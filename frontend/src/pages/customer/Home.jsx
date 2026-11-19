import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { dummyStores } from '../../services/mockData';
import {
  MapPin,
  Star,
  Sparkles,
  Navigation,
  Search,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export default function Home() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false); // true jika backend tidak bisa dihubungi
  const [outOfRange, setOutOfRange] = useState(false); // true jika tidak ada toko di radius pengguna
  const [userCoords, setUserCoords] = useState(null); // null = lokasi belum diketahui
  const [serviceMethod, setServiceMethod] = useState('');
  const [minRating, setMinRating] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Ambil lokasi pengguna. Jika ditolak, koordinat tetap null (tidak memakai Jakarta).
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserCoords(null)
      );
    }
  }, []);

  // Ambil daftar toko dari API
  useEffect(() => {
    let cancelled = false;

    const baseParams = {};
    if (serviceMethod) baseParams.service_method = serviceMethod;
    if (minRating) baseParams.min_rating = minRating;

    const load = async () => {
      setLoading(true);
      setIsDemo(false);
      setOutOfRange(false);

      try {
        const params = userCoords ? { ...baseParams, lat: userCoords.lat, lng: userCoords.lng } : baseParams;
        const res = await api.get('/stores', { params });
        let list = res.data.stores || [];

        // Ada lokasi tapi tidak ada toko dalam jangkauan: tampilkan semua toko tanpa filter jarak
        if (list.length === 0 && userCoords) {
          const resAll = await api.get('/stores', { params: baseParams });
          list = resAll.data.stores || [];
          if (list.length > 0 && !cancelled) setOutOfRange(true);
        }

        if (!cancelled) setStores(list);
      } catch (err) {
        console.error('Gagal memuat toko:', err.response?.data || err.message);
        if (!cancelled) {
          // Backend tidak bisa dihubungi: tampilkan data demo (tidak bisa dipesan)
          let filtered = [...dummyStores];
          if (serviceMethod) {
            filtered = filtered.filter((s) => s.service_methods?.includes(serviceMethod));
          }
          if (minRating) {
            filtered = filtered.filter((s) => parseFloat(s.avg_rating) >= parseFloat(minRating));
          }
          setStores(filtered);
          setIsDemo(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userCoords, serviceMethod, minRating]);

  const q = searchQuery.toLowerCase();
  const displayStores = stores.filter(
    (s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.address_text || '').toLowerCase().includes(q)
  );

  const normalizeMethods = (sm) =>
    Array.isArray(sm)
      ? sm
      : typeof sm === 'string'
        ? sm.replace(/[{}]/g, '').split(',').filter(Boolean)
        : [];

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 text-white pt-12 pb-20 px-4">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold tracking-wide text-cyan-200 mb-6 shadow-inner">
            <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
            <span>Marketplace Cuci Kendaraan #1 Panggilan ke Rumah</span>
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight mb-4 drop-shadow-sm">
            Mobil & Motor Kinclong, <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-amber-200">
              Tanpa Harus Antre Keluar Rumah
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm md:text-base text-blue-100/90 mb-8 leading-relaxed font-normal">
            Pesan teknisi cuci berpengalaman datang langsung ke lokasi Anda. Lengkap dengan opsi
            <span className="font-semibold text-white"> Waterless Eco</span>, peralatan modern, live tracking GPS, dan reschedule gratis saat cuaca hujan!
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold text-white/90">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Min. 2 Pegawai Standar Aman</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              <span>Bisa Tanpa Sumber Air (Waterless)</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur border border-white/10">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Garansi Reschedule Hujan</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="max-w-6xl mx-auto px-4 -mt-10 relative z-20">
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-5 md:p-6 backdrop-blur">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama toko cuci atau area..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs md:text-sm focus:outline-blue-600 transition"
              />
            </div>

            <div className="md:col-span-4">
              <select
                value={serviceMethod}
                onChange={(e) => setServiceMethod(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs md:text-sm font-medium text-slate-700 focus:outline-blue-600"
              >
                <option value="">Semua Metode Layanan</option>
                <option value="home_service">🏠 Home Service (Cuci di Rumah)</option>
                <option value="pickup_delivery">🚗 Jemput-Antar</option>
                <option value="self_service">📍 Datang Sendiri</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs md:text-sm font-medium text-slate-700 focus:outline-blue-600"
              >
                <option value="">Semua Rating Toko</option>
                <option value="4.8">⭐ 4.8 ke atas (Terbaik)</option>
                <option value="4.5">⭐ 4.5 ke atas</option>
                <option value="4.0">⭐ 4.0 ke atas</option>
              </select>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium text-blue-600">
              <Navigation className="w-3.5 h-3.5 animate-pulse" />
              <span>
                {userCoords
                  ? 'Toko diurutkan dari yang terdekat dengan lokasi Anda'
                  : 'Aktifkan izin lokasi untuk melihat jarak toko'}
              </span>
            </span>
            <span className="text-slate-400">
              Menampilkan <strong>{displayStores.length}</strong> toko mitra siap melayani
            </span>
          </div>
        </div>
      </div>

      {/* Daftar Toko */}
      <div className="max-w-7xl mx-auto px-4 pt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Toko Cuci Terdekat</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih toko favorit Anda untuk melihat paket cuci dan jadwal slot
            </p>
          </div>
        </div>

        {isDemo && (
          <div className="mb-6 flex items-start gap-2 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Server tidak dapat dihubungi, jadi yang tampil adalah data contoh dan belum bisa dipesan.
              Pastikan backend berjalan di port 4000.
            </span>
          </div>
        )}

        {outOfRange && (
          <div className="mb-6 flex items-start gap-2 p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Belum ada toko dalam jangkauan lokasi Anda. Berikut semua toko yang tersedia.
            </span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm">Memuat daftar toko...</div>
        ) : displayStores.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
            Tidak ada toko yang cocok dengan pencarian atau filter Anda.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {displayStores.map((store) => (
              <div
                key={store.id}
                className="group bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="h-48 relative overflow-hidden bg-slate-100">
                    {store.image_url ? (
                      <img
                        src={store.image_url}
                        alt={store.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                        Foto Toko
                      </div>
                    )}

                    {store.badge && (
                      <div
                        className={`absolute top-3 left-3 bg-gradient-to-r ${store.badge_color || 'from-blue-600 to-indigo-600'} text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md uppercase tracking-wide`}
                      >
                        {store.badge}
                      </div>
                    )}

                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow text-slate-800">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{store.avg_rating}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({store.review_count})</span>
                    </div>

                    {store.distance_km != null && (
                      <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow">
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        <span>{Number(store.distance_km).toFixed(1)} km</span>
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-600 transition line-clamp-1 mb-1">
                      {store.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-1 mb-4 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{store.address_text}</span>
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {normalizeMethods(store.service_methods).map((m) => (
                        <span
                          key={m}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${m === 'home_service'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : m === 'pickup_delivery'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                        >
                          {m === 'home_service' && '🏠 Home Service'}
                          {m === 'pickup_delivery' && '🚗 Jemput'}
                          {m === 'self_service' && '📍 Datang Sendiri'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Mulai Dari</span>
                    <span className="text-sm font-extrabold text-blue-600">
                      Rp {Number(store.starting_price || 35000).toLocaleString('id-ID')}
                    </span>
                  </div>

                  {isDemo ? (
                    <span className="px-4 py-2 bg-slate-200 text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed">
                      Contoh
                    </span>
                  ) : (
                    <Link
                      to={`/stores/${store.id}`}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition flex items-center gap-1"
                    >
                      <span>Pesan</span>
                      <span className="text-blue-200">→</span>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}