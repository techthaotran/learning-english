import { cn } from '@/lib/utils';

const CEFR_LEVEL_STYLES: Record<string, string> = {
  A1: 'border-emerald-500 bg-emerald-500/20 text-emerald-800',
  A2: 'border-teal-500 bg-teal-500/20 text-teal-800',
  B1: 'border-sky-500 bg-sky-500/20 text-sky-800',
  B2: 'border-blue-600 bg-blue-600/20 text-blue-900',
  C1: 'border-violet-500 bg-violet-500/20 text-violet-900',
  C2: 'border-rose-500 bg-rose-500/20 text-rose-900',
};

export function normalizeCefrLevel(level: string): string {
  return level.trim().toUpperCase();
}

export function getCefrLevelClassName(level: string): string {
  const key = normalizeCefrLevel(level);
  return CEFR_LEVEL_STYLES[key] ?? 'border-border bg-muted text-muted-foreground';
}

interface CefrLevelBadgeProps {
  level: string;
  className?: string;
}

export default function CefrLevelBadge({ level, className }: CefrLevelBadgeProps) {
  const displayLevel = normalizeCefrLevel(level);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md border px-2 py-0.5 text-xs font-bold tracking-wide',
        getCefrLevelClassName(level),
        className
      )}
    >
      {displayLevel}
    </span>
  );
}
