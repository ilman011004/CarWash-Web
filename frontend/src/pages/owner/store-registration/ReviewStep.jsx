import React from 'react';
import { BadgeCheck, MapPin, Phone, Tag } from 'lucide-react';

// Langkah 3: ringkasan sebelum masuk ke dashboard. Toko yang baru dibuat belum tampil
// ke pelanggan sampai admin memverifikasinya.
export default function ReviewStep({ store, packages, onBack, onFinish }) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-black text-slate-800">Hampir selesai</h2>
                <p className="text-sm text-slate-500 mt-0.5">Periksa ringkasan di bawah, lalu masuk ke dashboard toko.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100">
                <div className="p-4 space-y-1.5">
                    <p className="font-black text-slate-800">{store.name}</p>
                    <p className="text-xs text-slate-500 inline-flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-px shrink-0" />{store.address_text}</p>
                    <p className="text-xs text-slate-500 inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" />{store.phone}</p>
                    <p className="text-[11px] font-mono text-slate-400">{store.latitude}, {store.longitude}</p>
                </div>
                <div className="p-4">
                    <p className="text-xs font-bold text-slate-500 inline-flex items-center gap-1.5 mb-2">
                        <Tag className="w-3.5 h-3.5" /> {packages.length} paket cuci
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {packages.map((p) => (
                            <span key={p.id} className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">{p.name}</span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-4">
                <BadgeCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                    <p className="font-bold">Menunggu verifikasi admin</p>
                    <p className="text-xs mt-0.5 leading-relaxed">
                        Toko Anda baru tampil di pencarian pelanggan setelah disetujui admin. Sambil menunggu, Anda bisa menambahkan pegawai
                        di dashboard. Home service membutuhkan minimal 2 pegawai.
                    </p>
                </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                <button type="button" onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
                    Kembali
                </button>
                <button
                    type="button"
                    onClick={onFinish}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition"
                >
                    Buka Dashboard Toko
                </button>
            </div>
        </div>
    );
}