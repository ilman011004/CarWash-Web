import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import fs from 'fs';
import { upload } from '../middleware/upload.js';

const router = Router();

// Helper untuk mendapatkan data store_employee dari user saat ini
async function getEmployeeRecord(userId) {
  const { rows } = await pool.query('SELECT * FROM store_employees WHERE user_id = $1 ORDER BY id ASC LIMIT 1', [userId]);
  return rows[0] || null;
}

// 1. Daftar Tugas: semua penugasan mendatang (sudah diterima maupun belum dijawab), diurutkan
// berdasarkan tanggal & jam. Pesanan yang sedang berjalan / menunggu konfirmasi pelanggan tetap
// tampil walau tanggalnya sudah lewat. Tugas yang ditolak tidak ditampilkan.
// my_response: 'pending' (menunggu jawaban pegawai) atau 'accepted'.
router.get('/tasks', requireAuth, requireRole('employee'), async (req, res) => {
  try {
    const emp = await getEmployeeRecord(req.user.id);
    if (!emp) return res.status(404).json({ message: 'Akun Anda belum terdaftar di toko manapun' });

    const query = `
      SELECT o.*, 
             v.brand as vehicle_brand, v.model as vehicle_model, v.plate_number, v.vehicle_type,
             p.name as package_name, p.is_waterless,
             u.name as customer_name, u.phone as customer_phone,
             oa.response_status AS my_response,
             (SELECT COUNT(*)::int FROM order_proof_photos pp
               WHERE pp.order_id = o.id AND pp.photo_type = 'before') AS before_photos,
             (SELECT COUNT(*)::int FROM order_proof_photos pp
               WHERE pp.order_id = o.id AND pp.photo_type = 'after') AS after_photos,
             COALESCE((
               SELECT json_agg(json_build_object('name', tu.name, 'response_status', toa.response_status) ORDER BY toa.id)
               FROM order_assignments toa
               JOIN store_employees tse ON tse.id = toa.employee_id
               JOIN users tu ON tu.id = tse.user_id
               WHERE toa.order_id = o.id AND toa.id <> oa.id AND toa.response_status <> 'declined'
             ), '[]'::json) AS teammates
      FROM order_assignments oa
      JOIN store_employees se ON se.id = oa.employee_id
      JOIN orders o ON oa.order_id = o.id
      JOIN packages p ON o.package_id = p.id
      JOIN customer_vehicles v ON o.vehicle_id = v.id
      JOIN users u ON o.customer_id = u.id
      WHERE se.user_id = $1
        AND oa.response_status <> 'declined'
        AND o.order_status IN ('assigned', 'on_the_way', 'in_progress', 'completed', 'confirmed_by_customer', 'in_complaint')
        AND (
          o.booking_date >= (NOW() AT TIME ZONE 'Asia/Jakarta')::date
          OR o.order_status IN ('on_the_way', 'in_progress', 'completed')
        )
      ORDER BY o.booking_date ASC, o.time_slot ASC
    `;

    const { rows } = await pool.query(query, [req.user.id]);
    res.json({ tasks: rows });
  } catch (err) {
    console.error('GET /employee/tasks gagal:', err);
    res.status(500).json({ message: 'Gagal memuat tugas' });
  }
});

// 2. Riwayat Pekerjaan Seluruhnya (semua toko tempat akun ini bekerja)
router.get('/history', requireAuth, requireRole('employee'), async (req, res) => {
  try {
    const emp = await getEmployeeRecord(req.user.id);
    if (!emp) return res.status(404).json({ message: 'Akun Anda belum terdaftar di toko manapun' });

    const query = `
      SELECT o.*, 
             v.brand as vehicle_brand, v.plate_number,
             p.name as package_name,
             u.name as customer_name
      FROM order_assignments oa
      JOIN store_employees se ON se.id = oa.employee_id
      JOIN orders o ON oa.order_id = o.id
      JOIN packages p ON o.package_id = p.id
      JOIN customer_vehicles v ON o.vehicle_id = v.id
      JOIN users u ON o.customer_id = u.id
      WHERE se.user_id = $1 AND oa.response_status <> 'declined'
      ORDER BY o.booking_date DESC, o.id DESC
    `;

    const { rows } = await pool.query(query, [req.user.id]);
    res.json({ history: rows });
  } catch (err) {
    console.error('GET /employee/history gagal:', err);
    res.status(500).json({ message: 'Gagal memuat riwayat' });
  }
});

