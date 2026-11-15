import type { StudentProfile, TestAttempt } from '../types/quiz';
import { formatCountdown } from './quizEngine';

export function buildResultShareText(
  student: StudentProfile,
  attempt: TestAttempt,
): string {
  const dateStr = new Date(attempt.completedAt).toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return [
    `LexisCheck — Vocabulary Test Natijasi`,
    `O'quvchi: ${student.fullName} (${student.className} sinf)`,
    `Unit ${attempt.unitNumber}: ${attempt.unitTitle}`,
    `Natija: ${attempt.percentage}% (${attempt.correctCount}/${attempt.totalQuestions})`,
    `To'g'ri: ${attempt.correctCount} | Xato: ${attempt.wrongCount}`,
    `Ushbu test bali: +${attempt.pointsEarned} ball`,
    `Umumiy ball: ${student.totalPoints} ball`,
    `Sarflangan vaqt: ${formatCountdown(attempt.durationSeconds)}`,
    `Sana: ${dateStr}`,
  ].join('\n');
}

export function buildTelegramShareUrl(
  shareText: string,
  appUrl?: string,
): string {
  const params = new URLSearchParams();
  if (appUrl) {
    params.set('url', appUrl);
  }
  params.set('text', shareText);
  return `https://t.me/share/url?${params.toString()}`;
}

export function buildResultImageFilename(
  student: StudentProfile,
  attempt: TestAttempt,
): string {
  const safeName = student.fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '');
  return `LexisCheck-Unit-${attempt.unitNumber}-${safeName || 'natija'}.png`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderResultCardBlob(
  student: StudentProfile,
  attempt: TestAttempt,
): Promise<Blob> {
  const width = 1200;
  const height = 740;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context mavjud emas.');
  }

  // Outer light slate background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, width, height);

  // Main card container
  drawRoundedRect(ctx, 48, 48, width - 96, height - 96, 28);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  // Top header text
  ctx.fillStyle = '#0284C7';
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  ctx.fillText('LexisCheck · English Vocabulary in Use (Upper-Intermediate)', 96, 114);

  // Date & duration top right
  const dateStr = new Date(attempt.completedAt).toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  ctx.fillStyle = '#64748B';
  ctx.font = '500 18px ui-monospace, SFMono-Regular, monospace';
  const metaRight = `Unit ${attempt.unitNumber} · Vaqt: ${formatCountdown(attempt.durationSeconds)}`;
  const metaWidth = ctx.measureText(metaRight).width;
  ctx.fillText(metaRight, width - 96 - metaWidth, 114);

  // Unit Title
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 44px Georgia, serif';
  ctx.fillText(attempt.unitTitle, 96, 186, 760);

  // Student info
  ctx.fillStyle = '#1E293B';
  ctx.font = '600 26px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${student.fullName}  ·  ${student.className} sinf`, 96, 238);

  // Large Percentage on right
  ctx.fillStyle = '#64748B';
  ctx.font = '600 18px system-ui, -apple-system, sans-serif';
  const pctLabel = 'NATIJA FOIZI';
  const pctLabelW = ctx.measureText(pctLabel).width;
  ctx.fillText(pctLabel, width - 96 - pctLabelW, 160);

  ctx.fillStyle = attempt.percentage >= 70 ? '#059669' : '#0284C7';
  ctx.font = '700 76px ui-monospace, SFMono-Regular, monospace';
  const pctVal = `${attempt.percentage}%`;
  const pctValW = ctx.measureText(pctVal).width;
  ctx.fillText(pctVal, width - 96 - pctValW, 236);

  // Divider line
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, 284);
  ctx.lineTo(width - 96, 284);
  ctx.stroke();

  // 4 Metric Boxes
  const boxes = [
    {
      label: "To'g'ri javoblar",
      value: String(attempt.correctCount),
      bg: '#ECFDF5',
      border: '#A7F3D0',
      labelColor: '#065F46',
      valueColor: '#064E3B',
    },
    {
      label: 'Xato javoblar',
      value: String(attempt.wrongCount),
      bg: '#FEF2F2',
      border: '#FECACA',
      labelColor: '#991B1B',
      valueColor: '#7F1D1D',
    },
    {
      label: 'Ushbu test bali',
      value: `+${attempt.pointsEarned}`,
      bg: '#F8FAFC',
      border: '#E2E8F0',
      labelColor: '#475569',
      valueColor: '#0F172A',
    },
    {
      label: 'Umumiy ball',
      value: String(student.totalPoints),
      bg: '#F0F9FF',
      border: '#BAE6FD',
      labelColor: '#075985',
      valueColor: '#0C4A6E',
    },
  ];

  const boxGap = 24;
  const boxWidth = (width - 192 - boxGap * 3) / 4;
  const boxY = 330;
  const boxH = 175;

  boxes.forEach((box, idx) => {
    const bx = 96 + idx * (boxWidth + boxGap);
    drawRoundedRect(ctx, bx, boxY, boxWidth, boxH, 20);
    ctx.fillStyle = box.bg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = box.border;
    ctx.stroke();

    ctx.fillStyle = box.labelColor;
    ctx.font = '600 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(box.label, bx + 24, boxY + 52);

    ctx.fillStyle = box.valueColor;
    ctx.font = '700 54px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(box.value, bx + 24, boxY + 128);
  });

  // Footer details
  drawRoundedRect(ctx, 96, 548, width - 192, 92, 18);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = '600 21px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Jami savollar: ${attempt.totalQuestions} ta   ·   Bajarilgan unitlar: ${student.completedUnits.length}/20`,
    126,
    602,
  );

  ctx.fillStyle = '#64748B';
  ctx.font = '500 18px ui-monospace, SFMono-Regular, monospace';
  const dateW = ctx.measureText(dateStr).width;
  ctx.fillText(dateStr, width - 126 - dateW, 602);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Natija rasmini yaratib bo‘lmadi.'));
    }, 'image/png');
  });
}
