import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Store,
  Users,
  MessageSquare,
  MapPin,
  UserPlus,
  LayoutDashboard,
  ClipboardList,
  Wallet,
  Clock,
  Truck,
  BadgeCheck,
  ArrowDownToLine,
  X,
  ChevronRight,
} from 'lucide-react';
import OrderChat from '../../components/OrderChat';
import LiveTrackingMap from '../../components/LiveTrackingMap';
import StoreRegistration from './store-registration';

const rupiah = (n) => 'Rp ' + parseInt(n || 0, 10).toLocaleString('id-ID');

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

const STATUS_META = {
  waiting_payment: { label: 'Menunggu Pembayaran', cls: 'bg-slate-100 text-slate-600' },
  waiting_store_confirmation: { label: 'Perlu Dikonfirmasi', cls: 'bg-amber-100 text-amber-800' },
  assigned: { label: 'Pegawai Ditugaskan', cls: 'bg-blue-100 text-blue-700' },
  on_the_way: { label: 'Dalam Perjalanan', cls: 'bg-indigo-100 text-indigo-700' },
  in_progress: { label: 'Sedang Dicuci', cls: 'bg-cyan-100 text-cyan-700' },
  completed: { label: 'Selesai', cls: 'bg-emerald-100 text-emerald-700' },
  confirmed_by_customer: { label: 'Dikonfirmasi Pelanggan', cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Dibatalkan', cls: 'bg-red-100 text-red-700' },
  rescheduled: { label: 'Dijadwal Ulang', cls: 'bg-purple-100 text-purple-700' },
  in_complaint: { label: 'Komplain', cls: 'bg-orange-100 text-orange-700' },
  refunded: { label: 'Dikembalikan', cls: 'bg-red-100 text-red-700' },
};

const ACTIVE = ['assigned', 'on_the_way', 'in_progress'];
const DONE = ['completed', 'confirmed_by_customer'];

const FILTERS = [
  { key: 'all', label: 'Semua', test: () => true },
  { key: 'pending', label: 'Perlu Konfirmasi', test: (o) => o.order_status === 'waiting_store_confirmation' },
  { key: 'active', label: 'Berjalan', test: (o) => ACTIVE.includes(o.order_status) },
  { key: 'done', label: 'Selesai', test: (o) => DONE.includes(o.order_status) },
];

const emptyEmployee = { name: '', email: '', phone: '', password: '', notes: '' };

const inputCls =
  'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition';

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${m.cls}`}>{m.label}</span>;
}

function StatCard({ icon: Icon, label, value, tone, onClick }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-md hover:-translate-y-0.5 transition"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-black text-slate-800 leading-none">{value}</p>
      <p className="text-xs text-slate-500 mt-1.5 font-medium">{label}</p>
    </button>
  );
}

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [rawOrders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [orderFilter, setOrderFilter] = useState('all');
  const [storeId, setStoreId] = useState(null); // toko yang sedang dipilih (owner bisa punya >1 toko)

  const [activeChatOrder, setActiveChatOrder] = useState(null);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [selectedEmployees, setSelectedEmployees] = useState([]);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankInfo, setBankInfo] = useState({ bank_name: 'BCA', bank_account_number: '', bank_account_holder: '' });

  const [employeeMode, setEmployeeMode] = useState('create');
  const [newEmployee, setNewEmployee] = useState(emptyEmployee);
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);

  const loadData = (id = storeId) => {
    Promise.all([
      api.get('/owner/my-store', { params: id ? { store_id: id } : {} }),
      api.get('/orders'),
    ])
      .then(([storeRes, ordersRes]) => {
        setData(storeRes.data);
        setStoreId(storeRes.data.store?.id ?? null);
        setOrders(ordersRes.data.orders || []);
      })
      .catch((err) => console.error(err.response?.data || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData(null);
  }, []);

  const switchStore = (id) => {
    setLoading(true);
    setOrderFilter('all');
    setTab('overview');
    loadData(id);
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setAddingEmployee(true);
    try {
      const res =
        employeeMode === 'create'
          ? await api.post('/owner/employees/create', { ...newEmployee, store_id: data?.store?.id })
          : await api.post('/owner/employees', { email: newEmployee.email, notes: newEmployee.notes, store_id: data?.store?.id });
      alert(res.data.message || 'Pegawai ditambahkan');
      setNewEmployee(emptyEmployee);
      setShowEmployeeForm(false);
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
      await api.post('/owner/finance/withdraw', { amount: parseFloat(withdrawAmount), ...bankInfo, store_id: data?.store?.id });
      alert('Pengajuan penarikan dana berhasil!');
      setWithdrawAmount('');
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengajukan penarikan');
    }
  };

  if (loading) return <div className="text-center py-20 text-slate-500">Memuat dashboard toko...</div>;

  // Toko belum ada, atau sudah ada tetapi belum punya paket: tampilkan wizard onboarding.
  if (!data?.store || (data.packages || []).length === 0) {
    return (
      <StoreRegistration
        key={data?.store?.id ?? 'new'}
        store={data?.store || null}
        packages={data?.packages || []}
        onFinished={(id) => {
          setLoading(true);
          loadData(id ?? null);
        }}
      />
    );
  }

  const { store, employees = [], stores: myStores = [] } = data;
  const allOrders = rawOrders;
  const pendingByStore = {};
  allOrders.forEach((o) => {
    if (o.order_status === 'waiting_store_confirmation') pendingByStore[o.store_id] = (pendingByStore[o.store_id] || 0) + 1;
  });
  // Hanya tampilkan pesanan milik toko yang sedang dipilih
  const orders = allOrders.filter((o) => o.store_id === store.id);
  const pendingCount = orders.filter((o) => o.order_status === 'waiting_store_confirmation').length;
  const activeCount = orders.filter((o) => ACTIVE.includes(o.order_status)).length;
  const doneCount = orders.filter((o) => DONE.includes(o.order_status)).length;
  const filteredOrders = orders.filter(FILTERS.find((f) => f.key === orderFilter).test);

  const NAV = [
    { key: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
    { key: 'orders', label: 'Pesanan', icon: ClipboardList, badge: pendingCount },
    { key: 'employees', label: 'Pegawai', icon: Users },
    { key: 'finance', label: 'Keuangan', icon: Wallet },
  ];

  /* ---------- Kartu pesanan (dipakai di Ringkasan & Pesanan) ---------- */
  const OrderCard = ({ o }) => (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-bold text-slate-400">#{o.order_code}</p>
          <p className="font-bold text-slate-800 mt-0.5">{o.package_name}</p>
          <p className="text-xs text-slate-500">
            {o.customer_name} · {o.customer_phone}
          </p>
        </div>
        <StatusBadge status={o.order_status} />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
        <div>
          <p className="text-slate-400">Jadwal</p>
          <p className="font-semibold text-slate-700 mt-0.5">{formatDate(o.booking_date)}</p>
          <p className="text-slate-400">{o.time_slot}</p>
        </div>
        <div>
          <p className="text-slate-400">Metode</p>
          <p className="font-semibold text-slate-700 mt-0.5 uppercase">{o.service_method}</p>
        </div>
        <div>
          <p className="text-slate-400">Pendapatan Bersih</p>
          <p className="font-bold text-emerald-600 mt-0.5">{rupiah(o.store_earnings)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {o.order_status === 'waiting_store_confirmation' && (
          <>
            <button
              onClick={() => {
                setAssignModal(o);
                setSelectedEmployees([]);
              }}
              className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
            >
              Terima & Tugaskan
            </button>
            <button
              onClick={() => handleRejectOrder(o.id)}
              className="px-3.5 py-2 bg-red-50 text-red-700 rounded-xl text-xs font-bold hover:bg-red-100"
            >
              Tolak
            </button>
          </>
        )}
        {['on_the_way', 'in_progress'].includes(o.order_status) && (
          <button
            onClick={() => setActiveTrackingOrder(o)}
            className="px-3.5 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-100 flex items-center gap-1"
          >
            <MapPin className="w-3.5 h-3.5" /> Pantau GPS
          </button>
        )}
        <button
          onClick={() => setActiveChatOrder(o)}
          className="px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 flex items-center gap-1"
        >
          <MessageSquare className="w-3.5 h-3.5" /> Chat
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ================= SIDEBAR ================= */}
        <aside className="lg:w-64 lg:shrink-0">
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center mb-3">
                <Store className="w-6 h-6" />
              </div>
              <h1 className="font-black text-slate-800 leading-snug">{store.name}</h1>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{store.address_text}</p>
              <span
                className={`inline-flex items-center gap-1 mt-3 text-[11px] px-2.5 py-1 rounded-full font-bold ${store.is_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
              >
                <BadgeCheck className="w-3.5 h-3.5" />
                {store.is_verified ? 'Terverifikasi' : 'Menunggu Verifikasi'}
              </span>
            </div>

            {myStores.length > 1 && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Toko yang dikelola
                </label>
                <select
                  value={store.id}
                  onChange={(e) => switchStore(Number(e.target.value))}
                  className={inputCls}
                >
                  {myStores.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                      {pendingByStore[st.id] ? ` (${pendingByStore[st.id]} perlu konfirmasi)` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-2">
                  Pesanan, pegawai, dan saldo ditampilkan per toko.
                </p>
              </div>
            )}

            <nav className="bg-white rounded-2xl border border-slate-200/80 p-2 flex lg:flex-col gap-1 overflow-x-auto">
              {NAV.map(({ key, label, icon: Icon, badge }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition lg:w-full ${tab === key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{label}</span>
                  {badge > 0 && (
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${tab === key ? 'bg-white text-indigo-600' : 'bg-red-500 text-white'
                        }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* ================= KONTEN ================= */}
        <section className="flex-1 min-w-0 space-y-6">
          {/* ---------- RINGKASAN ---------- */}
          {tab === 'overview' && (
            <>
              <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-600 text-white p-6 sm:p-8 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10" />
                <div className="absolute right-16 -bottom-16 w-40 h-40 rounded-full bg-white/10" />
                <div className="relative flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-indigo-100 text-sm font-medium">Saldo Dompet Toko</p>
                    <h2 className="text-3xl sm:text-4xl font-black mt-1">{rupiah(store.balance)}</h2>
                    <p className="text-indigo-200 text-xs mt-2">Otomatis masuk 24 jam setelah cuci selesai</p>
                  </div>
                  <button
                    onClick={() => setTab('finance')}
                    className="px-5 py-2.5 bg-white text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-50 flex items-center gap-2"
                  >
                    <ArrowDownToLine className="w-4 h-4" /> Tarik Saldo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Clock} label="Perlu Konfirmasi" value={pendingCount} tone="amber" onClick={() => { setOrderFilter('pending'); setTab('orders'); }} />
                <StatCard icon={Truck} label="Pesanan Berjalan" value={activeCount} tone="cyan" onClick={() => { setOrderFilter('active'); setTab('orders'); }} />
                <StatCard icon={BadgeCheck} label="Pesanan Selesai" value={doneCount} tone="emerald" onClick={() => { setOrderFilter('done'); setTab('orders'); }} />
                <StatCard icon={Users} label="Pegawai" value={employees.length} tone="indigo" onClick={() => setTab('employees')} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  ['Batas Jarak Layanan', `${store.max_service_distance_km} km`],
                  ['Ongkir per km', rupiah(store.delivery_fee_per_km)],
                  ['Total Pesanan', orders.length],
                ].map(([k, v]) => (
                  <div key={k} className="bg-white rounded-2xl border border-slate-200/80 px-5 py-4">
                    <p className="text-xs text-slate-400">{k}</p>
                    <p className="font-black text-slate-800 text-lg mt-0.5">{v}</p>
                  </div>
                ))}
              </div>

              {employees.length < 2 && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm flex items-center justify-between gap-3">
                  <span>Home Service wajib minimal 2 pegawai. Tambahkan pegawai agar bisa menerima pesanan.</span>
                  <button onClick={() => setTab('employees')} className="font-bold underline whitespace-nowrap">
                    Tambah
                  </button>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black text-slate-800">Pesanan Terbaru</h3>
                  <button onClick={() => setTab('orders')} className="text-xs font-bold text-indigo-600 flex items-center">
                    Lihat semua <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                {orders.length === 0 ? (
                  <p className="bg-white rounded-2xl border border-slate-200/80 text-sm text-slate-400 text-center py-10">
                    Belum ada pesanan masuk.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {orders.slice(0, 3).map((o) => (
                      <OrderCard key={o.id} o={o} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ---------- PESANAN ---------- */}
          {tab === 'orders' && (
            <>
              <h2 className="text-xl font-black text-slate-800">Daftar Pesanan</h2>
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => {
                  const count = orders.filter(f.test).length;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setOrderFilter(f.key)}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition ${orderFilter === f.key
                        ? 'bg-slate-800 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>
              {filteredOrders.length === 0 ? (
                <p className="bg-white rounded-2xl border border-slate-200/80 text-sm text-slate-400 text-center py-12">
                  Tidak ada pesanan pada kategori ini.
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map((o) => (
                    <OrderCard key={o.id} o={o} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ---------- PEGAWAI ---------- */}
          {tab === 'employees' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-800">Pegawai Toko</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Home Service wajib minimal 2 pegawai. Berikan email dan password awal agar pegawai bisa login.
                  </p>
                </div>
                <button
                  onClick={() => setShowEmployeeForm(true)}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Tambah Pegawai
                </button>
              </div>

              {employees.length === 0 ? (
                <p className="text-sm text-red-600 bg-red-50 rounded-2xl p-5">
                  Belum ada pegawai. Tambahkan minimal 2 pegawai agar bisa menerima pesanan Home Service.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employees.map((emp) => (
                    <div
                      key={emp.store_employee_id}
                      className="bg-white rounded-2xl border border-slate-200/80 p-5 flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-lg">
                        {emp.name?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 truncate">{emp.name}</p>
                        <p className="text-xs text-slate-500 truncate">{emp.email}</p>
                        <p className="text-xs text-slate-400">{emp.phone || '-'}</p>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        {emp.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ---------- KEUANGAN ---------- */}
          {tab === 'finance' && (
            <>
              <h2 className="text-xl font-black text-slate-800">Keuangan</h2>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white p-6 self-start">
                  <p className="text-indigo-100 text-sm">Saldo tersedia</p>
                  <p className="text-3xl font-black mt-1">{rupiah(store.balance)}</p>
                  <p className="text-indigo-200 text-xs mt-3">
                    Dana masuk otomatis 24 jam setelah pesanan selesai. Minimal penarikan Rp 10.000.
                  </p>
                </div>

                <form
                  id="withdraw-form"
                  onSubmit={handleWithdraw}
                  className="lg:col-span-3 bg-white rounded-3xl border border-slate-200/80 p-6 space-y-4"
                >
                  <h3 className="font-black text-slate-800">Ajukan Penarikan Dana</h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nominal (Rp)</label>
                    <input
                      type="number"
                      required
                      min={10000}
                      max={store.balance}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className={inputCls}
                      placeholder="Contoh: 150000"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Bank / E-Wallet</label>
                      <input
                        type="text"
                        required
                        value={bankInfo.bank_name}
                        onChange={(e) => setBankInfo({ ...bankInfo, bank_name: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nomor Rekening</label>
                      <input
                        type="text"
                        required
                        value={bankInfo.bank_account_number}
                        onChange={(e) => setBankInfo({ ...bankInfo, bank_account_number: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nama Pemilik Rekening</label>
                    <input
                      type="text"
                      required
                      value={bankInfo.bank_account_holder}
                      onChange={(e) => setBankInfo({ ...bankInfo, bank_account_holder: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700"
                  >
                    Kirim Pengajuan Penarikan
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ================= MODAL TAMBAH PEGAWAI ================= */}
      {showEmployeeForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-800 text-lg">Tambah Pegawai</h3>
              <button onClick={() => setShowEmployeeForm(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4 text-xs">
              {[
                ['create', 'Buat akun baru'],
                ['link', 'Tautkan akun yang ada'],
              ].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setEmployeeMode(k)}
                  className={`flex-1 py-2 rounded-lg font-bold transition ${employeeMode === k ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'
                    }`}
                >
                  {l}
                </button>
              ))}
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-3">
              {employeeMode === 'create' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input required placeholder="Nama pegawai" value={newEmployee.name} onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })} className={inputCls} />
                  <input placeholder="No. telepon" value={newEmployee.phone} onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })} className={inputCls} />
                </div>
              )}
              <input
                required
                type="email"
                placeholder={employeeMode === 'create' ? 'Email (untuk login)' : 'Email akun yang sudah terdaftar'}
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                className={inputCls}
              />
              {employeeMode === 'create' ? (
                <input required type="text" minLength={8} placeholder="Password awal (min. 8 karakter)" value={newEmployee.password} onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })} className={inputCls} />
              ) : (
                <input placeholder="Catatan (opsional)" value={newEmployee.notes} onChange={(e) => setNewEmployee({ ...newEmployee, notes: e.target.value })} className={inputCls} />
              )}
              <button
                type="submit"
                disabled={addingEmployee}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:bg-slate-400"
              >
                <UserPlus className="w-4 h-4" />
                {addingEmployee ? 'Memproses...' : employeeMode === 'create' ? 'Buat Akun Pegawai' : 'Tautkan ke Toko'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL CHAT ================= */}
      {activeChatOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="max-w-lg w-full relative">
            <button
              onClick={() => setActiveChatOrder(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white border border-slate-300 rounded-full shadow text-slate-700 z-10 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
            <OrderChat orderId={activeChatOrder.id} orderStatus={activeChatOrder.order_status} />
          </div>
        </div>
      )}

      {/* ================= MODAL TRACKING ================= */}
      {activeTrackingOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="max-w-2xl w-full relative bg-white rounded-3xl p-5 shadow-xl">
            <button
              onClick={() => setActiveTrackingOrder(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 z-10 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
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

      {/* ================= MODAL PENUGASAN ================= */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl text-sm">
            <h3 className="text-lg font-black text-slate-800">Tugaskan Pegawai</h3>
            <p className="text-slate-400 mb-3 font-mono text-xs font-semibold">#{assignModal.order_code}</p>
            <div className="p-3 bg-amber-50 text-amber-800 rounded-xl mb-4 text-xs">
              <strong>Aturan Sistem:</strong> Home Service mewajibkan penugasan <strong>minimal 2 pegawai</strong> demi
              keselamatan & kecepatan pengerjaan.
            </div>

            <div className="space-y-2 mb-5">
              {employees.length === 0 ? (
                <p className="text-red-500 text-xs">Anda belum punya pegawai. Tutup jendela ini lalu tambahkan di tab Pegawai.</p>
              ) : (
                employees.map((emp) => {
                  const isChecked = selectedEmployees.includes(emp.store_employee_id);
                  return (
                    <label
                      key={emp.store_employee_id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${isChecked ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                        }`}
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
                      <span className="font-semibold text-slate-800">{emp.name}</span>
                      <span className="text-slate-400 text-xs">{emp.phone || '-'}</span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAssignModal(null)} className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-600 text-sm">
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleAcceptOrder(assignModal.id)}
                className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 text-sm"
              >
                Konfirmasi ({selectedEmployees.length} dipilih)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}