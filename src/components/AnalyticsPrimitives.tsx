import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { AnalyzedAttempt, TrendDirection } from '../utils/studentAnalytics';

export function TrendBadge({
  delta,
  trend,
  initialLabel,
}: {
  delta: number | null;
  trend: TrendDirection;
  initialLabel: string;
}) {
  if (trend === 'initial' || delta === null) {
    return (
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {initialLabel}
      </span>
    );
  }
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
        <span>+{delta}% oʻsish</span>
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-400">
        <TrendingDown className="h-3.5 w-3.5 shrink-0" />
        <span>{delta}% tushish</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400">
      <Minus className="h-3.5 w-3.5 shrink-0" />
      <span>0% (oʻzgarishsiz)</span>
    </span>
  );
}

export function ProgressLineChart({
  items,
}: {
  items: readonly AnalyzedAttempt[];
}) {
  const width = Math.max(520, items.length * 72);
  const height = 148;
  const padLeft = 36;
  const padRight = 24;
  const padTop = 18;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const coords = items.map((item, idx) => {
    const x =
      items.length === 1
        ? padLeft + chartW / 2
        : padLeft + (idx / (items.length - 1)) * chartW;
    const y = padTop + chartH - (item.attempt.percentage / 100) * chartH;
    return { x, y, item };
  });

  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath =
    coords.length >= 2
      ? `M ${coords[0].x.toFixed(1)},${(padTop + chartH).toFixed(1)} ` +
        coords.map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
        ` L ${coords[coords.length - 1].x.toFixed(1)},${(padTop + chartH).toFixed(1)} Z`
      : '';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[154px] min-w-full"
      role="img"
      aria-label="Test natijalari o'sish va tushish grafigi"
    >
      <defs>
        <linearGradient id="lexisChartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {[0, 50, 100].map((val) => {
        const gy = padTop + chartH - (val / 100) * chartH;
        return (
          <g key={val}>
            <line
              x1={padLeft}
              y1={gy}
              x2={width - padRight}
              y2={gy}
              stroke="currentColor"
              className="text-slate-200 dark:text-white/10"
              strokeDasharray="3 3"
            />
            <text
              x={padLeft - 6}
              y={gy + 3}
              textAnchor="end"
              className="fill-slate-400 text-[10px] font-mono dark:fill-slate-500"
            >
              {val}%
            </text>
          </g>
        );
      })}

      {areaPath && <path d={areaPath} fill="url(#lexisChartFill)" />}

      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-sky-600 dark:text-sky-400"
        points={polyline}
      />

      {coords.map(({ x, y, item }) => {
        const dotColor =
          item.overallTrend === 'up'
            ? 'fill-emerald-500 dark:fill-emerald-400'
            : item.overallTrend === 'down'
              ? 'fill-red-500 dark:fill-red-400'
              : 'fill-sky-500 dark:fill-sky-400';

        return (
          <g key={item.attempt.id}>
            <circle cx={x} cy={y} r="7" className="fill-sky-400/15" />
            <circle cx={x} cy={y} r="4" className={dotColor} />
            <text
              x={x}
              y={Math.max(11, y - 9)}
              textAnchor="middle"
              className="fill-slate-700 text-[10px] font-semibold font-mono dark:fill-slate-100"
            >
              {item.attempt.percentage}%
            </text>
            <text
              x={x}
              y={height - 10}
              textAnchor="middle"
              className="fill-slate-500 text-[10px] font-mono dark:fill-slate-400"
            >
              U{item.attempt.unitNumber}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
