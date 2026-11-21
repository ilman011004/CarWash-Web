import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { Car, MapPin, Plus, Trash2, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import LocationPicker from '../owner/store-registration/LocationPicker';

const EMPTY_ADDRESS = { label: 'Rumah', address_text: '', latitude: null, longitude: null, notes: '' };

// Alamat yang dibuat sebelum ada pemilih peta memakai koordinat bawaan Jakarta (Monas),
// bukan lokasi sebenarnya. Alamat seperti itu perlu dihapus dan dibuat ulang.
const isLegacyDefault = (a) =>
  Math.abs(parseFloat(a.latitude) + 6.2088) < 0.0001 && Math.abs(parseFloat(a.longitude) - 106.8456) < 0.0001;

export default function Profile() {
  const [vehicles, setVehicles] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [newVehicle, setNewVehicle] = useState({ vehicle_type: 'mobil', brand: '', model: '', plate_number: '' });
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS);
  const [locationError, setLocationError] = useState('');
  const [pickerKey, setPickerKey] = useState(0); // dinaikkan setelah simpan agar peta & kolom koordinat bersih lagi

  const loadData = () => {
    Promise.all([api.get('/customer/vehicles'), api.get('/customer/addresses')])
      .then(([v, a]) => {
        setVehicles(v.data.vehicles || []);
        setAddresses(a.data.addresses || []);
        setLoadError('');
      })
      .catch((err) => {
        console.error(err.response?.data || err.message);
        setLoadError('Gagal memuat data. Coba muat ulang halaman.');
      })
      .finally(() => setLoaded(true));
  };

  useEffect(() => {
    loadData();
  }, []);

  const hasVehicle = vehicles.length > 0;
  const hasAddress = addresses.some((a) => !isLegacyDefault(a));
  const allDone = hasVehicle && hasAddress;

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customer/vehicles', newVehicle);
      setNewVehicle({ vehicle_type: 'mobil', brand: '', model: '', plate_number: '' });
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menambah kendaraan');
    }
  };

  const handleDeleteVehicle = async (id) => {
    try {
      await api.delete(`/customer/vehicles/${id}`);
      loadData();
    } catch (err) {
      alert('Gagal menghapus');
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();

    if (newAddress.latitude == null || newAddress.longitude == null) {
      setLocationError('Tentukan titik lokasi alamat: klik peta, cari alamat, atau ketik koordinat.');
      return;
    }
    setLocationError('');

    try {
      await api.post('/customer/addresses', newAddress);
      setNewAddress(EMPTY_ADDRESS);
      setPickerKey((k) => k + 1);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menambah alamat');
    }
  };

  const handleDeleteAddress = async (id) => {
    try {
      await api.delete(`/customer/addresses/${id}`);
      loadData();
    } catch (err) {
      alert('Gagal menghapus');
    }
  };

  const Step = ({ done, number, title, hint }) => (
    <div className="flex items-start gap-3">
      {done ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-slate-300 shrink-0" />
      )}
      <div className="text-xs">
        <p className={`font-bold ${done ? 'text-emerald-700' : 'text-slate-800'}`}>
          {number}. {title}
        </p>
        {!done && <p className="text-slate-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Profil & Data Tersimpan</h1>
        <p className="text-xs text-slate-500 mt-1">
          Kendaraan dan alamat dipakai saat memesan cuci dan untuk menampilkan toko terdekat.
        </p>
      </div>

      {loadError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">{loadError}</div>
      )}

      {/* Checklist kelengkapan data */}
      {loaded && (
        <div
          className={`rounded-2xl border p-5 ${allDone ? 'bg-emerald-50 border-emerald-200' : 'bg-indigo-50 border-indigo-200'}`}
        >
          {allDone ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-emerald-800">
                Data Anda sudah lengkap. Anda siap memesan cuci kendaraan.
              </p>
              <Link
                to="/"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg"
              >
                Cari Toko Terdekat
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm font-bold text-indigo-900 mb-3">
                Lengkapi 2 langkah ini sebelum memesan:
              </p>
              <div className="space-y-3">
                <Step
                  done={hasVehicle}
                  number={1}
                  title="Tambah kendaraan"
                  hint="Dibutuhkan untuk menentukan harga paket (mobil atau motor)."
                />
                <Step
                  done={hasAddress}
                  number={2}
                  title="Tambah alamat dengan titik di peta"
                  hint="Dibutuhkan untuk menampilkan toko terdekat, menghitung ongkir, dan lokasi pencucian."
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Kendaraan Tersimpan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Car className="w-5 h-5 text-blue-600" />
          <span>Daftar Kendaraan Saya</span>
        </h2>

        {loaded && vehicles.length === 0 ? (
          <p className="text-xs text-slate-500 mb-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4">
            Belum ada kendaraan. Isi form di bawah untuk menambahkan mobil atau motor Anda.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {vehicles.map((v) => (
              <div key={v.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-slate-800 uppercase">{v.brand} {v.model}</p>
                  <p className="text-slate-500 font-mono">{v.plate_number} • {v.vehicle_type}</p>
                </div>
                <button onClick={() => handleDeleteVehicle(v.id)} className="text-red-500 hover:text-red-700" aria-label="Hapus kendaraan">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Form Tambah Kendaraan */}
        <form onSubmit={handleAddVehicle} className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs border-t border-slate-100 pt-4">
          <select
            value={newVehicle.vehicle_type}
            onChange={(e) => setNewVehicle({ ...newVehicle, vehicle_type: e.target.value })}
            className="border border-slate-300 rounded-lg p-2"
          >
            <option value="mobil">Mobil</option>
            <option value="motor">Motor</option>
          </select>
          <input
            required
            placeholder="Merek (e.g. Honda)"
            value={newVehicle.brand}
            onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
            className="border border-slate-300 rounded-lg p-2"
          />
          <input
            required
            placeholder="Model (e.g. HR-V)"
            value={newVehicle.model}
            onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
            className="border border-slate-300 rounded-lg p-2"
          />
          <input
            required
            placeholder="Plat (e.g. DA 1234 CD)"
            value={newVehicle.plate_number}
            onChange={(e) => setNewVehicle({ ...newVehicle, plate_number: e.target.value })}
            className="border border-slate-300 rounded-lg p-2"
          />
          <button type="submit" className="bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-1 py-2">
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </form>
      </div>

      {/* Alamat Tersimpan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-indigo-600" />
          <span>Alamat Tersimpan</span>
        </h2>

        <div className="space-y-3 mb-6">
          {loaded && addresses.length === 0 && (
            <p className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4">
              Belum ada alamat. Tambahkan alamat di bawah agar toko terdekat bisa ditampilkan dan pesanan bisa dibuat.
            </p>
          )}
          {addresses.map((a) => (
            <div key={a.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-start gap-3 text-xs">
              <div className="min-w-0">
                <span className="font-bold text-slate-800">{a.label}</span>
                {a.is_default && (
                  <span className="ml-2 text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    Utama
                  </span>
                )}
                <p className="text-slate-600 mt-0.5">{a.address_text}</p>
                {a.notes && <p className="text-slate-400 italic">Catatan: {a.notes}</p>}
                <p className="text-[11px] font-mono text-slate-400 mt-1">
                  {parseFloat(a.latitude).toFixed(6)}, {parseFloat(a.longitude).toFixed(6)}
                </p>
                {isLegacyDefault(a) && (
                  <p className="mt-1.5 inline-flex items-start gap-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    Titik lokasi alamat ini belum diatur (masih koordinat bawaan Jakarta). Hapus lalu tambahkan ulang dengan titik yang benar.
                  </p>
                )}
              </div>
              <button onClick={() => handleDeleteAddress(a.id)} className="text-red-500 hover:text-red-700 shrink-0" aria-label="Hapus alamat">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Form Tambah Alamat */}
        <form onSubmit={handleAddAddress} className="space-y-3 text-xs border-t border-slate-100 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              required
              placeholder="Label Alamat (e.g. Rumah, Kantor)"
              value={newAddress.label}
              onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
              className="border border-slate-300 rounded-lg p-2"
            />
            <input
              placeholder="Catatan Lokasi (e.g. Depan gapura)"
              value={newAddress.notes}
              onChange={(e) => setNewAddress({ ...newAddress, notes: e.target.value })}
              className="border border-slate-300 rounded-lg p-2"
            />
          </div>
          <textarea
            required
            rows={2}
            placeholder="Alamat Lengkap (Jl. Mawar No 10, RT 01/RW 02...)"
            value={newAddress.address_text}
            onChange={(e) => setNewAddress({ ...newAddress, address_text: e.target.value })}
            className="w-full border border-slate-300 rounded-lg p-2"
          />

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Titik Lokasi di Peta</p>
            <LocationPicker
              key={pickerKey}
              latitude={newAddress.latitude}
              longitude={newAddress.longitude}
              error={locationError}
              onChange={(latitude, longitude) => {
                setNewAddress((prev) => ({ ...prev, latitude, longitude }));
                if (latitude != null) setLocationError('');
              }}
            />
          </div>

          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-1">
            <Plus className="w-4 h-4" /> Tambah Alamat
          </button>
        </form>
      </div>
    </div>
  );
}