import type { IncomingMessage, ServerResponse } from 'node:http';
import { AiServiceError, generateAiReviewRecommendations } from '../../src/server/aiReview';

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function readHeader(req: IncomingMessage, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0].trim();
  return '';
}

async function readJsonBody(req: VercelRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    return JSON.parse(req.body) as Record<string, unknown>;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: "Faqat POST so'rovi qo'llab-quvvatlanadi." });
    return;
  }

  const studentToken = readHeader(req, 'x-student-token');
  const teacherToken = readHeader(req, 'x-teacher-token');
  if (studentToken.length < 8 && teacherToken.length < 8) {
    sendJson(res, 401, { error: "Ruxsat yo'q. Qaytadan kiring." });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { error: "So'rov ma'lumotlari noto'g'ri JSON formatda." });
    return;
  }

  const { studentName, scopeLabel, audience, mistakes } = body ?? {};
  if (
    typeof studentName !== 'string' ||
    typeof scopeLabel !== 'string' ||
    !Array.isArray(mistakes) ||
    mistakes.length === 0
  ) {
    sendJson(res, 400, {
      error: "AI tahlil uchun xato savollar ro'yxati yuborilmadi.",
    });
    return;
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
    sendJson(res, 200, { recommendation, profile: null });
  } catch (err) {
    if (err instanceof AiServiceError) {
      sendJson(res, err.status, { error: err.message, code: err.code });
      return;
    }
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : "AI tahlilini bajarib bo'lmadi.",
    });
  }
}
