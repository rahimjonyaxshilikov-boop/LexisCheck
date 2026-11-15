import type {
  StudentProfile,
  StudentSummaryForTeacher,
  TestAttempt,
} from '../types/quiz';

const STUDENT_TOKEN_KEY = 'lexischeck_student_token';
const TEACHER_TOKEN_KEY = 'lexischeck_teacher_token';

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

export async function enterStudentAccount(
  fullName: string,
  className: string,
): Promise<{ status: 'created' | 'resumed'; profile: StudentProfile; token: string }> {
  const existingToken = getSavedStudentToken();
  const res = await fetch('/api/student/enter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(existingToken ? { 'x-student-token': existingToken } : {}),
    },
    body: JSON.stringify({ fullName, className }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Kirishda xatolik yuz berdi.");
  }
  setSavedStudentToken(data.token);
  return data;
}

export async function fetchOwnStudentProfile(): Promise<StudentProfile | null> {
  const token = getSavedStudentToken();
  if (!token) return null;

  const res = await fetch('/api/student/profile', {
    headers: { 'x-student-token': token },
  });
  if (!res.ok) {
    if (res.status === 401) {
      setSavedStudentToken(null);
    }
    return null;
  }
  const data = await res.json();
  return data.profile as StudentProfile;
}

export async function submitTestAttempt(
  attempt: Omit<TestAttempt, 'id' | 'completedAt'>,
): Promise<{ profile: StudentProfile; attempt: TestAttempt }> {
  const token = getSavedStudentToken();
  if (!token) {
    throw new Error("O'quvchi sessiyasi topilmadi. Qaytadan kiring.");
  }
  const res = await fetch('/api/student/attempt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-student-token': token,
    },
    body: JSON.stringify({ attempt }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Natijani saqlashda xatolik yuz berdi.");
  }
  return data;
}

export async function completeUnitStudy(unitNumber: number): Promise<StudentProfile> {
  const token = getSavedStudentToken();
  if (!token) {
    throw new Error("O'quvchi sessiyasi topilmadi. Qaytadan kiring.");
  }
  const res = await fetch('/api/student/study-complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-student-token': token,
    },
    body: JSON.stringify({ unitNumber }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Lug'at holatini saqlab bo'lmadi.");
  }
  return data.profile as StudentProfile;
}

export async function loginTeacherAccount(password: string): Promise<string> {
  const res = await fetch('/api/teacher/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Parol noto'g'ri.");
  }
  setSavedTeacherToken(data.token);
  return data.token as string;
}

export async function fetchTeacherDashboard(): Promise<StudentSummaryForTeacher[]> {
  const token = getSavedTeacherToken();
  if (!token) {
    throw new Error("O'qituvchi sessiyasi topilmadi.");
  }
  const res = await fetch('/api/teacher/dashboard', {
    headers: { 'x-teacher-token': token },
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      setSavedTeacherToken(null);
    }
    throw new Error(data.error || "Ma'lumotlarni yuklab bo'lmadi.");
  }
  return data.students as StudentSummaryForTeacher[];
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
  const res = await fetch('/api/teacher/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-teacher-token': token,
    },
    body: JSON.stringify({ oldPassword, newPassword, confirmPassword }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Parolni yangilab bo'lmadi.");
  }
}

export async function deleteStudentByTeacher(studentId: string): Promise<void> {
  const token = getSavedTeacherToken();
  if (!token) {
    throw new Error("O'qituvchi sessiyasi topilmadi.");
  }
  const res = await fetch(`/api/teacher/student/${encodeURIComponent(studentId)}`, {
    method: 'DELETE',
    headers: { 'x-teacher-token': token },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Akkauntni o'chirib bo'lmadi.");
  }
}
