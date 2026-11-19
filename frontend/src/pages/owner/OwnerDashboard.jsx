import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Store, Users, MessageSquare, MapPin, UserPlus } from 'lucide-react';
import OrderChat from '../../components/OrderChat';
import LiveTrackingMap from '../../components/LiveTrackingMap';

const formatDate = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
};

const emptyEmployee = { name: '', email: '', phone: '', password: '', notes: '' };

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChatOrder, setActiveChatOrder] = useState(null);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState(null);

  // Penugasan & penarikan dana
  const [assignModal, setAssignModal] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankInfo, setBankInfo] = useState({ bank_name: 'BCA', bank_account_number: '', bank_account_holder: '' });

  // Pegawai
  const [employeeMode, setEmployeeMode] = useState('create'); // 'create' | 'link'
  const [newEmployee, setNewEmployee] = useState(emptyEmployee);
  const [addingEmployee, setAddingEmployee] = useState(false);

  const loadData = () => {
    Promise.all([api.get('/owner/my-store'), api.get('/orders')])
      .then(([storeRes, ordersRes]) => {
        setData(storeRes.data);
        setOrders(ordersRes.data.orders || []);
      })
      .catch((err) => console.error(err.response?.data || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setAddingEmployee(true);
    try {
      const res =
        employeeMode === 'create'
          ? await api.post('/owner/employees/create', newEmployee)
          : await api.post('/owner/employees', { email: newEmployee.email, notes: newEmployee.notes });
      alert(res.data.message || 'Pegawai ditambahkan');
      setNewEmployee(emptyEmployee);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menambahkan pegawai');
    } finally {
      setAddingEmployee(false);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    if (selectedEmployees.length < 2) {
      return alert('Aturan bisnis: Home service wajib menugaskan minimal 2 orang pegawai!');
    }
    try {
      await api.post(`/owner/orders/${orderId}/accept`, { employee_ids: selectedEmployees });
      alert('Pesanan diterima & pegawai ditugaskan!');
      setAssignModal(null);
      setSelectedEmployees([]);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menerima pesanan');
    }
  };

  const handleRejectOrder = async (orderId) => {
    const reason = prompt('Masukkan alasan penolakan pesanan:');
    if (!reason) return;
    try {
      await api.post(`/owner/orders/${orderId}/reject`, { reason });
      alert('Pesanan ditolak dan dana pelanggan dikembalikan.');
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menolak pesanan');
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    try {
      await api.post('/owner/finance/withdraw', {
        amount: parseFloat(withdrawAmount),
        ...bankInfo,
      });
      alert('Pengajuan penarikan dana berhasil!');
      setWithdrawAmount('');
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengajukan penarikan');
    }
  };

  if (loading) return <div className="text-center py-20">Memuat dashboard toko...</div>;
  if (!data?.store) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Store className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold">Anda belum mendaftarkan toko</h2>
        <p className="text-sm text-slate-500 mb-4">Daftarkan usaha car wash Anda untuk mulai menerima orderan.</p>
      </div>
    );
  }

  const { store, employees = [] } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header Info Toko & Saldo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-slate-800">{store.name}</h1>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${store.is_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
            >
              {store.is_verified ? 'Terverifikasi' : 'Menunggu Verifikasi'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">{store.address_text}</p>
          <div className="flex flex-wrap gap-4 text-xs text-slate-600 border-t border-slate-100 pt-3">
            <span>Batas Jarak: <strong>{store.max_service_distance_km} km</strong></span>
            <span>Ongkir: <strong>Rp {parseInt(store.delivery_fee_per_km, 10).toLocaleString('id-ID')}/km</strong></span>
            <span>Jumlah Pegawai: <strong>{employees.length} orang</strong></span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <span className="text-xs text-indigo-100 font-medium">Saldo Dompet Toko</span>
            <h2 className="text-2xl font-black mt-1">
              Rp {parseInt(store.balance || 0, 10).toLocaleString('id-ID')}
            </h2>
            <p className="text-[11px] text-indigo-200 mt-1">Otomatis masuk 24 jam setelah cuci selesai</p>
          </div>
          <button
            onClick={() => document.getElementById('withdraw-form')?.scrollIntoView({ behavior: 'smooth' })}
            className="w-full py-2 bg-white text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-50 mt-4"
          >
            Tarik Saldo
          </button>
        </div>
      </div>

      {/* Pegawai Toko */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          <span>Pegawai Toko</span>
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Home Service wajib minimal 2 pegawai. Berikan email dan password awal kepada pegawai agar bisa login.
        </p>

        {employees.length === 0 ? (
          <p className="text-xs text-red-500 bg-red-50 rounded-xl p-3 mb-4">
            Belum ada pegawai. Tambahkan minimal 2 pegawai agar bisa menerima pesanan Home Service.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {employees.map((emp) => (
              <div
                key={emp.store_employee_id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                  {emp.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 truncate">{emp.name}</p>
                  <p className="text-slate-500 truncate">{emp.email}</p>
                  <p className="text-slate-400">{emp.phone || '-'}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  {emp.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pilih mode */}
        <div className="flex gap-2 mb-3 border-t border-slate-100 pt-4 text-xs">
          <button
            type="button"
            onClick={() => setEmployeeMode('create')}
            className={`px-3 py-1.5 rounded-lg font-bold ${employeeMode === 'create' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
          >
            Buat akun baru
          </button>
          <button
            type="button"
            onClick={() => setEmployeeMode('link')}
            className={`px-3 py-1.5 rounded-lg font-bold ${employeeMode === 'link' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
          >
            Tautkan akun yang sudah ada
          </button>
        </div>

        <form onSubmit={handleAddEmployee} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {employeeMode === 'create' && (
            <>
              <input
                required
                placeholder="Nama pegawai"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                className="border border-slate-300 rounded-lg p-2"
              />
              <input
                placeholder="No. telepon"
                value={newEmployee.phone}
                onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                className="border border-slate-300 rounded-lg p-2"
              />
            </>
          )}

          <input
            required
            type="email"
            placeholder={employeeMode === 'create' ? 'Email (untuk login)' : 'Email akun yang sudah terdaftar'}
            value={newEmployee.email}
            onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
            className="border border-slate-300 rounded-lg p-2"
          />

          {employeeMode === 'create' ? (
            <input
              required
              type="text"
              minLength={8}
              placeholder="Password awal (min. 8 karakter)"
              value={newEmployee.password}
              onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
              className="border border-slate-300 rounded-lg p-2"
            />
          ) : (
            <input
              placeholder="Catatan (opsional)"
              value={newEmployee.notes}
              onChange={(e) => setNewEmployee({ ...newEmployee, notes: e.target.value })}
              className="border border-slate-300 rounded-lg p-2"
            />
          )}

          <button
            type="submit"
            disabled={addingEmployee}
            className="sm:col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center justify-center gap-1 py-2 disabled:bg-slate-400"
          >
            <UserPlus className="w-4 h-4" />
            {addingEmployee
              ? 'Memproses...'
              : employeeMode === 'create'
                ? 'Buat Akun Pegawai'
                : 'Tautkan ke Toko'}
          </button>
        </form>
      </div>

      {/* Pesanan Masuk */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-8 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Daftar Pesanan Toko</h2>
        {orders.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">Belum ada pesanan masuk.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="p-3">Kode Order</th>
                  <th className="p-3">Pelanggan</th>
                  <th className="p-3">Paket</th>
                  <th className="p-3">Metode</th>
                  <th className="p-3">Jadwal</th>
                  <th className="p-3">Pendapatan Bersih</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono font-bold text-slate-700">{o.order_code}</td>
                    <td className="p-3">{o.customer_name} ({o.customer_phone})</td>
                    <td className="p-3 font-semibold">{o.package_name}</td>
                    <td className="p-3 uppercase text-[11px] font-bold text-slate-600">{o.service_method}</td>
                    <td className="p-3">
                      {formatDate(o.booking_date)}
                      <span className="block text-slate-400">{o.time_slot}</span>
                    </td>
                    <td className="p-3 text-emerald-600 font-bold">
                      Rp {parseInt(o.store_earnings || 0, 10).toLocaleString('id-ID')}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {o.order_status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {['on_the_way', 'in_progress'].includes(o.order_status) && (
                          <button
                            onClick={() => setActiveTrackingOrder(o)}
                            className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[11px] font-bold hover:bg-blue-100 flex items-center gap-0.5"
                          >
                            <MapPin className="w-3 h-3" /> Pantau GPS
                          </button>
                        )}
                        <button
                          onClick={() => setActiveChatOrder(o)}
                          className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[11px] font-bold hover:bg-slate-200 flex items-center gap-0.5"
                        >
                          <MessageSquare className="w-3 h-3" /> Chat
                        </button>
                      </div>

                      {o.order_status === 'waiting_store_confirmation' && (
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => {
                              setAssignModal(o);
                              setSelectedEmployees([]);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold hover:bg-emerald-700"
                          >
                            Terima & Tugaskan
                          </button>
                          <button
                            onClick={() => handleRejectOrder(o.id)}
                            className="px-2.5 py-1 bg-red-100 text-red-700 rounded text-[11px] font-bold hover:bg-red-200"
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Formulir Penarikan Saldo */}
      <div id="withdraw-form" className="bg-white rounded-2xl border border-slate-200 p-6 max-w-xl">
        <h3 className="text-base font-bold text-slate-800 mb-2">Ajukan Penarikan Dana (Withdrawal)</h3>
        <p className="text-xs text-slate-500 mb-4">
          Saldo tersedia saat ini: Rp {parseInt(store.balance || 0, 10).toLocaleString('id-ID')}
        </p>
        <form onSubmit={handleWithdraw} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Nominal (Rp)</label>
            <input
              type="number"
              required
              min={10000}
              max={store.balance}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2"
              placeholder="Contoh: 150000"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Nama Bank / E-Wallet</label>
              <input
                type="text"
                required
                value={bankInfo.bank_name}
                onChange={(e) => setBankInfo({ ...bankInfo, bank_name: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Nomor Rekening</label>
              <input
                type="text"
                required
                value={bankInfo.bank_account_number}
                onChange={(e) => setBankInfo({ ...bankInfo, bank_account_number: e.target.value })}
                className="w-full border border-slate-300 rounded-lg p-2"
              />
            </div>
          </div>
          <div>
            <label className="block text-slate-600 font-semibold mb-1">Nama Pemilik Rekening</label>
            <input
              type="text"
              required
              value={bankInfo.bank_account_holder}
              onChange={(e) => setBankInfo({ ...bankInfo, bank_account_holder: e.target.value })}
              className="w-full border border-slate-300 rounded-lg p-2"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 mt-2"
          >
            Kirim Pengajuan Penarikan
          </button>
        </form>
      </div>

      {/* Modal Chat */}
      {activeChatOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="max-w-lg w-full relative">
            <button
              onClick={() => setActiveChatOrder(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white border border-slate-300 rounded-full font-bold shadow text-slate-700 z-10 flex items-center justify-center"
            >
              ✕
            </button>
            <OrderChat orderId={activeChatOrder.id} orderStatus={activeChatOrder.order_status} />
          </div>
        </div>
      )}

      {/* Modal Live Tracking */}
      {activeTrackingOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full relative bg-white rounded-2xl p-4 shadow-xl">
            <button
              onClick={() => setActiveTrackingOrder(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full font-bold text-slate-700 z-10 flex items-center justify-center"
            >
              ✕
            </button>
            <h3 className="text-sm font-bold text-slate-800 mb-3">
              Pantau Posisi Pegawai - Order #{activeTrackingOrder.order_code}
            </h3>
            <LiveTrackingMap
              orderId={activeTrackingOrder.id}
              orderStatus={activeTrackingOrder.order_status}
              destination={{
                latitude: activeTrackingOrder.service_latitude,
                longitude: activeTrackingOrder.service_longitude,
              }}
            />
          </div>
        </div>
      )}

      {/* Modal Penugasan */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl text-xs">
            <h3 className="text-base font-bold text-slate-800 mb-1">Tugaskan Pegawai untuk Order</h3>
            <p className="text-slate-500 mb-3 font-mono font-semibold">{assignModal.order_code}</p>
            <div className="p-3 bg-amber-50 text-amber-800 rounded-xl mb-4">
              ⚠️ <strong>Aturan Sistem:</strong> Layanan Home Service mewajibkan penugasan{' '}
              <strong>minimal 2 orang pegawai</strong> demi standar keselamatan & kecepatan pengerjaan.
            </div>

            <div className="space-y-2 mb-4">
              <span className="font-semibold text-slate-700 block">Pilih Pegawai Toko:</span>
              {employees.length === 0 ? (
                <p className="text-red-500">
                  Anda belum punya pegawai. Tutup jendela ini, lalu tambahkan pegawai di bagian "Pegawai Toko".
                </p>
              ) : (
                employees.map((emp) => {
                  const isChecked = selectedEmployees.includes(emp.store_employee_id);
                  return (
                    <label
                      key={emp.store_employee_id}
                      className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          setSelectedEmployees(
                            isChecked
                              ? selectedEmployees.filter((id) => id !== emp.store_employee_id)
                              : [...selectedEmployees, emp.store_employee_id]
                          )
                        }
                      />
                      <span className="font-medium text-slate-800">{emp.name}</span>
                      <span className="text-slate-400">({emp.phone || '-'})</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssignModal(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleAcceptOrder(assignModal.id)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700"
              >
                Konfirmasi Penugasan ({selectedEmployees.length} Terpilih)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}