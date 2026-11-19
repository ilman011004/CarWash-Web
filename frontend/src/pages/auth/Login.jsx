import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Droplets } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === 'owner') navigate('/owner');
      else if (user.role === 'employee') navigate('/employee');
      else if (user.role === 'admin') navigate('/admin');
      else navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-full mb-3">
            <Droplets className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Masuk ke CarWashHub</h1>
          <p className="text-xs text-slate-500 mt-1">Platform Cuci Kendaraan Home Service</p>
        </div>

        {error && <div className="p-3 mb-4 text-xs bg-red-50 text-red-700 rounded-lg">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-blue-600"
              placeholder="nama@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-blue-600"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:bg-slate-400"
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="text-xs text-center text-slate-500 mt-6">
          Belum punya akun?{' '}
          <Link to="/register" className="text-blue-600 font-bold hover:underline">
            Daftar Sekarang
          </Link>
        </p>
      </div>
    </div>
  );
}
