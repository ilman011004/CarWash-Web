import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles = [] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-500 text-sm">
        Memeriksa hak akses...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-white rounded-xl border border-red-200 text-center text-slate-700 shadow-sm">
        <h2 className="text-lg font-bold text-red-600 mb-2">Akses Ditolak</h2>
        <p className="text-xs text-slate-500">
          Akun Anda ({user.role}) tidak memiliki izin untuk mengakses halaman ini.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
