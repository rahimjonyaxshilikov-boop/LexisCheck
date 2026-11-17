import type {
  StudentProfile,
  StudentSummaryForTeacher,
  TestAttempt,
} from '../types/quiz';
import {
  buildStudentKey,
  buildStudentTokenBagKey,
  calculateStudentAggregates,
  DEFAULT_TEST_DURATION_MINUTES,
  isValidSchoolClass,
  looksLikeUzbekSurname,
  normalizeComparableText,
  normalizeStudentName,
  validateStudentNameOrder,
  validateTestDurationMinutes,
} from './quizEngine';

export class LocalStudentEntryError extends Error {
  code: string;
  suggestedName?: string;

  constructor(message: string, code: string, suggestedName?: string) {
    super(message);
    this.name = 'LocalStudentEntryError';
    this.code = code;
    this.suggestedName = suggestedName;
  }
}

const LOCAL_DB_KEY = 'lexischeck_local_db_v1';
const DEFAULT_TEACHER_HASH =
  'lexischeck_salt_2026:26892f86af0f5b04678fc3c063f9caab08b4356ab0e601a48ab244f026fcdb48';
const DEFAULT_CHEATER_CODE_HASH =
  'lexischeck_cheater_salt_2026:478f38966c399d456d7a573c075c9a074a16d516472afe548e5fc531a0179e93';

interface StoredLocalStudent {
  id: string;
  fullName: string;
  className: string;
  normalizedKey: string;
  secretToken: string;
  studiedUnits?: number[];
  attempts: TestAttempt[];
  createdAt: string;
}

interface LocalDatabase {
  teacherPasswordHash: string;
  cheaterCodeHash?: string;
  testDurationMinutes?: number;
  teacherTokens: string[];
  students: StoredLocalStudent[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getStorage(custom?: StorageLike): StorageLike {
  if (custom) return custom;
  if (typeof localStorage !== 'undefined') return localStorage;
  const mem = new Map<string, string>();
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, v),
  };
}

