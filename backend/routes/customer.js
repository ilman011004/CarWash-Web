import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// 1. Profil Pengguna
router.get('/profile', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, phone, role, avatar_url FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ message: 'User tidak ditemukan' });
  res.json({ user: rows[0] });
});

router.put('/profile', requireAuth, async (req, res) => {
  const { name, phone, avatar_url } = req.body;
  const { rows } = await pool.query(
    `UPDATE users 
     SET name = COALESCE($1, name), phone = COALESCE($2, phone), avatar_url = COALESCE($3, avatar_url), updated_at = NOW() 
     WHERE id = $4 RETURNING id, name, email, phone, role, avatar_url`,
    [name, phone, avatar_url, req.user.id]
  );
  res.json({ message: 'Profil berhasil diperbarui', user: rows[0] });
});

// 2. Alamat Tersimpan
router.get('/addresses', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM customer_addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC',
    [req.user.id]
  );
  res.json({ addresses: rows });
});

const addressSchema = z.object({
  label: z.string().default('Rumah'),
  address_text: z.string().min(5),
  latitude: z.number(),
  longitude: z.number(),
  notes: z.string().optional(),
  is_default: z.boolean().default(false),
});

router.post('/addresses', requireAuth, async (req, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: z.flattenError(parsed.error).fieldErrors });
  }
  const { label, address_text, latitude, longitude, notes, is_default } = parsed.data;

  if (is_default) {
    await pool.query('UPDATE customer_addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
  }

  const { rows } = await pool.query(
    `INSERT INTO customer_addresses (user_id, label, address_text, latitude, longitude, notes, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [req.user.id, label, address_text, latitude, longitude, notes || null, is_default]
  );
  res.status(201).json({ address: rows[0] });
});

router.delete('/addresses/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM customer_addresses WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  res.json({ message: 'Alamat berhasil dihapus' });
});

// 3. Kendaraan Tersimpan
router.get('/vehicles', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM customer_vehicles WHERE user_id = $1 ORDER BY id DESC',
    [req.user.id]
  );
  res.json({ vehicles: rows });
});

const vehicleSchema = z.object({
  vehicle_type: z.enum(['mobil', 'motor']),
  brand: z.string().min(2),
  model: z.string().min(1),
  plate_number: z.string().min(3),
});

router.post('/vehicles', requireAuth, async (req, res) => {
  const parsed = vehicleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: z.flattenError(parsed.error).fieldErrors });
  }
  const { vehicle_type, brand, model, plate_number } = parsed.data;
  const { rows } = await pool.query(
    `INSERT INTO customer_vehicles (user_id, vehicle_type, brand, model, plate_number)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [req.user.id, vehicle_type, brand, model, plate_number.toUpperCase()]
  );
  res.status(201).json({ vehicle: rows[0] });
});

router.delete('/vehicles/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM customer_vehicles WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.user.id,
  ]);
  res.json({ message: 'Kendaraan berhasil dihapus' });
});

export default router;
