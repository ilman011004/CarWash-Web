import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

export default function OrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/orders')
      .then((res) => setOrders(res.data.orders || []))
      .catch((err) => console.error(err.response?.data || err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20">Memuat riwayat pesanan...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Riwayat & Status Pesanan</h1>
      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
          Belum ada pesanan cuci kendaraan.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
            >
              <div>
                <span className="text-xs font-mono text-slate-400">{o.order_code}</span>
                <h3 className="font-bold text-slate-800 text-base">{o.store_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {o.package_name} • {o.vehicle_brand} ({o.plate_number})
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Jadwal: <strong>{o.booking_date} ({o.time_slot})</strong>
                </p>
              </div>

              <div className="text-right w-full sm:w-auto flex sm:flex-col justify-between items-center sm:items-end">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                  {o.order_status}
                </span>
                <span className="text-sm font-bold text-slate-800 mt-2 block">
                  Rp {parseInt(o.total_amount, 10).toLocaleString('id-ID')}
                </span>
                <Link
                  to={`/orders/${o.id}`}
                  className="mt-2 inline-block px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                >
                  Pelacakan & Foto
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}