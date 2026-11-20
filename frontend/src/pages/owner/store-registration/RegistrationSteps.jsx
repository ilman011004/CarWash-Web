import React from 'react';
import { Store, Tag, BadgeCheck, Check } from 'lucide-react';
import { REGISTRATION_STEPS } from './constants';

const ICONS = {
    register: Store,
    packages: Tag,
    verify: BadgeCheck,
};

// Indikator langkah. `current` = indeks langkah aktif (0, 1, 2).
// Langkah sebelum `current` ditandai selesai.
export default function RegistrationSteps({ current = 0 }) {
    return (
        <ol className="grid sm:grid-cols-3 gap-3">
            {REGISTRATION_STEPS.map((step, i) => {
                const Icon = ICONS[step.key];
                const isDone = i < current;
                const isCurrent = i === current;

                const card = isCurrent
                    ? 'border-indigo-300 bg-indigo-50/60'
                    : isDone
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-slate-200/80 bg-white';
                const badge = isCurrent
                    ? 'bg-indigo-600 text-white'
                    : isDone
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 text-slate-500';

                return (
                    <li
                        key={step.key}
                        aria-current={isCurrent ? 'step' : undefined}
                        className={`rounded-2xl border p-4 transition ${card}`}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${badge}`}>
                                {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                            </span>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Langkah {i + 1}
                                {isDone && ' · Selesai'}
                            </span>
                        </div>
                        <p className="font-bold text-slate-800 text-sm">{step.title}</p>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{step.desc}</p>
                    </li>
                );
            })}
        </ol>
    );
}