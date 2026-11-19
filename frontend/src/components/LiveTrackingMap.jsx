import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import socket from '../services/socket';
import api from '../services/api';
import { Navigation, Clock, ShieldCheck, MapPin } from 'lucide-react';

// Custom icons Leaflet
const employeeIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const customerIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function LiveTrackingMap({ orderId, orderStatus, destination }) {
  const [locations, setLocations] = useState([]);
  const [trackingActive, setTrackingActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    // Fetch initial location data
    api.get(`/tracking/orders/${orderId}/location`).then((res) => {
      setTrackingActive(res.data.tracking_active);
      setLocations(res.data.locations || []);
      setLoading(false);
    });

    // Join WebSocket room
    socket.emit('join_order_room', orderId);

    // Listen realtime GPS updates dari pegawai
    const handleLocationUpdate = (data) => {
      setTrackingActive(true);
      setLocations((prev) => {
        const filtered = prev.filter((l) => l.employee_id !== data.employee_id);
        return [...filtered, data];
      });
    };

    socket.on('employee_location_update', handleLocationUpdate);

    return () => {
      socket.off('employee_location_update', handleLocationUpdate);
      socket.emit('leave_order_room', orderId);
    };
  }, [orderId]);

  if (loading) {
    return <div className="text-center py-6 text-xs text-slate-400">Memeriksa status pelacakan GPS...</div>;
  }

  // Jika pesanan tidak dalam status menuju lokasi atau sedang cuci
  if (!trackingActive) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
        <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="font-bold text-slate-700">Pelacakan Posisi GPS Non-Aktif</p>
        <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
          Demi privasi pegawai, GPS hanya membagikan lokasi ketika pegawai telah menekan tombol "Menuju Lokasi" dan otomatis berhenti ketika pekerjaan selesai.
        </p>
      </div>
    );
  }

  const primaryLoc = locations[0];
  const destCoords = [parseFloat(destination.latitude), parseFloat(destination.longitude)];
  const centerCoords = primaryLoc
    ? [primaryLoc.latitude, primaryLoc.longitude]
    : destCoords;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      {/* Banner Estimasi Jarak & Waktu */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <Navigation className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-blue-100">
              Pelacakan Real-time Pegawai
            </span>
            <h4 className="text-sm font-bold">
              {primaryLoc ? `${primaryLoc.employee_name} Sedang Menuju Lokasi` : 'Menunggu Sinyal GPS Pegawai...'}
            </h4>
          </div>
        </div>

        {primaryLoc && (
          <div className="flex items-center gap-4 text-xs bg-black/20 px-3 py-1.5 rounded-xl backdrop-blur">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-amber-300" />
              <span>Sisa Jarak: <strong>{primaryLoc.distance_remaining_km} km</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4 text-emerald-300" />
              <span>Estimasi Tiba: <strong>~{primaryLoc.estimated_arrival_minutes} menit</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Map Leaflet */}
      <div className="h-72 w-full relative z-0">
        <MapContainer
          center={centerCoords}
          zoom={14}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Marker Lokasi Pelanggan (Destinasi) */}
          <Marker position={destCoords} icon={customerIcon}>
            <Popup>
              <div className="text-xs">
                <strong>Lokasi Anda (Cuci Kendaraan)</strong>
              </div>
            </Popup>
          </Marker>

          {/* Marker Posisi Pegawai Realtime */}
          {locations.map((loc) => (
            <Marker
              key={loc.employee_id}
              position={[loc.latitude, loc.longitude]}
              icon={employeeIcon}
            >
              <Popup>
                <div className="text-xs">
                  <strong>Pegawai: {loc.employee_name}</strong>
                  <p>Sisa: {loc.distance_remaining_km} km (~{loc.estimated_arrival_minutes} menit)</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Garis rute estimasi antara Pegawai dan Pelanggan */}
          {primaryLoc && (
            <Polyline
              positions={[
                [primaryLoc.latitude, primaryLoc.longitude],
                destCoords,
              ]}
              color="#2563eb"
              dashArray="6, 8"
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
