import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Shield,
  Store,
  DollarSign,
  AlertTriangle,
  X,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  User,
  Phone,
  Percent,
  Search,
  TrendingUp,
  Trash2,
  LayoutDashboard,
  BadgeCheck,
  Clock,
  ChevronRight,
  Wallet,
} from 'lucide-react';

const rupiah = (n) => 'Rp ' + parseInt(n || 0, 10).toLocaleString('id-ID');

const inputCls =
  'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition';

const STORE_FILTERS = [
  { key: 'all', label: 'Semua', test: () => true },
  { key: 'unverified', label: 'Belum Verifikasi', test: (s) => !s.is_verified },
  { key: 'inactive', label: 'Non-aktif', test: (s) => !s.is_active },
];

const W_FILTERS = [
  { key: 'pending', label: 'Menunggu', test: (w) => w.status === 'pending' },
  { key: 'all', label: 'Semua', test: () => true },
];

const W_STATUS = {
  pending: { label: 'Menunggu', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Disetujui', cls: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Ditolak', cls: 'bg-red-100 text-red-800' },
};

function Pill({ children, cls }) {
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${cls}`}>{children}</span>;
}

function StatCard({ icon: Icon, label, value, tone, onClick }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="text-left bg-white rounded-2xl border border-slate-200/80 p-5 enabled:hover:shadow-md enabled:hover:-translate-y-0.5 transition"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-black text-slate-800 leading-none">{value}</p>
      <p className="text-xs text-slate-500 mt-1.5 font-medium">{label}</p>
    </button>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [report, setReport] = useState(null);
  const [stores, setStores] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState('overview');
  const [searchStore, setSearchStore] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [wFilter, setWFilter] = useState('pending');

  // Modal Reset Password Owner
  const [resetModalUser, setResetModalUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Modal Edit Komisi
  const [commissionModalStore, setCommissionModalStore] = useState(null);
  const [customRate, setCustomRate] = useState('');

  // Modal Hapus Toko
  const [deleteModalStore, setDeleteModalStore] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadAdminData = () => {
    Promise.all([
      api.get('/admin/reports/dashboard'),
      api.get('/admin/stores'),
      api.get('/admin/withdrawals'),
      api.get('/admin/complaints'),
    ])
      .then(([repRes, storesRes, wRes, cRes]) => {
        setReport(repRes.data);
        setStores(storesRes.data.stores);
        setWithdrawals(wRes.data.withdrawals);
        setComplaints(cRes.data.complaints);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleToggleStoreStatus = async (storeId, currentVerified, currentActive) => {
    try {
      await api.patch(`/admin/stores/${storeId}/status`, {
        is_verified: !currentVerified,
        is_active: currentActive,
      });
      alert('Status verifikasi toko berhasil diubah!');
      loadAdminData();
    } catch (err) {
      alert('Gagal mengubah status toko');
    }
  };

  const handleToggleActiveStore = async (storeId, currentActive) => {
    try {
      await api.patch(`/admin/stores/${storeId}/status`, { is_active: !currentActive });
      alert(`Toko berhasil ${!currentActive ? 'diaktifkan' : 'dinonaktifkan'}!`);
      loadAdminData();
    } catch (err) {
      alert('Gagal mengubah status aktif toko');
    }
  };

  const handleDeleteStore = async (e) => {
    e.preventDefault();
    setDeleting(true);
    try {
      const res = await api.delete(`/admin/stores/${deleteModalStore.id}`, {
        data: { confirm_name: deleteConfirmName },
      });
      alert(res.data.message);
      setDeleteModalStore(null);
      setDeleteConfirmName('');
      loadAdminData();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus toko');
    } finally {
      setDeleting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      return alert('Password minimal 6 karakter!');
    }
    setResetting(true);
    try {
      const res = await api.patch(`/admin/owners/${resetModalUser.owner_user_id}/reset-password`, {
        new_password: newPassword,
      });
      alert(res.data.message);
      setResetModalUser(null);
      setNewPassword('');
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal reset password');
    } finally {
      setResetting(false);
    }
  };

  const handleSaveCommission = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/admin/stores/${commissionModalStore.id}/commission`, {
        custom_commission_rate: customRate ? parseFloat(customRate) : null,
      });
      alert('Komisi toko berhasil diatur!');
      setCommissionModalStore(null);
      loadAdminData();
    } catch (err) {
      alert('Gagal mengatur komisi');
    }
  };

  const handleProcessWithdrawal = async (wId, status) => {
    const notes = prompt(`Masukkan catatan admin untuk status [${status}]:`);
    try {
      await api.patch(`/admin/withdrawals/${wId}`, { status, admin_notes: notes });
      alert(`Penarikan dana berhasil di-${status}!`);
      loadAdminData();
    } catch (err) {
      alert('Gagal memproses penarikan');
    }
  };

  if (loading) {
    return <div className="text-center py-24 text-slate-500 font-medium">Memuat data Panel Super Admin...</div>;
  }

  // ---------- Data turunan ----------
  const unverifiedCount = stores.filter((s) => !s.is_verified).length;
  const activeCount = stores.filter((s) => s.is_active).length;
  const pendingW = withdrawals.filter((w) => w.status === 'pending');
  const pendingWAmount = pendingW.reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);
  const topStores = report?.top_stores || [];

  const q = searchStore.toLowerCase();
  const filteredStores = stores
    .filter(STORE_FILTERS.find((f) => f.key === storeFilter).test)
    .filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.owner_email.toLowerCase().includes(q) ||
        s.owner_name.toLowerCase().includes(q)
    );
  const filteredW = withdrawals.filter(W_FILTERS.find((f) => f.key === wFilter).test);

  const NAV = [
    { key: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
    { key: 'stores', label: 'Toko', icon: Store, badge: unverifiedCount },
    { key: 'withdrawals', label: 'Penarikan Saldo', icon: Wallet, badge: pendingW.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 lg:py-8">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ================= SIDEBAR ================= */}
        <aside className="lg:w-64 lg:shrink-0">
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center mb-3">
                <Shield className="w-6 h-6" />
              </div>
              <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Platform Control Center</p>
              <h1 className="font-black text-slate-800 leading-snug">Super Admin</h1>
              <p className="text-xs text-slate-500 mt-1">Toko, akun pemilik, finansial & komisi</p>
            </div>

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
              <h2 className="text-xl font-black text-slate-800">Ringkasan Platform</h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Pesanan</p>
                  <p className="text-3xl font-black text-slate-800 mt-1">{report?.summary?.total_orders || 0}</p>
                  <p className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Transaksi berhasil
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Gross GMV</p>
                  <p className="text-3xl font-black text-blue-600 mt-1">{rupiah(report?.summary?.total_gross_gmv)}</p>
                  <p className="text-xs text-slate-400 mt-2">Akumulasi volume bruto layanan</p>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white p-5">
                  <p className="text-xs text-indigo-100 font-bold uppercase tracking-wider">Pendapatan Komisi</p>
                  <p className="text-3xl font-black mt-1">{rupiah(report?.summary?.total_platform_revenue)}</p>
                  <p className="text-xs text-indigo-200 mt-2">Laba bersih platform</p>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Store} label="Total Toko" value={stores.length} tone="indigo" onClick={() => { setStoreFilter('all'); setTab('stores'); }} />
                <StatCard icon={BadgeCheck} label="Toko Aktif" value={activeCount} tone="emerald" onClick={() => { setStoreFilter('all'); setTab('stores'); }} />
                <StatCard icon={Clock} label="Belum Verifikasi" value={unverifiedCount} tone="amber" onClick={() => { setStoreFilter('unverified'); setTab('stores'); }} />
                <StatCard icon={DollarSign} label="Penarikan Menunggu" value={pendingW.length} tone="blue" onClick={() => { setWFilter('pending'); setTab('withdrawals'); }} />
              </div>

              {(unverifiedCount > 0 || pendingW.length > 0) && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2 text-sm text-amber-900">
                  <p className="font-black">Perlu perhatian</p>
                  {unverifiedCount > 0 && (
                    <button onClick={() => { setStoreFilter('unverified'); setTab('stores'); }} className="flex items-center gap-1 hover:underline">
                      {unverifiedCount} toko menunggu verifikasi <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  {pendingW.length > 0 && (
                    <button onClick={() => { setWFilter('pending'); setTab('withdrawals'); }} className="flex items-center gap-1 hover:underline">
                      {pendingW.length} pengajuan penarikan senilai {rupiah(pendingWAmount)} <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
                <h3 className="font-black text-slate-800 mb-3">Toko Teratas</h3>
                {topStores.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">Belum ada data.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {topStores.map((t, i) => (
                      <div key={t.id} className="flex items-center gap-3 py-3">
                        <span className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 text-xs font-black flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="flex-1 font-semibold text-slate-800 text-sm">{t.name}</span>
                        <span className="text-xs text-slate-500">{t.total_orders} pesanan</span>
                        <span className="text-xs font-bold text-amber-600">★ {parseFloat(t.avg_rating || 0).toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ---------- TOKO ---------- */}
          {tab === 'stores' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-800">Daftar Toko</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verifikasi toko, atur komisi, reset password pemilik, atau hapus toko.
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchStore}
                    onChange={(e) => setSearchStore(e.target.value)}
                    placeholder="Cari toko atau email pemilik..."
                    className={inputCls + ' pl-9'}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {STORE_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStoreFilter(f.key)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition ${storeFilter === f.key
                      ? 'bg-slate-800 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    {f.label} ({stores.filter(f.test).length})
                  </button>
                ))}
              </div>

              {filteredStores.length === 0 ? (
                <p className="bg-white rounded-2xl border border-slate-200/80 text-sm text-slate-400 text-center py-12">
                  Tidak ada toko yang cocok.
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredStores.map((s) => (
                    <div key={s.id} className="bg-white rounded-2xl border border-slate-200/80 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-black text-slate-800">{s.name}</h3>
                          <p className="text-xs text-slate-400 mt-0.5">{s.address_text}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <Pill cls={s.is_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}>
                            {s.is_verified ? 'Terverifikasi' : 'Belum Verifikasi'}
                          </Pill>
                          <Pill cls={s.is_active ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}>
                            {s.is_active ? 'Aktif' : 'Non-aktif'}
                          </Pill>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
                        <div className="space-y-1">
                          <p className="text-slate-400">Pemilik</p>
                          <p className="font-bold text-slate-800 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" /> {s.owner_name}
                          </p>
                          <p className="text-indigo-600 font-mono flex items-center gap-1 break-all">
                            <Mail className="w-3.5 h-3.5 shrink-0" /> {s.owner_email}
                          </p>
                          <p className="text-slate-500 flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {s.owner_phone || s.phone || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Komisi Platform</p>
                          <p className="font-bold text-slate-800 mt-1">
                            {s.custom_commission_rate ? `${s.custom_commission_rate}% (Khusus)` : '10% (Default)'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-400">Saldo Toko</p>
                          <p className="font-black text-emerald-600 text-base mt-1">{rupiah(s.balance)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-4">
                        <button
                          onClick={() => handleToggleStoreStatus(s.id, s.is_verified, s.is_active)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${s.is_verified
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                        >
                          {s.is_verified ? 'Batal Verifikasi' : 'Verifikasi'}
                        </button>
                        <button
                          onClick={() => handleToggleActiveStore(s.id, s.is_active)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${s.is_active
                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                          {s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          onClick={() => {
                            setCommissionModalStore(s);
                            setCustomRate(s.custom_commission_rate || '');
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1"
                        >
                          <Percent className="w-3.5 h-3.5" /> Ubah Komisi
                        </button>
                        <button
                          onClick={() => {
                            setResetModalUser(s);
                            setNewPassword('');
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 flex items-center gap-1"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> Ganti Password
                        </button>
                        <button
                          onClick={() => {
                            setDeleteModalStore(s);
                            setDeleteConfirmName('');
                          }}
                          title="Hapus toko permanen"
                          className="sm:ml-auto px-3.5 py-2 rounded-xl text-xs font-bold border border-red-200 text-red-600 hover:bg-red-600 hover:text-white transition flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ---------- PENARIKAN SALDO ---------- */}
          {tab === 'withdrawals' && (
            <>
              <div>
                <h2 className="text-xl font-black text-slate-800">Penarikan Saldo Toko</h2>
                <p className="text-xs text-slate-500 mt-0.5">Setujui atau tolak pengajuan pencairan saldo dari toko mitra.</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {W_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setWFilter(f.key)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition ${wFilter === f.key
                      ? 'bg-slate-800 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    {f.label} ({withdrawals.filter(f.test).length})
                  </button>
                ))}
              </div>

              {filteredW.length === 0 ? (
                <p className="bg-white rounded-2xl border border-slate-200/80 text-sm text-slate-400 text-center py-12">
                  Tidak ada pengajuan penarikan.
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredW.map((w) => {
                    const st = W_STATUS[w.status] || { label: w.status, cls: 'bg-slate-100 text-slate-600' };
                    return (
                      <div key={w.id} className="bg-white rounded-2xl border border-slate-200/80 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black text-slate-800">{w.store_name}</h3>
                            <p className="text-xs text-slate-500">
                              {w.owner_name} · {w.owner_email}
                            </p>
                          </div>
                          <Pill cls={st.cls}>{st.label}</Pill>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
                          <div>
                            <p className="text-slate-400">Nominal Penarikan</p>
                            <p className="font-black text-emerald-600 text-lg mt-0.5">{rupiah(w.amount)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Rekening Tujuan</p>
                            <p className="font-mono font-semibold text-slate-700 mt-1">
                              {w.bank_name} - {w.bank_account_number}
                            </p>
                            <p className="text-slate-400">a.n {w.bank_account_holder}</p>
                          </div>
                        </div>

                        {w.status === 'pending' && (
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => handleProcessWithdrawal(w.id, 'approved')}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs"
                            >
                              Setujui & Transfer
                            </button>
                            <button
                              onClick={() => handleProcessWithdrawal(w.id, 'rejected')}
                              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-bold text-xs"
                            >
                              Tolak
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* ================= MODAL RESET PASSWORD ================= */}
      {resetModalUser && (
        <Modal onClose={() => setResetModalUser(null)}>
          <div className="flex items-center gap-2 text-amber-600 font-black text-lg mb-1 pr-8">
            <KeyRound className="w-5 h-5" />
            <span>Ganti Password Pemilik</span>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Atur ulang kata sandi login untuk pemilik toko <strong>{resetModalUser.name}</strong>.
          </p>
          <div className="p-3 bg-slate-50 rounded-xl mb-4 text-xs space-y-1 border border-slate-200">
            <p>
              <strong>Nama Pemilik:</strong> {resetModalUser.owner_name}
            </p>
            <p>
              <strong>Email Login:</strong>{' '}
              <span className="font-mono text-indigo-600 font-bold">{resetModalUser.owner_email}</span>
            </p>
          </div>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password Baru</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 karakter"
                  className={inputCls + ' pr-10 font-mono'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setResetModalUser(null)} className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-600 text-sm font-semibold hover:bg-slate-50">
                Batal
              </button>
              <button type="submit" disabled={resetting} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:bg-slate-400">
                {resetting ? 'Menyimpan...' : 'Simpan Password'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL HAPUS TOKO ================= */}
      {deleteModalStore && (
        <Modal onClose={() => setDeleteModalStore(null)}>
          <form onSubmit={handleDeleteStore} className="text-sm">
            <div className="flex items-center gap-2 text-red-600 mb-3 pr-8">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-lg font-black">Hapus Toko Permanen</h3>
            </div>
            <p className="text-slate-600 text-xs mb-3">
              Anda akan menghapus <strong>{deleteModalStore.name}</strong> beserta paket layanan, relasi pegawai,
              riwayat pesanan, chat, ulasan, komplain, dan penarikan dananya. Tindakan ini{' '}
              <strong>tidak bisa dibatalkan</strong>. Akun pemilik dan pegawai tetap ada.
            </p>
            <p className="text-slate-500 text-xs mb-3">
              Jika hanya ingin menyembunyikan toko dari pelanggan, gunakan tombol <strong>Nonaktifkan</strong>.
            </p>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ketik nama toko untuk konfirmasi:</label>
            <input
              type="text"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={deleteModalStore.name}
              className={inputCls + ' mb-4'}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteModalStore(null)} className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-600 text-sm">
                Batal
              </button>
              <button
                type="submit"
                disabled={deleting || deleteConfirmName.trim() !== deleteModalStore.name.trim()}
                className="px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:bg-slate-300"
              >
                {deleting ? 'Menghapus...' : 'Hapus Permanen'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ================= MODAL KOMISI ================= */}
      {commissionModalStore && (
        <Modal onClose={() => setCommissionModalStore(null)}>
          <h3 className="text-lg font-black text-slate-800 mb-1 flex items-center gap-2 pr-8">
            <Percent className="w-5 h-5 text-blue-600" />
            <span>Atur Komisi Khusus</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">{commissionModalStore.name}</p>
          <form onSubmit={handleSaveCommission} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Persentase Komisi (%) - kosongkan untuk default (10%)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="50"
                placeholder="Contoh: 8.5"
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                className={inputCls + ' font-bold'}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCommissionModalStore(null)} className="px-4 py-2.5 border border-slate-300 rounded-xl text-slate-600 text-sm">
                Batal
              </button>
              <button type="submit" className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold">
                Simpan Komisi
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}