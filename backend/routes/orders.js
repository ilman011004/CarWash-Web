import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { calculateDistance } from '../utils/geo.js';
import { upload } from '../middleware/upload.js';
import { z } from 'zod';

const router = Router();

// Helper generate Order Code (misal: CW-20261119-XXXX)
function generateOrderCode() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CW-${dateStr}-${randomStr}`;
}

// 1. Checkout & Buat Pesanan Baru (Pelanggan)
const createOrderSchema = z.object({
  store_id: z.number(),
  vehicle_id: z.number(),
  package_id: z.number(),
  service_method: z.enum(['home_service', 'pickup_delivery', 'self_service']),
  service_address: z.string().min(5),
  service_latitude: z.number(),
  service_longitude: z.number(),
  has_water_source: z.boolean().default(true),
  customer_notes: z.string().optional(),
  booking_date: z.string(), // YYYY-MM-DD
  time_slot: z.string(),    // e.g. "08:00 - 10:00"
});

router.post('/', requireAuth, requireRole('customer'), async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: z.flattenError(parsed.error).fieldErrors });
  }

  const {
    store_id,
    vehicle_id,
    package_id,
    service_method,
    service_address,
    service_latitude,
    service_longitude,
    has_water_source,
    customer_notes,
    booking_date,
    time_slot,
  } = parsed.data;

  try {
    // 1. Validasi Toko & Lokasi
    const { rows: storeRows } = await pool.query('SELECT * FROM stores WHERE id = $1 AND is_active = true', [store_id]);
    if (!storeRows[0]) return res.status(404).json({ message: 'Toko tidak ditemukan atau sedang nonaktif' });
    const store = storeRows[0];

    // Cek jarak untuk home_service dan pickup_delivery
    const distanceKm = calculateDistance(
      service_latitude,
      service_longitude,
      parseFloat(store.latitude),
      parseFloat(store.longitude)
    );

    if (service_method !== 'self_service' && distanceKm > parseFloat(store.max_service_distance_km)) {
      return res.status(400).json({
        message: `Lokasi Anda (${distanceKm} km) melebihi batas jangkauan toko (${store.max_service_distance_km} km)`,
      });
    }

    // 2. Ambil data kendaraan & paket untuk perhitungan harga
    const { rows: vehicleRows } = await pool.query(
      'SELECT * FROM customer_vehicles WHERE id = $1 AND user_id = $2',
      [vehicle_id, req.user.id]
    );
    if (!vehicleRows[0]) return res.status(404).json({ message: 'Kendaraan tidak ditemukan' });
    const vehicle = vehicleRows[0];

    const { rows: pkgRows } = await pool.query('SELECT * FROM packages WHERE id = $1 AND store_id = $2', [
      package_id,
      store_id,
    ]);
    if (!pkgRows[0]) return res.status(404).json({ message: 'Paket tidak ditemukan' });
    const pkg = pkgRows[0];

    // Tentukan harga paket berdasarkan mobil vs motor
    const packagePrice =
      vehicle.vehicle_type === 'mobil' ? parseFloat(pkg.price_car) : parseFloat(pkg.price_motorcycle);

    // Hitung ongkir
    let deliveryFee = 0;
    if (service_method !== 'self_service') {
      deliveryFee = Math.round(distanceKm * parseFloat(store.delivery_fee_per_km));
    }

    // Ambil setting komisi (prioritaskan custom_commission_rate toko, jika null ambil default sistem 10%)
    let commissionRate = 10.0;
    if (store.custom_commission_rate !== null) {
      commissionRate = parseFloat(store.custom_commission_rate);
    } else {
      const { rows: settingRows } = await pool.query(
        "SELECT value FROM system_settings WHERE key = 'default_commission_rate'"
      );
      if (settingRows[0]) commissionRate = parseFloat(settingRows[0].value);
    }

    // Hitung bagi hasil
    // Komisi hanya dipotong dari harga paket (ongkos datang 100% untuk toko)
    const platformFee = Math.round(packagePrice * (commissionRate / 100));
    const storeEarnings = Math.round(packagePrice - platformFee + deliveryFee);
    const totalAmount = Math.round(packagePrice + deliveryFee);

    const orderCode = generateOrderCode();

    const insertQuery = `
      INSERT INTO orders (
        order_code, customer_id, store_id, vehicle_id, package_id,
        service_method, service_address, service_latitude, service_longitude, distance_km,
        has_water_source, customer_notes, booking_date, time_slot,
        order_status, payment_status, package_price, delivery_fee, commission_rate,
        platform_fee, store_earnings, total_amount
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        'waiting_payment', 'pending', $15, $16, $17,
        $18, $19, $20
      ) RETURNING *
    `;

    const { rows: orderRows } = await pool.query(insertQuery, [
      orderCode,
      req.user.id,
      store_id,
      vehicle_id,
      package_id,
      service_method,
      service_address,
      service_latitude,
      service_longitude,
      distanceKm,
      has_water_source,
      customer_notes || null,
      booking_date,
      time_slot,
      packagePrice,
      deliveryFee,
      commissionRate,
      platformFee,
      storeEarnings,
      totalAmount,
    ]);

    res.status(201).json({
      message: 'Pesanan berhasil dibuat. Silakan lakukan pembayaran.',
      order: orderRows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal membuat pesanan' });
  }
});

// 2. Simulasi Pembayaran / Mock Webhook Bayar (QRIS, E-Wallet, Transfer)
router.post('/:id/pay', requireAuth, async (req, res) => {
  const { payment_method } = req.body;
  const orderId = req.params.id;

  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!rows[0]) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });

  // Update ke waiting_store_confirmation
  const { rows: updated } = await pool.query(
    `UPDATE orders 
     SET payment_status = 'paid', 
         order_status = 'waiting_store_confirmation', 
         payment_method = $1, 
         payment_transaction_id = $2,
         updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [payment_method || 'QRIS', `TRX-${Date.now()}`, orderId]
  );

  res.json({ message: 'Pembayaran berhasil dikonfirmasi!', order: updated[0] });
});

