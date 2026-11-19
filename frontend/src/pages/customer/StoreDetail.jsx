import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { MapPin, Star } from 'lucide-react';

export default function StoreDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [storeData, setStoreData] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState('home_service');
  const [hasWater, setHasWater] = useState(true);
  const [bookingDate, setBookingDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('08:00 - 10:00');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  // Ambil detail toko
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    api
      .get(`/stores/${id}`)
      .then((res) => {
        if (!cancelled) setStoreData(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err.response?.status;
        setStoreData(null);
        setError(
          status === 404 || status === 400
            ? 'Toko tidak ditemukan.'
            : err.response?.data?.message || 'Gagal memuat detail toko. Coba lagi nanti.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Ambil kendaraan & alamat tersimpan milik pelanggan
  useEffect(() => {
    if (!user || user.role !== 'customer') return;

    api
      .get('/customer/vehicles')
      .then((res) => {
        const list = res.data.vehicles || [];
        setVehicles(list);
        if (list.length > 0) setSelectedVehicle(list[0].id);
      })
      .catch((err) => console.error('Gagal memuat kendaraan:', err.response?.data || err.message));

    api
      .get('/customer/addresses')
      .then((res) => {
        const list = res.data.addresses || [];
        const def = list.find((a) => a.is_default) || list[0];
        if (def) setAddress(def.address_text);
      })
      .catch((err) => console.error('Gagal memuat alamat:', err.response?.data || err.message));
  }, [user]);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Silakan login terlebih dahulu untuk memesan.');
      return navigate('/login');
    }
    if (!selectedPackage) {
      return alert('Pilih salah satu paket cuci terlebih dahulu.');
    }
    if (!selectedVehicle) {
      return alert('Pilih atau daftarkan kendaraan terlebih dahulu di Profil.');
    }
    if (!bookingDate) {
      return alert('Pilih tanggal cuci.');
    }

    setSubmitting(true);
    try {
      const payload = {
        store_id: parseInt(id, 10),
        vehicle_id: parseInt(selectedVehicle, 10),
        package_id: selectedPackage.id,
        service_method: selectedMethod,
        service_address: address || 'Alamat lokasi pelanggan',
        service_latitude: parseFloat(storeData.store.latitude),
        service_longitude: parseFloat(storeData.store.longitude),
        has_water_source: hasWater,
        customer_notes: notes,
        booking_date: bookingDate,
        time_slot: timeSlot,
      };

      const res = await api.post('/orders', payload);
      alert('Pesanan berhasil dibuat! Lanjutkan ke pembayaran.');
      navigate(`/orders/${res.data.order.id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal membuat pesanan');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-center py-20">Memuat detail toko...</div>;

  if (error || !storeData) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-700 font-semibold mb-3">{error || 'Toko tidak ditemukan.'}</p>
        <Link to="/" className="text-blue-600 underline text-sm">
          Kembali ke daftar toko
        </Link>
      </div>
    );
  }

  const { store, packages = [], reviews = [] } = storeData;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header Toko */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 flex flex-col md:flex-row gap-6 items-start">
        <div className="w-full md:w-64 h-44 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0">
          {store.image_url ? (
            <img src={store.image_url} alt={store.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400">
              Foto Toko
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold text-slate-800">{store.name}</h1>
            {store.is_verified && (
              <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Terverifikasi
              </span>
            )}
          </div>

          <p className="text-sm text-slate-600 flex items-center gap-1 mb-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            {store.address_text}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-4">
            <span className="flex items-center gap-1 font-bold text-amber-500">
              <Star className="w-4 h-4 fill-amber-400" /> {store.avg_rating} ({store.review_count} ulasan)
            </span>
            <span>• Jarak maksimal: {store.max_service_distance_km} km</span>
            <span>• Ongkir: Rp {parseInt(store.delivery_fee_per_km, 10).toLocaleString('id-ID')} / km</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Paket & Ulasan */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-slate-800">Pilihan Paket Cuci</h2>

          {packages.length === 0 ? (
            <p className="text-sm text-slate-400 bg-white border border-slate-200 rounded-xl p-6">
              Toko ini belum memiliki paket cuci aktif.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition ${selectedPackage?.id === pkg.id
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-800">{pkg.name}</h3>
                    {pkg.is_waterless && (
                      <span className="text-[10px] bg-sky-100 text-sky-700 font-semibold px-2 py-0.5 rounded">
                        Waterless
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{pkg.description}</p>
                  <div className="text-sm font-semibold text-slate-700 flex justify-between border-t border-slate-100 pt-2">
                    <span>Mobil: Rp {parseInt(pkg.price_car, 10).toLocaleString('id-ID')}</span>
                    <span>Motor: Rp {parseInt(pkg.price_motorcycle, 10).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ulasan */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold mb-4">Ulasan Pelanggan</h3>
            {reviews.length === 0 ? (
              <p className="text-slate-400 text-sm">Belum ada ulasan untuk toko ini.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div key={r.id} className="border-b border-slate-100 pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{r.customer_name}</span>
                      <span className="text-amber-500 text-xs flex items-center gap-0.5">⭐ {r.rating}</span>
                    </div>
                    <p className="text-xs text-slate-600">{r.comment}</p>
                    {r.store_reply && (
                      <div className="mt-2 bg-slate-50 p-2.5 rounded-lg border-l-2 border-blue-500 text-xs">
                        <span className="font-semibold text-slate-700 block">Balasan Pemilik:</span>
                        <span className="text-slate-600">{r.store_reply}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Form Pemesanan */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 h-fit sticky top-24">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Formulir Pemesanan</h2>
          <form onSubmit={handleCheckout} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kendaraan</label>
              {vehicles.length === 0 ? (
                <div className="text-xs text-red-500 mb-1">
                  Belum ada kendaraan tersimpan.{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/profile')}
                    className="underline text-blue-600"
                  >
                    Tambah Kendaraan
                  </button>
                </div>
              ) : (
                <select
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.plate_number}) - {v.vehicle_type}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Metode Layanan</label>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2"
              >
                <option value="home_service">Home Service (Cuci di rumah)</option>
                <option value="pickup_delivery">Jemput-Antar</option>
                <option value="self_service">Antar Sendiri ke Toko</option>
              </select>
            </div>

            {selectedMethod === 'home_service' && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <label className="block text-xs font-semibold text-blue-900 mb-2">
                  Apakah di lokasi tersedia sumber air?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-blue-900 cursor-pointer">
                    <input
                      type="radio"
                      name="water"
                      checked={hasWater === true}
                      onChange={() => setHasWater(true)}
                    />
                    <span>Ya, Ada</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-blue-900 cursor-pointer">
                    <input
                      type="radio"
                      name="water"
                      checked={hasWater === false}
                      onChange={() => setHasWater(false)}
                    />
                    <span>Tidak Ada (Pakai Tangki/Waterless)</span>
                  </label>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal Layanan</label>
              <input
                type="date"
                required
                min={today}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Slot Waktu (Per 2 Jam)</label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2"
              >
                <option value="08:00 - 10:00">08:00 - 10:00</option>
                <option value="10:00 - 12:00">10:00 - 12:00</option>
                <option value="13:00 - 15:00">13:00 - 15:00</option>
                <option value="15:00 - 17:00">15:00 - 17:00</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Alamat Lengkap</label>
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Jl. Mawar No. 12..."
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Catatan Tambahan</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Pagar warna hitam..."
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition disabled:bg-slate-400"
            >
              {submitting ? 'Memproses...' : 'Lanjut ke Pembayaran'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}