import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { calculateDistance } from '../utils/geo.js';
import { z } from 'zod';

const router = Router();

// GET /api/stores - Pencarian toko terdekat & filter
router.get('/', async (req, res) => {
  try {
    const { lat, lng, service_method, max_distance, min_rating, sort_by } = req.query;

    // Subquery dipakai agar JOIN tidak saling menggandakan baris
    const query = `
      SELECT s.*,
             COALESCE(r.avg_rating, 0)    AS avg_rating,
             COALESCE(r.review_count, 0)  AS review_count,
             COALESCE(m.methods, ARRAY[]::text[]) AS service_methods
      FROM stores s
      LEFT JOIN (
        SELECT store_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
        FROM reviews
        GROUP BY store_id
      ) r ON r.store_id = s.id
      LEFT JOIN (
        SELECT store_id, ARRAY_AGG(method::text) AS methods
        FROM store_service_methods
        WHERE is_enabled = true
        GROUP BY store_id
      ) m ON m.store_id = s.id
      WHERE s.is_active = true AND s.is_verified = true
    `;
    const { rows } = await pool.query(query);

    let stores = rows.map((store) => {
      let distance = null;
      if (lat && lng) {
        distance = calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          parseFloat(store.latitude),
          parseFloat(store.longitude)
        );
      }

      let methods = [];
      if (Array.isArray(store.service_methods)) {
        methods = store.service_methods;
      } else if (typeof store.service_methods === 'string') {
        methods = store.service_methods.replace(/[{}]/g, '').split(',').filter(Boolean);
      }

      return {
        ...store,
        avg_rating: parseFloat(store.avg_rating).toFixed(1),
        review_count: parseInt(store.review_count, 10),
        distance_km: distance,
        service_methods: methods,
      };
    });

    // Filter jarak jika lat & lng diberikan
    if (lat && lng) {
      if (max_distance) {
        stores = stores.filter((s) => s.distance_km <= parseFloat(max_distance));
      } else {
        // Otomatis cek batas jarak layanan toko
        stores = stores.filter((s) => s.distance_km <= parseFloat(s.max_service_distance_km));
      }
    }

    // Filter metode layanan
    if (service_method) {
      stores = stores.filter((s) => s.service_methods.includes(service_method));
    }

    // Filter rating minimum
    if (min_rating) {
      stores = stores.filter((s) => parseFloat(s.avg_rating) >= parseFloat(min_rating));
    }

    // Pengurutan
    if (sort_by === 'rating') {
      stores.sort((a, b) => parseFloat(b.avg_rating) - parseFloat(a.avg_rating));
    } else if (lat && lng) {
      stores.sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
    }

    res.json({ stores });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data toko' });
  }
});

// GET /api/stores/:id - Detail toko beserta paket, jadwal, metode & ulasan
router.get('/:id', async (req, res) => {
  const storeId = Number(req.params.id);

  // Validasi id agar PostgreSQL tidak error pada input non-angka
  if (!Number.isInteger(storeId) || storeId <= 0) {
    return res.status(400).json({ message: 'ID toko tidak valid' });
  }

  try {
    const storeQuery = `
      SELECT s.*,
             COALESCE(r.avg_rating, 0)   AS avg_rating,
             COALESCE(r.review_count, 0) AS review_count
      FROM stores s
      LEFT JOIN (
        SELECT store_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
        FROM reviews
        WHERE store_id = $1
        GROUP BY store_id
      ) r ON r.store_id = s.id
      WHERE s.id = $1
    `;
    const { rows: storeRows } = await pool.query(storeQuery, [storeId]);

    if (!storeRows[0]) {
      return res.status(404).json({ message: `Toko dengan id ${storeId} tidak ditemukan` });
    }

    const [packagesRes, schedulesRes, methodsRes, reviewsRes] = await Promise.all([
      pool.query(
        'SELECT * FROM packages WHERE store_id = $1 AND is_active = true ORDER BY id ASC',
        [storeId]
      ),
      pool.query(
        'SELECT * FROM store_schedules WHERE store_id = $1 ORDER BY day_of_week ASC',
        [storeId]
      ),
      pool.query(
        'SELECT method, is_enabled FROM store_service_methods WHERE store_id = $1',
        [storeId]
      ),
      pool.query(
        `SELECT r.*, u.name AS customer_name, u.avatar_url AS customer_avatar
         FROM reviews r
         JOIN users u ON r.customer_id = u.id
         WHERE r.store_id = $1
         ORDER BY r.created_at DESC
         LIMIT 20`,
        [storeId]
      ),
    ]);

    res.json({
      store: {
        ...storeRows[0],
        avg_rating: parseFloat(storeRows[0].avg_rating).toFixed(1),
        review_count: parseInt(storeRows[0].review_count, 10),
      },
      packages: packagesRes.rows,
      schedules: schedulesRes.rows,
      service_methods: methodsRes.rows,
      reviews: reviewsRes.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil detail toko' });
  }
});

// POST /api/stores - Pemilik mendaftarkan toko
const storeRegisterSchema = z.object({
  name: z.string().min(3),
  phone: z.string().min(8),
  address_text: z.string().min(5),
  latitude: z.number(),
  longitude: z.number(),
  max_service_distance_km: z.number().default(15),
  delivery_fee_per_km: z.number().default(3000),
  image_url: z.string().optional(),
  verification_doc_url: z.string().optional(),
});

router.post('/', requireAuth, requireRole('owner'), async (req, res) => {
  const parsed = storeRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: z.flattenError(parsed.error).fieldErrors });
  }

  const {
    name,
    phone,
    address_text,
    latitude,
    longitude,
    max_service_distance_km,
    delivery_fee_per_km,
    image_url,
    verification_doc_url,
  } = parsed.data;

  const client = await pool.connect();
  try {
    // Transaksi: kalau salah satu langkah gagal, semuanya dibatalkan
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO stores (owner_id, name, phone, address_text, latitude, longitude,
                           max_service_distance_km, delivery_fee_per_km, image_url, verification_doc_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.user.id,
        name,
        phone,
        address_text,
        latitude,
        longitude,
        max_service_distance_km,
        delivery_fee_per_km,
        image_url || null,
        verification_doc_url || null,
      ]
    );

    const storeId = rows[0].id;

    // Metode layanan default: aktifkan semua
    await client.query(
      `INSERT INTO store_service_methods (store_id, method, is_enabled)
       VALUES
        ($1, 'home_service', true),
        ($1, 'pickup_delivery', true),
        ($1, 'self_service', true)
       ON CONFLICT DO NOTHING`,
      [storeId]
    );

    // Jadwal default 7 hari (08:00 - 18:00, kuota 3/slot)
    for (let day = 0; day <= 6; day++) {
      await client.query(
        `INSERT INTO store_schedules (store_id, day_of_week, open_time, close_time, slot_capacity_per_2hours, is_open)
         VALUES ($1, $2, '08:00', '18:00', 3, true)
         ON CONFLICT DO NOTHING`,
        [storeId, day]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Toko berhasil didaftarkan dan menunggu verifikasi Admin.',
      store: rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ message: 'Gagal mendaftarkan toko' });
  } finally {
    client.release();
  }
});

export default router;