// Nilai awal form pendaftaran toko.
// Jarak layanan & tarif antar sama dengan default di backend (routes/stores.js).
export const INITIAL_FORM = {
    name: '',
    phone: '',
    address_text: '',
    latitude: null,
    longitude: null,
    max_service_distance_km: '15',
    delivery_fee_per_km: '3000',
};

// Nilai awal form paket cuci (langkah 2).
export const INITIAL_PACKAGE = {
    name: '',
    description: '',
    price_car: '',
    price_motorcycle: '',
    estimated_duration_minutes: '60',
    is_waterless: false,
};

// Template cepat supaya owner tidak mulai dari form kosong. Harga sengaja tidak diisi
// karena berbeda di tiap daerah dan tiap toko.
export const PACKAGE_TEMPLATES = [
    {
        label: 'Cuci Reguler',
        values: {
            name: 'Cuci Reguler',
            description: 'Cuci bodi luar, bilas, dan pengeringan.',
            estimated_duration_minutes: '45',
            is_waterless: false,
        },
    },
    {
        label: 'Cuci + Interior',
        values: {
            name: 'Cuci + Vakum Interior',
            description: 'Cuci bodi luar, vakum jok dan karpet, serta lap dashboard.',
            estimated_duration_minutes: '75',
            is_waterless: false,
        },
    },
    {
        label: 'Waterless',
        values: {
            name: 'Cuci Waterless',
            description: 'Cuci tanpa air mengalir. Cocok untuk home service tanpa sumber air.',
            estimated_duration_minutes: '45',
            is_waterless: true,
        },
    },
];

// Peta awal: seluruh Indonesia. Setelah owner memilih titik, peta mendekat.
export const MAP_DEFAULT_CENTER = [-2.5, 118.0];
export const MAP_DEFAULT_ZOOM = 5;
export const MAP_PICKED_ZOOM = 17;

// Batas koordinat yang valid secara global dan kotak kasar wilayah Indonesia.
// Kotak Indonesia hanya dipakai untuk peringatan, bukan untuk menolak input.
export const COORD_LIMITS = { lat: [-90, 90], lng: [-180, 180] };
export const INDONESIA_BOUNDS = { lat: [-11.5, 6.5], lng: [94.5, 141.5] };

// Langkah yang ditampilkan di indikator atas wizard.
export const REGISTRATION_STEPS = [
    {
        key: 'register',
        title: 'Data & lokasi toko',
        desc: 'Isi nama, alamat, dan titik lokasi toko Anda.',
    },
    {
        key: 'packages',
        title: 'Paket & harga',
        desc: 'Buat minimal satu paket cuci beserta harga mobil dan motor.',
    },
    {
        key: 'verify',
        title: 'Verifikasi admin',
        desc: 'Setelah disetujui admin, toko Anda tampil di pencarian pelanggan.',
    },
];