import type {
  StudentProfile,
  StudentSummaryForTeacher,
  TestAttempt,
} from '../types/quiz';
import {
  localCompleteUnitStudy,
  localDeleteStudent,
  localEnterStudent,
  localFetchTeacherDashboard,
  localGetStudentByToken,
  localGetTestDurationMinutes,
  localLoginTeacher,
  localLookupStudent,
  localSubmitAttempt,
  localUpdateCheaterCode,
  localUpdateTeacherPassword,
  localUpdateTestDurationMinutes,
  localVerifyCheaterCode,
} from './localFallbackStore';
import { DEFAULT_TEST_DURATION_MINUTES } from './quizEngine';

const STUDENT_TOKEN_KEY = 'lexischeck_student_token';
const TEACHER_TOKEN_KEY = 'lexischeck_teacher_token';

class BackendUnavailableError extends Error {
  constructor() {
    super('Backend API unavailable');
    this.name = 'BackendUnavailableError';
  }
}

async function fetchBackendJson(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new BackendUnavailableError();
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new BackendUnavailableError();
  }

  const data = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export function getSavedStudentToken(): string | null {
  try {
    return localStorage.getItem(STUDENT_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSavedStudentToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(STUDENT_TOKEN_KEY, token);
    else localStorage.removeItem(STUDENT_TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function getSavedTeacherToken(): string | null {
  try {
    return localStorage.getItem(TEACHER_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSavedTeacherToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TEACHER_TOKEN_KEY, token);
    else localStorage.removeItem(TEACHER_TOKEN_KEY);
  } catch {
    // Ignore storage errors
  }
}

export class StudentEntryError extends Error {
  code?: string;
  suggestedName?: string;

  constructor(message: string, code?: string, suggestedName?: string) {
    super(message);
    this.name = 'StudentEntryError';
    this.code = code;
    this.suggestedName = suggestedName;
  }
}

export async function enterStudentAccount(
  fullName: string,
  className: string,
): Promise<{ status: 'created' | 'resumed'; profile: StudentProfile; token: string }> {
  const existingToken = getSavedStudentToken();
  try {
    const { ok, data } = await fetchBackendJson('/api/student/enter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(existingToken ? { 'x-student-token': existingToken } : {}),
      },
      body: JSON.stringify({ fullName, className }),
    });
    if (!ok) {
      throw new StudentEntryError(
        (data.error as string) || "Kirishda xatolik yuz berdi.",
        typeof data.code === 'string' ? data.code : undefined,
        typeof data.suggestedName === 'string' ? data.suggestedName : undefined,
      );
    }
    setSavedStudentToken(data.token as string);
    return data as {
      status: 'created' | 'resumed';
      profile: StudentProfile;
      token: string;
    };
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      const result = localEnterStudent(fullName, className, existingToken);
      setSavedStudentToken(result.token);
      return result;
    }
    throw err;
  }
}

export type StudentLookupResult =
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
  | { found: false };

export async function lookupStudentProfile(
  fullName: string,
  className?: string,
): Promise<StudentLookupResult> {
  const params = new URLSearchParams({ fullName });
  if (className) params.set('className', className);
  try {
    const { ok, data } = await fetchBackendJson(`/api/student/lookup?${params.toString()}`);
    if (ok && data && typeof data.found === 'boolean') {
      return data as unknown as StudentLookupResult;
    }
    return { found: false };
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      return localLookupStudent(fullName, className);
    }
    return { found: false };
  }
}

export async function fetchOwnStudentProfile(): Promise<StudentProfile | null> {
  const token = getSavedStudentToken();
  if (!token) return null;

  try {
    const { ok, status, data } = await fetchBackendJson('/api/student/profile', {
      headers: { 'x-student-token': token },
    });
    if (!ok) {
      if (status === 401) {
        setSavedStudentToken(null);
      }
      return null;
    }
    return data.profile as StudentProfile;
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      return localGetStudentByToken(token);
    }
    return null;
  }
}

export async function submitTestAttempt(
  attempt: Omit<TestAttempt, 'id' | 'completedAt'>,
): Promise<{ profile: StudentProfile; attempt: TestAttempt }> {
  const token = getSavedStudentToken();
  if (!token) {
    throw new Error("O'quvchi sessiyasi topilmadi. Qaytadan kiring.");
  }
  try {
    const { ok, data } = await fetchBackendJson('/api/student/attempt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-student-token': token,
      },
      body: JSON.stringify({ attempt }),
    });
    if (!ok) {
      throw new Error((data.error as string) || "Natijani saqlashda xatolik yuz berdi.");
    }
    return data as { profile: StudentProfile; attempt: TestAttempt };
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      return localSubmitAttempt(token, attempt);
    }
    throw err;
  }
}