// 3. Lihat Riwayat & Detail Pesanan
router.get('/', requireAuth, async (req, res) => {
  const { role, id: userId } = req.user;
  let query = '';
  let params = [];

  if (role === 'customer') {
    query = `
      SELECT o.*, s.name as store_name, s.phone as store_phone, p.name as package_name, v.brand as vehicle_brand, v.plate_number
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      JOIN packages p ON o.package_id = p.id
      JOIN customer_vehicles v ON o.vehicle_id = v.id
      WHERE o.customer_id = $1
      ORDER BY o.id DESC
    `;
    params = [userId];
  } else if (role === 'owner') {
    query = `
      SELECT o.*, u.name as customer_name, u.phone as customer_phone, p.name as package_name, v.brand as vehicle_brand, v.plate_number
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      JOIN users u ON o.customer_id = u.id
      JOIN packages p ON o.package_id = p.id
      JOIN customer_vehicles v ON o.vehicle_id = v.id
      WHERE s.owner_id = $1
      ORDER BY o.id DESC
    `;
    params = [userId];
  } else {
    // Admin
    query = `
      SELECT o.*, s.name as store_name, u.name as customer_name, p.name as package_name
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      JOIN users u ON o.customer_id = u.id
      JOIN packages p ON o.package_id = p.id
      ORDER BY o.id DESC
    `;
  }

  const { rows } = await pool.query(query, params);
  res.json({ orders: rows });
});

// Detail 1 Pesanan beserta foto before/after & pegawai yang bertugas
router.get('/:id', requireAuth, async (req, res) => {
  const orderId = req.params.id;

  const orderQuery = `
    SELECT o.*, 
           s.name as store_name, s.phone as store_phone, s.address_text as store_address,
           u.name as customer_name, u.phone as customer_phone,
           p.name as package_name, p.is_waterless,
           v.brand as vehicle_brand, v.model as vehicle_model, v.plate_number, v.vehicle_type
    FROM orders o
    JOIN stores s ON o.store_id = s.id
    JOIN users u ON o.customer_id = u.id
    JOIN packages p ON o.package_id = p.id
    JOIN customer_vehicles v ON o.vehicle_id = v.id
    WHERE o.id = $1
  `;
  const { rows: orderRows } = await pool.query(orderQuery, [orderId]);
  if (!orderRows[0]) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });

  // Ambil pegawai yang ditugaskan
  const { rows: assignedEmployees } = await pool.query(
    `SELECT e.id as employee_id, u.name, u.phone, u.avatar_url
     FROM order_assignments oa
     JOIN store_employees e ON oa.employee_id = e.id
     JOIN users u ON e.user_id = u.id
     WHERE oa.order_id = $1`,
    [orderId]
  );

  // Ambil foto before & after
  const { rows: proofPhotos } = await pool.query(
    'SELECT * FROM order_proof_photos WHERE order_id = $1 ORDER BY created_at ASC',
    [orderId]
  );

  res.json({
    order: orderRows[0],
    assigned_employees: assignedEmployees,
    proof_photos: proofPhotos,
  });
});