// 3. Update Status Tugas (on_the_way -> in_progress -> completed)
router.patch('/tasks/:orderId/status', requireAuth, requireRole('employee'), async (req, res) => {
  try {
    const emp = await getEmployeeRecord(req.user.id);
    if (!emp) return res.status(404).json({ message: 'Akun belum terdaftar' });

    const { status } = req.body;
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId)) return res.status(400).json({ message: 'ID pesanan tidak valid' });

    // Validasi transisi status yang sah untuk pegawai
    const allowed = ['on_the_way', 'in_progress', 'completed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid' });
    }

    // Verifikasi pegawai memang bertugas di pesanan ini
    const { rows: check } = await pool.query(
      `SELECT oa.* FROM order_assignments oa
       JOIN store_employees se ON se.id = oa.employee_id
       WHERE oa.order_id = $1 AND se.user_id = $2`,
      [orderId, req.user.id]
    );
    if (!check[0]) return res.status(403).json({ message: 'Anda tidak ditugaskan pada pesanan ini' });

    // Penugasan harus sudah diterima pegawai
    if (check[0].response_status !== 'accepted') {
      return res.status(400).json({
        message:
          check[0].response_status === 'pending'
            ? 'Terima penugasan ini terlebih dahulu sebelum mengubah status.'
            : 'Anda sudah menolak penugasan ini.',
      });
    }

    // Status hanya boleh maju satu langkah: assigned -> on_the_way -> in_progress -> completed
    const NEXT_STATUS = { assigned: 'on_the_way', on_the_way: 'in_progress', in_progress: 'completed' };
    const { rows: current } = await pool.query('SELECT order_status, service_method FROM orders WHERE id = $1', [orderId]);
    if (!current[0]) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
    if (NEXT_STATUS[current[0].order_status] !== status) {
      return res.status(400).json({
        message: `Status pesanan tidak bisa diubah dari "${current[0].order_status}" ke "${status}".`,
      });
    }

    // Berangkat hanya boleh jika tim sudah lengkap (home service butuh 2 pegawai yang sudah menerima)
    if (status === 'on_the_way') {
      const required = current[0].service_method === 'home_service' ? 2 : 1;
      const { rows: accepted } = await pool.query(
        "SELECT COUNT(*)::int AS n FROM order_assignments WHERE order_id = $1 AND response_status = 'accepted'",
        [orderId]
      );
      if (accepted[0].n < required) {
        return res.status(400).json({
          message: `Menunggu pegawai lain menerima penugasan (${accepted[0].n} dari ${required} sudah menerima).`,
        });
      }
    }

    let completedClause = '';
    if (status === 'completed') {
      completedClause = ', completed_at = NOW()';
    }

    const { rows: updated } = await pool.query(
      `UPDATE orders SET order_status = $1 ${completedClause}, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, orderId]
    );

    res.json({ message: `Status pesanan berhasil diubah menjadi ${status}`, order: updated[0] });
  } catch (err) {
    console.error('PATCH /employee/tasks/:orderId/status gagal:', err);
    res.status(500).json({ message: 'Gagal mengubah status' });
  }
});

// 3b. Terima / tolak penugasan. Hanya bisa sebelum pesanan berangkat (status masih 'assigned').
// Menolak wajib disertai alasan; pegawai yang menolak tidak dihitung bentrok lagi, dan pemilik toko
// bisa menggantinya lewat /owner/orders/:orderId/reassign.
router.post('/tasks/:orderId/respond', requireAuth, requireRole('employee'), async (req, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId)) return res.status(400).json({ message: 'ID pesanan tidak valid' });

    const { response } = req.body;
    const reason = String(req.body.reason || '').trim();
    if (!['accepted', 'declined'].includes(response)) {
      return res.status(400).json({ message: 'Jawaban harus "accepted" atau "declined"' });
    }
    if (response === 'declined' && reason.length < 3) {
      return res.status(400).json({ message: 'Tulis alasan penolakan (minimal 3 karakter).' });
    }

    const { rows } = await pool.query(
      `SELECT oa.id, oa.response_status, o.order_status
       FROM order_assignments oa
       JOIN store_employees se ON se.id = oa.employee_id
       JOIN orders o ON o.id = oa.order_id
       WHERE oa.order_id = $1 AND se.user_id = $2`,
      [orderId, req.user.id]
    );
    const assignment = rows[0];
    if (!assignment) return res.status(403).json({ message: 'Anda tidak ditugaskan pada pesanan ini' });

    if (assignment.order_status !== 'assigned') {
      return res.status(400).json({ message: 'Tugas sudah berjalan, jawaban tidak bisa diubah. Hubungi pemilik toko.' });
    }
    if (assignment.response_status === 'declined') {
      return res.status(400).json({ message: 'Anda sudah menolak tugas ini.' });
    }
    if (assignment.response_status === response) {
      return res.json({ message: 'Jawaban Anda sudah tercatat.', response_status: response });
    }

    await pool.query(
      `UPDATE order_assignments
       SET response_status = $1, responded_at = NOW(), decline_reason = $2
       WHERE id = $3`,
      [response, response === 'declined' ? reason : null, assignment.id]
    );

    res.json({
      message: response === 'accepted' ? 'Tugas diterima.' : 'Tugas ditolak. Pemilik toko akan mencari pengganti.',
      response_status: response,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menyimpan jawaban penugasan' });
  }
});

// 4. Unggah Foto Bukti Kondisi Sebelum & Sesudah Cuci
router.post(
  '/tasks/:orderId/upload-proof',
  requireAuth,
  requireRole('employee'),
  upload.single('photo'),
  async (req, res) => {
    try {
      const emp = await getEmployeeRecord(req.user.id);
      if (!emp) {
        if (req.file) fs.unlink(req.file.path, () => { });
        return res.status(404).json({ message: 'Akun belum terdaftar' });
      }

      const orderId = Number(req.params.orderId);
      const { photo_type } = req.body; // 'before' | 'after'

      if (!Number.isInteger(orderId)) {
        if (req.file) fs.unlink(req.file.path, () => { });
        return res.status(400).json({ message: 'ID pesanan tidak valid' });
      }

      // Hanya pegawai yang sudah menerima penugasan ini yang boleh mengunggah foto
      const { rows: assigned } = await pool.query(
        `SELECT oa.employee_id FROM order_assignments oa
         JOIN store_employees se ON se.id = oa.employee_id
         WHERE oa.order_id = $1 AND se.user_id = $2 AND oa.response_status = 'accepted'`,
        [orderId, req.user.id]
      );
      if (!assigned[0]) {
        if (req.file) fs.unlink(req.file.path, () => { }); // buang file yang sudah terlanjur tersimpan
        return res.status(403).json({ message: 'Anda tidak ditugaskan pada pesanan ini' });
      }

      if (!['before', 'after'].includes(photo_type)) {
        if (req.file) fs.unlink(req.file.path, () => { });
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
        [orderId, assigned[0].employee_id, photo_type, photoUrl]
      );

      res.status(201).json({
        message: `Foto ${photo_type} cuci berhasil diunggah`,
        proof: rows[0],
      });
    } catch (err) {
      console.error('POST /employee/tasks/:orderId/upload-proof gagal:', err);
      res.status(500).json({ message: 'Gagal mengunggah foto' });
    }
  }
);

export default router;