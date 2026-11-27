import type {
  RecordCheatEventPayload,
  StudentCheatOverview,
  UnitCheatSummary,
} from '../types/quiz';

const LEGACY_CHEATER_LOCK_KEY = 'lexischeck_cheater_lock_v1';

export const AI_SUSPICION_AWAY_SECONDS = 8;

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export function clearLegacyCheaterLockStorage(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LEGACY_CHEATER_LOCK_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function shouldFlagAiUsage(params: {
  exitCount: number;
  tabSwitchCount: number;
  totalAwaySeconds: number;
}): boolean {
  return (
    params.tabSwitchCount >= 1 ||
    params.exitCount >= 2 ||
    params.totalAwaySeconds >= AI_SUSPICION_AWAY_SECONDS
  );
}

export function applyCheatEventToLogs(
  existingLogs: UnitCheatSummary[] | undefined,
  payload: RecordCheatEventPayload,
  nowIso: string = new Date().toISOString(),
): UnitCheatSummary[] {
  const safeLogs = Array.isArray(existingLogs) ? existingLogs.map((l) => ({ ...l })) : [];
  const awayIncrement =
    typeof payload.awaySeconds === 'number' &&
    Number.isFinite(payload.awaySeconds) &&
    payload.awaySeconds > 0
      ? Math.min(3600, Math.round(payload.awaySeconds))
      : 0;

  let entry = safeLogs.find((item) => item.unitNumber === payload.unitNumber);
  if (!entry) {
    entry = {
      unitNumber: payload.unitNumber,
      unitTitle: payload.unitTitle,
      exitCount: 0,
      tabSwitchCount: 0,
      totalAwaySeconds: 0,
      aiSuspected: false,
      lastEventAt: nowIso,
    };
    safeLogs.push(entry);
  } else if (payload.unitTitle) {
    entry.unitTitle = payload.unitTitle;
  }

  if (payload.eventType === 'fullscreen_exit') {
    entry.exitCount += 1;
  } else if (payload.eventType === 'tab_switch') {
    entry.tabSwitchCount += 1;
  }

  if (awayIncrement > 0) {
    entry.totalAwaySeconds += awayIncrement;
  }

  entry.aiSuspected = shouldFlagAiUsage(entry);
  entry.lastEventAt = nowIso;

  return safeLogs.sort(
    (a, b) => new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime(),
  );
}

export function summarizeStudentCheatLogs(
  logs: UnitCheatSummary[] | undefined,
): StudentCheatOverview {
  const safeLogs = Array.isArray(logs) ? logs : [];
  let totalExits = 0;
  let totalTabSwitches = 0;
  let totalAwaySeconds = 0;
  let aiSuspected = false;

  for (const log of safeLogs) {
    totalExits += log.exitCount;
    totalTabSwitches += log.tabSwitchCount;
    totalAwaySeconds += log.totalAwaySeconds;
    if (log.aiSuspected) {
      aiSuspected = true;
    }
  }

  return {
    totalExits,
    totalTabSwitches,
    totalAwaySeconds,
    flaggedUnitsCount: safeLogs.length,
    aiSuspected,
  };
}

export function isFullscreenActive(doc?: FullscreenDocument): boolean {
  const target =
    doc ?? (typeof document !== 'undefined' ? (document as FullscreenDocument) : null);
  if (!target) return false;
  return Boolean(target.fullscreenElement || target.webkitFullscreenElement);
}

export async function requestAppFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (isFullscreenActive()) return true;

  const el = document.documentElement as FullscreenElement;
  try {
    if (typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen();
      return true;
    }
    if (typeof el.webkitRequestFullscreen === 'function') {
      await el.webkitRequestFullscreen();
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function exitAppFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  const doc = document as FullscreenDocument;
  if (!isFullscreenActive(doc)) return;

  try {
    if (typeof doc.exitFullscreen === 'function') {
      await doc.exitFullscreen();
    } else if (typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // Ignore exit fullscreen error
  }
}