// 4. Pelanggan Konfirmasi Selesai
router.post('/:id/confirm-completion', requireAuth, requireRole('customer'), async (req, res) => {
  const orderId = req.params.id;
  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1 AND customer_id = $2', [
    orderId,
    req.user.id,
  ]);
  if (!rows[0]) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
  const order = rows[0];

  if (order.order_status !== 'completed') {
    return res.status(400).json({ message: 'Pesanan belum berstatus completed' });
  }

  // Update status jadi confirmed_by_customer dan tambahkan saldo toko
  await pool.query(
    `UPDATE orders 
     SET order_status = 'confirmed_by_customer', updated_at = NOW() 
     WHERE id = $1`,
    [orderId]
  );

  await pool.query(
    'UPDATE stores SET balance = balance + $1 WHERE id = $2',
    [order.store_earnings, order.store_id]
  );

  res.json({ message: 'Terima kasih telah mengonfirmasi pesanan selesai! Saldo telah diteruskan ke toko.' });
});

// 5. Batalkan atau Jadwal Ulang (Gratis jika hujan)
router.post('/:id/reschedule', requireAuth, requireRole('customer'), async (req, res) => {
  const { new_date, new_time_slot, is_rain } = req.body;
  const orderId = req.params.id;

  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1 AND customer_id = $2', [
    orderId,
    req.user.id,
  ]);
  if (!rows[0]) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });

  // Update tanggal & slot
  const { rows: updated } = await pool.query(
    `UPDATE orders 
     SET booking_date = $1, 
         time_slot = $2, 
         order_status = 'rescheduled',
         is_rain_rescheduled = $3,
         rescheduled_reason = $4,
         updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [new_date, new_time_slot, !!is_rain, is_rain ? 'Dijadwal ulang karena hujan' : 'Jadwal ulang pelanggan', orderId]
  );

  res.json({
    message: is_rain ? 'Jadwal ulang gratis karena faktor cuaca hujan berhasil.' : 'Jadwal ulang berhasil diajukan.',
    order: updated[0],
  });
});

// 6. Batalkan Pesanan & Refund Penuh jika sebelum pegawai ditugaskan
router.post('/:id/cancel', requireAuth, requireRole('customer'), async (req, res) => {
  const orderId = req.params.id;
  const { reason } = req.body;

  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1 AND customer_id = $2', [
    orderId,
    req.user.id,
  ]);
  if (!rows[0]) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
  const order = rows[0];

  const eligibleForFullRefund =
    order.order_status === 'waiting_payment' || order.order_status === 'waiting_store_confirmation';

  let newPaymentStatus = order.payment_status;
  if (order.payment_status === 'paid' && eligibleForFullRefund) {
    newPaymentStatus = 'refunded';
  }

  const { rows: updated } = await pool.query(
    `UPDATE orders 
     SET order_status = 'cancelled', 
         payment_status = $1,
         customer_notes = COALESCE(customer_notes, '') || ' [Dibatalkan: ' || $2 || ']',
         updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [newPaymentStatus, reason || 'Dibatalkan oleh pelanggan', orderId]
  );

  res.json({
    message: eligibleForFullRefund
      ? 'Pesanan berhasil dibatalkan dan dana dikembalikan penuh (refund).'
      : 'Pesanan dibatalkan.',
    order: updated[0],
  });
});

// 7. Berikan Ulasan & Rating
router.post('/:id/review', requireAuth, requireRole('customer'), async (req, res) => {
  const { rating, comment } = req.body;
  const orderId = req.params.id;

  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1 AND customer_id = $2', [
    orderId,
    req.user.id,
  ]);
  if (!rows[0]) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
  const order = rows[0];

  const { rows: reviewRows } = await pool.query(
    `INSERT INTO reviews (order_id, store_id, customer_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (order_id) DO UPDATE SET rating = $4, comment = $5
     RETURNING *`,
    [orderId, order.store_id, req.user.id, rating, comment || '']
  );

  res.json({ message: 'Terima kasih atas ulasan Anda!', review: reviewRows[0] });
});

export default router;
