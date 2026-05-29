import type { WordStatus } from '@/shared/wordStatus';
import { Badge } from '@/components/ui/badge';

const variantMap: Record<
  WordStatus,
  'info' | 'warning' | 'success'
> = {
  'Mới': 'info',
  'Đang học': 'warning',
  'Hoàn thành': 'success',
};

export function StatusBadge({ status }: { status: WordStatus }) {
  return <Badge variant={variantMap[status]}>{status}</Badge>;
}
