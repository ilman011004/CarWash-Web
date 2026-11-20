import api from './api';

// Mendaftarkan toko baru untuk owner yang sedang login.
// Backend: POST /api/stores (butuh role "owner"). Mengembalikan { message, store }.
export async function registerStore(payload) {
    const res = await api.post('/stores', payload);
    return res.data;
}

// Menambah paket cuci ke toko milik owner.
// Backend: POST /api/owner/packages (store_id dikirim di body). Mengembalikan paket baru.
export async function addPackage(storeId, payload) {
    const res = await api.post('/owner/packages', { ...payload, store_id: storeId });
    return res.data.package;
}