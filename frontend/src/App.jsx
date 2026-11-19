import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Auth pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Customer pages
import Home from './pages/customer/Home';
import StoreDetail from './pages/customer/StoreDetail';
import OrderList from './pages/customer/OrderList';
import OrderTracking from './pages/customer/OrderTracking';
import Profile from './pages/customer/Profile';

// Role dashboards
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

function NotFound() {
  return (
    <div className="text-center py-20">
      <p className="text-slate-700 font-semibold mb-3">Halaman tidak ditemukan.</p>
      <Link to="/" className="text-blue-600 underline text-sm">
        Kembali ke beranda
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          {/* Publik */}
          <Route path="/" element={<Home />} />
          <Route path="/stores/:id" element={<StoreDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Area Pelanggan */}
          <Route element={<ProtectedRoute allowedRoles={['customer', 'admin']} />}>
            <Route path="/orders" element={<OrderList />} />
            <Route path="/orders/:id" element={<OrderTracking />} />
            <Route path="/profile" element={<Profile />} />
          </Route>

          {/* Area Pegawai */}
          <Route element={<ProtectedRoute allowedRoles={['employee', 'admin']} />}>
            <Route path="/employee" element={<EmployeeDashboard />} />
          </Route>

          {/* Area Pemilik Toko */}
          <Route element={<ProtectedRoute allowedRoles={['owner', 'admin']} />}>
            <Route path="/owner" element={<OwnerDashboard />} />
          </Route>

          {/* Area Super Admin */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          {/* Halaman tidak dikenal */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}