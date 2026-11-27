import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  RecordCheatEventPayload,
  StudentProfile,
  StudentSummaryForTeacher,
  TestAttempt,
  UnitCheatSummary,
} from '../types/quiz';
import {
  applyCheatEventToLogs,
  summarizeStudentCheatLogs,
} from '../utils/antiCheat';
import {
  buildStudentKey,
  buildStudentTokenBagKey,
  calculateStudentAggregates,
  DEFAULT_TEST_DURATION_MINUTES,
  isValidSchoolClass,
  looksLikeUzbekSurname,
  normalizeComparableText,
  normalizeStudentName,
  TOTAL_UNITS,
  validateStudentNameOrder,
  validateTestDurationMinutes,
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
  cheatLogs?: UnitCheatSummary[];
  createdAt: string;
}

export interface PersistedDatabase {
  teacherPasswordHash: string;
  cheaterCodeHash?: string;
  testDurationMinutes?: number;
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

  const cheatLogs: UnitCheatSummary[] = Array.isArray(student.cheatLogs)
    ? [...student.cheatLogs].sort(
        (a, b) => new Date(b.lastEventAt).getTime() - new Date(a.lastEventAt).getTime(),
      )
    : [];

  return {
    id: student.id,
    fullName: student.fullName,
    className: student.className,
    totalPoints: agg.totalPoints,
    completedUnits: agg.completedUnits,
    studiedUnits,
    averagePercentage: agg.averagePercentage,
    attempts: sortedAttempts,
    cheatLogs,
    cheatOverview: summarizeStudentCheatLogs(cheatLogs),
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
          const validatedTimer = validateTestDurationMinutes(parsed.testDurationMinutes);
          return {
            teacherPasswordHash: parsed.teacherPasswordHash,
            testDurationMinutes: validatedTimer.ok
              ? validatedTimer.minutes
              : DEFAULT_TEST_DURATION_MINUTES,
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
      testDurationMinutes: DEFAULT_TEST_DURATION_MINUTES,
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
    _existingToken?: string,
  ):
    | { ok: true; status: 'created' | 'resumed'; profile: StudentProfile; token: string }
    | {
        ok: false;
        code: 'INVALID_INPUT' | 'SURNAME_FIRST';
        error: string;
        suggestedName?: string;
      } {
    const nameCheck = validateStudentNameOrder(rawName);
    if (!nameCheck.ok) {
      return nameCheck;
    }

    const fullName = nameCheck.fullName;
    const className = rawClass.trim();

    if (!isValidSchoolClass(className)) {
      return {
        ok: false,
        code: 'INVALID_INPUT',
        error: "Sinf noto'g'ri tanlangan. 5-01 dan 10-03 gacha bo'lgan sinflardan birini tanlang.",
      };
    }

    const normalizedKey = buildStudentKey(fullName, className);
    const tokenBagKey = buildStudentTokenBagKey(fullName, className);

    const exactMatch = this.db.students.find(
      (s) => buildStudentKey(s.fullName, s.className) === normalizedKey,
    );
    if (exactMatch) {
      return {
        ok: true,
        status: 'resumed',
        profile: toStudentProfile(exactMatch),
        token: exactMatch.secretToken,
      };
    }

    // Detect same person with swapped first/last name in the same class
    const swappedMatch = this.db.students.find(
      (s) => buildStudentTokenBagKey(s.fullName, s.className) === tokenBagKey,
    );
    if (swappedMatch) {
      const existingFirstToken = swappedMatch.fullName.trim().split(/\s+/)[0] ?? '';
      // If legacy DB record had surname first while new input has first name first, normalize & resume
      if (looksLikeUzbekSurname(existingFirstToken)) {
        swappedMatch.fullName = fullName;
        swappedMatch.normalizedKey = normalizedKey;
        this.persist();
        return {
          ok: true,
          status: 'resumed',
          profile: toStudentProfile(swappedMatch),
          token: swappedMatch.secretToken,
        };
      }
      // Otherwise existing record has first name first -> reject reversed order & guide back
      return {
        ok: false,
        code: 'SURNAME_FIRST',
        error: `Avval ismingizni, keyin familiyangizni yozing (masalan: ${swappedMatch.fullName}).`,
        suggestedName: swappedMatch.fullName,
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
      cheatLogs: [],
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

  lookupStudent(
    rawName: string,
    rawClass?: string,
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

    const trimmedClass = rawClass?.trim();
    const targetExact = normalizeComparableText(fullName);
    const targetBag = normalizeComparableText(fullName).split(' ').filter(Boolean).sort().join('|');

    let match: StoredStudent | undefined;
    let exactClassMatch = false;
    let reversedOrder = false;

    if (trimmedClass && isValidSchoolClass(trimmedClass)) {
      const exactKey = buildStudentKey(fullName, trimmedClass);
      match = this.db.students.find((s) => buildStudentKey(s.fullName, s.className) === exactKey);
      if (match) {
        exactClassMatch = true;
      } else {
        const bagKey = buildStudentTokenBagKey(fullName, trimmedClass);
        match = this.db.students.find(
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
      match = this.db.students.find(
        (s) => normalizeComparableText(s.fullName) === targetExact,
      );
      if (!match) {
        match = this.db.students.find(
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
    const profile = toStudentProfile(match);
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

  recordCheatEvent(
    token: string | undefined,
    payload: RecordCheatEventPayload,
  ): { ok: true; profile: StudentProfile } | { ok: false; error: string } {
    if (!token) {
      return { ok: false, error: 'Sessiya topilmadi. Qaytadan kiring.' };
    }
    const found = this.db.students.find((s) => safeTokenMatch(token, s.secretToken));
    if (!found) {
      return { ok: false, error: "Akkaunt topilmadi yoki ruxsat yo'q." };
    }
    if (
      !Number.isInteger(payload.unitNumber) ||
      payload.unitNumber < 1 ||
      payload.unitNumber > TOTAL_UNITS
    ) {
      return { ok: false, error: "Unit raqami noto'g'ri." };
    }

    found.cheatLogs = applyCheatEventToLogs(found.cheatLogs, payload);
    this.persist();
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

  getTestDurationMinutes(): number {
    const validated = validateTestDurationMinutes(this.db.testDurationMinutes);
    return validated.ok ? validated.minutes : DEFAULT_TEST_DURATION_MINUTES;
  }

  setTestDurationMinutes(
    token: string | undefined,
    minutes: unknown,
  ): { ok: true; testDurationMinutes: number } | { ok: false; error: string } {
    if (!this.isValidTeacherToken(token)) {
      return { ok: false, error: "O'qituvchi sessiyasi yaroqsiz. Qaytadan kiring." };
    }
    const validated = validateTestDurationMinutes(minutes);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }
    this.db.testDurationMinutes = validated.minutes;
    this.persist();
    return { ok: true, testDurationMinutes: validated.minutes };
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

  clearStudentCheatLogs(
    token: string | undefined,
    studentId: string,
  ): { ok: true; student: StudentSummaryForTeacher } | { ok: false; error: string } {
    if (!this.isValidTeacherToken(token)) {
      return { ok: false, error: "Ruxsat yo'q." };
    }
    const student = this.db.students.find((s) => s.id === studentId);
    if (!student) {
      return { ok: false, error: "O'quvchi topilmadi." };
    }
    student.cheatLogs = [];
    this.persist();
    return { ok: true, student: toTeacherSummary(student) };
  }
}
