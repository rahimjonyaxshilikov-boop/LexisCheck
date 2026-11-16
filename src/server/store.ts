import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
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
  TOTAL_UNITS,
} from '../utils/quizEngine';

const DEFAULT_TEACHER_PASSWORD = 'Jalolova@2026';

export interface StoredStudent {
  id: string;
  fullName: string;
  className: string;
  normalizedKey: string;
  secretToken: string;
  studiedUnits?: number[];
  attempts: TestAttempt[];
  createdAt: string;
}

export interface PersistedDatabase {
  teacherPasswordHash: string;
  teacherTokens: string[];
  students: StoredStudent[];
}

function hashPassword(password: string, salt?: string): string {
  const usedSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return `${usedSalt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const actualBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function safeTokenMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function toStudentProfile(student: StoredStudent): StudentProfile {
  const agg = calculateStudentAggregates(student.attempts);
  const sortedAttempts = [...student.attempts].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
  const studiedSet = new Set<number>(
    Array.isArray(student.studiedUnits) ? student.studiedUnits : [],
  );
  for (const u of agg.completedUnits) {
    studiedSet.add(u);
  }
  const studiedUnits = Array.from(studiedSet).sort((a, b) => a - b);

  return {
    id: student.id,
    fullName: student.fullName,
    className: student.className,
    totalPoints: agg.totalPoints,
    completedUnits: agg.completedUnits,
    studiedUnits,
    averagePercentage: agg.averagePercentage,
    attempts: sortedAttempts,
    createdAt: student.createdAt,
  };
}

function toTeacherSummary(student: StoredStudent): StudentSummaryForTeacher {
  const profile = toStudentProfile(student);
  const lastActiveAt =
    profile.attempts.length > 0 ? profile.attempts[0].completedAt : student.createdAt;
  return {
    ...profile,
    lastActiveAt,
  };
}

export class AppStore {
  private readonly filePath: string;
  private db: PersistedDatabase;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.db = this.loadOrInit();
  }

  private loadOrInit(): PersistedDatabase {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<PersistedDatabase>;
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
      } catch {
        // Re-initialize cleanly if file is corrupted
      }
    }

    const initial: PersistedDatabase = {
      teacherPasswordHash: hashPassword(DEFAULT_TEACHER_PASSWORD),
      teacherTokens: [],
      students: [],
    };
    this.writeAtomic(initial);
    return initial;
  }

  private writeAtomic(data: PersistedDatabase): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${this.filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }

  private persist(): void {
    this.writeAtomic(this.db);
  }

  enterStudent(
    rawName: string,
    rawClass: string,
    existingToken?: string,
  ):
    | { ok: true; status: 'created' | 'resumed'; profile: StudentProfile; token: string }
    | { ok: false; code: 'INVALID_INPUT' | 'ACCOUNT_LOCKED'; error: string } {
    const fullName = normalizeStudentName(rawName);
    const className = rawClass.trim();

    if (fullName.length < 3 || !fullName.includes(' ')) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        error: "Iltimos, to'liq ism va familiyangizni kiriting (masalan: Aziza Karimova).",
      };
    }

    if (!isValidSchoolClass(className)) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        error: "Sinf noto'g'ri tanlangan. 5-01 dan 10-03 gacha bo'lgan sinflardan birini tanlang.",
      };
    }

    const normalizedKey = buildStudentKey(fullName, className);
    const existing = this.db.students.find((s) => s.normalizedKey === normalizedKey);

    if (existing) {
      if (existingToken && safeTokenMatch(existingToken, existing.secretToken)) {
        return {
          ok: true,
          status: 'resumed',
          profile: toStudentProfile(existing),
          token: existing.secretToken,
        };
      }
      return {
        ok: false,
        code: 'ACCOUNT_LOCKED',
        error:
          "Ushbu ism-familiya va sinf bilan akkaunt allaqachon ro'yxatdan o'tgan. Boshqa shaxs avval kirgan akkauntga kira olmaydi va uning test natijalarini ko'ra olmaydi.",
      };
    }

    const newStudent: StoredStudent = {
      id: crypto.randomUUID(),
      fullName,
      className,
      normalizedKey,
      secretToken: crypto.randomBytes(24).toString('hex'),
      studiedUnits: [],
      attempts: [],
      createdAt: new Date().toISOString(),
    };

    this.db.students.push(newStudent);
    this.persist();

    return {
      ok: true,
      status: 'created',
      profile: toStudentProfile(newStudent),
      token: newStudent.secretToken,
    };
  }

  getStudentByToken(token: string | undefined): StudentProfile | null {
    if (!token) return null;
    const found = this.db.students.find((s) => safeTokenMatch(token, s.secretToken));
    return found ? toStudentProfile(found) : null;
  }

  recordAttempt(
    token: string | undefined,
    attempt: Omit<TestAttempt, 'id' | 'completedAt'>,
  ): { ok: true; profile: StudentProfile; attempt: TestAttempt } | { ok: false; error: string } {
    if (!token) {
      return { ok: false, error: 'Sessiya topilmadi. Qaytadan kiring.' };
    }
    const found = this.db.students.find((s) => safeTokenMatch(token, s.secretToken));
    if (!found) {
      return { ok: false, error: "Akkaunt topilmadi yoki ruxsat yo'q." };
    }

    const savedAttempt: TestAttempt = {
      ...attempt,
      id: crypto.randomUUID(),
      completedAt: new Date().toISOString(),
    };

    found.attempts.push(savedAttempt);
    this.persist();

    return {
      ok: true,
      profile: toStudentProfile(found),
      attempt: savedAttempt,
    };
  }

  markUnitStudied(
    token: string | undefined,
    unitNumber: number,
  ): { ok: true; profile: StudentProfile } | { ok: false; error: string } {
    if (!token) {
      return { ok: false, error: 'Sessiya topilmadi. Qaytadan kiring.' };
    }
    const found = this.db.students.find((s) => safeTokenMatch(token, s.secretToken));
    if (!found) {
      return { ok: false, error: "Akkaunt topilmadi yoki ruxsat yo'q." };
    }
    if (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > TOTAL_UNITS) {
      return { ok: false, error: "Unit raqami noto'g'ri." };
    }
    const current = Array.isArray(found.studiedUnits) ? found.studiedUnits : [];
    if (!current.includes(unitNumber)) {
      found.studiedUnits = [...current, unitNumber].sort((a, b) => a - b);
      this.persist();
    }
    return {
      ok: true,
      profile: toStudentProfile(found),
    };
  }

  loginTeacher(password: string): { ok: true; token: string } | { ok: false; error: string } {
    if (!password || !verifyPassword(password, this.db.teacherPasswordHash)) {
      return { ok: false, error: "Parol noto'g'ri." };
    }
    const token = crypto.randomBytes(24).toString('hex');
    this.db.teacherTokens = [token, ...this.db.teacherTokens].slice(0, 10);
    this.persist();
    return { ok: true, token };
  }

  isValidTeacherToken(token: string | undefined): boolean {
    if (!token) return false;
    return this.db.teacherTokens.some((t) => safeTokenMatch(token, t));
  }

  changeTeacherPassword(
    token: string | undefined,
    oldPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): { ok: true } | { ok: false; error: string } {
    if (!this.isValidTeacherToken(token)) {
      return { ok: false, error: "O'qituvchi sessiyasi yaroqsiz. Qaytadan kiring." };
    }
    if (!verifyPassword(oldPassword, this.db.teacherPasswordHash)) {
      return { ok: false, error: "Eski parol noto'g'ri kiritildi." };
    }
    if (newPassword.length < 6) {
      return {
        ok: false,
        error: "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak.",
      };
    }
    if (newPassword !== confirmPassword) {
      return {
        ok: false,
        error: 'Yangi parol va tasdiqlash paroli bir-biriga mos kelmadi.',
      };
    }
    if (newPassword === oldPassword) {
      return {
        ok: false,
        error: "Yangi parol eski paroldan farq qilishi kerak.",
      };
    }

    this.db.teacherPasswordHash = hashPassword(newPassword);
    this.persist();
    return { ok: true };
  }

  getTeacherDashboard(token: string | undefined):
    | { ok: true; students: StudentSummaryForTeacher[] }
    | { ok: false; error: string } {
    if (!this.isValidTeacherToken(token)) {
      return { ok: false, error: "Ruxsat yo'q." };
    }
    const students = this.db.students
      .map(toTeacherSummary)
      .sort((a, b) => b.totalPoints - a.totalPoints);
    return { ok: true, students };
  }

  removeStudentAccount(
    token: string | undefined,
    studentId: string,
  ): { ok: true } | { ok: false; error: string } {
    if (!this.isValidTeacherToken(token)) {
      return { ok: false, error: "Ruxsat yo'q." };
    }
    const idx = this.db.students.findIndex((s) => s.id === studentId);
    if (idx === -1) {
      return { ok: false, error: "O'quvchi topilmadi." };
    }
    this.db.students.splice(idx, 1);
    this.persist();
    return { ok: true };
  }
}
