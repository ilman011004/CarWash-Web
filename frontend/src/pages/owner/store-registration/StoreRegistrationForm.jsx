import React from 'react';
import LocationPicker from './LocationPicker';

const inputCls =
    'w-full bg-slate-50 border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition';

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

const borderFor = (error) => (error ? 'border-red-400' : 'border-slate-200');

// Tampilan form saja. Data dan logikanya datang dari useStoreRegistration.
export default function StoreRegistrationForm({ form }) {
    const { values, errors, serverError, submitting, setField, setLocation, submit } = form;

    return (
        <form onSubmit={submit} className="space-y-5">
            {serverError && <div className="p-3 text-sm bg-red-50 text-red-700 rounded-xl">{serverError}</div>}

            <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Nama Toko" error={errors.name}>
                    <input
                        type="text"
                        value={values.name}
                        onChange={(e) => setField('name', e.target.value)}
                        className={`${inputCls} ${borderFor(errors.name)}`}
                        placeholder="Contoh: Garage 88 Home Wash"
                    />
                </Field>

                <Field label="Nomor Telepon Toko" error={errors.phone}>
                    <input
                        type="tel"
                        value={values.phone}
                        onChange={(e) => setField('phone', e.target.value)}
                        className={`${inputCls} ${borderFor(errors.phone)}`}
                        placeholder="08123456789"
                    />
                </Field>
            </div>

            <Field label="Alamat Lengkap" error={errors.address_text}>
                <textarea
                    rows={2}
                    value={values.address_text}
                    onChange={(e) => setField('address_text', e.target.value)}
                    className={`${inputCls} ${borderFor(errors.address_text)} resize-none`}
                    placeholder="Jalan, nomor, kelurahan, kecamatan, kota"
                />
            </Field>

            <Field label="Lokasi Toko di Peta">
                <LocationPicker
                    latitude={values.latitude}
                    longitude={values.longitude}
                    onChange={setLocation}
                    error={errors.location}
                />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
                <Field
                    label="Jarak Layanan Maksimal (km)"
                    hint="Pelanggan di luar jarak ini tidak akan melihat toko Anda."
                    error={errors.max_service_distance_km}
                >
                    <input
                        type="number"
                        min="1"
                        step="any"
                        value={values.max_service_distance_km}
                        onChange={(e) => setField('max_service_distance_km', e.target.value)}
                        className={`${inputCls} ${borderFor(errors.max_service_distance_km)}`}
                    />
                </Field>

                <Field
                    label="Tarif Antar per km (Rp)"
                    hint="Dipakai untuk layanan home service / jemput antar."
                    error={errors.delivery_fee_per_km}
                >
                    <input
                        type="number"
                        min="0"
                        step="500"
                        value={values.delivery_fee_per_km}
                        onChange={(e) => setField('delivery_fee_per_km', e.target.value)}
                        className={`${inputCls} ${borderFor(errors.delivery_fee_per_km)}`}
                    />
                </Field>
            </div>

            <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition disabled:bg-slate-400"
            >
                {submitting ? 'Menyimpan...' : 'Simpan & Lanjut ke Paket'}
            </button>
        </form>
    );
}