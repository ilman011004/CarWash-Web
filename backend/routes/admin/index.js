import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../../db.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

const router = Router();

// Semua rute di file ini butuh role admin
router.use(requireAuth, requireRole('admin'));

// 1. Verifikasi, Nonaktifkan & Daftar Toko beserta Email Pemilik
router.get('/stores', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT s.*, 
           u.id as owner_user_id,
           u.name as owner_name, 
           u.email as owner_email, 
           u.phone as owner_phone,
           (SELECT COUNT(*) FROM packages WHERE store_id = s.id) as total_packages,
           (SELECT COUNT(*) FROM store_employees WHERE store_id = s.id) as total_employees
    FROM stores s
    JOIN users u ON s.owner_id = u.id
    ORDER BY s.id DESC
  `);
  res.json({ stores: rows });
});

// Admin Reset / Ganti Password Pemilik Toko
router.patch('/owners/:userId/reset-password', async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ message: 'Password baru minimal 6 karakter' });
  }

  const hash = await bcrypt.hash(new_password, 10);
  const { rows } = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2 AND role = $3 RETURNING id, name, email',
    [hash, req.params.userId, 'owner']
  );

  if (!rows[0]) {
    return res.status(404).json({ message: 'Pemilik toko tidak ditemukan' });
  }

  res.json({
    message: `Password pemilik toko ${rows[0].email} berhasil direset!`,
    user: rows[0],
  });
});

router.patch('/stores/:id/status', async (req, res) => {
  const { is_verified, is_active } = req.body;
  const { rows } = await pool.query(
    `UPDATE stores 
     SET is_verified = COALESCE($1, is_verified),
         is_active = COALESCE($2, is_active),
         updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [is_verified, is_active, req.params.id]
  );
  res.json({ message: 'Status toko berhasil diperbarui', store: rows[0] });
});

// 2. Atur Komisi Default & Komisi Khusus Toko
router.patch('/stores/:id/commission', async (req, res) => {
  const { custom_commission_rate } = req.body;
  const { rows } = await pool.query(
    'UPDATE stores SET custom_commission_rate = $1 WHERE id = $2 RETURNING *',
    [custom_commission_rate, req.params.id]
  );
  res.json({ message: 'Komisi khusus toko berhasil diatur', store: rows[0] });
});

router.get('/settings', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM system_settings');
  res.json({ settings: rows });
});

router.put('/settings', async (req, res) => {
  const { key, value } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2 RETURNING *`,
    [key, value]
  );
  res.json({ message: 'Pengaturan sistem berhasil disimpan', setting: rows[0] });
});

// 3. Proses Penarikan Saldo Toko (Withdrawal)
router.get('/withdrawals', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT w.*, s.name as store_name, u.name as owner_name, u.email as owner_email
    FROM withdrawals w
    JOIN stores s ON w.store_id = s.id
    JOIN users u ON s.owner_id = u.id
    ORDER BY w.id DESC
  `);
  res.json({ withdrawals: rows });
});

router.patch('/withdrawals/:id', async (req, res) => {
  const { status, admin_notes } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid' });
  }

  const { rows: wRows } = await pool.query('SELECT * FROM withdrawals WHERE id = $1', [req.params.id]);
  if (!wRows[0]) return res.status(404).json({ message: 'Pengajuan tidak ditemukan' });
  const withdrawal = wRows[0];

  if (status === 'rejected' && withdrawal.status === 'pending') {
    await pool.query('UPDATE stores SET balance = balance + $1 WHERE id = $2', [
      withdrawal.amount,
      withdrawal.store_id,
    ]);
  }

  const { rows } = await pool.query(
    `UPDATE withdrawals 
     SET status = $1, admin_notes = $2, processed_by_admin_id = $3, processed_at = NOW()
     WHERE id = $4 RETURNING *`,
    [status, admin_notes || null, req.user.id, req.params.id]
  );

  res.json({ message: `Penarikan saldo ${status}`, withdrawal: rows[0] });
});

// 4. Komplain & Refund
router.get('/complaints', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT c.*, o.order_code, o.total_amount, u.name as customer_name, s.name as store_name
    FROM complaints c
    JOIN orders o ON c.order_id = o.id
    JOIN users u ON c.customer_id = u.id
    JOIN stores s ON o.store_id = s.id
    ORDER BY c.id DESC
  `);
  res.json({ complaints: rows });
});

router.patch('/complaints/:id/resolve', async (req, res) => {
  const { status, refund_amount, admin_notes } = req.body;

  const { rows: cRows } = await pool.query('SELECT * FROM complaints WHERE id = $1', [req.params.id]);
  if (!cRows[0]) return res.status(404).json({ message: 'Komplain tidak ditemukan' });
  const complaint = cRows[0];

  if (status === 'refunded' && parseFloat(refund_amount) > 0) {
    await pool.query("UPDATE orders SET payment_status = 'refunded', order_status = 'refunded' WHERE id = $1", [
      complaint.order_id,
    ]);
  }

  const { rows } = await pool.query(
    `UPDATE complaints 
     SET status = $1, refund_amount = COALESCE($2, refund_amount), admin_notes = $3, resolved_by_admin_id = $4, resolved_at = NOW()
     WHERE id = $5 RETURNING *`,
    [status, refund_amount || 0, admin_notes || null, req.user.id, req.params.id]
  );

  res.json({ message: 'Komplain berhasil diselesaikan', complaint: rows[0] });
});

// 5. Laporan Platform: Pendapatan, Jumlah Pesanan, Toko Teratas
router.get('/reports/dashboard', async (req, res) => {
  const { rows: stats } = await pool.query(`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(total_amount), 0) as total_gross_gmv,
      COALESCE(SUM(platform_fee), 0) as total_platform_revenue
    FROM orders
    WHERE payment_status = 'paid'
  `);

  const { rows: topStores } = await pool.query(`
    SELECT s.id, s.name, COUNT(o.id) as total_orders, COALESCE(AVG(r.rating), 0) as avg_rating
    FROM stores s
    LEFT JOIN orders o ON s.id = o.store_id AND o.payment_status = 'paid'
    LEFT JOIN reviews r ON s.id = r.store_id
    GROUP BY s.id
    ORDER BY total_orders DESC, avg_rating DESC
    LIMIT 5
  `);

  res.json({
    summary: stats[0],
    top_stores: topStores,
  });
});

export default router;
