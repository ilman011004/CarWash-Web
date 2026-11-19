import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Shield,
  Store,
  DollarSign,
  AlertTriangle,
  Check,
  X,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  User,
  Phone,
  Percent,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export default function AdminDashboard() {
  const [report, setReport] = useState(null);
  const [stores, setStores] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchStore, setSearchStore] = useState('');

  // State Modal Reset Password Owner
  const [resetModalUser, setResetModalUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  // State Modal Edit Komisi
  const [commissionModalStore, setCommissionModalStore] = useState(null);
  const [customRate, setCustomRate] = useState('');

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
      await api.patch(`/admin/stores/${storeId}/status`, {
        is_active: !currentActive,
      });
      alert(`Toko berhasil ${!currentActive ? 'diaktifkan' : 'dinonaktifkan'}!`);
      loadAdminData();
    } catch (err) {
      alert('Gagal mengubah status aktif toko');
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

  const filteredStores = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(searchStore.toLowerCase()) ||
      s.owner_email.toLowerCase().includes(searchStore.toLowerCase()) ||
      s.owner_name.toLowerCase().includes(searchStore.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-24 text-slate-500 font-medium">Memuat data Panel Super Admin...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white py-8 px-4 shadow-lg mb-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
              <Shield className="w-6 h-6 text-purple-200" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider text-purple-200 font-bold block">
                Platform Control Center
              </span>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">Super Admin Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Manajemen Toko, Akun Pemilik, Finansial & Komisi</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 space-y-8">
        {/* Ringkasan Finansial Platform */}
        {report && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Total Pesanan Selesai
              </span>
              <h2 className="text-3xl font-black text-slate-800">{report.summary?.total_orders || 0}</h2>
              <p className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Transaksi Berhasil
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Gross GMV Transaksi
              </span>
              <h2 className="text-3xl font-black text-blue-600">
                Rp {parseInt(report.summary?.total_gross_gmv || 0).toLocaleString('id-ID')}
              </h2>
              <p className="text-xs text-slate-400 mt-2">Akumulasi volume bruto layanan</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition bg-gradient-to-br from-emerald-50/50 to-white">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Pendapatan Komisi Platform (10%)
              </span>
              <h2 className="text-3xl font-black text-emerald-600">
                Rp {parseInt(report.summary?.total_platform_revenue || 0).toLocaleString('id-ID')}
              </h2>
              <p className="text-xs text-emerald-700 font-semibold mt-2">Laba bersih sistem platform</p>
            </div>
          </div>
        )}

        {/* Manajemen Toko & Akun Pemilik (Email & Password Reset) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Store className="w-5 h-5 text-indigo-600" />
                <span>Daftar Toko & Kredensial Akun Pemilik</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola status verifikasi toko, email login pemilik, dan reset kata sandi pemilik toko.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchStore}
                onChange={(e) => setSearchStore(e.target.value)}
                placeholder="Cari toko atau email pemilik..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-indigo-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Nama Toko</th>
                  <th className="p-3">Akun Pemilik (Email & HP)</th>
                  <th className="p-3">Kredensial Akun</th>
                  <th className="p-3">Komisi Platform</th>
                  <th className="p-3">Saldo Toko</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Aksi Manajemen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStores.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition">
                    {/* Toko */}
                    <td className="p-3">
                      <strong className="text-slate-800 text-sm block">{s.name}</strong>
                      <span className="text-[11px] text-slate-400 block line-clamp-1">{s.address_text}</span>
                    </td>

                    {/* Akun Pemilik */}
                    <td className="p-3">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {s.owner_name}
                        </span>
                        <span className="text-indigo-600 font-mono flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {s.owner_email}
                        </span>
                        <span className="text-slate-500 flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {s.owner_phone || s.phone}
                        </span>
                      </div>
                    </td>

                    {/* Tombol Reset Password */}
                    <td className="p-3">
                      <button
                        onClick={() => {
                          setResetModalUser(s);
                          setNewPassword('');
                        }}
                        className="px-2.5 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 rounded-lg font-bold flex items-center gap-1 shadow-sm transition"
                        title="Reset Kata Sandi Akun Pemilik"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                        <span>Ganti Password</span>
                      </button>
                    </td>

                    {/* Komisi */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-700">
                          {s.custom_commission_rate ? `${s.custom_commission_rate}% (Khusus)` : '10.0% (Default)'}
                        </span>
                        <button
                          onClick={() => {
                            setCommissionModalStore(s);
                            setCustomRate(s.custom_commission_rate || '');
                          }}
                          className="text-blue-600 hover:underline font-semibold"
                        >
                          Ubah
                        </button>
                      </div>
                    </td>

                    {/* Saldo Toko */}
                    <td className="p-3 font-bold text-emerald-600">
                      Rp {parseInt(s.balance || 0).toLocaleString('id-ID')}
                    </td>

                    {/* Status Toko */}
                    <td className="p-3">
                      <div className="space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.is_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.is_verified ? '✓ Terverifikasi' : '⏳ Belum Verifikasi'}
                        </span>
                        <div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.is_active ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {s.is_active ? 'Aktif' : 'Non-aktif'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Aksi */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleStoreStatus(s.id, s.is_verified, s.is_active)}
                          className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
                            s.is_verified
                              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {s.is_verified ? 'Batal Verifikasi' : 'Verifikasi'}
                        </button>

                        <button
                          onClick={() => handleToggleActiveStore(s.id, s.is_active)}
                          className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] ${
                            s.is_active
                              ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {s.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Persetujuan Penarikan Saldo Toko (Withdrawals) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <span>Persetujuan Penarikan Saldo Toko (Withdrawals)</span>
          </h2>

          {withdrawals.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">Belum ada pengajuan pencairan saldo toko.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                  <tr>
                    <th className="p-3">Toko Mitra</th>
                    <th className="p-3">Pemilik</th>
                    <th className="p-3">Nominal Penarikan</th>
                    <th className="p-3">Rekening Tujuan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td className="p-3 font-bold text-slate-800">{w.store_name}</td>
                      <td className="p-3 text-slate-600">
                        {w.owner_name} ({w.owner_email})
                      </td>
                      <td className="p-3 font-black text-emerald-600 text-sm">
                        Rp {parseInt(w.amount).toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 font-mono">
                        {w.bank_name} - {w.bank_account_number} <br />
                        <span className="font-sans text-slate-400 text-[11px]">a.n {w.bank_account_holder}</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            w.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : w.status === 'rejected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {w.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {w.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleProcessWithdrawal(w.id, 'approved')}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-sm"
                            >
                              ✓ Setujui & Transfer
                            </button>
                            <button
                              onClick={() => handleProcessWithdrawal(w.id, 'rejected')}
                              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-bold text-[11px]"
                            >
                              ✕ Tolak
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
      </div>

      {/* MODAL RESET PASSWORD PEMILIK TOKO */}
      {resetModalUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-base mb-1">
              <KeyRound className="w-5 h-5" />
              <span>Ganti Password Pemilik Toko</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Atur ulang kata sandi login untuk pemilik toko <strong>{resetModalUser.name}</strong>.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl mb-4 text-xs space-y-1 border border-slate-200">
              <p>
                <strong>Nama Pemilik:</strong> {resetModalUser.owner_name}
              </p>
              <p>
                <strong>Email Login:</strong> <span className="font-mono text-indigo-600 font-bold">{resetModalUser.owner_email}</span>
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Password Baru</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan kata sandi baru (min. 6 karakter)"
                    className="w-full pl-3 pr-10 py-2.5 border border-slate-300 rounded-xl focus:outline-indigo-600 font-mono text-sm"
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

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition disabled:bg-slate-400 shadow-md shadow-indigo-500/20"
                >
                  {resetting ? 'Menyimpan...' : 'Simpan Password Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT KOMISI KHUSUS TOKO */}
      {commissionModalStore && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Percent className="w-4 h-4 text-blue-600" />
              <span>Atur Komisi Khusus Toko</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">{commissionModalStore.name}</p>

            <form onSubmit={handleSaveCommission} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Persentase Komisi (%) - Kosongkan jika pakai default (10%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="50"
                  placeholder="Contoh: 8.5"
                  value={customRate}
                  onChange={(e) => setCustomRate(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-blue-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCommissionModalStore(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
                >
                  Simpan Komisi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
