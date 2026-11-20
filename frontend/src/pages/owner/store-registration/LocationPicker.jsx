import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { LocateFixed, Search, ExternalLink, AlertTriangle, Check } from 'lucide-react';
import { MAP_DEFAULT_CENTER, MAP_DEFAULT_ZOOM, MAP_PICKED_ZOOM } from './constants';
import {
    parseCoordinate,
    parseCoordinatePair,
    isValidLat,
    isValidLng,
    checkRegion,
    looksLikeIndonesianLongitude,
} from './validation';

// Ikon dari paket leaflet sendiri, jadi tidak bergantung pada situs lain.
const pinIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    shadowSize: [41, 41],
});

const round6 = (n) => Number(n.toFixed(6));

const inputCls =
    'w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition';

/* ---------------------------- Bagian-bagian peta ---------------------------- */

// Klik di peta = taruh pin. Scroll-zoom baru aktif setelah peta diklik, supaya
// halaman tetap bisa di-scroll saat kursor lewat di atas peta.
function MapInteractions({ onPick }) {
    const map = useMapEvents({
        click: (e) => {
            map.scrollWheelZoom.enable();
            onPick(round6(e.latlng.lat), round6(e.latlng.lng));
        },
        mouseout: () => map.scrollWheelZoom.disable(),
    });
    return null;
}

// Menggeser peta ke titik tertentu. `nonce` berubah setiap kali ada permintaan baru,
// jadi titik yang sama bisa difokuskan ulang.
function MapFocus({ focus }) {
    const map = useMap();
    useEffect(() => {
        if (focus) map.flyTo(focus.center, focus.zoom ?? MAP_PICKED_ZOOM, { duration: 0.8 });
    }, [focus, map]);
    return null;
}

/* ---------------------------- Pencarian alamat ---------------------------- */

// Geocoding gratis dari OpenStreetMap (Nominatim). Dipanggil hanya saat tombol Cari
// ditekan, bukan tiap ketikan, sesuai aturan pemakaian layanan tersebut.
async function searchPlaces(query, signal) {
    const url =
        'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=id&accept-language=id&q=' +
        encodeURIComponent(query);
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('Pencarian gagal');
    const data = await res.json();
    return data.map((d) => ({
        id: d.place_id,
        name: d.display_name,
        lat: round6(Number(d.lat)),
        lng: round6(Number(d.lon)),
    }));
}

/* ------------------------------- Komponen ------------------------------- */

