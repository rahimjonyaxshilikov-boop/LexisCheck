import { GoogleGenAI, Type } from '@google/genai';
import type { AiMistakeInput, AiReviewRecommendation } from '../types/quiz';
import {
  AI_REVIEW_MODEL,
  buildAiReviewPrompt,
  buildMistakeAnalysisItems,
  parseAiReviewJson,
} from '../utils/aiReviewSchema';

export class AiServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number = 500, code: string = 'AI_ERROR') {
    super(message);
    this.name = 'AiServiceError';
    this.status = status;
    this.code = code;
  }
}

function getConfiguredGeminiApiKey(): string | null {
  const candidates = [process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY];
  for (const raw of candidates) {
    const key = raw?.trim();
    if (key && key !== 'MY_GEMINI_API_KEY') {
      return key;
    }
  }
  return null;
}

function isNonRetryableGeminiError(rawMsg: string): boolean {
  return (
    rawMsg.includes('API_KEY_INVALID') ||
    rawMsg.includes('PERMISSION_DENIED') ||
    rawMsg.includes('RESOURCE_EXHAUSTED') ||
    rawMsg.includes('INVALID_ARGUMENT') ||
    rawMsg.includes('400') ||
    rawMsg.includes('401') ||
    rawMsg.includes('403') ||
    rawMsg.includes('404') ||
    rawMsg.includes('429')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateAiReviewRecommendations(params: {
  studentName: string;
  scopeLabel: string;
  audience: 'student' | 'teacher';
  mistakes: readonly AiMistakeInput[];
}): Promise<AiReviewRecommendation> {
  const apiKey = getConfiguredGeminiApiKey();
  if (!apiKey) {
    throw new AiServiceError(
      "AI tavsiya xizmati uchun GEMINI_API_KEY sozlanmagan. Iltimos, Settings > Secrets boʻlimida API kalitni belgilang.",
      503,
      'GEMINI_API_KEY_MISSING',
    );
  }

  const enriched = buildMistakeAnalysisItems(params.mistakes);
  if (enriched.length === 0) {
    throw new AiServiceError(
      "Tahlil qilish uchun xato savollar topilmadi.",
      400,
      'NO_MISTAKES',
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const prompt = buildAiReviewPrompt({
    studentName: params.studentName,
    scopeLabel: params.scopeLabel,
    audience: params.audience,
    mistakes: enriched,
  });

  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: AI_REVIEW_MODEL,
        contents: prompt,
        config: {
          systemInstruction:
            "Siz 'English Vocabulary in Use Upper-Intermediate' bo'yicha tajribali ingliz tili metodisti va shaxsiy repetitorsiz. " +
            "O'quvchining testda xato qilgan savollarini tahlil qilib, aniq qaysi grammatik/leksik mavzularni, collocationlarni yoki so'z oilalarini takrorlash kerakligini aniqlang. " +
            "Barcha izoh va tavsiyalarni aniq, lo'nda va tabiiy O'zbek tilida (lotin yozuvida) yozing; inglizcha kalit so'z va iboralarni asl shaklida keltiring. " +
            "Javobda 1 tadan 5 tagacha eng muhim takrorlash mavzusini va 2-4 ta amaliy takrorlash qadamini bering.",
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: "Xatolar bo'yicha 1-2 gaplik umumiy diagnostik xulosa (O'zbek tilida).",
              },
              strengthsNote: {
                type: Type.STRING,
                description: "Rag'batlantiruvchi yoki e'tibor qaratish lozim bo'lgan qisqa eslatma (O'zbek tilida).",
              },
              recommendedTopics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    topicTitle: {
                      type: Type.STRING,
                      description: "Takrorlash kerak bo'lgan aniq mavzu nomi (masalan: Verb + noun collocations, Formal vs informal register).",
                    },
                    unitNumber: {
                      type: Type.INTEGER,
                      description: "Tegishli unit raqami (1 dan 101 gacha).",
                    },
                    priority: {
                      type: Type.STRING,
                      description: "Muhimlik darajasi: 'high', 'medium' yoki 'low'.",
                    },
                    reason: {
                      type: Type.STRING,
                      description: "Nega aynan shu mavzuni takrorlash kerakligi va o'quvchi qayerda adashgani haqida qisqa izoh.",
                    },
                    keyWords: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Takrorlanishi shart bo'lgan 2-6 ta inglizcha so'z yoki ibora.",
                    },
                    practiceTip: {
                      type: Type.STRING,
                      description: "Shu mavzuni mustahkamlash uchun 1 ta aniq amaliy mashq tavsiyasi.",
                    },
                  },
                  required: ['topicTitle', 'unitNumber', 'priority', 'reason', 'keyWords', 'practiceTip'],
                },
              },
              studyPlan: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "2-4 ta qisqa va amaliy takrorlash qadamlari ro'yxati.",
              },
            },
            required: ['summary', 'strengthsNote', 'recommendedTopics', 'studyPlan'],
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new AiServiceError(
          "AI modelidan boʻsh javob qaytdi. Qayta urinib koʻring.",
          502,
          'EMPTY_AI_RESPONSE',
        );
      }

      return parseAiReviewJson(text, enriched[0]?.unitNumber ?? 1, AI_REVIEW_MODEL);
    } catch (err) {
      lastError = err;
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (attempt < maxAttempts && !isNonRetryableGeminiError(rawMsg)) {
        await delay(450 * attempt);
        continue;
      }
      break;
    }
  }

  if (lastError instanceof AiServiceError) {
    throw lastError;
  }
  const rawMsg = lastError instanceof Error ? lastError.message : String(lastError);
  if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('403')) {
    throw new AiServiceError(
      "Gemini API kaliti yaroqsiz yoki ruxsat etilmagan. Settings > Secrets boʻlimini tekshiring.",
      502,
      'GEMINI_AUTH_ERROR',
    );
  }
  if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
    throw new AiServiceError(
      "AI soʻrovlar limiti vaqtincha tugadi. Birozdan soʻng qayta urinib koʻring.",
      429,
      'GEMINI_RATE_LIMIT',
    );
  }
  throw new AiServiceError(
    `AI tavsiya generatsiyasida xatolik yuz berdi: ${rawMsg}`,
    502,
    'GEMINI_UPSTREAM_ERROR',
  );
}

