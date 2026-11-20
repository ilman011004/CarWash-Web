import { useState } from 'react';
import { registerStore } from '../../../services/storeService';
import { INITIAL_FORM } from './constants';
import { validateStoreForm, buildStorePayload } from './validation';

// Ambil pesan error yang paling berguna dari respons backend.
export function extractError(err, fallback = 'Terjadi kesalahan. Coba lagi.') {
    const data = err.response?.data;
    if (data?.message) return data.message;
    if (data?.errors) {
        const first = Object.values(data.errors).flat()[0];
        if (first) return String(first);
    }
    return fallback;
}

// Seluruh logika form langkah 1 (state, validasi, kirim ke backend) ada di sini,
// jadi komponen tampilan cukup menerima hasilnya.
// onCreated(store) dipanggil dengan data toko yang baru dibuat.
export default function useStoreRegistration({ defaultPhone = '', onCreated }) {
    const [values, setValues] = useState({ ...INITIAL_FORM, phone: defaultPhone });
    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const setField = (name, value) => {
        setValues((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: undefined }));
    };

    const setLocation = (latitude, longitude) => {
        setValues((prev) => ({ ...prev, latitude, longitude }));
        setErrors((prev) => ({ ...prev, location: undefined }));
    };

    const submit = async (e) => {
        e.preventDefault();
        setServerError('');

        const found = validateStoreForm(values);
        setErrors(found);
        if (Object.keys(found).length > 0) return;

        setSubmitting(true);
        try {
            const data = await registerStore(buildStorePayload(values));
            if (onCreated) onCreated(data.store);
        } catch (err) {
            setServerError(extractError(err, 'Gagal mendaftarkan toko. Coba lagi.'));
        } finally {
            setSubmitting(false);
        }
    };

    return { values, errors, serverError, submitting, setField, setLocation, submit };
}