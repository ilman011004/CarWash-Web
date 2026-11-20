import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Droplets } from 'lucide-react';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register({ name, email, phone, password, role });
      if (user.role === 'owner') navigate('/owner');
      else navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Pendaftaran gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-full mb-3">
            <Droplets className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Buat Akun Baru</h1>
          <p className="text-xs text-slate-500 mt-1">Gabung sebagai Pelanggan atau Pemilik Toko</p>
        </div>

        {error && <div className="p-3 mb-4 text-xs bg-red-50 text-red-700 rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Mendaftar Sebagai</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold ${role === 'customer' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200'
                  }`}
              >
                <input
                  type="radio"
                  name="role"
                  className="hidden"
                  checked={role === 'customer'}
                  onChange={() => setRole('customer')}
                />
                Pelanggan
              </label>
              <label
                className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border cursor-pointer text-xs font-semibold ${role === 'owner' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200'
                  }`}
              >
                <input
                  type="radio"
                  name="role"
                  className="hidden"
                  checked={role === 'owner'}
                  onChange={() => setRole('owner')}
                />
                Pemilik Toko
              </label>
            </div>
            {role === 'owner' && (
              <p className="text-[11px] text-slate-500 mt-2">
                Setelah akun dibuat, Anda akan diminta mengisi data toko untuk didaftarkan di CarWash Hub.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nama Lengkap</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5"
              placeholder="Budi Santoso"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5"
              placeholder="budi@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Nomor WhatsApp / HP</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5"
              placeholder="08123456789"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5"
              placeholder="Minimal 8 karakter"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:bg-slate-400"
          >
            {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
          </button>
        </form>

        <p className="text-xs text-center text-slate-500 mt-6">
          Sudah memiliki akun?{' '}
          <Link to="/login" className="text-blue-600 font-bold hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}