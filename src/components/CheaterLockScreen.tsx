import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, ShieldAlert, Unlock } from 'lucide-react';
import { verifyCheaterCode } from '../utils/api';

interface CheaterLockScreenProps {
  onUnlock: () => void;
}

export function CheaterLockScreen({ onUnlock }: CheaterLockScreenProps) {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const ok = await verifyCheaterCode(code);
      if (!ok) {
        setError("Kod notoʻgʻri. Test bloklangan holatda qoladi.");
        return;
      }
      setCode('');
      onUnlock();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div
      data-testid="cheater-lock-screen"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cheater-heading"
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-[#05060b] bg-[radial-gradient(ellipse_65%_45%_at_50%_14%,rgba(239,68,68,0.22),transparent_65%)] p-6 text-slate-100"
    >
      <div className="w-full max-w-lg rounded-2xl border border-red-500/35 bg-gradient-to-b from-[#17121c]/95 to-[#0b0d14]/95 p-7 text-center shadow-[inset_0_1px_0_rgba(254,202,202,0.18),0_28px_60px_-20px_rgba(0,0,0,0.92)] backdrop-blur-2xl sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/40 bg-red-950/60 text-red-400 shadow-[inset_0_1px_0_rgba(254,202,202,0.2),0_10px_25px_-8px_rgba(239,68,68,0.45)]">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <h1
          id="cheater-heading"
          data-testid="cheater-title"
          className="font-display mt-5 text-6xl font-bold tracking-tight text-red-500 sm:text-7xl"
        >
          Cheater
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          Toʻliq ekran (Fullscreen) rejimidan chiqilgani sababli test bloklandi.
          Toʻliq ekran qayta yoqilsa ham testni davom ettirib boʻlmaydi.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4 text-left" noValidate>
          <div>
            <label
              htmlFor="cheater-unlock-code"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>Blokdan chiqarish kodi</span>
            </label>
            <div className="relative mt-2">
              <input
                id="cheater-unlock-code"
                type={showCode ? 'text' : 'password'}
                autoComplete="off"
                autoFocus
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Kodni kiriting"
                className="block min-h-[48px] w-full rounded-xl border border-white/15 bg-black/65 pr-12 pl-4 font-mono-tabular text-base text-white placeholder:text-slate-500 shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)] focus:border-red-500/80 focus:outline-none focus:ring-2 focus:ring-red-500/25"
              />
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                aria-label={showCode ? 'Kodni yashirish' : 'Kodni koʻrsatish'}
                className="absolute top-1/2 right-2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200"
              >
                {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/40 bg-red-950/60 p-3 text-xs font-medium text-red-300"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={verifying}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-gradient-to-b from-red-500 to-red-700 px-5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_12px_26px_-8px_rgba(220,38,38,0.6)] transition-all hover:brightness-110 disabled:opacity-60"
          >
            <Unlock className="h-4 w-4" />
            <span>{verifying ? 'Tekshirilmoqda...' : 'Ochish'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
