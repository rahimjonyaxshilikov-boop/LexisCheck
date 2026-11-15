const CHEATER_LOCK_KEY = 'lexischeck_cheater_lock_v1';
const UNLOCK_CODE = '2026Al1209.9';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export function verifyCheaterUnlockCode(input: string): boolean {
  return input.trim() === UNLOCK_CODE;
}

export function isCheaterLockedInStorage(customStorage?: StorageLike): boolean {
  try {
    const storage =
      customStorage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    return storage?.getItem(CHEATER_LOCK_KEY) === 'locked';
  } catch {
    return false;
  }
}

export function setCheaterLockedInStorage(
  locked: boolean,
  customStorage?: StorageLike,
): void {
  try {
    const storage =
      customStorage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!storage) return;
    if (locked) storage.setItem(CHEATER_LOCK_KEY, 'locked');
    else storage.removeItem(CHEATER_LOCK_KEY);
  } catch {
    // Ignore storage errors
  }
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