function randomToken(bytes = 20): string {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${randomToken(12)}`;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('WebCrypto SHA-256 is unavailable in this browser.');
}

async function hashTeacherPassword(password: string, salt?: string): Promise<string> {
  const usedSalt = salt ?? randomToken(12);
  const digest = await sha256Hex(`${usedSalt}:${password}`);
  return `${usedSalt}:${digest}`;
}

async function verifyTeacherPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [salt, expected] = storedHash.split(':');
  if (!salt || !expected) return false;
  const actual = await sha256Hex(`${salt}:${password}`);
  return actual === expected;
}

function loadDb(storage: StorageLike): LocalDatabase {
  try {
    const raw = storage.getItem(LOCAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalDatabase>;
      if (
        typeof parsed.teacherPasswordHash === 'string' &&
        Array.isArray(parsed.students)
      ) {
        const validatedTimer = validateTestDurationMinutes(parsed.testDurationMinutes);
        return {
          teacherPasswordHash: parsed.teacherPasswordHash,
          cheaterCodeHash:
            typeof parsed.cheaterCodeHash === 'string' && parsed.cheaterCodeHash.includes(':')
              ? parsed.cheaterCodeHash
              : DEFAULT_CHEATER_CODE_HASH,
          testDurationMinutes: validatedTimer.ok
            ? validatedTimer.minutes
            : DEFAULT_TEST_DURATION_MINUTES,
          teacherTokens: Array.isArray(parsed.teacherTokens)
            ? parsed.teacherTokens
            : [],
          students: parsed.students,
        };
      }
    }
  } catch {
    // Ignore corrupted local storage
  }
  const initial: LocalDatabase = {
    teacherPasswordHash: DEFAULT_TEACHER_HASH,
    cheaterCodeHash: DEFAULT_CHEATER_CODE_HASH,
    testDurationMinutes: DEFAULT_TEST_DURATION_MINUTES,
    teacherTokens: [],
    students: [],
  };
  saveDb(storage, initial);
  return initial;
}

function saveDb(storage: StorageLike, db: LocalDatabase): void {
  storage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
}

function toProfile(student: StoredLocalStudent): StudentProfile {
  const agg = calculateStudentAggregates(student.attempts);
  const sortedAttempts = [...student.attempts].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
  const studiedSet = new Set<number>(
    Array.isArray(student.studiedUnits) ? student.studiedUnits : [],
  );
  for (const u of agg.completedUnits) studiedSet.add(u);

  return {
    id: student.id,
    fullName: student.fullName,
    className: student.className,
    totalPoints: agg.totalPoints,
    completedUnits: agg.completedUnits,
    studiedUnits: Array.from(studiedSet).sort((a, b) => a - b),
    averagePercentage: agg.averagePercentage,
    attempts: sortedAttempts,
    createdAt: student.createdAt,
  };
}

export function localEnterStudent(
  rawName: string,
  rawClass: string,
  _existingToken?: string | null,
  customStorage?: StorageLike,
): { status: 'created' | 'resumed'; profile: StudentProfile; token: string } {
  const nameCheck = validateStudentNameOrder(rawName);
  if (!nameCheck.ok) {
    throw new LocalStudentEntryError(
      nameCheck.error,
      nameCheck.code,
      nameCheck.suggestedName,
    );
  }

  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  const fullName = nameCheck.fullName;
  const className = rawClass.trim();

  if (!isValidSchoolClass(className)) {
    throw new LocalStudentEntryError(
      "Sinf noto'g'ri tanlangan. 5-01 dan 10-03 gacha bo'lgan sinflardan birini tanlang.",
      'INVALID_INPUT',
    );
  }

  const normalizedKey = buildStudentKey(fullName, className);
  const tokenBagKey = buildStudentTokenBagKey(fullName, className);

  const exactMatch = db.students.find(
    (s) => buildStudentKey(s.fullName, s.className) === normalizedKey,
  );
  if (exactMatch) {
    return {
      status: 'resumed',
      profile: toProfile(exactMatch),
      token: exactMatch.secretToken,
    };
  }

  const swappedMatch = db.students.find(
    (s) => buildStudentTokenBagKey(s.fullName, s.className) === tokenBagKey,
  );
  if (swappedMatch) {
    const existingFirstToken = swappedMatch.fullName.trim().split(/\s+/)[0] ?? '';
    if (looksLikeUzbekSurname(existingFirstToken)) {
      swappedMatch.fullName = fullName;
      swappedMatch.normalizedKey = normalizedKey;
      saveDb(storage, db);
      return {
        status: 'resumed',
        profile: toProfile(swappedMatch),
        token: swappedMatch.secretToken,
      };
    }
    throw new LocalStudentEntryError(
      `Avval ismingizni, keyin familiyangizni yozing (masalan: ${swappedMatch.fullName}).`,
      'SURNAME_FIRST',
      swappedMatch.fullName,
    );
  }

  const created: StoredLocalStudent = {
    id: randomId(),
    fullName,
    className,
    normalizedKey,
    secretToken: randomToken(24),
    studiedUnits: [],
    attempts: [],
    createdAt: new Date().toISOString(),
  };
  db.students.push(created);
  saveDb(storage, db);
  return {
    status: 'created',
    profile: toProfile(created),
    token: created.secretToken,
  };
}

export function localLookupStudent(
  rawName: string,
  rawClass?: string,
  customStorage?: StorageLike,
):
  | {
      found: true;
      exactClassMatch: boolean;
      reversedOrder: boolean;
      fullName: string;
      className: string;
      totalPoints: number;
      completedUnitsCount: number;
      attemptsCount: number;
    }
  | { found: false } {
  const fullName = normalizeStudentName(rawName);
  const parts = fullName.split(' ').filter(Boolean);
  if (fullName.length < 3 || parts.length < 2) {
    return { found: false };
  }
  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  const targetExact = normalizeComparableText(fullName);
  const targetBag = normalizeComparableText(fullName).split(' ').filter(Boolean).sort().join('|');
  const trimmedClass = rawClass?.trim();

  let match: StoredLocalStudent | undefined;
  let exactClassMatch = false;
  let reversedOrder = false;

  if (trimmedClass && isValidSchoolClass(trimmedClass)) {
    const exactKey = buildStudentKey(fullName, trimmedClass);
    match = db.students.find((s) => buildStudentKey(s.fullName, s.className) === exactKey);
    if (match) {
      exactClassMatch = true;
    } else {
      const bagKey = buildStudentTokenBagKey(fullName, trimmedClass);
      match = db.students.find(
        (s) => buildStudentTokenBagKey(s.fullName, s.className) === bagKey,
      );
      if (match) {
        exactClassMatch = true;
        const matchFirstToken = match.fullName.trim().split(/\s+/)[0] ?? '';
        reversedOrder = looksLikeUzbekSurname(parts[0]) || !looksLikeUzbekSurname(matchFirstToken);
      }
    }
  }

  if (!match) {
    match = db.students.find((s) => normalizeComparableText(s.fullName) === targetExact);
    if (!match) {
      match = db.students.find(
        (s) =>
          normalizeComparableText(s.fullName).split(' ').filter(Boolean).sort().join('|') ===
          targetBag,
      );
      if (match) {
        const matchFirstToken = match.fullName.trim().split(/\s+/)[0] ?? '';
        reversedOrder = looksLikeUzbekSurname(parts[0]) || !looksLikeUzbekSurname(matchFirstToken);
      }
    }
  }

  if (!match) return { found: false };
  const profile = toProfile(match);
  return {
    found: true,
    exactClassMatch,
    reversedOrder,
    fullName: profile.fullName,
    className: profile.className,
    totalPoints: profile.totalPoints,
    completedUnitsCount: profile.completedUnits.length,
    attemptsCount: profile.attempts.length,
  };
}

export function localGetStudentByToken(
  token: string | null,
  customStorage?: StorageLike,
): StudentProfile | null {
  if (!token) return null;
  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  const found = db.students.find((s) => s.secretToken === token);
  return found ? toProfile(found) : null;
}

export function localSubmitAttempt(
  token: string,
  attempt: Omit<TestAttempt, 'id' | 'completedAt'>,
  customStorage?: StorageLike,
): { profile: StudentProfile; attempt: TestAttempt } {
  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  const found = db.students.find((s) => s.secretToken === token);
  if (!found) {
    throw new Error("O'quvchi sessiyasi topilmadi. Qaytadan kiring.");
  }
  const savedAttempt: TestAttempt = {
    ...attempt,
    id: randomId(),
    completedAt: new Date().toISOString(),
  };
  found.attempts.push(savedAttempt);
  saveDb(storage, db);
  return { profile: toProfile(found), attempt: savedAttempt };
}

export function localCompleteUnitStudy(
  token: string,
  unitNumber: number,
  customStorage?: StorageLike,
): StudentProfile {
  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  const found = db.students.find((s) => s.secretToken === token);
  if (!found) {
    throw new Error("O'quvchi sessiyasi topilmadi.");
  }
  const current = Array.isArray(found.studiedUnits) ? found.studiedUnits : [];
  if (!current.includes(unitNumber)) {
    found.studiedUnits = [...current, unitNumber].sort((a, b) => a - b);
    saveDb(storage, db);
  }
  return toProfile(found);
}

export async function localLoginTeacher(
  password: string,
  customStorage?: StorageLike,
): Promise<string> {
  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  const ok = await verifyTeacherPassword(password, db.teacherPasswordHash);
  if (!ok) {
    throw new Error("Parol noto'g'ri.");
  }
  const token = randomToken(24);
  db.teacherTokens = [token, ...db.teacherTokens].slice(0, 10);
  saveDb(storage, db);
  return token;
}

export function localFetchTeacherDashboard(
  token: string,
  customStorage?: StorageLike,
): StudentSummaryForTeacher[] {
  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  if (!db.teacherTokens.includes(token)) {
    throw new Error("O'qituvchi sessiyasi topilmadi.");
  }
  return db.students
    .map((s) => {
      const profile = toProfile(s);
      const lastActiveAt =
        profile.attempts.length > 0 ? profile.attempts[0].completedAt : s.createdAt;
      return { ...profile, lastActiveAt };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

export async function localUpdateTeacherPassword(
  token: string,
  oldPassword: string,
  newPassword: string,
  confirmPassword: string,
  customStorage?: StorageLike,
): Promise<void> {
  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  if (!db.teacherTokens.includes(token)) {
    throw new Error("O'qituvchi sessiyasi yaroqsiz. Qaytadan kiring.");
  }
  if (!(await verifyTeacherPassword(oldPassword, db.teacherPasswordHash))) {
    throw new Error("Eski parol noto'g'ri kiritildi.");
  }
  if (newPassword.length < 6) {
    throw new Error("Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak.");
  }
  if (newPassword !== confirmPassword) {
    throw new Error('Yangi parol va tasdiqlash paroli bir-biriga mos kelmadi.');
  }
  if (newPassword === oldPassword) {
    throw new Error("Yangi parol eski paroldan farq qilishi kerak.");
  }
  db.teacherPasswordHash = await hashTeacherPassword(newPassword);
  saveDb(storage, db);
}

export async function localVerifyCheaterCode(
  code: string,
  customStorage?: StorageLike,
): Promise<boolean> {
  const trimmed = code.trim();
  if (!trimmed) return false;
  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  const hash = db.cheaterCodeHash || DEFAULT_CHEATER_CODE_HASH;
  return verifyTeacherPassword(trimmed, hash);
}

export async function localUpdateCheaterCode(
  token: string,
  oldCode: string,
  newCode: string,
  confirmCode: string,
  customStorage?: StorageLike,
): Promise<void> {
  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  if (!db.teacherTokens.includes(token)) {
    throw new Error("O'qituvchi sessiyasi yaroqsiz. Qaytadan kiring.");
  }
  const oldTrimmed = oldCode.trim();
  const newTrimmed = newCode.trim();
  const confirmTrimmed = confirmCode.trim();
  const currentHash = db.cheaterCodeHash || DEFAULT_CHEATER_CODE_HASH;

  if (!oldTrimmed || !(await verifyTeacherPassword(oldTrimmed, currentHash))) {
    throw new Error("Eski cheater paroli noto'g'ri kiritildi.");
  }
  if (newTrimmed.length < 4) {
    throw new Error("Yangi cheater paroli kamida 4 ta belgidan iborat bo'lishi kerak.");
  }
  if (newTrimmed !== confirmTrimmed) {
    throw new Error('Yangi cheater paroli va tasdiqlash paroli bir-biriga mos kelmadi.');
  }
  if (newTrimmed === oldTrimmed) {
    throw new Error('Yangi cheater paroli eski paroldan farq qilishi kerak.');
  }
  db.cheaterCodeHash = await hashTeacherPassword(newTrimmed);
  saveDb(storage, db);
}

export function localDeleteStudent(
  token: string,
  studentId: string,
  customStorage?: StorageLike,
): void {
  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  if (!db.teacherTokens.includes(token)) {
    throw new Error("Ruxsat yo'q.");
  }
  const idx = db.students.findIndex((s) => s.id === studentId);
  if (idx === -1) {
    throw new Error("O'quvchi topilmadi.");
  }
  db.students.splice(idx, 1);
  saveDb(storage, db);
}

export function localGetTestDurationMinutes(customStorage?: StorageLike): number {
  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  const validated = validateTestDurationMinutes(db.testDurationMinutes);
  return validated.ok ? validated.minutes : DEFAULT_TEST_DURATION_MINUTES;
}

export function localUpdateTestDurationMinutes(
  token: string,
  minutes: unknown,
  customStorage?: StorageLike,
): number {
  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  if (!db.teacherTokens.includes(token)) {
    throw new Error("O'qituvchi sessiyasi yaroqsiz. Qaytadan kiring.");
  }
  const validated = validateTestDurationMinutes(minutes);
  if (!validated.ok) {
    throw new Error(validated.error);
  }
  db.testDurationMinutes = validated.minutes;
  saveDb(storage, db);
  return validated.minutes;
}
