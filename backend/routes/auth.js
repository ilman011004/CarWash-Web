import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const sign = (u) =>
  jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  phone: z.string().min(8).optional(),
  password: z.string().min(8),
  role: z.enum(['customer', 'owner']).default('customer'),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Data tidak valid',
      errors: z.flattenError(parsed.error).fieldErrors,
    });
  }
  const { name, email, phone, password, role } = parsed.data;
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role`,
      [name, email.toLowerCase(), phone || null, hash, role]
    );
    res.status(201).json({ user: rows[0], token: sign(rows[0]) });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ message: 'Email sudah terdaftar' });
    }
    throw e;
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [
    String(email || '').toLowerCase(),
  ]);
  const u = rows[0];
  const ok = u && u.is_active && (await bcrypt.compare(String(password || ''), u.password_hash));
  if (!ok) return res.status(401).json({ message: 'Email atau password salah' });
  res.json({
    user: { id: u.id, name: u.name, email: u.email, role: u.role },
    token: sign(u),
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, phone, role FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ message: 'Pengguna tidak ditemukan' });
  res.json({ user: rows[0] });
});

export default router;