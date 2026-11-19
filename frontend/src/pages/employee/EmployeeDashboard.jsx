import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { Camera, CheckCircle2, Navigation, Clock, MessageSquare, Radio } from 'lucide-react';
import OrderChat from '../../components/OrderChat';

const statusLabel = {
  assigned: 'Ditugaskan',
  on_the_way: 'Menuju Lokasi',
  in_progress: 'Sedang Dicuci',
  completed: 'Selesai Dicuci',
  confirmed_by_customer: 'Dikonfirmasi Pelanggan',
};

export default function EmployeeDashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [chatOrder, setChatOrder] = useState(null);
  const [photoType, setPhotoType] = useState('before');
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sharingOrderId, setSharingOrderId] = useState(null); // pesanan yang sedang dikirim GPS-nya
  const watchIdRef = useRef(null);

  const fetchTasks = () => {
    api
      .get('/employee/tasks')
      .then((res) => {
        setTasks(res.data.tasks || []);
        setError('');
      })
      .catch((err) => {
        console.error(err.response?.data || err.message);
        setError(err.response?.data?.message || 'Gagal memuat tugas. Coba tekan Perbarui.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Hentikan GPS saat meninggalkan halaman
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  const stopGpsSharing = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharingOrderId(null);
  };

  const startGpsSharing = (orderId) => {
    if (!navigator.geolocation) {
      return alert('Browser/HP Anda tidak mendukung fitur Geolocation GPS');
    }
    // Hentikan pelacakan sebelumnya agar tidak dobel
    stopGpsSharing();

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        api
          .post(`/tracking/orders/${orderId}/location`, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading || 0,
          })
          .catch((err) => console.error('Gagal update GPS', err.response?.data || err.message));
      },
      (err) => {
        console.error('GPS error:', err);
        if (err.code === 1) {
          alert('Izin lokasi ditolak. Aktifkan izin lokasi di browser agar posisi Anda bisa dilacak.');
          stopGpsSharing();
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
    watchIdRef.current = watchId;
    setSharingOrderId(orderId);
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await api.patch(`/employee/tasks/${orderId}/status`, { status: newStatus });
      alert(`Status diperbarui ke: ${statusLabel[newStatus] || newStatus}`);

      if (newStatus === 'on_the_way') {
        startGpsSharing(orderId);
      } else if (newStatus === 'completed' && sharingOrderId === orderId) {
        // Matikan pelacakan saat cuci selesai demi privasi
        stopGpsSharing();
      }

      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengubah status');
    }
  };

  const handleUploadPhoto = async (e) => {
    e.preventDefault();
    if (!photoFile || !selectedTask) return alert('Pilih foto terlebih dahulu');

    setUploading(true);
    const formData = new FormData();
    formData.append('photo', photoFile);
    formData.append('photo_type', photoType);

    try {
      // Content-Type multipart diatur otomatis oleh axios (beserta boundary)
      await api.post(`/employee/tasks/${selectedTask.id}/upload-proof`, formData);
      alert(`Foto ${photoType === 'before' ? 'sebelum' : 'sesudah'} cuci berhasil diunggah!`);
      setPhotoFile(null);
      setPhotoType('before');
      setSelectedTask(null);
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengunggah foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tugas Saya Hari Ini</h1>
          <p className="text-xs text-slate-500">Daftar penugasan cuci kendaraan Anda</p>
        </div>
        <button
          onClick={fetchTasks}
          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg"
        >
          Perbarui
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12">Memuat tugas...</div>
      ) : tasks.length === 0 && !error ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400 text-sm">
          Belum ada tugas. Tugas akan muncul setelah pemilik toko menugaskan Anda ke sebuah pesanan.
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const isSharingThis = sharingOrderId === task.id;
            return (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400">{task.order_code}</span>
                    <h3 className="font-bold text-slate-800 text-base">
                      {task.package_name} ({task.vehicle_brand} - {task.plate_number})
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <Clock className="w-3.5 h-3.5" /> Slot: {task.time_slot}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                    {statusLabel[task.order_status] || task.order_status}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                  <p>
                    <strong>Pelanggan:</strong> {task.customer_name} ({task.customer_phone})
                  </p>
                  <p>
                    <strong>Alamat:</strong> {task.service_address}
                  </p>
                  <p>
                    <strong>Sumber Air:</strong>{' '}
                    {task.has_water_source ? (
                      <span className="text-emerald-600 font-semibold">Tersedia di lokasi</span>
                    ) : (
                      <span className="text-amber-600 font-semibold">
                        Tidak ada (Gunakan tangki toko/waterless)
                      </span>
                    )}
                  </p>
                  {task.customer_notes && (
                    <p className="text-slate-500 italic">Catatan: "{task.customer_notes}"</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  {task.order_status === 'assigned' && (
                    <button
                      onClick={() => handleUpdateStatus(task.id, 'on_the_way')}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1"
                    >
                      <Navigation className="w-3.5 h-3.5" /> Menuju Lokasi
                    </button>
                  )}

                  {task.order_status === 'on_the_way' && (
                    <button
                      onClick={() => handleUpdateStatus(task.id, 'in_progress')}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center gap-1"
                    >
                      Mulai Cuci
                    </button>
                  )}

                  {task.order_status === 'in_progress' && (
                    <button
                      onClick={() => handleUpdateStatus(task.id, 'completed')}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Selesai Cuci
                    </button>
                  )}

                  {/* Status GPS yang jujur: hanya tampil jika benar-benar mengirim */}
                  {['on_the_way', 'in_progress'].includes(task.order_status) &&
                    (isSharingThis ? (
                      <>
                        <span className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg animate-pulse">
                          <Radio className="w-3.5 h-3.5" /> GPS Aktif Mengirim Lokasi
                        </span>
                        <button
                          onClick={stopGpsSharing}
                          className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-semibold"
                        >
                          Matikan GPS
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startGpsSharing(task.id)}
                        className="px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <Radio className="w-3.5 h-3.5" /> Aktifkan GPS
                      </button>
                    ))}

                  <button
                    onClick={() => setChatOrder(task)}
                    className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                  </button>

                  <button
                    onClick={() => setSelectedTask(task)}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 flex items-center gap-1 ml-auto"
                  >
                    <Camera className="w-3.5 h-3.5" /> Unggah Foto Sebelum/Sesudah
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Chat */}
      {chatOrder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="max-w-lg w-full relative">
            <button
              onClick={() => setChatOrder(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white border border-slate-300 rounded-full font-bold shadow text-slate-700 z-10 flex items-center justify-center"
            >
              ✕
            </button>
            <OrderChat orderId={chatOrder.id} orderStatus={chatOrder.order_status} />
          </div>
        </div>
      )}

      {/* Modal Upload Foto */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-800 mb-2">Unggah Foto Kondisi Kendaraan</h3>
            <p className="text-xs text-slate-500 mb-4">
              Kode Pesanan: <strong>{selectedTask.order_code}</strong>
            </p>

            <form onSubmit={handleUploadPhoto} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Tipe Foto</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="photoType"
                      checked={photoType === 'before'}
                      onChange={() => setPhotoType('before')}
                    />
                    <span>Sebelum Cuci (Kondisi Awal)</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="photoType"
                      checked={photoType === 'after'}
                      onChange={() => setPhotoType('after')}
                    />
                    <span>Sesudah Cuci (Hasil Bersih)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Pilih Berkas Gambar</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files[0] || null)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTask(null);
                    setPhotoFile(null);
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
                >
                  {uploading ? 'Mengunggah...' : 'Simpan Foto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}