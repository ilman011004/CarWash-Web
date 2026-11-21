import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { calculateDistance } from '../utils/geo.js';

const router = Router();

// 1. Pegawai Update Posisi GPS Realtime
router.post('/orders/:orderId/location', requireAuth, requireRole('employee'), async (req, res) => {
  const orderId = req.params.orderId;
  const { latitude, longitude, heading } = req.body;

  if (latitude == null || longitude == null) {
    return res.status(400).json({ message: 'Koordinat latitude dan longitude wajib dikirim' });
  }

  // Cek apakah pegawai ditugaskan & status pesanan aktif (on_the_way atau in_progress)
  const { rows: orderRows } = await pool.query(
    `SELECT o.id, o.order_status, o.service_latitude, o.service_longitude,
            oa.employee_id, se.user_id, u.name as employee_name, u.avatar_url
     FROM orders o
     JOIN order_assignments oa ON o.id = oa.order_id
     JOIN store_employees se ON oa.employee_id = se.id
     JOIN users u ON se.user_id = u.id
    WHERE o.id = $1 AND se.user_id = $2 AND oa.response_status = 'accepted'`,
    [orderId, req.user.id]
  );

  if (!orderRows[0]) {
    return res.status(403).json({ message: 'Anda tidak ditugaskan pada pesanan ini' });
  }

  const order = orderRows[0];
  const activeStatuses = ['on_the_way', 'in_progress'];
  if (!activeStatuses.includes(order.order_status)) {
    return res.status(400).json({
      message: 'Pelacakan GPS hanya aktif saat menuju lokasi atau sedang cuci.',
      tracking_active: false,
    });
  }

  // Simpan/update posisi terakhir
  const { rows: locRows } = await pool.query(
    `INSERT INTO employee_live_locations (order_id, employee_id, latitude, longitude, heading, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (order_id, employee_id) 
     DO UPDATE SET latitude = $3, longitude = $4, heading = $5, updated_at = NOW()
     RETURNING *`,
    [orderId, order.employee_id, latitude, longitude, heading || null]
  );

  // Hitung jarak ke lokasi pelanggan dan perkiraan waktu tiba (asumsi rata-rata kecepatan motor/mobil 25 km/jam)
  const distanceRemainingKm = calculateDistance(
    latitude,
    longitude,
    parseFloat(order.service_latitude),
    parseFloat(order.service_longitude)
  );
  const estimatedMinutes = Math.max(1, Math.round((distanceRemainingKm / 25) * 60));

  const payload = {
    order_id: parseInt(orderId, 10),
    employee_id: order.employee_id,
    employee_name: order.employee_name,
    employee_avatar: order.avatar_url,
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    heading: heading || 0,
    distance_remaining_km: distanceRemainingKm,
    estimated_arrival_minutes: estimatedMinutes,
    updated_at: new Date().toISOString(),
  };

  // Broadcast realtime via Socket.io ke room order
  const io = req.app.get('io');
  if (io) {
    io.to(`order_${orderId}`).emit('employee_location_update', payload);
  }

  res.json({
    message: 'Lokasi diperbarui',
    location: payload,
  });
});

// 2. Dapatkan Lokasi Terakhir Pegawai untuk Order (Pelanggan & Pemilik Toko)
router.get('/orders/:orderId/location', requireAuth, async (req, res) => {
  const orderId = req.params.orderId;

  // Cek pesanan
  const { rows: orderRows } = await pool.query(
    `SELECT o.id, o.order_status, o.customer_id, o.service_latitude, o.service_longitude, s.owner_id
     FROM orders o
     JOIN stores s ON o.store_id = s.id
     WHERE o.id = $1`,
    [orderId]
  );
  if (!orderRows[0]) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });

  const order = orderRows[0];

  // Pastikan yang mengakses adalah pelanggan bersangkutan, pemilik toko, pegawai, atau admin
  const isCustomer = order.customer_id === req.user.id;
  const isOwner = order.owner_id === req.user.id;
  const isAdmin = req.user.role === 'admin';
  const isEmployee = req.user.role === 'employee';

  if (!isCustomer && !isOwner && !isAdmin && !isEmployee) {
    return res.status(403).json({ message: 'Tidak memiliki izin akses pelacakan lokasi ini' });
  }

  // Jika pesanan sudah selesai / batal, pelacakan otomatis tidak aktif (menjaga privasi)
  const trackingActive = ['on_the_way', 'in_progress'].includes(order.order_status);

  if (!trackingActive) {
    return res.json({
      tracking_active: false,
      message: 'Pelacakan GPS tidak aktif untuk status pesanan saat ini.',
      locations: [],
    });
  }

  const { rows: locations } = await pool.query(
    `SELECT el.*, u.name as employee_name, u.avatar_url
     FROM employee_live_locations el
     JOIN store_employees se ON el.employee_id = se.id
     JOIN users u ON se.user_id = u.id
     WHERE el.order_id = $1`,
    [orderId]
  );

  const locationsWithEta = locations.map((loc) => {
    const dist = calculateDistance(
      parseFloat(loc.latitude),
      parseFloat(loc.longitude),
      parseFloat(order.service_latitude),
      parseFloat(order.service_longitude)
    );
    const eta = Math.max(1, Math.round((dist / 25) * 60));
    return {
      ...loc,
      latitude: parseFloat(loc.latitude),
      longitude: parseFloat(loc.longitude),
      distance_remaining_km: dist,
      estimated_arrival_minutes: eta,
    };
  });

  res.json({
    tracking_active: true,
    destination: {
      latitude: parseFloat(order.service_latitude),
      longitude: parseFloat(order.service_longitude),
    },
    locations: locationsWithEta,
  });
});

export default router;
