// Aturan di sini disamakan dengan skema zod di backend (routes/stores.js)
// supaya kesalahan terlihat langsung di form, bukan baru setelah dikirim.
import { COORD_LIMITS, INDONESIA_BOUNDS } from './constants';

const toNumber = (value) => (value === '' || value == null ? NaN : Number(value));

/* ------------------------------ Koordinat ------------------------------ */

// Ubah teks menjadi angka koordinat. Menerima koma desimal ("-3,3167") dan tanda
// minus bergaya Unicode ("−") yang sering ikut tersalin dari web. Hasil NaN = tidak valid.
export function parseCoordinate(text) {
    const clean = String(text ?? '')
        .replace(/[\u2212\u2012\u2013\u2014]/g, '-')
        .trim()
        .replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(clean)) return NaN;
    return Number(clean);
}

// Membaca pasangan koordinat dari satu teks, misalnya hasil salin dari Google Maps:
// "-3.316694, 114.590111". Mengembalikan { lat, lng } atau null bila bukan pasangan.
export function parseCoordinatePair(text) {
    const clean = String(text ?? '')
        .replace(/[\u2212\u2012\u2013\u2014]/g, '-')
        .trim();
    const m = clean.match(/^(-?\d+(?:[.,]\d+)?)(?:\s*;\s*|\s*,\s+|\s+|,)(-?\d+(?:[.,]\d+)?)$/);
    if (!m) return null;
    const lat = parseCoordinate(m[1]);
    const lng = parseCoordinate(m[2]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export const isValidLat = (n) => Number.isFinite(n) && n >= COORD_LIMITS.lat[0] && n <= COORD_LIMITS.lat[1];
export const isValidLng = (n) => Number.isFinite(n) && n >= COORD_LIMITS.lng[0] && n <= COORD_LIMITS.lng[1];

const inRange = (n, [min, max]) => n >= min && n <= max;

// 'ok' bila titik berada di dalam kotak kasar Indonesia, selain itu 'outside'.
export function checkRegion(lat, lng) {
    return inRange(lat, INDONESIA_BOUNDS.lat) && inRange(lng, INDONESIA_BOUNDS.lng) ? 'ok' : 'outside';
}

// Angka yang tidak mungkin jadi latitude tetapi pas sebagai longitude Indonesia (95 s/d 141).
// Dipakai untuk memberi petunjuk bila owner menukar isi kolom lintang dan bujur.
export function looksLikeIndonesianLongitude(n) {
    return Number.isFinite(n) && inRange(n, INDONESIA_BOUNDS.lng);
}

/* ------------------------------ Toko ------------------------------ */

export function validateStoreForm(values) {
    const errors = {};

    if (values.name.trim().length < 3) errors.name = 'Nama toko minimal 3 karakter';
    if (values.phone.trim().length < 8) errors.phone = 'Nomor telepon minimal 8 karakter';
    if (values.address_text.trim().length < 5) errors.address_text = 'Alamat minimal 5 karakter';

    if (!isValidLat(values.latitude) || !isValidLng(values.longitude)) {
        errors.location = 'Tentukan titik lokasi toko: klik peta, cari alamat, atau ketik koordinat.';
    }

    const distance = toNumber(values.max_service_distance_km);
    if (!Number.isFinite(distance) || distance <= 0) {
        errors.max_service_distance_km = 'Isi jarak layanan lebih dari 0 km';
    }

    const fee = toNumber(values.delivery_fee_per_km);
    if (!Number.isFinite(fee) || fee < 0) {
        errors.delivery_fee_per_km = 'Isi tarif antar (boleh 0 jika gratis)';
    }

    return errors;
}

// Ubah isi form menjadi body request. Backend meminta angka sungguhan, bukan string.
export function buildStorePayload(values) {
    return {
        name: values.name.trim(),
        phone: values.phone.trim(),
        address_text: values.address_text.trim(),
        latitude: values.latitude,
        longitude: values.longitude,
        max_service_distance_km: Number(values.max_service_distance_km),
        delivery_fee_per_km: Number(values.delivery_fee_per_km),
    };
}

/* ------------------------------ Paket ------------------------------ */

export function validatePackageForm(values) {
    const errors = {};

    if (values.name.trim().length < 3) errors.name = 'Nama paket minimal 3 karakter';

    const car = toNumber(values.price_car);
    const motor = toNumber(values.price_motorcycle);
    if (!Number.isFinite(car) || car < 0) errors.price_car = 'Isi harga mobil (0 jika tidak melayani mobil)';
    if (!Number.isFinite(motor) || motor < 0) errors.price_motorcycle = 'Isi harga motor (0 jika tidak melayani motor)';
    if (!errors.price_car && !errors.price_motorcycle && car === 0 && motor === 0) {
        errors.price_car = 'Isi minimal salah satu harga (mobil atau motor)';
    }

    const minutes = toNumber(values.estimated_duration_minutes);
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 480) {
        errors.estimated_duration_minutes = 'Durasi antara 15 dan 480 menit';
    }

    return errors;
}

export function buildPackagePayload(values) {
    return {
        name: values.name.trim(),
        description: values.description.trim() || null,
        is_waterless: !!values.is_waterless,
        price_car: Number(values.price_car),
        price_motorcycle: Number(values.price_motorcycle),
        estimated_duration_minutes: Number(values.estimated_duration_minutes),
    };
}