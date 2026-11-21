import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// 1. Profil Pengguna
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, phone, role, avatar_url FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'User tidak ditemukan' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memuat profil' });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, phone, avatar_url } = req.body;
    const { rows } = await pool.query(
      `UPDATE users 
       SET name = COALESCE($1, name), phone = COALESCE($2, phone), avatar_url = COALESCE($3, avatar_url), updated_at = NOW() 
       WHERE id = $4 RETURNING id, name, email, phone, role, avatar_url`,
      [name, phone, avatar_url, req.user.id]
    );
    res.json({ message: 'Profil berhasil diperbarui', user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui profil' });
  }
});

// 2. Alamat Tersimpan
router.get('/addresses', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM customer_addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC',
      [req.user.id]
    );
    res.json({ addresses: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memuat alamat' });
  }
});

const addressSchema = z.object({
  label: z.string().default('Rumah'),
  address_text: z.string().min(5),
  latitude: z.number(),
  longitude: z.number(),
  notes: z.string().optional(),
  is_default: z.boolean().default(false),
});

// Alamat pertama otomatis menjadi alamat utama.
router.post('/addresses', requireAuth, async (req, res) => {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: z.flattenError(parsed.error).fieldErrors });
  }
  const { label, address_text, latitude, longitude, notes, is_default } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      'SELECT COUNT(*)::int AS n FROM customer_addresses WHERE user_id = $1',
      [req.user.id]
    );
    const makeDefault = is_default || existing[0].n === 0;

    if (makeDefault) {
      await client.query('UPDATE customer_addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
    }

    const { rows } = await client.query(
      `INSERT INTO customer_addresses (user_id, label, address_text, latitude, longitude, notes, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, label, address_text, latitude, longitude, notes || null, makeDefault]
    );

    await client.query('COMMIT');
    res.status(201).json({ address: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error(err);
    res.status(500).json({ message: 'Gagal menambah alamat' });
  } finally {
    client.release();
  }
});

// Jadikan alamat ini sebagai alamat utama
router.put('/addresses/:id/default', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'ID alamat tidak valid' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: own } = await client.query(
      'SELECT id FROM customer_addresses WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (!own[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Alamat tidak ditemukan' });
    }
    await client.query('UPDATE customer_addresses SET is_default = false WHERE user_id = $1', [req.user.id]);
    await client.query('UPDATE customer_addresses SET is_default = true WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ message: 'Alamat utama diperbarui' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error(err);
    res.status(500).json({ message: 'Gagal mengubah alamat utama' });
  } finally {
    client.release();
  }
});

// Jika alamat utama dihapus, alamat terbaru yang tersisa menjadi alamat utama.
router.delete('/addresses/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'ID alamat tidak valid' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: del } = await client.query(
      'DELETE FROM customer_addresses WHERE id = $1 AND user_id = $2 RETURNING is_default',
      [id, req.user.id]
    );
    if (del[0]?.is_default) {
      await client.query(
        `UPDATE customer_addresses SET is_default = true
         WHERE id = (SELECT id FROM customer_addresses WHERE user_id = $1 ORDER BY id DESC LIMIT 1)`,
        [req.user.id]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Alamat berhasil dihapus' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus alamat' });
  } finally {
    client.release();
  }
});

// 3. Kendaraan Tersimpan
router.get('/vehicles', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM customer_vehicles WHERE user_id = $1 ORDER BY id DESC',
      [req.user.id]
    );
    res.json({ vehicles: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memuat kendaraan' });
  }
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
  try {
    const { vehicle_type, brand, model, plate_number } = parsed.data;
    const { rows } = await pool.query(
      `INSERT INTO customer_vehicles (user_id, vehicle_type, brand, model, plate_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, vehicle_type, brand, model, plate_number.toUpperCase()]
    );
    res.status(201).json({ vehicle: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menambah kendaraan' });
  }
});

router.delete('/vehicles/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM customer_vehicles WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    res.json({ message: 'Kendaraan berhasil dihapus' });
  } catch (err) {
    // 23503 = masih dipakai oleh pesanan (ON DELETE RESTRICT)
    if (err.code === '23503') {
      return res.status(409).json({ message: 'Kendaraan ini tidak bisa dihapus karena sudah dipakai pada pesanan.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus kendaraan' });
  }
});

export default router;