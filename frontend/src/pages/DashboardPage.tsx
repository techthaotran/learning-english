import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Users } from 'lucide-react';
import type { DashboardResponse, ParticipantStats } from '@/shared/types';
import { getDashboard } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

function compareMetric(
  me: ParticipantStats,
  other: ParticipantStats,
  key: keyof Pick<ParticipantStats, 'studiedToday' | 'totalReviews' | 'completedReviews'>
): 'win' | 'lose' | 'tie' {
  if (me[key] > other[key]) return 'win';
  if (me[key] < other[key]) return 'lose';
  return 'tie';
}

function summarizeVsMe(me: ParticipantStats, other: ParticipantStats): string {
  let wins = 0;
  let losses = 0;
  for (const key of ['studiedToday', 'totalReviews', 'completedReviews'] as const) {
    const r = compareMetric(me, other, key);
    if (r === 'win') wins++;
    if (r === 'lose') losses++;
  }
  if (wins > losses) return 'Bạn đang dẫn';
  if (losses > wins) return 'Bạn đang thua';
  return 'Ngang bằng';
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { userName } = useAuth();
  const [stats, setStats] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboard()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Lỗi'))
      .finally(() => setLoading(false));
  }, []);

  const others = stats?.participants.filter((p) => p.userName !== userName) ?? [];
  const me = stats?.me;

  const statItems = stats
    ? [
        { label: 'Tổng từ', value: stats.total },
        { label: 'Cần ôn', value: stats.dueForReview },
        { label: 'Mới', value: stats.byStatus['Mới'] },
        { label: 'Đang học', value: stats.byStatus['Đang học'] },
        { label: 'Hoàn thành', value: stats.byStatus['Hoàn thành'] },
        { label: 'Ôn hôm nay', value: stats.studiedToday },
      ]
    : [];

  return (
    <AppLayout title="Dashboard" subtitle="Tiến độ học tập" onBack={() => navigate('/')}>
      {loading && <p className="text-muted-foreground py-8 text-center">Đang tải...</p>}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {statItems.map((item) => (
              <Card key={item.label} className="py-4">
                <CardContent className="px-4 text-center">
                  <p className="text-primary text-2xl font-bold">{item.value}</p>
                  <p className="text-muted-foreground text-xs">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {me && (
            <Card className="border-primary/30 bg-primary/5 py-4">
              <CardHeader className="px-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="size-4" />
                  Tiến độ của bạn — {me.userName}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-4 px-4 text-sm">
                <span>
                  Ôn hôm nay: <strong>{me.studiedToday}</strong>
                </span>
                <span>
                  Lượt ôn: <strong>{me.totalReviews}</strong>
                </span>
                <span>
                  Hoàn thành: <strong>{me.completedReviews}</strong>
                </span>
              </CardContent>
            </Card>
          )}

          <section className="grid gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4" />
              So sánh với người khác
            </h2>
            {others.length === 0 ? (
              <Card className="py-6">
                <CardDescription className="px-4 text-center">
                  Chưa có người tham gia khác. Mời bạn bè đăng nhập bằng tên riêng.
                </CardDescription>
              </Card>
            ) : (
              others.map((other) => (
                <Card key={other.userName} className="py-4">
                  <CardHeader className="flex-row items-center justify-between space-y-0 px-4 pb-2">
                    <CardTitle className="text-base">{other.userName}</CardTitle>
                    {me && (
                      <span className="text-muted-foreground text-xs">
                        {summarizeVsMe(me, other)}
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="grid gap-1 px-4">
                    <CompareRow
                      label="Ôn hôm nay"
                      mine={me?.studiedToday ?? 0}
                      theirs={other.studiedToday}
                      highlight={me ? compareMetric(me, other, 'studiedToday') : 'tie'}
                    />
                    <CompareRow
                      label="Tổng lượt ôn"
                      mine={me?.totalReviews ?? 0}
                      theirs={other.totalReviews}
                      highlight={me ? compareMetric(me, other, 'totalReviews') : 'tie'}
                    />
                    <CompareRow
                      label="Hoàn thành"
                      mine={me?.completedReviews ?? 0}
                      theirs={other.completedReviews}
                      highlight={me ? compareMetric(me, other, 'completedReviews') : 'tie'}
                    />
                  </CardContent>
                </Card>
              ))
            )}
          </section>

          <section className="grid gap-3">
            <h2 className="text-sm font-semibold">Từ mới nhất</h2>
            {stats.recentWords.length === 0 ? (
              <p className="text-muted-foreground text-center text-sm">Chưa có từ</p>
            ) : (
              stats.recentWords.map((word) => (
                <Card key={word.id} className="py-3">
                  <CardContent className="flex items-center justify-between gap-2 px-4">
                    <div>
                      <p className="font-medium">{word.name}</p>
                      {word.meaning && (
                        <p className="text-muted-foreground text-sm">{word.meaning}</p>
                      )}
                    </div>
                    <StatusBadge status={word.status} />
                  </CardContent>
                </Card>
              ))
            )}
          </section>
        </>
      )}
    </AppLayout>
  );
}

function CompareRow({
  label,
  mine,
  theirs,
  highlight,
}: {
  label: string;
  mine: number;
  theirs: number;
  highlight: 'win' | 'lose' | 'tie';
}) {
  return (
    <div
      className={cn(
        'flex justify-between rounded-md px-2 py-1.5 text-sm',
        highlight === 'win' && 'bg-emerald-50 text-emerald-900',
        highlight === 'lose' && 'bg-red-50 text-red-900',
        highlight === 'tie' && 'bg-muted/50'
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span>
        Bạn: <strong>{mine}</strong> · Họ: <strong>{theirs}</strong>
      </span>
    </div>
  );
}
