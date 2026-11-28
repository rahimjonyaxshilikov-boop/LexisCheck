import { AiServiceError, generateAiReviewRecommendations } from '../../src/server/aiReview';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

export const config = {
  path: '/api/ai/review-recommendations',
};

export default async (request: Request): Promise<Response> => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: "Faqat POST so'rovi qo'llab-quvvatlanadi." }, 405);
  }

  const studentToken = request.headers.get('x-student-token')?.trim() ?? '';
  const teacherToken = request.headers.get('x-teacher-token')?.trim() ?? '';
  if (studentToken.length < 8 && teacherToken.length < 8) {
    return jsonResponse({ error: "Ruxsat yo'q. Qaytadan kiring." }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "So'rov ma'lumotlari noto'g'ri JSON formatda." }, 400);
  }

  const { studentName, scopeLabel, audience, mistakes } = body ?? {};
  if (
    typeof studentName !== 'string' ||
    typeof scopeLabel !== 'string' ||
    !Array.isArray(mistakes) ||
    mistakes.length === 0
  ) {
    return jsonResponse(
      { error: "AI tahlil uchun xato savollar ro'yxati yuborilmadi." },
      400,
    );
  }

  const resolvedAudience: 'student' | 'teacher' =
    teacherToken.length >= 8 && audience === 'teacher' ? 'teacher' : 'student';

  try {
    const recommendation = await generateAiReviewRecommendations({
      studentName,
      scopeLabel,
      audience: resolvedAudience,
      mistakes,
    });
    return jsonResponse({ recommendation, profile: null }, 200);
  } catch (err) {
    if (err instanceof AiServiceError) {
      return jsonResponse({ error: err.message, code: err.code }, err.status);
    }
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : "AI tahlilini bajarib bo'lmadi.",
      },
      500,
    );
  }
};
