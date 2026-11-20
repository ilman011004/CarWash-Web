import React, { useState } from 'react';
import { Plus, Droplets, Clock } from 'lucide-react';
import { addPackage } from '../../../services/storeService';
import { INITIAL_PACKAGE, PACKAGE_TEMPLATES } from './constants';
import { validatePackageForm, buildPackagePayload } from './validation';
import { extractError } from './useStoreRegistration';

const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

const inputCls =
    'w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition';
const borderFor = (error) => (error ? 'border-red-400' : 'border-slate-200');

function Field({ label, hint, error, children }) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">{label}</label>
            {children}
            {hint && !error && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
            {error && <p className="text-xs text-red-600 font-medium mt-1">{error}</p>}
        </div>
    );
}

function PriceInput({ value, onChange, hasError, placeholder }) {
    return (
        <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-semibold">Rp</span>
            <input
                type="number"
                min="0"
                step="1000"
                inputMode="numeric"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`${inputCls} ${borderFor(hasError)} pl-10`}
            />
        </div>
    );
}

// Langkah 2: owner membuat minimal satu paket cuci. Paket langsung disimpan ke backend
// satu per satu; daftar di bawah form adalah paket yang sudah tersimpan.
export default function PackagesStep({ store, packages, onPackageAdded, onBack, onNext }) {
    const [values, setValues] = useState(INITIAL_PACKAGE);
    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const setField = (name, value) => {
        setValues((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: undefined }));
    };

    const applyTemplate = (tpl) => {
        setValues((prev) => ({ ...prev, ...tpl.values }));
        setErrors({});
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setServerError('');

        const found = validatePackageForm(values);
        setErrors(found);
        if (Object.keys(found).length > 0) return;

        setSubmitting(true);
        try {
            const created = await addPackage(store.id, buildPackagePayload(values));
            onPackageAdded(created);
            setValues(INITIAL_PACKAGE);
        } catch (err) {
            setServerError(extractError(err, 'Gagal menambah paket. Coba lagi.'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-black text-slate-800">Atur paket & harga</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                    Toko <span className="font-semibold text-slate-700">{store.name}</span> sudah terdaftar. Tambahkan minimal satu
                    paket agar pelanggan bisa memesan.
                </p>
            </div>

            {/* Paket yang sudah tersimpan */}
            {packages.length > 0 && (
                <ul className="space-y-2">
                    {packages.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
                            <div className="min-w-0">
                                <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                                    {p.name}
                                    {p.is_waterless && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700">
                                            <Droplets className="w-3 h-3" /> Waterless
                                        </span>
                                    )}
                                </p>
                                {p.description && <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>}
                                <p className="text-[11px] text-slate-400 mt-1 inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> ±{p.estimated_duration_minutes} menit
                                </p>
                            </div>
                            <div className="text-right text-xs shrink-0">
                                <p className="text-slate-500">Mobil <span className="font-bold text-slate-800">{rupiah(p.price_car)}</span></p>
                                <p className="text-slate-500">Motor <span className="font-bold text-slate-800">{rupiah(p.price_motorcycle)}</span></p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {/* Form tambah paket */}
            <form onSubmit={handleAdd} className="space-y-4 rounded-2xl border border-slate-200 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Mulai dari template:</span>
                    {PACKAGE_TEMPLATES.map((tpl) => (
                        <button
                            key={tpl.label}
                            type="button"
                            onClick={() => applyTemplate(tpl)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100"
                        >
                            {tpl.label}
                        </button>
                    ))}
                </div>

                {serverError && <div className="p-3 text-sm bg-red-50 text-red-700 rounded-xl">{serverError}</div>}

                <Field label="Nama Paket" error={errors.name}>
                    <input
                        type="text"
                        value={values.name}
                        onChange={(e) => setField('name', e.target.value)}
                        placeholder="Contoh: Cuci Reguler"
                        className={`${inputCls} ${borderFor(errors.name)}`}
                    />
                </Field>

                <Field label="Deskripsi (opsional)">
                    <textarea
                        rows={2}
                        value={values.description}
                        onChange={(e) => setField('description', e.target.value)}
                        placeholder="Apa saja yang termasuk dalam paket ini"
                        className={`${inputCls} border-slate-200 resize-none`}
                    />
                </Field>

                <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Harga Mobil" error={errors.price_car}>
                        <PriceInput value={values.price_car} onChange={(v) => setField('price_car', v)} hasError={errors.price_car} placeholder="50000" />
                    </Field>
                    <Field label="Harga Motor" error={errors.price_motorcycle}>
                        <PriceInput value={values.price_motorcycle} onChange={(v) => setField('price_motorcycle', v)} hasError={errors.price_motorcycle} placeholder="25000" />
                    </Field>
                    <Field label="Estimasi Durasi (menit)" error={errors.estimated_duration_minutes}>
                        <input
                            type="number"
                            min="15"
                            max="480"
                            step="5"
                            value={values.estimated_duration_minutes}
                            onChange={(e) => setField('estimated_duration_minutes', e.target.value)}
                            className={`${inputCls} ${borderFor(errors.estimated_duration_minutes)}`}
                        />
                    </Field>
                </div>

                <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={values.is_waterless}
                        onChange={(e) => setField('is_waterless', e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-indigo-600"
                    />
                    <span>
                        <span className="font-semibold">Paket waterless</span>
                        <span className="block text-xs text-slate-400">Tanpa air mengalir, bisa dipesan pelanggan yang tidak punya sumber air.</span>
                    </span>
                </label>

                <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl transition disabled:bg-slate-400"
                >
                    <Plus className="w-4 h-4" />
                    {submitting ? 'Menyimpan...' : 'Tambah Paket'}
                </button>
            </form>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                {onBack ? (
                    <button type="button" onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
                        Kembali
                    </button>
                ) : <span />}
                <div className="flex flex-col sm:items-end gap-1">
                    <button
                        type="button"
                        onClick={onNext}
                        disabled={packages.length === 0}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                        Lanjut ke Verifikasi
                    </button>
                    {packages.length === 0 && (
                        <p className="text-[11px] text-slate-400">Tambahkan minimal satu paket untuk melanjutkan.</p>
                    )}
                </div>
            </div>
        </div>
    );
}