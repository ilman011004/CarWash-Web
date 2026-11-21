import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { findEmployeeConflicts } from '../utils/scheduling.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Ambil toko milik owner yang sedang login
// Ambil toko milik owner. Jika storeId diberikan, ambil toko itu (dan pastikan milik owner);
// jika tidak, pakai toko pertama. Owner boleh punya lebih dari satu toko.
async function getOwnerStore(userId, storeId) {
  if (storeId) {
    const { rows } = await pool.query('SELECT * FROM stores WHERE owner_id = $1 AND id = $2', [userId, storeId]);
    return rows[0] || null;
  }
  const { rows } = await pool.query('SELECT * FROM stores WHERE owner_id = $1 ORDER BY id ASC LIMIT 1', [userId]);
  return rows[0] || null;
}

// Toko yang dipilih di dashboard dikirim lewat ?store_id= atau body.store_id
const pickStoreId = (req) => {
  const v = Number(req.query?.store_id ?? req.body?.store_id);
  return Number.isInteger(v) && v > 0 ? v : undefined;
};

// 1. Profil toko milik owner
router.get('/my-store', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const store = await getOwnerStore(req.user.id, pickStoreId(req));
    if (!store) return res.status(404).json({ message: 'Anda belum mendaftarkan toko' });

    const { rows: packages } = await pool.query('SELECT * FROM packages WHERE store_id = $1', [store.id]);
    const { rows: schedules } = await pool.query(
      'SELECT * FROM store_schedules WHERE store_id = $1 ORDER BY day_of_week',
      [store.id]
    );
    const { rows: methods } = await pool.query('SELECT * FROM store_service_methods WHERE store_id = $1', [store.id]);
    const { rows: employees } = await pool.query(
      `SELECT se.id AS store_employee_id, se.status, se.notes,
              u.id AS user_id, u.name, u.email, u.phone, u.avatar_url
       FROM store_employees se
       JOIN users u ON se.user_id = u.id
       WHERE se.store_id = $1
       ORDER BY se.id ASC`,
      [store.id]
    );

    const { rows: stores } = await pool.query(
      'SELECT id, name FROM stores WHERE owner_id = $1 ORDER BY id ASC',
      [req.user.id]
    );

    res.json({ store, stores, packages, schedules, methods, employees });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data toko' });
  }
});