export default function LocationPicker({ latitude, longitude, onChange, error }) {
    const hasPoint = latitude != null && longitude != null;
    const position = hasPoint ? [latitude, longitude] : null;

    const [focus, setFocus] = useState(null);
    const flyTo = (lat, lng, zoom) => setFocus({ center: [lat, lng], zoom, nonce: Date.now() });

    // Teks koordinat disimpan terpisah agar ketikan setengah jadi ("-3.") tidak ditimpa.
    const [latText, setLatText] = useState(hasPoint ? String(latitude) : '');
    const [lngText, setLngText] = useState(hasPoint ? String(longitude) : '');
    const [touched, setTouched] = useState({ lat: false, lng: false });

    // Saat titik berubah dari sumber lain (klik peta, geser pin, cari, GPS), samakan kolom teksnya.
    useEffect(() => {
        if (latitude == null || longitude == null) return;
        if (round6(parseCoordinate(latText)) !== latitude) setLatText(String(latitude));
        if (round6(parseCoordinate(lngText)) !== longitude) setLngText(String(longitude));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [latitude, longitude]);

    const applyPoint = (lat, lng, { fly = true, zoom } = {}) => {
        const la = round6(lat);
        const ln = round6(lng);
        setLatText(String(la));
        setLngText(String(ln));
        onChange(la, ln);
        if (fly) flyTo(la, ln, zoom);
    };

    /* --- Input koordinat manual --- */
    const handleCoordInput = (which, text) => {
        const nextLat = which === 'lat' ? text : latText;
        const nextLng = which === 'lng' ? text : lngText;
        if (which === 'lat') setLatText(text);
        else setLngText(text);

        const la = parseCoordinate(nextLat);
        const ln = parseCoordinate(nextLng);
        if (isValidLat(la) && isValidLng(ln)) onChange(round6(la), round6(ln));
        else if (hasPoint) onChange(null, null); // jangan biarkan titik lama terkirim saat teks tidak valid
    };

    const handleCoordBlur = (which) => {
        setTouched((t) => ({ ...t, [which]: true }));
        if (hasPoint) flyTo(latitude, longitude, MAP_PICKED_ZOOM);
    };

    // Tempel "lat, lng" (format Google Maps) di salah satu kolom -> keduanya terisi.
    const handlePaste = (e) => {
        const pair = parseCoordinatePair(e.clipboardData.getData('text'));
        if (!pair || !isValidLat(pair.lat) || !isValidLng(pair.lng)) return;
        e.preventDefault();
        setTouched({ lat: true, lng: true });
        applyPoint(pair.lat, pair.lng);
    };

    const latBad = touched.lat && latText !== '' && !isValidLat(parseCoordinate(latText));
    const lngBad = touched.lng && lngText !== '' && !isValidLng(parseCoordinate(lngText));

    /* --- Cari alamat (atau tempel koordinat di kotak cari) --- */
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searchMsg, setSearchMsg] = useState('');
    const abortRef = useRef(null);

    const handleSearch = async () => {
        const q = query.trim();
        if (q.length < 3) {
            setSearchMsg('Ketik minimal 3 karakter.');
            return;
        }
        setSearchMsg('');
        setResults([]);

        const pair = parseCoordinatePair(q);
        if (pair) {
            if (isValidLat(pair.lat) && isValidLng(pair.lng)) {
                setTouched({ lat: true, lng: true });
                applyPoint(pair.lat, pair.lng);
                setQuery('');
            } else {
                setSearchMsg('Koordinat tidak valid. Lintang -90 s/d 90, bujur -180 s/d 180.');
            }
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setSearching(true);
        try {
            const found = await searchPlaces(q, controller.signal);
            setResults(found);
            if (found.length === 0) setSearchMsg('Tempat tidak ditemukan. Coba kata kunci lain atau ketik koordinatnya.');
        } catch (err) {
            if (err.name !== 'AbortError') setSearchMsg('Pencarian sedang tidak tersedia. Ketik koordinat atau klik peta.');
        } finally {
            if (abortRef.current === controller) setSearching(false);
        }
    };

    const pickResult = (r) => {
        setTouched({ lat: true, lng: true });
        applyPoint(r.lat, r.lng);
        setResults([]);
        setQuery(r.name);
    };

    useEffect(() => () => abortRef.current?.abort(), []);

    /* --- GPS perangkat --- */
    const [locating, setLocating] = useState(false);
    const [geoError, setGeoError] = useState('');

    const handleUseMyLocation = () => {
        if (!navigator.geolocation) {
            setGeoError('Browser Anda tidak mendukung deteksi lokasi. Ketik koordinat atau klik peta.');
            return;
        }
        setGeoError('');
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setTouched({ lat: true, lng: true });
                applyPoint(pos.coords.latitude, pos.coords.longitude);
                setLocating(false);
            },
            () => {
                setGeoError('Lokasi tidak bisa diambil. Izinkan akses lokasi di browser, atau pilih titik secara manual.');
                setLocating(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const region = hasPoint ? checkRegion(latitude, longitude) : null;

    return (
        <div className="space-y-3">
            {/* Pencarian + GPS */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSearch();
                                }
                            }}
                            placeholder="Cari alamat, atau tempel koordinat"
                            aria-label="Cari alamat atau koordinat"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
                        />
                        <button
                            type="button"
                            onClick={handleSearch}
                            disabled={searching}
                            className="inline-flex items-center gap-1.5 px-4 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 disabled:opacity-60"
                        >
                            <Search className="w-4 h-4" />
                            {searching ? 'Mencari...' : 'Cari'}
                        </button>
                    </div>

                    {results.length > 0 && (
                        <ul className="absolute z-[1000] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                            {results.map((r) => (
                                <li key={r.id}>
                                    <button
                                        type="button"
                                        onClick={() => pickResult(r)}
                                        className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-indigo-50 border-b border-slate-100 last:border-0"
                                    >
                                        {r.name}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={locating}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-bold hover:bg-indigo-100 disabled:opacity-60"
                >
                    <LocateFixed className="w-4 h-4" />
                    {locating ? 'Mencari lokasi...' : 'Lokasi saya'}
                </button>
            </div>
            {searchMsg && <p className="text-xs text-amber-700">{searchMsg}</p>}
            {geoError && <p className="text-xs text-amber-700">{geoError}</p>}

            {/* Peta */}
            <div
                className={`h-80 sm:h-96 rounded-xl overflow-hidden border ${error ? 'border-red-400' : 'border-slate-200'}`}
            >
                <MapContainer
                    center={position || MAP_DEFAULT_CENTER}
                    zoom={position ? MAP_PICKED_ZOOM : MAP_DEFAULT_ZOOM}
                    scrollWheelZoom={false}
                    style={{ height: '100%', width: '100%' }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapInteractions onPick={(lat, lng) => applyPoint(lat, lng, { fly: false })} />
                    <MapFocus focus={focus} />
                    {position && (
                        <Marker
                            position={position}
                            icon={pinIcon}
                            draggable
                            eventHandlers={{
                                dragend: (e) => {
                                    const p = e.target.getLatLng();
                                    applyPoint(p.lat, p.lng, { fly: false });
                                },
                            }}
                        />
                    )}
                </MapContainer>
            </div>
            <p className="text-[11px] text-slate-400 -mt-1">
                Klik peta untuk menaruh pin, atau geser pin untuk menyesuaikan. Klik peta sekali untuk mengaktifkan zoom dengan scroll.
            </p>

            {/* Koordinat manual */}
            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <label htmlFor="store-lat" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Latitude (lintang)
                    </label>
                    <input
                        id="store-lat"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={latText}
                        onChange={(e) => handleCoordInput('lat', e.target.value)}
                        onBlur={() => handleCoordBlur('lat')}
                        onPaste={handlePaste}
                        placeholder="-3.316694"
                        className={`${inputCls} ${latBad ? 'border-red-400' : 'border-slate-200'}`}
                    />
                    {latBad && (
                        <p className="text-xs text-red-600 font-medium mt-1">
                            {looksLikeIndonesianLongitude(parseCoordinate(latText))
                                ? 'Angka ini terlihat seperti longitude. Latitude di Indonesia berkisar -11 s/d 6. Mungkin kolomnya tertukar?'
                                : 'Harus angka antara -90 dan 90.'}
                        </p>
                    )}
                </div>
                <div>
                    <label htmlFor="store-lng" className="block text-xs font-bold text-slate-600 mb-1.5">
                        Longitude (bujur)
                    </label>
                    <input
                        id="store-lng"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={lngText}
                        onChange={(e) => handleCoordInput('lng', e.target.value)}
                        onBlur={() => handleCoordBlur('lng')}
                        onPaste={handlePaste}
                        placeholder="114.590111"
                        className={`${inputCls} ${lngBad ? 'border-red-400' : 'border-slate-200'}`}
                    />
                    {lngBad && <p className="text-xs text-red-600 font-medium mt-1">Harus angka antara -180 dan 180.</p>}
                </div>
            </div>
            <p className="text-[11px] text-slate-400 -mt-1">
                Tips: di Google Maps, tekan lama pada lokasi lalu salin angkanya (contoh <span className="font-mono">-3.316694, 114.590111</span>)
                dan tempel di salah satu kolom, keduanya akan terisi otomatis.
            </p>

            {/* Status titik */}
            {hasPoint ? (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                    <p className="text-xs text-emerald-800 font-semibold inline-flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        Titik terpilih: <span className="font-mono">{latitude}, {longitude}</span>
                    </p>
                    <a
                        href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                    >
                        Cek di Google Maps <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                </div>
            ) : (
                <p className="text-xs text-slate-500">Belum ada titik yang dipilih.</p>
            )}

            {region === 'outside' && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 inline-flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                    Titik ini berada di luar wilayah Indonesia. Pastikan koordinatnya benar dan isi latitude/longitude tidak tertukar.
                </p>
            )}

            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        </div>
    );
}