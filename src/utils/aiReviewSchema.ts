import { getUnitByNumber } from '../data/units';
import type {
  AiMistakeInput,
  AiReviewPriority,
  AiReviewRecommendation,
  AiTopicRecommendation,
  MistakeRecord,
} from '../types/quiz';

export const AI_REVIEW_MODEL = 'gemini-4-hydrogen';

export interface EnrichedMistakeItem extends AiMistakeInput {
  unitSubtitle: string;
}

export function attemptMistakesToAiInputs(
  unitNumber: number,
  unitTitle: string,
  mistakes: readonly MistakeRecord[],
): AiMistakeInput[] {
  return mistakes.map((m) => ({
    questionId: m.questionId,
    unitNumber,
    unitTitle,
    prompt: m.prompt,
    selectedAnswer: m.selectedAnswer,
    correctAnswer: m.correctAnswer,
    explanation: m.explanation,
    missCount: 1,
  }));
}

export function buildMistakeAnalysisItems(
  mistakes: readonly AiMistakeInput[],
  maxItems: number = 30,
): EnrichedMistakeItem[] {
  const deduped = new Map<string, EnrichedMistakeItem>();

  for (const item of mistakes) {
    if (!item || typeof item.prompt !== 'string' || !item.prompt.trim()) continue;
    const unitNum = Number(item.unitNumber);
    const unitMeta = Number.isInteger(unitNum) ? getUnitByNumber(unitNum) : undefined;
    const key = `${unitNum}:${item.questionId || item.prompt}`;
    const existing = deduped.get(key);
    if (existing) {
      existing.missCount = (existing.missCount ?? 1) + (item.missCount ?? 1);
      continue;
    }

    deduped.set(key, {
      questionId: String(item.questionId || key),
      unitNumber: Number.isInteger(unitNum) && unitNum > 0 ? unitNum : 1,
      unitTitle: item.unitTitle?.trim() || unitMeta?.title || `Unit ${unitNum}`,
      unitSubtitle: unitMeta?.subtitle || '',
      prompt: item.prompt.trim(),
      selectedAnswer: item.selectedAnswer?.trim() || 'Javob belgilanmagan',
      correctAnswer: item.correctAnswer?.trim() || '',
      explanation: item.explanation?.trim() || '',
      missCount: typeof item.missCount === 'number' && item.missCount > 0 ? item.missCount : 1,
    });
  }

  return Array.from(deduped.values())
    .sort((a, b) => (b.missCount ?? 1) - (a.missCount ?? 1))
    .slice(0, maxItems);
}

export function buildAiReviewPrompt(params: {
  studentName: string;
  scopeLabel: string;
  audience: 'student' | 'teacher';
  mistakes: readonly EnrichedMistakeItem[];
}): string {
  const { studentName, scopeLabel, audience, mistakes } = params;

  const groupedUnits = new Map<number, { title: string; subtitle: string; count: number }>();
  for (const m of mistakes) {
    const existing = groupedUnits.get(m.unitNumber);
    if (!existing) {
      groupedUnits.set(m.unitNumber, {
        title: m.unitTitle,
        subtitle: m.unitSubtitle,
        count: 1,
      });
    } else {
      existing.count += 1;
    }
  }

  const unitSummaryLines = Array.from(groupedUnits.entries())
    .sort((a, b) => a[0] - b[0])
    .map(
      ([unitNumber, info]) =>
        `- Unit ${unitNumber}: ${info.title}${info.subtitle ? ` (${info.subtitle})` : ''} — ${info.count} ta xato`,
    )
    .join('\n');

  const mistakeLines = mistakes
    .map(
      (m, i) =>
        `${i + 1}. [Unit ${m.unitNumber}: ${m.unitTitle}] Savol: ${m.prompt}\n` +
        `   O'quvchi javobi: ${m.selectedAnswer}\n` +
        `   To'g'ri javob: ${m.correctAnswer}\n` +
        `   Izoh: ${m.explanation}${m.missCount && m.missCount > 1 ? ` (${m.missCount} marta xato qilingan)` : ''}`,
    )
    .join('\n');

  const perspectiveNote =
    audience === 'teacher'
      ? `Tavsiya o'qituvchiga mo'ljallangan: o'quvchi (${studentName}) qaysi mavzularda qiynalayotgani va darsda nimalarga urg'u berish kerakligini aniq ko'rsating.`
      : `Tavsiya o'quvchi (${studentName}) ga mo'ljallangan: do'stona, aniq va amaliy tilda yozing.`;

  return [
    `O'quvchi: ${studentName}`,
    `Bo'lim: ${scopeLabel}`,
    `Jami tahlil qilinayotgan xatolar: ${mistakes.length} ta`,
    perspectiveNote,
    '',
    "Xatolar tushgan unitlar va mavzular:",
    unitSummaryLines,
    '',
    "Xato qilingan savollar ro'yxati:",
    mistakeLines,
    '',
    "Yuqoridagi xatolarni chuqur tahlil qilib, o'quvchi takrorlashi shart bo'lgan aniq mavzular (English Vocabulary in Use Upper-Intermediate mavzulari kesimida), kalit so'zlar va bosqichma-bosqich takrorlash rejasini O'zbek tilida (lotin alifbosida) JSON shaklida bering.",
  ].join('\n');
}

function normalizePriority(value: unknown): AiReviewPriority {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return 'medium';
}

export function stripMarkdownCodeFences(rawText: string): string {
  const trimmed = rawText.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

export function parseAiReviewJson(
  rawText: string,
  fallbackUnitNumber: number = 1,
  model: string = AI_REVIEW_MODEL,
): AiReviewRecommendation {
  const cleaned = stripMarkdownCodeFences(rawText);
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error("AI javobi noto'g'ri formatda keldi.");
  }

  const summary =
    typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  const strengthsNote =
    typeof parsed.strengthsNote === 'string' ? parsed.strengthsNote.trim() : '';

  const rawTopics = Array.isArray(parsed.recommendedTopics)
    ? parsed.recommendedTopics
    : [];

  const recommendedTopics: AiTopicRecommendation[] = rawTopics
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => {
      const unitNum = Number(item.unitNumber);
      const safeUnit =
        Number.isInteger(unitNum) && unitNum >= 1 && unitNum <= 101
          ? unitNum
          : fallbackUnitNumber;
      const keyWords = Array.isArray(item.keyWords)
        ? item.keyWords
            .filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
            .map((w) => w.trim())
            .slice(0, 8)
        : [];
      return {
        topicTitle:
          typeof item.topicTitle === 'string' && item.topicTitle.trim()
            ? item.topicTitle.trim()
            : `Unit ${safeUnit} mavzulari`,
        unitNumber: safeUnit,
        priority: normalizePriority(item.priority),
        reason:
          typeof item.reason === 'string' ? item.reason.trim() : '',
        keyWords,
        practiceTip:
          typeof item.practiceTip === 'string' ? item.practiceTip.trim() : '',
      };
    })
    .filter((t) => t.topicTitle.length > 0 && t.reason.length > 0)
    .slice(0, 6);

  const studyPlan = Array.isArray(parsed.studyPlan)
    ? parsed.studyPlan
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim())
        .slice(0, 5)
    : [];

  if (!summary || recommendedTopics.length === 0) {
    throw new Error("AI tahlil natijasi to'liq shakllanmadi.");
  }

  return {
    summary,
    strengthsNote,
    recommendedTopics,
    studyPlan,
    generatedAt: new Date().toISOString(),
    model,
  };
}