export async function completeUnitStudy(unitNumber: number): Promise<StudentProfile> {
  const token = getSavedStudentToken();
  if (!token) {
    throw new Error("O'quvchi sessiyasi topilmadi. Qaytadan kiring.");
  }
  try {
    const { ok, data } = await fetchBackendJson('/api/student/study-complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-student-token': token,
      },
      body: JSON.stringify({ unitNumber }),
    });
    if (!ok) {
      throw new Error((data.error as string) || "Lug'at holatini saqlab bo'lmadi.");
    }
    return data.profile as StudentProfile;
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      return localCompleteUnitStudy(token, unitNumber);
    }
    throw err;
  }
}

export async function loginTeacherAccount(password: string): Promise<string> {
  try {
    const { ok, data } = await fetchBackendJson('/api/teacher/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!ok) {
      throw new Error((data.error as string) || "Parol noto'g'ri.");
    }
    setSavedTeacherToken(data.token as string);
    return data.token as string;
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      const token = await localLoginTeacher(password);
      setSavedTeacherToken(token);
      return token;
    }
    throw err;
  }
}

export async function fetchTeacherDashboard(): Promise<StudentSummaryForTeacher[]> {
  const token = getSavedTeacherToken();
  if (!token) {
    throw new Error("O'qituvchi sessiyasi topilmadi.");
  }
  try {
    const { ok, status, data } = await fetchBackendJson('/api/teacher/dashboard', {
      headers: { 'x-teacher-token': token },
    });
    if (!ok) {
      if (status === 401) {
        setSavedTeacherToken(null);
      }
      throw new Error((data.error as string) || "Ma'lumotlarni yuklab bo'lmadi.");
    }
    return data.students as StudentSummaryForTeacher[];
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      return localFetchTeacherDashboard(token);
    }
    throw err;
  }
}

export async function updateTeacherPassword(
  oldPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  const token = getSavedTeacherToken();
  if (!token) {
    throw new Error("O'qituvchi sessiyasi topilmadi.");
  }
  try {
    const { ok, data } = await fetchBackendJson('/api/teacher/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-teacher-token': token,
      },
      body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
    });
    if (!ok) {
      throw new Error((data.error as string) || "Parolni yangilab bo'lmadi.");
    }
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      await localUpdateTeacherPassword(
        token,
        oldPassword,
        newPassword,
        confirmPassword,
      );
      return;
    }
    throw err;
  }
}

export async function deleteStudentByTeacher(studentId: string): Promise<void> {
  const token = getSavedTeacherToken();
  if (!token) {
    throw new Error("O'qituvchi sessiyasi topilmadi.");
  }
  try {
    const { ok, data } = await fetchBackendJson(
      `/api/teacher/student/${encodeURIComponent(studentId)}`,
      {
        method: 'DELETE',
        headers: { 'x-teacher-token': token },
      },
    );
    if (!ok) {
      throw new Error((data.error as string) || "Akkauntni o'chirib bo'lmadi.");
    }
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      localDeleteStudent(token, studentId);
      return;
    }
    throw err;
  }
}

export async function verifyCheaterCode(code: string): Promise<boolean> {
  try {
    const { ok } = await fetchBackendJson('/api/anticheat/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    return ok;
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      return localVerifyCheaterCode(code);
    }
    return false;
  }
}

export async function updateCheaterCode(
  oldCode: string,
  newCode: string,
  confirmCode: string,
): Promise<void> {
  const token = getSavedTeacherToken();
  if (!token) {
    throw new Error("O'qituvchi sessiyasi topilmadi.");
  }
  try {
    const { ok, data } = await fetchBackendJson('/api/teacher/change-cheater-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-teacher-token': token,
      },
      body: JSON.stringify({ oldCode, newCode, confirmCode }),
    });
    if (!ok) {
      throw new Error((data.error as string) || "Cheater parolini yangilab bo'lmadi.");
    }
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      await localUpdateCheaterCode(token, oldCode, newCode, confirmCode);
      return;
    }
    throw err;
  }
}

export async function fetchTestDurationMinutes(): Promise<number> {
  try {
    const { ok, data } = await fetchBackendJson('/api/settings/timer');
    if (ok && typeof data.testDurationMinutes === 'number') {
      return data.testDurationMinutes;
    }
    return DEFAULT_TEST_DURATION_MINUTES;
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      return localGetTestDurationMinutes();
    }
    return DEFAULT_TEST_DURATION_MINUTES;
  }
}

export async function updateTestDurationMinutes(minutes: number): Promise<number> {
  const token = getSavedTeacherToken();
  if (!token) {
    throw new Error("O'qituvchi sessiyasi topilmadi.");
  }
  try {
    const { ok, data } = await fetchBackendJson('/api/teacher/test-timer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-teacher-token': token,
      },
      body: JSON.stringify({ minutes }),
    });
    if (!ok) {
      throw new Error((data.error as string) || "Taymer vaqtini yangilab bo'lmadi.");
    }
    return typeof data.testDurationMinutes === 'number'
      ? data.testDurationMinutes
      : minutes;
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      return localUpdateTestDurationMinutes(token, minutes);
    }
    throw err;
  }
}
