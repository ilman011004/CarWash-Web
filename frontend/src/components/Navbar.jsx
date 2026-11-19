import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Droplets, User, LogOut, Shield, Store, Briefcase, Sparkles } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-black tracking-tight text-slate-800 flex items-center gap-1">
              CarWash<span className="text-blue-600">Hub</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium block -mt-1 tracking-wider uppercase">
              Home Service
            </span>
          </div>
        </Link>

        {/* Navigation Actions */}
        <nav className="flex items-center gap-4 text-xs md:text-sm font-semibold">
          <Link
            to="/"
            className="text-slate-600 hover:text-blue-600 transition px-3 py-1.5 rounded-lg hover:bg-slate-50"
          >
            Cari Toko
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              {user.role === 'customer' && (
                <>
                  <Link
                    to="/orders"
                    className="text-slate-600 hover:text-blue-600 transition px-3 py-1.5 rounded-lg hover:bg-slate-50"
                  >
                    Pesanan Saya
                  </Link>
                  <Link
                    to="/profile"
                    className="text-slate-600 hover:text-blue-600 transition px-3 py-1.5 rounded-lg hover:bg-slate-50"
                  >
                    Kendaraan & Alamat
                  </Link>
                </>
              )}

              {user.role === 'owner' && (
                <Link
                  to="/owner"
                  className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 hover:bg-indigo-100 transition"
                >
                  <Store className="w-4 h-4" />
                  <span>Dashboard Toko</span>
                </Link>
              )}

              {user.role === 'employee' && (
                <Link
                  to="/employee"
                  className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 hover:bg-emerald-100 transition"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Tugas Pegawai</span>
                </Link>
              )}

              {user.role === 'admin' && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 text-purple-600 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200 hover:bg-purple-100 transition"
                >
                  <Shield className="w-4 h-4" />
                  <span>Super Admin</span>
                </Link>
              )}

              <div className="h-5 w-[1px] bg-slate-200 mx-1" />

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <span className="text-xs font-bold text-slate-800 block leading-tight">{user.name}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{user.role}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition ml-1"
                  title="Keluar"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link
                to="/login"
                className="px-4 py-2 rounded-xl text-slate-700 hover:bg-slate-100 font-semibold transition"
              >
                Masuk
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                <span>Daftar Gratis</span>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
