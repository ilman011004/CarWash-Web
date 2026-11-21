import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Droplets,
  LogOut,
  Shield,
  Store,
  Briefcase,
  Sparkles,
  ChevronDown,
  MapPin,
} from 'lucide-react';

const ROLE_LABEL = {
  customer: 'Pelanggan',
  owner: 'Pemilik Toko',
  employee: 'Pegawai',
  admin: 'Admin',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const menuRef = useRef(null);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate('/login');
  };

  // Tutup dropdown saat pindah halaman
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Tutup dropdown saat klik di luar atau tekan Escape
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Pelanggan: cek apakah kendaraan/alamat sudah lengkap (untuk titik penanda)
  useEffect(() => {
    if (!user || user.role !== 'customer') {
      setProfileIncomplete(false);
      return;
    }
    let cancelled = false;
    Promise.all([api.get('/customer/vehicles'), api.get('/customer/addresses')])
      .then(([v, a]) => {
        if (cancelled) return;
        const noVehicle = (v.data.vehicles || []).length === 0;
        const noAddress = (a.data.addresses || []).length === 0;
        setProfileIncomplete(noVehicle || noAddress);
      })
      .catch(() => {
        if (!cancelled) setProfileIncomplete(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, location.pathname]);

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
                <Link
                  to="/orders"
                  className="text-slate-600 hover:text-blue-600 transition px-3 py-1.5 rounded-lg hover:bg-slate-50"
                >
                  Pesanan Saya
                </Link>
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

              {/* Dropdown Profil */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-100 transition"
                >
                  <span className="relative">
                    <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                      {(user.name || '?').charAt(0).toUpperCase()}
                    </span>
                    {profileIncomplete && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-orange-500 border-2 border-white"
                        title="Lengkapi kendaraan dan alamat"
                      />
                    )}
                  </span>
                  <span className="hidden sm:block text-left">
                    <span className="text-xs font-bold text-slate-800 block leading-tight max-w-[110px] truncate">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-slate-400">{ROLE_LABEL[user.role] || user.role}</span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>

                {open && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-60 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50"
                  >
                    <div className="px-4 py-2 border-b border-slate-100 sm:hidden">
                      <p className="text-sm font-bold text-slate-800 truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-400">{ROLE_LABEL[user.role] || user.role}</p>
                    </div>

                    {user.role === 'customer' && (
                      <Link
                        to="/profile"
                        role="menuitem"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <MapPin className="w-4 h-4 text-indigo-600" />
                        <span className="flex-1">Kendaraan & Alamat</span>
                        {profileIncomplete && (
                          <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                            Lengkapi
                          </span>
                        )}
                      </Link>
                    )}

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Keluar
                    </button>
                  </div>
                )}
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