// 2. Update pengaturan toko
router.put('/settings', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const store = await getOwnerStore(req.user.id, pickStoreId(req));
    if (!store) return res.status(404).json({ message: 'Toko tidak ditemukan' });

    const { max_service_distance_km, delivery_fee_per_km, name, phone, address_text } = req.body;
    const { rows } = await pool.query(
      `UPDATE stores
       SET max_service_distance_km = COALESCE($1, max_service_distance_km),
           delivery_fee_per_km = COALESCE($2, delivery_fee_per_km),
           name = COALESCE($3, name),
           phone = COALESCE($4, phone),
           address_text = COALESCE($5, address_text),
           updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [max_service_distance_km, delivery_fee_per_km, name, phone, address_text, store.id]
    );
    res.json({ message: 'Pengaturan toko berhasil diperbarui', store: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui pengaturan toko' });
  }
});

// 3. Metode layanan
router.post('/service-methods', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const store = await getOwnerStore(req.user.id, pickStoreId(req));
    if (!store) return res.status(404).json({ message: 'Toko tidak ditemukan' });

    const { method, is_enabled } = req.body;
    await pool.query(
      `INSERT INTO store_service_methods (store_id, method, is_enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (store_id, method) DO UPDATE SET is_enabled = $3`,
      [store.id, method, is_enabled]
    );
    res.json({ message: `Metode ${method} diperbarui` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui metode layanan' });
  }
});

// 4. Paket cuci
router.post('/packages', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const store = await getOwnerStore(req.user.id, pickStoreId(req));
    if (!store) return res.status(404).json({ message: 'Toko tidak ditemukan' });

    const { name, description, is_waterless, price_car, price_motorcycle, estimated_duration_minutes } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO packages (store_id, name, description, is_waterless, price_car, price_motorcycle, estimated_duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [store.id, name, description, !!is_waterless, price_car, price_motorcycle, estimated_duration_minutes || 60]
    );
    res.status(201).json({ message: 'Paket berhasil ditambahkan', package: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menambah paket' });
  }
});

router.put('/packages/:id', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const store = await getOwnerStore(req.user.id, pickStoreId(req));
    if (!store) return res.status(404).json({ message: 'Toko tidak ditemukan' });

    const { name, description, is_waterless, price_car, price_motorcycle, is_active } = req.body;
    const { rows } = await pool.query(
      `UPDATE packages
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           is_waterless = COALESCE($3, is_waterless),
           price_car = COALESCE($4, price_car),
           price_motorcycle = COALESCE($5, price_motorcycle),
           is_active = COALESCE($6, is_active)
       WHERE id = $7 AND store_id = $8 RETURNING *`,
      [name, description, is_waterless, price_car, price_motorcycle, is_active, req.params.id, store.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Paket tidak ditemukan' });
    res.json({ message: 'Paket berhasil diubah', package: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengubah paket' });
  }
});

// 5a. Pemilik MEMBUATKAN akun pegawai baru (langsung terhubung ke toko)
router.post('/employees/create', requireAuth, requireRole('owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    const store = await getOwnerStore(req.user.id, pickStoreId(req));
    if (!store) return res.status(404).json({ message: 'Toko tidak ditemukan' });

    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const notes = String(req.body.notes || '').trim() || null;
    const password = String(req.body.password || '');

    if (name.length < 2) return res.status(400).json({ message: 'Nama minimal 2 karakter' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Format email tidak valid' });
    if (phone && phone.length < 8) return res.status(400).json({ message: 'Nomor telepon minimal 8 digit' });
    if (password.length < 8) return res.status(400).json({ message: 'Password minimal 8 karakter' });

    const { rows: exist } = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exist[0]) {
      return res.status(409).json({
        message: 'Email sudah terdaftar. Gunakan opsi "Tautkan akun yang sudah ada".',
      });
    }

    const hash = await bcrypt.hash(password, 10);

    await client.query('BEGIN');
    const { rows: u } = await client.query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'employee')
       RETURNING id`,
      [name, email, phone || null, hash]
    );
    const { rows: se } = await client.query(
      `INSERT INTO store_employees (store_id, user_id, notes)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [store.id, u[0].id, notes]
    );
    await client.query('COMMIT');

    res.status(201).json({ message: 'Akun pegawai berhasil dibuat', employee: se[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    if (err.code === '23505') return res.status(409).json({ message: 'Email sudah terdaftar' });
    console.error(err);
    res.status(500).json({ message: 'Gagal membuat akun pegawai' });
  } finally {
    client.release();
  }
});

// 5b. Pemilik MENAUTKAN akun yang sudah ada ke tokonya (lewat email)
router.post('/employees', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const store = await getOwnerStore(req.user.id, pickStoreId(req));
    if (!store) return res.status(404).json({ message: 'Toko tidak ditemukan' });

    const email = String(req.body.email || '').trim().toLowerCase();
    const notes = req.body.notes || null;
    if (!email) return res.status(400).json({ message: 'Email pegawai wajib diisi' });

    const { rows: userRows } = await pool.query('SELECT id, role FROM users WHERE email = $1', [email]);
    const employeeUser = userRows[0];
    if (!employeeUser) {
      return res.status(404).json({ message: 'Email tidak ditemukan. Gunakan opsi "Buat akun baru".' });
    }

    // Jangan ubah role akun pemilik / admin
    if (['owner', 'admin'].includes(employeeUser.role)) {
      return res.status(400).json({ message: 'Akun dengan role owner/admin tidak bisa dijadikan pegawai.' });
    }

    if (employeeUser.role !== 'employee') {
      await pool.query("UPDATE users SET role = 'employee' WHERE id = $1", [employeeUser.id]);
    }

    const { rows } = await pool.query(
      `INSERT INTO store_employees (store_id, user_id, notes)
       VALUES ($1, $2, $3)
       ON CONFLICT (store_id, user_id) DO UPDATE SET status = 'available', notes = $3
       RETURNING *`,
      [store.id, employeeUser.id, notes]
    );
    res.status(201).json({ message: 'Pegawai berhasil ditambahkan ke toko', employee: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menambahkan pegawai' });
  }
});

// ---- Penugasan pegawai ----------------------------------------------------------

// Pesan ramah untuk bentrok jadwal.
const conflictMessage = (conflicts) =>
  'Jadwal bentrok: ' +
  Object.values(conflicts)
    .map((c) => `${c.employee_name} sudah bertugas di #${c.order_code} (${c.time_slot})`)
    .join('; ') +
  '.';

// Kunci baris pegawai (termasuk keanggotaan toko lain dari akun yang sama), lalu cek bentrok.
// Kunci diurutkan berdasarkan id agar dua penugasan bersamaan tidak saling deadlock. Penugasan
// kedua menunggu yang pertama selesai lalu melihat hasilnya, jadi tidak mungkin ada pegawai yang dobel.
async function lockAndCheckConflicts(client, orderId, employeeIds) {
  if (employeeIds.length === 0) return {};
  await client.query(
    `SELECT se.id FROM store_employees se
     WHERE se.user_id IN (SELECT user_id FROM store_employees WHERE id = ANY($1::int[]))
     ORDER BY se.id
     FOR UPDATE`,
    [employeeIds]
  );
  return findEmployeeConflicts(client, { orderId, employeeIds });
}

const parseEmployeeIds = (body) =>
  [...new Set((body.employee_ids || []).map(Number))].filter(Number.isInteger);

// Ambil pesanan milik owner ini (lewat pemilik toko, bukan satu toko saja,
// supaya cocok dengan daftar pesanan di dashboard).
async function getOwnerOrder(db, orderId, ownerId) {
  const { rows } = await db.query(
    `SELECT o.* FROM orders o
     JOIN stores s ON s.id = o.store_id
     WHERE o.id = $1 AND s.owner_id = $2`,
    [orderId, ownerId]
  );
  return rows[0] || null;
}

// 6a. Terima pesanan & tugaskan pegawai (home service minimal 2).
// Pegawai yang dipilih harus bebas pada tanggal & jam tersebut. Penugasan dibuat 'pending' dan baru
// resmi setelah pegawai menerimanya di dashboard mereka.
router.post('/orders/:orderId/accept', requireAuth, requireRole('owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    const store = await getOwnerStore(req.user.id, pickStoreId(req));
    if (!store) return res.status(404).json({ message: 'Toko tidak ditemukan' });

    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId)) return res.status(400).json({ message: 'ID pesanan tidak valid' });

    const employeeIds = parseEmployeeIds(req.body);

    const order = await getOwnerOrder(client, orderId, req.user.id);
    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });

    if (order.order_status !== 'waiting_store_confirmation') {
      return res.status(400).json({ message: 'Pesanan ini tidak sedang menunggu konfirmasi toko.' });
    }

    const minEmployees = 2;
    if (order.service_method === 'home_service' && employeeIds.length < minEmployees) {
      return res.status(400).json({
        message: `Layanan Home Service memerlukan minimal ${minEmployees} pegawai yang ditugaskan.`,
      });
    }

    // Semua pegawai harus milik toko ini
    if (employeeIds.length > 0) {
      const { rows: valid } = await client.query(
        'SELECT id FROM store_employees WHERE store_id = $1 AND id = ANY($2::int[])',
        [order.store_id, employeeIds]
      );
      if (valid.length !== employeeIds.length) {
        return res.status(400).json({ message: 'Pegawai yang dipilih bukan pegawai toko pesanan ini. Pindah ke toko yang sesuai di dashboard, lalu coba lagi.' });
      }
    }

    await client.query('BEGIN');

    // Kunci pesanan & pastikan statusnya belum berubah (mis. akibat klik ganda)
    const { rows: locked } = await client.query('SELECT order_status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (locked[0].order_status !== 'waiting_store_confirmation') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Pesanan ini sudah diproses.' });
    }

    const conflicts = await lockAndCheckConflicts(client, orderId, employeeIds);
    if (Object.keys(conflicts).length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: conflictMessage(conflicts), conflicts });
    }

    await client.query('DELETE FROM order_assignments WHERE order_id = $1', [orderId]);
    for (const empId of employeeIds) {
      await client.query(
        `INSERT INTO order_assignments (order_id, employee_id, response_status)
         VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING`,
        [orderId, empId]
      );
    }
    const { rows: updatedOrder } = await client.query(
      `UPDATE orders SET order_status = 'assigned', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [orderId]
    );
    await client.query('COMMIT');

    res.json({
      message: 'Pesanan diterima. Menunggu konfirmasi dari pegawai yang ditugaskan.',
      order: updatedOrder[0],
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error(err);
    res.status(500).json({ message: 'Gagal menerima pesanan: ' + err.message });
  } finally {
    client.release();
  }
});

// 6c. Ganti / tambah pegawai pada pesanan yang sudah ditugaskan tetapi belum berangkat
// (misalnya ada pegawai yang menolak). Kirim daftar pegawai yang diinginkan secara lengkap.
// Pegawai yang sudah menerima tetap diterima; yang baru berstatus 'pending'; yang dihapus
// dari daftar atau yang pernah menolak dibuat ulang/dibersihkan.
router.post('/orders/:orderId/reassign', requireAuth, requireRole('owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId)) return res.status(400).json({ message: 'ID pesanan tidak valid' });

    const employeeIds = parseEmployeeIds(req.body);

    const order = await getOwnerOrder(client, orderId, req.user.id);
    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });

    if (order.order_status !== 'assigned') {
      return res.status(400).json({ message: 'Pegawai hanya bisa diganti sebelum pesanan berangkat.' });
    }

    const minEmployees = order.service_method === 'home_service' ? 2 : 1;
    if (employeeIds.length < minEmployees) {
      return res.status(400).json({ message: `Minimal ${minEmployees} pegawai harus ditugaskan untuk pesanan ini.` });
    }

    const { rows: valid } = await client.query(
      'SELECT id FROM store_employees WHERE store_id = $1 AND id = ANY($2::int[])',
      [order.store_id, employeeIds]
    );
    if (valid.length !== employeeIds.length) {
      return res.status(400).json({ message: 'Ada pegawai yang bukan pegawai toko pesanan ini.' });
    }

    await client.query('BEGIN');

    const { rows: locked } = await client.query('SELECT order_status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (locked[0].order_status !== 'assigned') {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'Pesanan sudah berangkat, pegawai tidak bisa diganti lagi.' });
    }

    const conflicts = await lockAndCheckConflicts(client, orderId, employeeIds);
    if (Object.keys(conflicts).length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: conflictMessage(conflicts), conflicts });
    }

    const { rows: current } = await client.query(
      'SELECT employee_id, response_status FROM order_assignments WHERE order_id = $1',
      [orderId]
    );
    const keep = new Set(
      current
        .filter((c) => employeeIds.includes(c.employee_id) && c.response_status !== 'declined')
        .map((c) => c.employee_id)
    );

    await client.query('DELETE FROM order_assignments WHERE order_id = $1 AND employee_id <> ALL($2::int[])', [
      orderId,
      [...keep],
    ]);
    for (const empId of employeeIds) {
      if (keep.has(empId)) continue;
      await client.query(
        `INSERT INTO order_assignments (order_id, employee_id, response_status)
         VALUES ($1, $2, 'pending') ON CONFLICT DO NOTHING`,
        [orderId, empId]
      );
    }
    await client.query('UPDATE orders SET updated_at = NOW() WHERE id = $1', [orderId]);
    await client.query('COMMIT');

    res.json({ message: 'Penugasan diperbarui. Pegawai baru perlu menerima tugas ini.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui penugasan: ' + err.message });
  } finally {
    client.release();
  }
});

// 6d. Ketersediaan tiap pegawai toko pada tanggal & jam pesanan ini (dipakai modal "Tugaskan Pegawai").
router.get('/orders/:orderId/availability', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId)) return res.status(400).json({ message: 'ID pesanan tidak valid' });

    const order = await getOwnerOrder(pool, orderId, req.user.id);
    if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });

    const { rows: emps } = await pool.query('SELECT id FROM store_employees WHERE store_id = $1', [order.store_id]);
    const conflicts = await findEmployeeConflicts(pool, { orderId, employeeIds: emps.map((e) => e.id) });

    res.json({
      availability: emps.map((e) => ({ store_employee_id: e.id, conflict: conflicts[e.id] || null })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memeriksa ketersediaan pegawai' });
  }
});

// 6b. Tolak pesanan
router.post('/orders/:orderId/reject', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const store = await getOwnerStore(req.user.id, pickStoreId(req));
    if (!store) return res.status(404).json({ message: 'Toko tidak ditemukan' });

    const { reason } = req.body;
    const { rows } = await pool.query(
      `UPDATE orders
       SET order_status = 'cancelled',
           payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END,
           customer_notes = COALESCE(customer_notes, '') || ' [Ditolak toko: ' || $1 || ']',
           updated_at = NOW()
       WHERE id = $2
         AND store_id IN (SELECT id FROM stores WHERE owner_id = $3)
         AND order_status = 'waiting_store_confirmation'
       RETURNING *`,
      [reason || 'Toko tidak dapat menerima pesanan saat ini', req.params.orderId, req.user.id]
    );
    if (!rows[0]) {
      return res.status(400).json({ message: 'Pesanan tidak ditemukan atau tidak bisa ditolak lagi.' });
    }

    res.json({ message: 'Pesanan ditolak dan dana pelanggan dikembalikan.', order: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menolak pesanan' });
  }
});

// 7. Balas ulasan
router.post('/reviews/:id/reply', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const store = await getOwnerStore(req.user.id, pickStoreId(req));
    if (!store) return res.status(404).json({ message: 'Toko tidak ditemukan' });

    const { reply } = req.body;
    const { rows } = await pool.query(
      `UPDATE reviews
       SET store_reply = $1, replied_at = NOW()
       WHERE id = $2 AND store_id = $3 RETURNING *`,
      [reply, req.params.id, store.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Ulasan tidak ditemukan' });
    res.json({ message: 'Balasan ulasan terkirim', review: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal membalas ulasan' });
  }
});

// 8a. Keuangan
router.get('/finance', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const store = await getOwnerStore(req.user.id, pickStoreId(req));
    if (!store) return res.status(404).json({ message: 'Toko tidak ditemukan' });

    const { rows: withdrawals } = await pool.query(
      'SELECT * FROM withdrawals WHERE store_id = $1 ORDER BY id DESC',
      [store.id]
    );

    res.json({ balance: parseFloat(store.balance), withdrawals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data keuangan' });
  }
});

// 8b. Ajukan penarikan saldo (atomik: saldo dikurangi hanya jika masih cukup)
router.post('/finance/withdraw', requireAuth, requireRole('owner'), async (req, res) => {
  const client = await pool.connect();
  try {
    const store = await getOwnerStore(req.user.id, pickStoreId(req));
    if (!store) return res.status(404).json({ message: 'Toko tidak ditemukan' });

    const { amount, bank_name, bank_account_number, bank_account_holder } = req.body;
    const withdrawAmount = parseFloat(amount);

    if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ message: 'Nominal penarikan tidak valid' });
    }

    await client.query('BEGIN');
    const { rows: upd } = await client.query(
      'UPDATE stores SET balance = balance - $1 WHERE id = $2 AND balance >= $1 RETURNING id',
      [withdrawAmount, store.id]
    );
    if (!upd[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Saldo tidak mencukupi' });
    }

    const { rows } = await client.query(
      `INSERT INTO withdrawals (store_id, amount, bank_name, bank_account_number, bank_account_holder, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [store.id, withdrawAmount, bank_name, bank_account_number, bank_account_holder]
    );
    await client.query('COMMIT');

    res.status(201).json({
      message: 'Pengajuan penarikan saldo berhasil dikirim. Menunggu verifikasi admin.',
      withdrawal: rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error(err);
    res.status(500).json({ message: 'Gagal mengajukan penarikan' });
  } finally {
    client.release();
  }
});

export default router;