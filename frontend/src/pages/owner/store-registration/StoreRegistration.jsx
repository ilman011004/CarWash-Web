import React, { useState } from 'react';
import { Store } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import useStoreRegistration from './useStoreRegistration';
import RegistrationSteps from './RegistrationSteps';
import StoreRegistrationForm from './StoreRegistrationForm';
import PackagesStep from './PackagesStep';
import ReviewStep from './ReviewStep';

// Wizard onboarding owner, tampil di dashboard selama toko belum siap dipakai:
//   langkah 0 = data & lokasi toko (membuat toko di backend)
//   langkah 1 = paket & harga (minimal satu paket)
//   langkah 2 = ringkasan + info verifikasi admin
//
// Props:
//   store       toko yang sudah ada tetapi belum punya paket (wizard langsung lanjut ke langkah 2)
//   packages    paket yang sudah ada untuk toko tersebut
//   onFinished  dipanggil dengan id toko saat owner menekan "Buka Dashboard Toko"
//
// Dashboard baru dimuat ulang saat wizard selesai, bukan di tiap langkah, supaya
// wizard tidak hilang di tengah jalan.
export default function StoreRegistration({ store: existingStore = null, packages: existingPackages = [], onFinished }) {
    const { user } = useAuth();
    const [store, setStore] = useState(existingStore);
    const [packages, setPackages] = useState(existingPackages);
    const [step, setStep] = useState(existingStore ? 1 : 0);

    const form = useStoreRegistration({
        defaultPhone: user?.phone || '',
        onCreated: (created) => {
            setStore(created);
            setStep(1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        },
    });

    const goTo = (next) => {
        setStep(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 lg:py-12">
            <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center mx-auto mb-3">
                    <Store className="w-7 h-7" />
                </div>
                <h1 className="text-2xl font-black text-slate-800">
                    {step === 0 ? 'Daftarkan Toko Anda' : 'Lengkapi Toko Anda'}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Akun pemilik sudah aktif. Selesaikan tiga langkah ini agar toko siap menerima pesanan.
                </p>
            </div>

            <div className="mb-6">
                <RegistrationSteps current={step} />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6">
                {step === 0 && <StoreRegistrationForm form={form} />}

                {step === 1 && store && (
                    <PackagesStep
                        store={store}
                        packages={packages}
                        onPackageAdded={(p) => setPackages((prev) => [...prev, p])}
                        onNext={() => goTo(2)}
                    />
                )}

                {step === 2 && store && (
                    <ReviewStep
                        store={store}
                        packages={packages}
                        onBack={() => goTo(1)}
                        onFinish={() => onFinished && onFinished(store.id)}
                    />
                )}
            </div>
        </div>
    );
}