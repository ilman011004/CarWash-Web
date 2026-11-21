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

const METHOD_LABEL = {
  home_service: 'Home Service',
  in_store: 'Di Toko',
};

// Tanggal ditampilkan dalam zona waktu Indonesia agar tidak bergeser sehari.
const formatDay = (d) => {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' });
};

const RESPONSE_LABEL = { pending: 'belum menerima', accepted: 'sudah menerima' };
const DECLINE_REASONS = ['Sedang sakit', 'Ada keperluan mendesak', 'Jadwal saya sudah penuh'];

export default function EmployeeDashboard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // { text, type }
  const [selectedTask, setSelectedTask] = useState(null);
  const [chatOrder, setChatOrder] = useState(null);
  const [photoType, setPhotoType] = useState('before');
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sharingOrderId, setSharingOrderId] = useState(null); // pesanan yang sedang dikirim GPS-nya
  const [declineTask, setDeclineTask] = useState(null); // tugas yang sedang akan ditolak
  const [declineReason, setDeclineReason] = useState('');
  const [responding, setResponding] = useState(false);
  const watchIdRef = useRef(null);
  const noticeTimerRef = useRef(null);

  const showNotice = (text, type = 'success') => {
    setNotice({ text, type });
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 4000);
  };

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

  // Muat ulang berkala agar permintaan tugas baru muncul tanpa refresh manual
  const fetchRef = useRef(fetchTasks);
  fetchRef.current = fetchTasks;
  useEffect(() => {
    const timer = setInterval(() => fetchRef.current(), 20000);
    const onFocus = () => fetchRef.current();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
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

  // Terima atau tolak penugasan baru dari pemilik toko
  const handleRespond = async (task, response, reason) => {
    setResponding(true);
    try {
      await api.post(`/employee/tasks/${task.id}/respond`, { response, reason });
      showNotice(response === 'accepted' ? 'Tugas diterima.' : 'Tugas ditolak. Pemilik toko akan mencari pengganti.');
      setDeclineTask(null);
      setDeclineReason('');
      fetchTasks();
    } catch (err) {
      showNotice(err.response?.data?.message || 'Gagal menyimpan jawaban', 'error');
    } finally {
      setResponding(false);
    }
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

  // Permintaan penugasan yang belum dijawab dipisah dari tugas yang sudah diterima
  const pendingTasks = tasks.filter((t) => t.my_response === 'pending' && t.order_status === 'assigned');
  const visibleTasks = tasks.filter((t) => !pendingTasks.includes(t));

  // Ringkasan di bagian atas halaman
  const countActive = visibleTasks.filter((t) => ['assigned', 'on_the_way', 'in_progress'].includes(t.order_status)).length;
  const countWaiting = visibleTasks.filter((t) => t.order_status === 'completed').length;
  const countDone = visibleTasks.filter((t) => t.order_status === 'confirmed_by_customer').length;

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

      {notice && (
        <div
          role="status"
          className={`mb-4 p-3 rounded-xl border text-xs ${notice.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
        >
          {notice.text}
        </div>
      )}

      {visibleTasks.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className="text-xl font-bold text-indigo-600">{countActive}</p>
            <p className="text-[11px] text-slate-500">Aktif</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className="text-xl font-bold text-amber-600">{countWaiting}</p>
            <p className="text-[11px] text-slate-500">Menunggu Konfirmasi</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <p className="text-xl font-bold text-emerald-600">{countDone}</p>
            <p className="text-[11px] text-slate-500">Selesai</p>
          </div>
        </div>
      )}

      {pendingTasks.length > 0 && (
        <section className="mb-6" aria-label="Permintaan tugas baru">
          <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
            Permintaan Tugas Baru
            <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
              {pendingTasks.length}
            </span>
          </h2>
          <div className="space-y-3">
            {pendingTasks.map((task) => (
              <div key={task.id} className="rounded-xl border-2 border-amber-300 bg-amber-50/60 p-4">
                <span className="text-[11px] font-mono text-slate-500">{task.order_code}</span>
                <p className="font-bold text-slate-800">
                  {task.package_name} ({task.vehicle_brand} - {task.plate_number})
                </p>
                <p className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <span className="font-semibold">{formatDay(task.booking_date)}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {task.time_slot}
                  </span>
                  {METHOD_LABEL[task.service_method] && (
                    <span className="px-2 py-0.5 rounded-full bg-white text-slate-600 font-semibold text-[10px]">
                      {METHOD_LABEL[task.service_method]}
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-600 mt-2">
                  <strong>Lokasi:</strong> {task.service_address}
                </p>
                {(task.teammates || []).length > 0 && (
                  <p className="text-xs text-slate-600 mt-1">
                    <strong>Bersama:</strong> {task.teammates.map((m) => m.name).join(', ')}
                  </p>
                )}
                <p className="text-[11px] text-amber-800 mt-2">
                  Pemilik toko meminta Anda mengerjakan pesanan ini. Terima jika jadwal Anda kosong.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleRespond(task, 'accepted')}
                    disabled={responding}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:bg-slate-400"
                  >
                    Terima Tugas
                  </button>
                  <button
                    onClick={() => {
                      setDeclineTask(task);
                      setDeclineReason('');
                    }}
                    disabled={responding}
                    className="px-4 py-2 bg-white border border-red-200 text-red-700 rounded-lg text-xs font-bold hover:bg-red-50"
                  >
                    Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="text-center py-12">Memuat tugas...</div>
      ) : visibleTasks.length === 0 && pendingTasks.length === 0 && !error ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 text-slate-400 text-sm">
          Belum ada tugas. Permintaan tugas dari pemilik toko akan muncul di sini, lalu Anda bisa menerima atau menolaknya.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleTasks.map((task) => {
            const isSharingThis = sharingOrderId === task.id;
            // Berangkat hanya bisa jika tim lengkap (home service butuh 2 pegawai yang sudah menerima)
            const requiredTeam = task.service_method === 'home_service' ? 2 : 1;
            const acceptedTeam = 1 + (task.teammates || []).filter((m) => m.response_status === 'accepted').length;
            const teamReady = acceptedTeam >= requiredTeam;
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
                    <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <span className="font-semibold">{formatDay(task.booking_date)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Slot: {task.time_slot}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                    {statusLabel[task.order_status] || task.order_status}
                  </span>
                </div>

                {task.order_status === 'assigned' && !teamReady && (
                  <p className="text-xs font-semibold text-amber-800 bg-amber-100/80 rounded-md px-2.5 py-1.5">
                    Menunggu rekan Anda menerima tugas ({acceptedTeam} dari {requiredTeam} sudah menerima). Anda bisa
                    berangkat setelah tim lengkap.
                  </p>
                )}

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
                  {(task.teammates || []).length > 0 && (
                    <p>
                      <strong>Rekan:</strong>{' '}
                      {task.teammates.map((m) => `${m.name} (${RESPONSE_LABEL[m.response_status] || m.response_status})`).join(', ')}
                    </p>
                  )}
                  {task.customer_notes && (
                    <p className="text-slate-500 italic">Catatan: "{task.customer_notes}"</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  {task.order_status === 'assigned' && (
                    <button
                      onClick={() => handleUpdateStatus(task.id, 'on_the_way')}
                      disabled={!teamReady}
                      title={teamReady ? undefined : 'Menunggu rekan menerima tugas'}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1 disabled:bg-slate-300 disabled:cursor-not-allowed"
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

      {/* Modal Tolak Tugas */}
      {declineTask && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-800">Tolak Tugas</h3>
            <p className="text-xs text-slate-500 mb-3">
              #{declineTask.order_code} · {formatDay(declineTask.booking_date)} · {declineTask.time_slot}
            </p>
            <p className="text-xs text-slate-600 mb-2">Pilih atau tulis alasan agar pemilik toko bisa mencari pengganti.</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {DECLINE_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDeclineReason(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${declineReason === r
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Tulis alasan penolakan"
              aria-label="Alasan penolakan"
              className="w-full border border-slate-300 rounded-lg p-2 text-xs"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeclineTask(null)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleRespond(declineTask, 'declined', declineReason.trim())}
                disabled={responding || declineReason.trim().length < 3}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg text-xs hover:bg-red-700 disabled:bg-slate-300"
              >
                Kirim Penolakan
              </button>
            </div>
          </div>
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