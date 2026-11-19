import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Car, MapPin, Plus, Trash2 } from 'lucide-react';

export default function Profile() {
  const [vehicles, setVehicles] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [newVehicle, setNewVehicle] = useState({ vehicle_type: 'mobil', brand: '', model: '', plate_number: '' });
  const [newAddress, setNewAddress] = useState({ label: 'Rumah', address_text: '', latitude: -6.2088, longitude: 106.8456, notes: '' });

  const loadData = () => {
    api.get('/customer/vehicles').then((res) => setVehicles(res.data.vehicles));
    api.get('/customer/addresses').then((res) => setAddresses(res.data.addresses));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    try {
      await api.post('/customer/vehicles', newVehicle);
      setNewVehicle({ vehicle_type: 'mobil', brand: '', model: '', plate_number: '' });
      loadData();
    } catch (err) {
      alert('Gagal menambah kendaraan');
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
    try {
      await api.post('/customer/addresses', newAddress);
      setNewAddress({ label: 'Rumah', address_text: '', latitude: -6.2088, longitude: 106.8456, notes: '' });
      loadData();
    } catch (err) {
      alert('Gagal menambah alamat');
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">Profil & Data Tersimpan</h1>

      {/* Kendaraan Tersimpan */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Car className="w-5 h-5 text-blue-600" />
          <span>Daftar Kendaraan Saya</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {vehicles.map((v) => (
            <div key={v.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center text-xs">
              <div>
                <p className="font-bold text-slate-800 uppercase">{v.brand} {v.model}</p>
                <p className="text-slate-500 font-mono">{v.plate_number} • {v.vehicle_type}</p>
              </div>
              <button onClick={() => handleDeleteVehicle(v.id)} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

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
            placeholder="Plat (e.g. B 1234 CD)"
            value={newVehicle.plate_number}
            onChange={(e) => setNewVehicle({ ...newVehicle, plate_number: e.target.value })}
            className="border border-slate-300 rounded-lg p-2"
          />
          <button type="submit" className="bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-1">
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
          {addresses.map((a) => (
            <div key={a.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-start text-xs">
              <div>
                <span className="font-bold text-slate-800">{a.label}</span>
                <p className="text-slate-600 mt-0.5">{a.address_text}</p>
                {a.notes && <p className="text-slate-400 italic">Catatan: {a.notes}</p>}
              </div>
              <button onClick={() => handleDeleteAddress(a.id)} className="text-red-500 hover:text-red-700">
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
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold flex items-center gap-1">
            <Plus className="w-4 h-4" /> Tambah Alamat
          </button>
        </form>
      </div>
    </div>
  );
}
