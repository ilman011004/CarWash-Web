import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Verifikasi hak akses user ke pesanan (Pelanggan, Owner toko, Pegawai toko, atau Admin)
async function canAccessOrder(orderId, user) {
  if (user.role === 'admin') return true;

  const { rows } = await pool.query(
    `SELECT o.id, o.customer_id, o.store_id, o.order_status,
            s.owner_id,
            EXISTS(SELECT 1 FROM order_assignments oa JOIN store_employees se ON oa.employee_id = se.id WHERE oa.order_id = o.id AND se.user_id = $2) as is_assigned_employee
     FROM orders o
     JOIN stores s ON o.store_id = s.id
     WHERE o.id = $1`,
    [orderId, user.id]
  );

  if (!rows[0]) return null;
  const o = rows[0];

  const isCustomer = o.customer_id === user.id;
  const isOwner = o.owner_id === user.id;
  const isEmployee = o.is_assigned_employee;

  if (isCustomer || isOwner || isEmployee) {
    return o;
  }
  return null;
}

// 1. Dapatkan Pesan Chat pada Order
router.get('/:orderId/messages', requireAuth, async (req, res) => {
  const orderId = req.params.orderId;
  const order = await canAccessOrder(orderId, req.user);
  if (!order) {
    return res.status(403).json({ message: 'Anda tidak memiliki akses ke chat pesanan ini' });
  }

  const { rows } = await pool.query(
    `SELECT c.*, u.name as sender_name, u.avatar_url as sender_avatar
     FROM order_chats c
     JOIN users u ON c.sender_id = u.id
     WHERE c.order_id = $1
     ORDER BY c.created_at ASC`,
    [orderId]
  );

  const isArchived = ['completed', 'confirmed_by_customer', 'cancelled', 'refunded'].includes(order.order_status);

  res.json({
    messages: rows,
    is_archived: isArchived,
    order_status: order.order_status,
  });
});

// 2. Kirim Pesan / Foto ke Chat Order
router.post('/:orderId/messages', requireAuth, upload.single('photo'), async (req, res) => {
  const orderId = req.params.orderId;
  const order = await canAccessOrder(orderId, req.user);
  if (!order) {
    return res.status(403).json({ message: 'Anda tidak memiliki akses ke chat pesanan ini' });
  }

  // Cek apakah chat masih aktif atau sudah arsip
  const isArchived = ['completed', 'confirmed_by_customer', 'cancelled', 'refunded'].includes(order.order_status);
  if (isArchived) {
    return res.status(400).json({
      message: 'Pesanan telah selesai/ditutup. Ruang chat kini berstatus arsip hanya baca.',
    });
  }

  const { message_text } = req.body;
  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

  if (!message_text && !photoUrl) {
    return res.status(400).json({ message: 'Pesan atau foto wajib disertakan' });
  }

  const { rows } = await pool.query(
    `INSERT INTO order_chats (order_id, sender_id, sender_role, message_text, photo_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [orderId, req.user.id, req.user.role, message_text || null, photoUrl]
  );

  const message = rows[0];

  // Ambil nama pengirim
  const { rows: uRows } = await pool.query('SELECT name, avatar_url FROM users WHERE id = $1', [req.user.id]);
  message.sender_name = uRows[0]?.name || 'User';
  message.sender_avatar = uRows[0]?.avatar_url || null;

  // Emit socket event jika io tersedia
  const io = req.app.get('io');
  if (io) {
    io.to(`order_${orderId}`).emit('new_message', message);
  }

  res.status(201).json({ message });
});

export default router;
