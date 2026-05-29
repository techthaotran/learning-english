import type { ReactNode, RefObject } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: ReactNode;
  onBack?: () => void;
  headerAction?: ReactNode;
  className?: string;
  footer?: ReactNode;
  topAnchorRef?: RefObject<HTMLDivElement | null>;
  /** Renders below header, sticks together when scrolling (e.g. filters). */
  stickyToolbar?: ReactNode;
}

export function AppLayout({
  children,
  title,
  subtitle,
  onBack,
  headerAction,
  className,
  footer,
  topAnchorRef,
  stickyToolbar,
}: AppLayoutProps) {
  const hasHeader = Boolean(onBack || title || headerAction);
  const hasStickyBlock = hasHeader || stickyToolbar;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col pb-8">
      {hasStickyBlock && (
        <div className="bg-background sticky top-0 z-40  px-4 pt-4 pb-3 ">
          <div ref={topAnchorRef} className="scroll-mt-4" aria-hidden />
          {hasHeader && (
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
                    <div className="text-muted-foreground text-sm">{subtitle}</div>
                  )}
                </div>
                {headerAction}
              </div>
            </header>
          )}
          {stickyToolbar && <div className={cn(hasHeader && 'mt-3')}>{stickyToolbar}</div>}
        </div>
      )}
      {!hasStickyBlock && topAnchorRef && (
        <div ref={topAnchorRef} className="scroll-mt-4 px-4 pt-4" aria-hidden />
      )}
      <main className={cn('flex flex-1 flex-col gap-4 px-4 pt-4', className)}>{children}</main>
      {footer && <div className="px-4">{footer}</div>}
    </div>
  );
}
