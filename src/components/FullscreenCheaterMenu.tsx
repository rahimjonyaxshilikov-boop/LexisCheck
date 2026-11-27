import { AlertTriangle, Clock, Eye, LogOut, Maximize2, ShieldAlert } from 'lucide-react';
import { formatCountdown } from '../utils/quizEngine';

interface FullscreenCheaterMenuProps {
  studentName: string;
  unitNumber: number;
  unitTitle: string;
  exitCount: number;
  tabSwitchCount: number;
  aiSuspected: boolean;
  secondsLeft: number;
  fullscreenActive: boolean;
  onReturnFullscreen: () => void;
  onRequestAbortTest: () => void;
}

export function FullscreenCheaterMenu({
  studentName,
  unitNumber,
  unitTitle,
  exitCount,
  tabSwitchCount,
  aiSuspected,
  secondsLeft,
  fullscreenActive,
  onReturnFullscreen,
  onRequestAbortTest,
}: FullscreenCheaterMenuProps) {
  const totalIncidents = Math.max(1, exitCount + tabSwitchCount);

  return (
    <div
      data-testid="cheater-menu-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cheater-menu-heading"
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-[#070a12]/96 bg-[radial-gradient(ellipse_70%_50%_at_50%_10%,rgba(225,29,72,0.16),transparent_65%),radial-gradient(ellipse_60%_45%_at_85%_90%,rgba(99,102,241,0.12),transparent_60%)] p-4 text-slate-100 backdrop-blur-2xl sm:p-6"
    >
      <div className="w-full max-w-xl rounded-2xl border border-rose-500/35 bg-[#121826] p-6 shadow-2xl sm:p-9">
        {/* Top Protection Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-700/50 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-500/35 bg-rose-500/15 text-rose-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-300/90">
                Ekran himoyasi · Screen Hide yoqildi
              </div>
              <div className="text-sm font-semibold text-slate-200">
                {studentName} · Unit {unitNumber}
              </div>
            </div>
          </div>

          <div className="text-right font-mono-tabular">
            <div className="text-[11px] text-slate-400">Qolgan vaqt</div>
            <div className="inline-flex items-center gap-1 text-sm font-bold text-amber-300">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatCountdown(secondsLeft)}</span>
            </div>
          </div>
        </div>

        {/* Main CHEATER & Fullscreen Request */}
        <div className="mt-6 text-center">
          <div
            data-testid="cheater-word-mark"
            className="font-display text-4xl font-bold tracking-tight text-rose-400 sm:text-5xl"
          >
            CHEATER
          </div>

          <h1
            id="cheater-menu-heading"
            data-testid="cheater-menu-title"
            className="font-display mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl [text-wrap:balance]"
          >
            Iltimos, fullscreen rejimiga oʻting
          </h1>

          <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-slate-300">
            Test vaqtida toʻliq ekrandan chiqilgani uchun savollar yashirildi. Ushbu holat
            oʻqituvchi boʻlimida akkauntingiz va{' '}
            <span className="font-semibold text-white">Unit {unitNumber}</span> testiga qayd etildi.
          </p>
        </div>

        {/* Addition 1: 3-column Live Violation & AI Monitoring Telemetry */}
        <div className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="rounded-xl border border-rose-500/25 bg-[#0d121d] p-3 text-center">
            <div className="text-[11px] font-medium text-slate-400">Chiqishlar</div>
            <div
              data-testid="cheater-exit-counter"
              className="font-mono-tabular mt-1 text-lg font-bold text-rose-400 sm:text-xl"
            >
              {totalIncidents} marta
            </div>
          </div>

          <div className="rounded-xl border border-indigo-500/25 bg-[#0d121d] p-3 text-center">
            <div className="text-[11px] font-medium text-slate-400">Faol unit</div>
            <div className="font-mono-tabular mt-1 truncate text-lg font-bold text-indigo-300 sm:text-xl">
              Unit {unitNumber}
            </div>
          </div>

          <div
            className={`rounded-xl border p-3 text-center ${
              aiSuspected
                ? 'border-rose-500/40 bg-rose-950/35'
                : 'border-amber-500/30 bg-amber-950/25'
            }`}
          >
            <div className="text-[11px] font-medium text-slate-400">AI nazorati</div>
            <div
              data-testid="cheater-ai-status"
              className={`mt-1 flex min-h-[28px] items-center justify-center text-sm font-bold tracking-normal ${
                aiSuspected ? 'text-rose-300' : 'text-amber-300'
              }`}
            >
              {aiSuspected ? 'AI shubhasi' : 'Qayd etildi'}
            </div>
          </div>
        </div>

        {/* Addition 2: Anti-Cheat Guidance & Unit Info Notice */}
        <div className="mt-4 rounded-xl border border-slate-700/50 bg-[#0d121d]/90 p-3.5 text-xs leading-relaxed text-slate-300">
          <div className="flex items-start gap-2.5">
            {aiSuspected ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            )}
            <div>
              <span className="font-semibold text-white">Unit {unitNumber}: {unitTitle}.</span>{' '}
              {aiSuspected
                ? 'Bir necha marta chiqish yoki boshqa oynaga oʻtish AI/tashqi yordam belgisi sifatida oʻqituvchiga koʻrsatiladi.'
                : 'Testni adolatli davom ettirish uchun boshqa oyna yoki AI vositalariga oʻtmang va fullscreen rejimiga qayting.'}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            data-testid="return-fullscreen-btn"
            onClick={onReturnFullscreen}
            className="gloss-btn-primary flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white"
          >
            <Maximize2 className="h-4 w-4" />
            <span>
              {fullscreenActive
                ? 'Testga qaytish'
                : 'Toʻliq ekranga oʻtish (Fullscreen)'}
            </span>
          </button>

          <button
            type="button"
            data-testid="cheater-abort-test-btn"
            onClick={onRequestAbortTest}
            className="gloss-btn-secondary inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold text-slate-300 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span>Testni toʻxtatish</span>
          </button>
        </div>
      </div>
    </div>
  );
}
