import bcrypt from 'bcryptjs';
import { pool } from './db.js';

async function seedData() {
  console.log('🌱 Menyiapkan data awal Marketplace CarWash...');
  try {
    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Buat User: Admin, Owners, Employees, Customer
    const usersData = [
      ['Admin Utama', 'admin@carwash.com', '0811000001', 'admin'],
      ['Budi Toko AutoClean', 'budi@autoclean.com', '0812000002', 'owner'],
      ['Siti Owner KilatWash', 'siti@kilatwash.com', '0813000003', 'owner'],
      ['Asep Pegawai 1', 'asep@pegawai.com', '0814000004', 'employee'],
      ['Rian Pegawai 2', 'rian@pegawai.com', '0815000005', 'employee'],
      ['Doni Pegawai 3', 'doni@pegawai.com', '0816000006', 'employee'],
      ['Andi Pelanggan', 'customer@gmail.com', '0817000007', 'customer'],
    ];

    const userMap = {};
    for (const [name, email, phone, role] of usersData) {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET name = $1, role = $5
         RETURNING id, email, role`,
        [name, email, phone, passwordHash, role]
      );
      userMap[email] = rows[0].id;
    }

    // 2. Buat Toko Mitra (Terverifikasi)
    // Toko 1: AutoClean Express (Home Service & Pickup)
    const { rows: store1Rows } = await pool.query(
      `INSERT INTO stores (
        owner_id, name, phone, address_text, latitude, longitude,
        image_url, is_verified, is_active, max_service_distance_km, delivery_fee_per_km, balance
      ) VALUES (
        $1, 'AutoClean Pro & Home Service', '08129998881', 'Jl. Fatmawati Raya No. 45, Jakarta Selatan',
        -6.2088, 106.8456,
        'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=80',
        true, true, 25.00, 3500.00, 450000.00
      ) RETURNING id`,
      [userMap['budi@autoclean.com']]
    );
    const store1Id = store1Rows[0].id;

    // Toko 2: Kilat Premium Waterless & Detailing
    const { rows: store2Rows } = await pool.query(
      `INSERT INTO stores (
        owner_id, name, phone, address_text, latitude, longitude,
        image_url, is_verified, is_active, max_service_distance_km, delivery_fee_per_km, balance
      ) VALUES (
        $1, 'Kilat Waterless & Detailing', '08137776662', 'Jl. Tebet Barat Dalam Raya No. 12, Jakarta Selatan',
        -6.2345, 106.8520,
        'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&w=800&q=80',
        true, true, 30.00, 3000.00, 850000.00
      ) RETURNING id`,
      [userMap['siti@kilatwash.com']]
    );
    const store2Id = store2Rows[0].id;

    // Toko 3: Garage Clean (Dekat & Cepat)
    const { rows: store3Rows } = await pool.query(
      `INSERT INTO stores (
        owner_id, name, phone, address_text, latitude, longitude,
        image_url, is_verified, is_active, max_service_distance_km, delivery_fee_per_km, balance
      ) VALUES (
        $1, 'Garage 88 Home Wash', '08124445553', 'Jl. Kemang Timur No. 8, Jakarta Selatan',
        -6.2600, 106.8150,
        'https://images.unsplash.com/photo-1552930294-6b595f4c2974?auto=format&fit=crop&w=800&q=80',
        true, true, 20.00, 4000.00, 200000.00
      ) RETURNING id`,
      [userMap['budi@autoclean.com']]
    );
    const store3Id = store3Rows[0].id;

    // 3. Tambahkan Metode Layanan untuk Toko-toko
    for (const sid of [store1Id, store2Id, store3Id]) {
      await pool.query(
        `INSERT INTO store_service_methods (store_id, method, is_enabled)
         VALUES 
          ($1, 'home_service', true),
          ($1, 'pickup_delivery', true),
          ($1, 'self_service', true)
         ON CONFLICT (store_id, method) DO NOTHING`,
        [sid]
      );
    }

    // 4. Tambahkan Paket Layanan
    const packages = [
      // Toko 1
      [store1Id, 'Cuci Standar Salju + Vakum', 'Cuci bodi eksterior dengan busa salju, poles ban, dan vakum interior.', false, 65000, 35000, 45],
      [store1Id, 'Deep Cleaning & Jamur Kaca', 'Pembersihan mendalam sela pintu, velg, jamur kaca, dan ruang mesin.', false, 120000, 60000, 75],
      [store1Id, 'Eco Waterless Express', 'Cuci hemat air berbasis cairan nano polimer khusus, aman tanpa goresan.', true, 80000, 45000, 40],
      // Toko 2
      [store2Id, 'Hydrophobic Ceramic Shield', 'Cuci premium + lapisan wax ceramic hydrophobic anti air dan debu.', false, 150000, 75000, 90],
      [store2Id, 'Waterless Eco Clean', 'Formula organik ramah lingkungan tanpa selang air, ideal untuk apartemen/kantor.', true, 90000, 50000, 50],
      // Toko 3
      [store3Id, 'Cuci Kilat Rumah', 'Cuci cepat bodi + semir ban langsung di garasi rumah Anda.', false, 50000, 25000, 35],
    ];

    for (const [sid, name, desc, waterless, car, moto, dur] of packages) {
      await pool.query(
        `INSERT INTO packages (store_id, name, description, is_waterless, price_car, price_motorcycle, estimated_duration_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sid, name, desc, waterless, car, moto, dur]
      );
    }

    // 5. Hubungkan Pegawai ke Toko
    const { rows: emp1 } = await pool.query(
      `INSERT INTO store_employees (store_id, user_id, status, notes)
       VALUES ($1, $2, 'available', 'Spesialis Detailing & Home Service')
       ON CONFLICT (store_id, user_id) DO UPDATE SET status = 'available'
       RETURNING id`,
      [store1Id, userMap['asep@pegawai.com']]
    );

    const { rows: emp2 } = await pool.query(
      `INSERT INTO store_employees (store_id, user_id, status, notes)
       VALUES ($1, $2, 'available', 'Spesialis Vakum & Interior')
       ON CONFLICT (store_id, user_id) DO UPDATE SET status = 'available'
       RETURNING id`,
      [store1Id, userMap['rian@pegawai.com']]
    );

    await pool.query(
      `INSERT INTO store_employees (store_id, user_id, status, notes)
       VALUES ($1, $2, 'available', 'Teknisi Waterless')
       ON CONFLICT (store_id, user_id) DO UPDATE SET status = 'available'`,
      [store2Id, userMap['doni@pegawai.com']]
    );

    // 6. Kendaraan & Alamat Pelanggan Dummy
    await pool.query(
      `INSERT INTO customer_vehicles (user_id, vehicle_type, brand, model, plate_number)
       VALUES 
        ($1, 'mobil', 'Honda', 'HR-V Prestige', 'B 1988 KAA'),
        ($1, 'motor', 'Yamaha', 'NMAX 155', 'B 3456 PLM')`,
      [userMap['customer@gmail.com']]
    );

    await pool.query(
      `INSERT INTO customer_addresses (user_id, label, address_text, latitude, longitude, notes, is_default)
       VALUES ($1, 'Rumah Utama', 'Jl. Mawar Melati Blok B3 No. 7, Jakarta Selatan', -6.2100, 106.8400, 'Pagar putih, samping minimarket', true)`,
      [userMap['customer@gmail.com']]
    );

    // 7. Buat Order Demo Terlebih Dahulu Sebelum Review
    const { rows: orderDemo } = await pool.query(
      `INSERT INTO orders (
        order_code, customer_id, store_id, vehicle_id, package_id,
        service_method, service_address, service_latitude, service_longitude, distance_km,
        has_water_source, customer_notes, booking_date, time_slot,
        order_status, payment_status, package_price, delivery_fee, commission_rate,
        platform_fee, store_earnings, total_amount, completed_at
      ) VALUES (
        'CW-DEMO-001', $1, $2, 
        (SELECT id FROM customer_vehicles WHERE user_id = $1 LIMIT 1),
        (SELECT id FROM packages WHERE store_id = $2 LIMIT 1),
        'home_service', 'Jl. Mawar Melati Blok B3 No. 7, Jakarta Selatan', -6.2100, 106.8400, 1.2,
        true, 'Tolong vakum jok belakang lebih teliti', CURRENT_DATE, '08:00 - 10:00',
        'completed', 'paid', 65000, 4200, 10.0, 6500, 62700, 69200, NOW()
      ) ON CONFLICT (order_code) DO UPDATE SET order_status = 'completed'
      RETURNING id`,
      [userMap['customer@gmail.com'], store1Id]
    );
    const demoOrderId = orderDemo[0].id;

    // 8. Dummy Reviews Terhubung ke Order Demo
    await pool.query(
      `INSERT INTO reviews (order_id, store_id, customer_id, rating, comment, store_reply)
       VALUES 
        ($1, $2, $3, 5, 'Pelayanan cepat dan bersih banget! Pegawai ramah bawa peralatan lengkap ke rumah.', 'Terima kasih banyak kak, ditunggu pemesanan berikutnya! 😊')
       ON CONFLICT (order_id) DO UPDATE SET rating = 5, comment = 'Pelayanan cepat dan bersih banget! Pegawai ramah bawa peralatan lengkap ke rumah.'`,
      [demoOrderId, store1Id, userMap['customer@gmail.com']]
    );

    console.log('✅ Data dummy toko, paket, pegawai, dan pelanggan berhasil dibuat!');
  } catch (err) {
    console.error('❌ Gagal seed data:', err);
  } finally {
    await pool.end();
  }
}

seedData();
