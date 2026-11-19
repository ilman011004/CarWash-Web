import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Helper untuk mendapatkan data store_employee dari user saat ini
async function getEmployeeRecord(userId) {
  const { rows } = await pool.query('SELECT * FROM store_employees WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

// 1. Daftar Tugas Hari Ini
router.get('/tasks', requireAuth, requireRole('employee'), async (req, res) => {
  const emp = await getEmployeeRecord(req.user.id);
  if (!emp) return res.status(404).json({ message: 'Akun Anda belum terdaftar di toko manapun' });

  const query = `
    SELECT o.*, 
           v.brand as vehicle_brand, v.model as vehicle_model, v.plate_number, v.vehicle_type,
           p.name as package_name, p.is_waterless,
           u.name as customer_name, u.phone as customer_phone
    FROM order_assignments oa
    JOIN orders o ON oa.order_id = o.id
    JOIN packages p ON o.package_id = p.id
    JOIN customer_vehicles v ON o.vehicle_id = v.id
    JOIN users u ON o.customer_id = u.id
    WHERE oa.employee_id = $1 AND o.booking_date = CURRENT_DATE
    ORDER BY o.time_slot ASC
  `;

  const { rows } = await pool.query(query, [emp.id]);
  res.json({ tasks: rows });
});

// 2. Riwayat Pekerjaan Seluruhnya
router.get('/history', requireAuth, requireRole('employee'), async (req, res) => {
  const emp = await getEmployeeRecord(req.user.id);
  if (!emp) return res.status(404).json({ message: 'Akun Anda belum terdaftar di toko manapun' });

  const query = `
    SELECT o.*, 
           v.brand as vehicle_brand, v.plate_number,
           p.name as package_name,
           u.name as customer_name
    FROM order_assignments oa
    JOIN orders o ON oa.order_id = o.id
    JOIN packages p ON o.package_id = p.id
    JOIN customer_vehicles v ON o.vehicle_id = v.id
    JOIN users u ON o.customer_id = u.id
    WHERE oa.employee_id = $1
    ORDER BY o.booking_date DESC, o.id DESC
  `;

  const { rows } = await pool.query(query, [emp.id]);
  res.json({ history: rows });
});

// 3. Update Status Tugas (on_the_way -> in_progress -> completed)
router.patch('/tasks/:orderId/status', requireAuth, requireRole('employee'), async (req, res) => {
  const emp = await getEmployeeRecord(req.user.id);
  if (!emp) return res.status(404).json({ message: 'Akun belum terdaftar' });

  const { status } = req.body;
  const orderId = req.params.orderId;

  // Validasi transisi status yang sah untuk pegawai
  const allowed = ['on_the_way', 'in_progress', 'completed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: 'Status tidak valid' });
  }

  // Verifikasi pegawai memang bertugas di pesanan ini
  const { rows: check } = await pool.query(
    'SELECT * FROM order_assignments WHERE order_id = $1 AND employee_id = $2',
    [orderId, emp.id]
  );
  if (!check[0]) return res.status(403).json({ message: 'Anda tidak ditugaskan pada pesanan ini' });

  let completedClause = '';
  if (status === 'completed') {
    completedClause = ', completed_at = NOW()';
  }

  const { rows: updated } = await pool.query(
    `UPDATE orders SET order_status = $1 ${completedClause}, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, orderId]
  );

  res.json({ message: `Status pesanan berhasil diubah menjadi ${status}`, order: updated[0] });
});

// 4. Unggah Foto Bukti Kondisi Sebelum & Sesudah Cuci
router.post(
  '/tasks/:orderId/upload-proof',
  requireAuth,
  requireRole('employee'),
  upload.single('photo'),
  async (req, res) => {
    const emp = await getEmployeeRecord(req.user.id);
    if (!emp) return res.status(404).json({ message: 'Akun belum terdaftar' });

    const orderId = req.params.orderId;
    const { photo_type } = req.body; // 'before' | 'after'

    if (!['before', 'after'].includes(photo_type)) {
      return res.status(400).json({ message: 'Tipe foto harus "before" atau "after"' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'File gambar wajib diunggah' });
    }

    const photoUrl = `/uploads/${req.file.filename}`;

    const { rows } = await pool.query(
      `INSERT INTO order_proof_photos (order_id, uploaded_by_employee_id, photo_type, photo_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [orderId, emp.id, photo_type, photoUrl]
    );

    res.status(201).json({
      message: `Foto ${photo_type} cuci berhasil diunggah`,
      proof: rows[0],
    });
  }
);

export default router;
