import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock, ShieldAlert, Unlock } from 'lucide-react';
import { verifyCheaterUnlockCode } from '../utils/antiCheat';

interface CheaterLockScreenProps {
  onUnlock: () => void;
}

export function CheaterLockScreen({ onUnlock }: CheaterLockScreenProps) {
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!verifyCheaterUnlockCode(code)) {
      setError("Kod notoʻgʻri. Test bloklangan holatda qoladi.");
      return;
    }
    setError(null);
    setCode('');
    onUnlock();
  }

  return (
    <div
      data-testid="cheater-lock-screen"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cheater-heading"
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100"
    >
      <div className="w-full max-w-lg rounded-2xl border border-red-900/70 bg-slate-900 p-7 text-center shadow-2xl sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-800/80 bg-red-950/70 text-red-400">
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
                className="block min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-950 pr-12 pl-4 font-mono-tabular text-base text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
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
              className="rounded-xl border border-red-800/70 bg-red-950/60 p-3 text-xs font-medium text-red-300"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-500"
          >
            <Unlock className="h-4 w-4" />
            <span>Ochish</span>
          </button>
        </form>
      </div>
    </div>
  );
}
