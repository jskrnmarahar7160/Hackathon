import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedCounter } from "./animated-counter";

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent,
  trend,
  animate = true,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: string;
  trend?: { value: number; positive: boolean };
  animate?: boolean;
}) {
  const numeric = typeof value === "number";
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
              {animate && numeric ? (
                <AnimatedCounter value={value as number} />
              ) : (
                value
              )}
            </p>
            {sublabel && <p className="mt-1 text-xs text-muted-foreground truncate">{sublabel}</p>}
            {trend && (
              <p
                className={cn(
                  "mt-2 inline-flex items-center gap-1 text-xs font-medium",
                  trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                )}
              >
                {trend.positive ? "▲" : "▼"} {Math.abs(trend.value)} pts
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted", accent)}>
              <Icon className="size-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/// Circular progress ring for the compliance score.
export function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/40"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}
