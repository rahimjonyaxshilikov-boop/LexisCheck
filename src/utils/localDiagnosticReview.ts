import type {
  AiMistakeInput,
  AiReviewPriority,
  AiReviewRecommendation,
  AiTopicRecommendation,
} from '../types/quiz';
import {
  buildMistakeAnalysisItems,
  type EnrichedMistakeItem,
} from './aiReviewSchema';

export const LOCAL_DIAGNOSTIC_MODEL = 'local-curriculum-analyzer';

interface DiagnosticBucket {
  unitNumber: number;
  unitTitle: string;
  unitSubtitle: string;
  sectionTag: string | null;
  focusLabel: string;
  items: EnrichedMistakeItem[];
  totalMisses: number;
  unansweredCount: number;
}

const FOCUS_RULES: ReadonlyArray<{
  pattern: RegExp;
  label: string;
  tip: string;
}> = [
  {
    pattern: /\b(collocation|pairs?|links?\s+["']?.+["']?\s+to|verb\s*\+\s*noun)\b/i,
    label: 'Collocations va soʻz birikmalari',
    tip: "Har bir kalit soʻzni yakka holda emas, u bilan birga keladigan feʼl yoki sifat juftligi (collocation) bilan yozib mashq qiling.",
  },
  {
    pattern: /\b(idiom|expression|fixed\s+phrase|metaphor|figurative)\b/i,
    label: 'Idiomalar va barqaror iboralar',
    tip: "Iboralarning soʻzma-soʻz tarjimasini emas, gap ichidagi koʻchma maʼnosini va qoʻllanish vaziyatini alohida misol gap bilan yodlang.",
  },
  {
    pattern: /\b(phrasal|preposition|particle|verb\s+pattern)\b/i,
    label: 'Frazal feʼllar va predloglar',
    tip: "Feʼl ortidan keladigan predlog oʻzgarganda maʼno qanday oʻzgarishini jadval koʻrinishida taqqoslab chiqing.",
  },
  {
    pattern: /\b(register|formal|informal|slang|neutral|polite|taboo)\b/i,
    label: 'Uslub (Formal / Informal register)',
    tip: "Rasmiy va norasmiy soʻz juftliklarini ikki ustunga ajratib yozing va qaysi vaziyatda qaysi biri ishlatilishini solishtiring.",
  },
  {
    pattern: /\b(prefix|suffix|word\s+famil|root|compound|noun\s+form|adjective)\b/i,
    label: 'Soʻz yasalishi va soʻz oilalari',
    tip: "Har bir asosiy soʻzning ot, sifat, feʼl va ravish shakllarini prefiks-suffikslari bilan birga tuzib chiqing.",
  },
  {
    pattern: /\b(synonym|antonym|opposite|contrast|difference\s+between|subtle)\b/i,
    label: 'Maʼno nozikliklari va qarama-qarshi soʻzlar',
    tip: "Yaqin maʼnoli soʻzlar orasidagi nozik farqni (context) ajratish uchun har biriga 1 tadan qarama-qarshi gap tuzing.",
  },
  {
    pattern: /\b(silent|pronunciation|phonetic|stress|syllable|homophone|spelling)\b/i,
    label: 'Talaffuz, urgʻu va imlo qoidalari',
    tip: "Oʻqilmaydigan harflar (silent letters) va urgʻu oʻzgaradigan soʻzlarni ovoz chiqarib takrorlang va transkripsiyasini yozib boring.",
  },
];

function extractSectionTag(explanation: string, unitNumber: number): string | null {
  const unitSectionMatch = explanation.match(
    new RegExp(`\\bUnit\\s*${unitNumber}([A-F])\\b`, 'i'),
  );
  if (unitSectionMatch) {
    return `Unit ${unitNumber}${unitSectionMatch[1].toUpperCase()}`;
  }

  const genericUnitSection = explanation.match(/\bUnit\s*(\d{1,3}[A-F])\b/i);
  if (genericUnitSection) {
    return `Unit ${genericUnitSection[1].toUpperCase()}`;
  }

  const exerciseMatch = explanation.match(/\bExercise\s*(\d{1,3}\.\d+)\b/i);
  if (exerciseMatch) {
    return `Exercise ${exerciseMatch[1]}`;
  }

  return null;
}

function detectFocusRule(item: EnrichedMistakeItem): { label: string; tip: string } | null {
  const primaryText = `${item.explanation} ${item.prompt}`;
  for (const rule of FOCUS_RULES) {
    if (rule.pattern.test(primaryText)) {
      return { label: rule.label, tip: rule.tip };
    }
  }
  if (item.unitSubtitle) {
    for (const rule of FOCUS_RULES) {
      if (rule.pattern.test(item.unitSubtitle)) {
        return { label: rule.label, tip: rule.tip };
      }
    }
  }
  return null;
}

function isUnanswered(selectedAnswer: string): boolean {
  const normalized = selectedAnswer.trim().toLowerCase();
  return !normalized || normalized.includes('javob belgilanmagan');
}

function computePriority(totalMisses: number, totalQuestions: number): AiReviewPriority {
  if (totalMisses >= 4 || totalQuestions >= 3) return 'high';
  if (totalMisses >= 2 || totalQuestions >= 2) return 'medium';
  return 'low';
}

function buildTopicTitle(bucket: DiagnosticBucket): string {
  if (bucket.sectionTag) {
    return `${bucket.sectionTag}: ${bucket.focusLabel}`;
  }
  if (bucket.unitSubtitle) {
    return `${bucket.unitTitle} (${bucket.focusLabel})`;
  }
  return `Unit ${bucket.unitNumber}: ${bucket.unitTitle}`;
}

function buildTopicReason(bucket: DiagnosticBucket): string {
  const questionCount = bucket.items.length;
  const answeredWrongCount = questionCount - bucket.unansweredCount;
  const sampleExplanation = bucket.items.find((i) => i.explanation)?.explanation ?? '';

  const parts: string[] = [];
  if (answeredWrongCount > 0 && bucket.unansweredCount > 0) {
    parts.push(
      `Ushbu boʻlimda ${answeredWrongCount} ta savolda notoʻgʻri variant tanlangan va ${bucket.unansweredCount} ta savol javobsiz qolgan.`,
    );
  } else if (bucket.unansweredCount > 0) {
    parts.push(`Ushbu boʻlimdagi ${bucket.unansweredCount} ta savol javobsiz qolgan.`);
  } else {
    parts.push(
      `Ushbu boʻlimdagi ${questionCount} ta savolda (${bucket.totalMisses} marta) xatolik kuzatilgan.`,
    );
  }

  if (sampleExplanation) {
    parts.push(`Asosiy qoida: ${sampleExplanation}`);
  } else if (bucket.unitSubtitle) {
    parts.push(`Qamrab olinadigan mavzu: ${bucket.unitSubtitle}.`);
  }

  return parts.join(' ');
}

function extractKeyWords(items: readonly EnrichedMistakeItem[]): string[] {
  const seen = new Set<string>();
  const words: string[] = [];

  for (const item of items) {
    const candidate = item.correctAnswer.trim();
    if (!candidate) continue;
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(candidate);
    if (words.length >= 6) break;
  }

  return words;
}

export function buildLocalDiagnosticReview(params: {
  studentName: string;
  scopeLabel: string;
  audience: 'student' | 'teacher';
  mistakes: readonly AiMistakeInput[];
}): AiReviewRecommendation | null {
  const enriched = buildMistakeAnalysisItems(params.mistakes, 60);
  if (enriched.length === 0) return null;

  const buckets = new Map<string, DiagnosticBucket>();

  for (const item of enriched) {
    const sectionTag = extractSectionTag(item.explanation, item.unitNumber);
    const focus = detectFocusRule(item);
    const focusLabel =
      focus?.label ??
      (item.unitSubtitle
        ? item.unitSubtitle.split(',')[0].trim()
        : item.unitTitle);

    const bucketKey = sectionTag
      ? `${item.unitNumber}::sec:${sectionTag}`
      : `${item.unitNumber}::focus:${focusLabel}`;

    const misses = item.missCount ?? 1;
    const unanswered = isUnanswered(item.selectedAnswer) ? 1 : 0;

    const existing = buckets.get(bucketKey);
    if (existing) {
      existing.items.push(item);
      existing.totalMisses += misses;
      existing.unansweredCount += unanswered;
    } else {
      buckets.set(bucketKey, {
        unitNumber: item.unitNumber,
        unitTitle: item.unitTitle,
        unitSubtitle: item.unitSubtitle,
        sectionTag,
        focusLabel,
        items: [item],
        totalMisses: misses,
        unansweredCount: unanswered,
      });
    }
  }

  const sortedBuckets = Array.from(buckets.values()).sort(
    (a, b) => b.totalMisses - a.totalMisses || b.items.length - a.items.length,
  );

  const recommendedTopics: AiTopicRecommendation[] = sortedBuckets
    .slice(0, 5)
    .map((bucket) => {
      const matchedRule = detectFocusRule(bucket.items[0]);
      const defaultTip =
        bucket.unansweredCount === bucket.items.length
          ? `Unit ${bucket.unitNumber} lugʻat jadvalidagi kalit soʻzlarni oʻqib chiqib, vaqt ichida barcha savollarga javob berishni mashq qiling.`
          : `Unit ${bucket.unitNumber} boʻyicha xato qilingan soʻzlarni kontekstli gaplar ichida qayta yozib mustahkamlang.`;

      return {
        topicTitle: buildTopicTitle(bucket),
        unitNumber: bucket.unitNumber,
        priority: computePriority(bucket.totalMisses, bucket.items.length),
        reason: buildTopicReason(bucket),
        keyWords: extractKeyWords(bucket.items),
        practiceTip: matchedRule?.tip ?? defaultTip,
      };
    });

  const totalQuestions = enriched.length;
  const totalUnanswered = enriched.filter((m) => isUnanswered(m.selectedAnswer)).length;
  const totalWrongChoice = totalQuestions - totalUnanswered;
  const uniqueUnits = Array.from(new Set(enriched.map((m) => m.unitNumber))).sort(
    (a, b) => a - b,
  );

  const unitListText =
    uniqueUnits.length === 1
      ? `Unit ${uniqueUnits[0]}`
      : `Unit ${uniqueUnits.slice(0, 4).join(', Unit ')}${uniqueUnits.length > 4 ? ' va boshqalar' : ''}`;

  const summary =
    params.audience === 'teacher'
      ? `${params.studentName} uchun ${unitListText} kesimida jami ${totalQuestions} ta muammoli savol tahlil qilindi (${totalWrongChoice} ta xato tanlov, ${totalUnanswered} ta javobsiz). Eng koʻp xatolik ${recommendedTopics[0]?.topicTitle ?? unitListText} yoʻnalishida qayd etilgan.`
      : `${unitListText} boʻyicha ${totalQuestions} ta savol tahlil qilindi (${totalWrongChoice} ta xato javob, ${totalUnanswered} ta javobsiz). Asosiy eʼtiborni ${recommendedTopics[0]?.topicTitle ?? unitListText} mavzusini takrorlashga qarating.`;

  const strengthsNote =
    totalUnanswered > totalWrongChoice
      ? params.audience === 'teacher'
        ? "Koʻpchilik savollar javobsiz qoldirilgani sababli oʻquvchiga test vaqtini taqsimlash va qiyin savollarni belgilab keyinroq qaytish boʻyicha yoʻl-yoʻriq bering."
        : "Savollarning bir qismi javobsiz qolgan. Avval oson savollarni yechib, murakkablarini bayroqcha bilan belgilab qayta koʻrib chiqish natijangizni tez oshiradi."
      : params.audience === 'teacher'
        ? "Oʻquvchi savollarga faol javob bergan; darsda yuqoridagi kalit soʻzlarni juftlik va kontekst mashqlari orqali mustahkamlash tavsiya etiladi."
        : "Barcha savollarda harakat qilganingiz yaxshi — endi xato chiqqan kalit soʻzlarni misol gaplar bilan qayta koʻrib chiqsangiz, keyingisida ballingiz sezilarli koʻtariladi.";

  const topKeywords = recommendedTopics
    .flatMap((t) => t.keyWords)
    .slice(0, 6);

  const studyPlan: string[] = [
    `${unitListText} boʻlimidagi lugʻat qoidalarini va ayniqsa ${recommendedTopics[0]?.topicTitle ?? 'xato chiqqan qismlarni'} qayta oʻqib chiqing.`,
    topKeywords.length > 0
      ? `Ushbu kalit soʻzlarni alohida daftarga koʻchiring va har biriga 1 tadan gap tuzing: ${topKeywords.join(', ')}.`
      : `Xato qilingan har bir savolning toʻgʻri javobini kontekstli gap bilan yozib chiqing.`,
    totalUnanswered > 0
      ? `Testni qayta ishlashda har 10 ta savolga 4–5 daqiqa ajratib, javobsiz savol qoldirmaslikka harakat qiling.`
      : `Xatolar tahlilini koʻrib chiqqach, ${uniqueUnits[0] ? `Unit ${uniqueUnits[0]}` : 'ushbu'} testni qayta topshirib natijangizni mustahkamlang.`,
  ];

  return {
    summary,
    strengthsNote,
    recommendedTopics,
    studyPlan,
    generatedAt: new Date().toISOString(),
    model: LOCAL_DIAGNOSTIC_MODEL,
  };
}
