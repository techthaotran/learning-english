import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  headerAction?: ReactNode;
  className?: string;
  footer?: ReactNode;
}

export function AppLayout({
  children,
  title,
  subtitle,
  onBack,
  headerAction,
  className,
  footer,
}: AppLayoutProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 p-4 pb-8">
      {(onBack || title || headerAction) && (
        <header className="flex flex-col gap-2">
          {onBack && (
            <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={onBack}>
              <ArrowLeft className="size-4" />
              Trang chủ
            </Button>
          )}
          <div className="flex items-start justify-between gap-3">
            <div>
              {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
              {subtitle && (
                <p className="text-muted-foreground text-sm">{subtitle}</p>
              )}
            </div>
            {headerAction}
          </div>
        </header>
      )}
      <main className={cn('flex flex-1 flex-col gap-4', className)}>{children}</main>
      {footer}
    </div>
  );
}
