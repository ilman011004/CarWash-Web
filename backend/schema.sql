-- CarWash Marketplace Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUM TYPES
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('customer', 'owner', 'employee', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE vehicle_type AS ENUM ('mobil', 'motor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE service_method AS ENUM ('home_service', 'pickup_delivery', 'self_service');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'waiting_payment',
        'waiting_store_confirmation',
        'assigned',
        'on_the_way',
        'in_progress',
        'completed',
        'confirmed_by_customer',
        'cancelled',
        'rescheduled',
        'in_complaint',
        'refunded'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded', 'failed', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE withdrawal_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CUSTOMER SAVED ADDRESSES
CREATE TABLE IF NOT EXISTS customer_addresses (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(100) NOT NULL DEFAULT 'Rumah',
    address_text TEXT NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    notes TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. CUSTOMER VEHICLES
CREATE TABLE IF NOT EXISTS customer_vehicles (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type vehicle_type NOT NULL,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    plate_number VARCHAR(30) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. STORES
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    owner_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    address_text TEXT NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    image_url TEXT,
    verification_doc_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Service rules & distance
    max_service_distance_km NUMERIC(5, 2) DEFAULT 15.00,
    delivery_fee_per_km NUMERIC(12, 2) DEFAULT 3000.00,
    
    -- Custom store commission (default null = uses platform global commission)
    custom_commission_rate NUMERIC(5, 2) DEFAULT NULL,
    balance NUMERIC(15, 2) DEFAULT 0.00,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. STORE OPERATING HOURS & QUOTA
CREATE TABLE IF NOT EXISTS store_schedules (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL, -- 0 = Sunday, 1 = Monday, ... 6 = Saturday
    open_time TIME NOT NULL DEFAULT '08:00',
    close_time TIME NOT NULL DEFAULT '18:00',
    slot_capacity_per_2hours INT NOT NULL DEFAULT 3,
    is_open BOOLEAN DEFAULT true,
    UNIQUE(store_id, day_of_week)
);

-- 7. STORE SERVICE METHODS ENABLED
CREATE TABLE IF NOT EXISTS store_service_methods (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    method service_method NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    UNIQUE(store_id, method)
);

-- 8. SERVICE PACKAGES
CREATE TABLE IF NOT EXISTS packages (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_waterless BOOLEAN DEFAULT false,
    price_car NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    price_motorcycle NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    estimated_duration_minutes INT DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. STORE EMPLOYEES
CREATE TABLE IF NOT EXISTS store_employees (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'available', -- 'available', 'busy', 'off'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(store_id, user_id)
);

-- 10. ORDERS
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_code VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    vehicle_id INT NOT NULL REFERENCES customer_vehicles(id) ON DELETE RESTRICT,
    package_id INT NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
    
    service_method service_method NOT NULL,
    
    -- Location & water info
    service_address TEXT NOT NULL,
    service_latitude NUMERIC(10, 7) NOT NULL,
    service_longitude NUMERIC(10, 7) NOT NULL,
    distance_km NUMERIC(5, 2) DEFAULT 0.00,
    has_water_source BOOLEAN NOT NULL DEFAULT true,
    customer_notes TEXT,
    
    -- Timing
    booking_date DATE NOT NULL,
    time_slot VARCHAR(50) NOT NULL, -- e.g. "08:00 - 10:00"
    
    -- Statuses
    order_status order_status NOT NULL DEFAULT 'waiting_payment',
    payment_status payment_status NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_transaction_id VARCHAR(100),
    
    -- Financials
    package_price NUMERIC(12, 2) NOT NULL,
    delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00, -- default 10%
    platform_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,    -- package_price * (commission_rate / 100)
    store_earnings NUMERIC(12, 2) NOT NULL DEFAULT 0.00,  -- (package_price - platform_fee) + delivery_fee
    total_amount NUMERIC(12, 2) NOT NULL,                 -- package_price + delivery_fee
    
    -- Weather / Reschedule flags
    rescheduled_reason TEXT,
    is_rain_rescheduled BOOLEAN DEFAULT false,
    
    -- Auto-completion timestamp
    completed_at TIMESTAMP WITH TIME ZONE,
    auto_confirmed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. ORDER ASSIGNMENTS (Minimal 2 pegawai untuk home service)
CREATE TABLE IF NOT EXISTS order_assignments (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    employee_id INT NOT NULL REFERENCES store_employees(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(order_id, employee_id)
);

-- 12. PROOF PHOTOS (Sebelum & Sesudah cuci)
CREATE TABLE IF NOT EXISTS order_proof_photos (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    uploaded_by_employee_id INT REFERENCES store_employees(id) ON DELETE SET NULL,
    photo_type VARCHAR(20) NOT NULL CHECK (photo_type IN ('before', 'after')),
    photo_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. REVIEWS & RATINGS
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    order_id INT UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    store_reply TEXT,
    replied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. STORE WITHDRAWALS
CREATE TABLE IF NOT EXISTS withdrawals (
    id SERIAL PRIMARY KEY,
    store_id INT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    bank_name VARCHAR(100) NOT NULL,
    bank_account_number VARCHAR(50) NOT NULL,
    bank_account_holder VARCHAR(150) NOT NULL,
    status withdrawal_status DEFAULT 'pending',
    processed_by_admin_id INT REFERENCES users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

-- 15. COMPLAINTS & REFUNDS
CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'investigating', 'refunded', 'rejected', 'resolved'
    refund_amount NUMERIC(12, 2) DEFAULT 0.00,
    resolved_by_admin_id INT REFERENCES users(id) ON DELETE SET NULL,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- 16. ORDER CHATS (Chat per pesanan: Pelanggan, Pemilik, Pegawai)
CREATE TABLE IF NOT EXISTS order_chats (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_role user_role NOT NULL,
    message_text TEXT,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. EMPLOYEE LIVE LOCATIONS (Pelacakan posisi realtime saat aktif)
CREATE TABLE IF NOT EXISTS employee_live_locations (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    employee_id INT NOT NULL REFERENCES store_employees(id) ON DELETE CASCADE,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    heading NUMERIC(5, 2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(order_id, employee_id)
);

-- 18. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT
);

INSERT INTO system_settings (key, value, description)
VALUES 
    ('default_commission_rate', '10.00', 'Persentase komisi platform default (%)'),
    ('min_home_service_employees', '2', 'Jumlah minimal pegawai untuk home service'),
    ('store_confirmation_timeout_minutes', '30', 'Batas waktu konfirmasi pesanan oleh toko sebelum auto-cancel'),
    ('auto_confirm_hours', '24', 'Batas waktu pesanan otomatis dikonfirmasi setelah status selesai')
ON CONFLICT (key) DO NOTHING;

-- 19. KONFIRMASI PEGAWAI ATAS PENUGASAN
-- Penugasan baru dibuat 'pending' oleh aplikasi, lalu pegawai menerima ('accepted') atau menolak ('declined').
-- Data lama dianggap sudah diterima, jadi pesanan yang sedang berjalan tidak terganggu.
ALTER TABLE order_assignments
    ADD COLUMN IF NOT EXISTS response_status VARCHAR(20) NOT NULL DEFAULT 'accepted',
    ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS decline_reason TEXT;

DO $$ BEGIN
    ALTER TABLE order_assignments
        ADD CONSTRAINT order_assignments_response_status_check
        CHECK (response_status IN ('pending', 'accepted', 'declined'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Mempercepat pengecekan jadwal bentrok pegawai
CREATE INDEX IF NOT EXISTS idx_orders_booking_date ON orders (booking_date);
CREATE INDEX IF NOT EXISTS idx_order_assignments_employee ON order_assignments (employee_id);
