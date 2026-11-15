import type {
  StudentProfile,
  StudentSummaryForTeacher,
  TestAttempt,
} from '../types/quiz';
import {
  buildStudentKey,
  calculateStudentAggregates,
  isValidSchoolClass,
  normalizeStudentName,
} from './quizEngine';

const LOCAL_DB_KEY = 'lexischeck_local_db_v1';
const DEFAULT_TEACHER_HASH =
  'lexischeck_salt_2026:26892f86af0f5b04678fc3c063f9caab08b4356ab0e601a48ab244f026fcdb48';

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
        return {
          teacherPasswordHash: parsed.teacherPasswordHash,
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
  existingToken?: string | null,
  customStorage?: StorageLike,
): { status: 'created' | 'resumed'; profile: StudentProfile; token: string } {
  const storage = getStorage(customStorage);
  const db = loadDb(storage);
  const fullName = normalizeStudentName(rawName);
  const className = rawClass.trim();

  if (fullName.length < 3 || !fullName.includes(' ')) {
    throw new Error("Iltimos, to'liq ism va familiyangizni kiriting (masalan: Aziza Karimova).");
  }
  if (!isValidSchoolClass(className)) {
    throw new Error("Sinf noto'g'ri tanlangan. 5-01 dan 10-03 gacha bo'lgan sinflardan birini tanlang.");
  }

  const normalizedKey = buildStudentKey(fullName, className);
  const existing = db.students.find((s) => s.normalizedKey === normalizedKey);
  if (existing) {
    if (existingToken && existingToken === existing.secretToken) {
      return {
        status: 'resumed',
        profile: toProfile(existing),
        token: existing.secretToken,
      };
    }
    throw new Error(
      "Ushbu ism-familiya va sinf bilan akkaunt allaqachon ro'yxatdan o'tgan. Boshqa shaxs avval kirgan akkauntga kira olmaydi va uning test natijalarini ko'ra olmaydi.",
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
