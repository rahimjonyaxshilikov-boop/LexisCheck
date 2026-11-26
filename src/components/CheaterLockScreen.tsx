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
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-[#0d111a] bg-[radial-gradient(ellipse_65%_45%_at_50%_14%,rgba(225,29,72,0.14),transparent_65%)] p-6 text-slate-100"
    >
      <div className="w-full max-w-lg rounded-2xl border border-rose-500/30 bg-[#141925] p-7 text-center shadow-xl sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/35 bg-rose-950/50 text-rose-400">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <h1
          id="cheater-heading"
          data-testid="cheater-title"
          className="font-display mt-5 text-6xl font-bold tracking-tight text-rose-500 sm:text-7xl"
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
                className="block min-h-[48px] w-full rounded-xl border border-slate-700/60 bg-[#0d121d] pr-12 pl-4 font-mono-tabular text-base text-slate-100 placeholder:text-slate-500 focus:border-rose-500/75 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                aria-label={showCode ? 'Kodni yashirish' : 'Kodni koʻrsatish'}
                className="absolute top-1/2 right-2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/35 bg-rose-950/50 p-3 text-xs font-medium text-rose-300"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={verifying}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-rose-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-rose-500 disabled:opacity-60"
          >
            <Unlock className="h-4 w-4" />
            <span>{verifying ? 'Tekshirilmoqda...' : 'Ochish'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
