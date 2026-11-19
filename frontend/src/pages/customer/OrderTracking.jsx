import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { Truck, Camera, CloudRain, MessageSquare } from 'lucide-react';
import LiveTrackingMap from '../../components/LiveTrackingMap';
import OrderChat from '../../components/OrderChat';

export default function OrderTracking() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tracking'); // 'tracking' | 'chat'
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const fetchDetail = () => {
    return api
      .get(`/orders/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error('Gagal memuat pesanan:', err.response?.data || err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 10000); // Polling status pesanan
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePay = async (method) => {
    try {
      await api.post(`/orders/${id}/pay`, { payment_method: method });
      alert('Pembayaran sukses!');
      fetchDetail();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal memproses pembayaran');
    }
  };

  const handleConfirmCompletion = async () => {
    try {
      await api.post(`/orders/${id}/confirm-completion`);
      alert('Pesanan telah Anda konfirmasi selesai!');
      fetchDetail();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal konfirmasi');
    }
  };

  const handleRescheduleRain = async () => {
    const newDate = prompt('Masukkan tanggal baru (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!newDate) return;
    try {
      await api.post(`/orders/${id}/reschedule`, {
        new_date: newDate,
        new_time_slot: data.order.time_slot,
        is_rain: true,
      });
      alert('Pesanan dijadwal ulang gratis karena cuaca hujan!');
      fetchDetail();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal reschedule');
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/orders/${id}/review`, { rating, comment });
      alert('Ulasan berhasil dikirim!');
      setReviewSubmitted(true);
      fetchDetail();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengirim ulasan');
    }
  };

  if (loading) return <div className="text-center py-20">Memuat status pesanan...</div>;
  if (!data || !data.order) return <div className="text-center py-20">Pesanan tidak ditemukan.</div>;

  // proof_photos dari API di-rename ke proofPhotos agar sesuai pemakaian di JSX
  const { order, assigned_employees = [], proof_photos: proofPhotos = [] } = data;

  const statusMap = {
    waiting_payment: 'Menunggu Pembayaran',
    waiting_store_confirmation: 'Menunggu Konfirmasi Toko',
    assigned: 'Pegawai Ditugaskan',
    on_the_way: 'Pegawai Menuju Lokasi',
    in_progress: 'Sedang Dicuci',
    completed: 'Pencucian Selesai',
    confirmed_by_customer: 'Selesai & Dikonfirmasi Pelanggan',
    cancelled: 'Dibatalkan',
    rescheduled: 'Dijadwal Ulang',
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Tab Navigasi */}
      <div className="flex border-b border-slate-200 mb-6 gap-6">
        <button
          onClick={() => setActiveTab('tracking')}
          className={`pb-3 text-sm font-bold flex items-center gap-1.5 transition ${activeTab === 'tracking'
            ? 'border-b-2 border-blue-600 text-blue-600'
            : 'text-slate-400 hover:text-slate-600'
            }`}
        >
          <Truck className="w-4 h-4" />
          <span>Status & Pelacakan Pegawai</span>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`pb-3 text-sm font-bold flex items-center gap-1.5 transition ${activeTab === 'chat'
            ? 'border-b-2 border-blue-600 text-blue-600'
            : 'text-slate-400 hover:text-slate-600'
            }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Ruang Chat Pesanan</span>
        </button>
      </div>

      {activeTab === 'chat' ? (
        <OrderChat orderId={id} orderStatus={order.order_status} />
      ) : (
        <>
          {/* Peta Pelacakan GPS */}
          <LiveTrackingMap
            orderId={id}
            orderStatus={order.order_status}
            destination={{
              latitude: order.service_latitude,
              longitude: order.service_longitude,
            }}
          />

          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
            <div className="flex flex-wrap justify-between items-center border-b border-slate-100 pb-4 mb-4 gap-2">
              <div>
                <span className="text-xs text-slate-400 font-mono">Kode Pesanan: {order.order_code}</span>
                <h1 className="text-xl font-bold text-slate-800">{order.store_name}</h1>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                  {statusMap[order.order_status] || order.order_status}
                </span>
              </div>
            </div>

            {/* Informasi Utama */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-600 mb-6 bg-slate-50 p-4 rounded-xl">
              <div>
                <span className="block text-slate-400">Paket:</span>
                <strong className="text-slate-800">{order.package_name}</strong>
              </div>
              <div>
                <span className="block text-slate-400">Kendaraan:</span>
                <strong className="text-slate-800">
                  {order.vehicle_brand} ({order.plate_number})
                </strong>
              </div>
              <div>
                <span className="block text-slate-400">Jadwal:</span>
                <strong className="text-slate-800">
                  {order.booking_date} ({order.time_slot})
                </strong>
              </div>
              <div>
                <span className="block text-slate-400">Total Biaya:</span>
                <strong className="text-blue-600 font-bold">
                  Rp {parseInt(order.total_amount, 10).toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            {/* Tombol Bayar */}
            {order.order_status === 'waiting_payment' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                <h3 className="font-bold text-amber-900 text-sm mb-2">Pilih Metode Pembayaran Cepat:</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePay('QRIS')}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                  >
                    Bayar QRIS
                  </button>
                  <button
                    onClick={() => handlePay('BCA Transfer')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                  >
                    Transfer Bank
                  </button>
                </div>
              </div>
            )}

            {/* Pegawai yang Bertugas */}
            {assigned_employees.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-sm text-slate-800 mb-2">Pegawai yang Bertugas:</h3>
                <div className="flex flex-wrap gap-4">
                  {assigned_employees.map((emp) => (
                    <div
                      key={emp.employee_id}
                      className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                        {emp.name?.charAt(0)}
                      </div>
                      <div className="text-xs">
                        <p className="font-bold text-slate-800">{emp.name}</p>
                        <p className="text-slate-500">{emp.phone}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Foto Sebelum & Sesudah */}
            <div className="mb-6">
              <h3 className="font-bold text-sm text-slate-800 mb-2 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-blue-600" />
                <span>Dokumentasi Foto Sebelum & Sesudah Cuci</span>
              </h3>

              {proofPhotos.length === 0 ? (
                <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl text-center">
                  Belum ada foto yang diunggah pegawai. Foto kondisi sebelum dan sesudah cuci akan muncul di sini.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {proofPhotos.map((photo) => (
                    <div key={photo.id} className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                      <img src={photo.photo_url} alt="Kondisi" className="w-full h-32 object-cover" />
                      <div className="p-2 text-center text-[11px] font-bold uppercase tracking-wider bg-white">
                        {photo.photo_type === 'before' ? '📸 Sebelum Cuci' : '✨ Sesudah Cuci'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Konfirmasi Selesai & Reschedule Hujan */}
            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
              {order.order_status === 'completed' && (
                <button
                  onClick={handleConfirmCompletion}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md"
                >
                  Konfirmasi Selesai (Otomatis setelah 24 jam)
                </button>
              )}

              {['waiting_payment', 'waiting_store_confirmation', 'assigned'].includes(order.order_status) && (
                <button
                  onClick={handleRescheduleRain}
                  className="px-4 py-2 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <CloudRain className="w-4 h-4" />
                  <span>Jadwal Ulang Gratis (Cuaca Hujan)</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Form Ulasan */}
      {['completed', 'confirmed_by_customer'].includes(order.order_status) && !reviewSubmitted && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-3 text-sm">Beri Rating & Ulasan untuk Toko</h3>
          <form onSubmit={handleSubmitReview} className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Rating Bintang</label>
              <select
                value={rating}
                onChange={(e) => setRating(parseInt(e.target.value, 10))}
                className="border border-slate-300 rounded-lg p-2 text-xs"
              >
                <option value={5}>⭐⭐⭐⭐⭐ (5 - Sangat Bersih & Puas)</option>
                <option value={4}>⭐⭐⭐⭐ (4 - Bagus)</option>
                <option value={3}>⭐⭐⭐ (3 - Cukup)</option>
                <option value={2}>⭐⭐ (2 - Kurang Puas)</option>
                <option value={1}>⭐ (1 - Buruk)</option>
              </select>
            </div>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ceritakan pengalaman cuci Anda..."
              className="w-full border border-slate-300 rounded-lg p-2 text-xs"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
            >
              Kirim Ulasan
            </button>
          </form>
        </div>
      )}
    </div>
  );
}