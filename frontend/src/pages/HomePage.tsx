import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellRing,
  BookMarked,
  Layers,
  LineChart,
  LogOut,
  PlusCircle,
  Search,
  Settings,
} from 'lucide-react';
import { getUserName, clearUserName } from '@/utils/storage';
import {
  getReminderStatus,
  notifyDueReminder,
  requestReminderPermission,
  resetReminderAnchor,
} from '@/utils/studyReminder';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const menuItems = [
  { path: '/add', label: 'Thêm từ mới', desc: 'Bổ sung từ vào từ điển', icon: PlusCircle },
  { path: '/flashcard', label: 'Ôn tập flashcard', desc: 'SRS — 5 thẻ mỗi lượt', icon: Layers },
  { path: '/search', label: 'Tìm kiếm', desc: 'Tra cứu theo tên từ', icon: Search },
  { path: '/dashboard', label: 'Dashboard', desc: 'Tiến độ & so sánh', icon: LineChart },
  { path: '/words', label: 'Quản lý từ vựng', desc: 'CRUD & phân trang', icon: BookMarked },
] as const;

export default function HomePage() {
  const navigate = useNavigate();
  const userName = getUserName();
  const isThaoUser = userName === 'Thảo';
  const [dueNow, setDueNow] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );
  const [nextOffset, setNextOffset] = useState<number | null>(null);

  function handleLogout() {
    clearUserName();
    navigate('/login');
  }

  useEffect(() => {
    let mounted = true;

    async function tick() {
      const status = getReminderStatus();
      if (!mounted) return;
      setDueNow(status.dueNow);
      setNextOffset(status.nextOffsetMinutes);
      if (status.enabled && Notification.permission === 'granted') {
        await notifyDueReminder(userName);
      }
    }

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, 30000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [userName]);

  const flashcardHint = useMemo(() => {
    if (dueNow) return 'Đến giờ ôn tập rồi - vào Flashcard ngay';
    if (nextOffset == null) return 'Hôm nay đã qua các mốc 30p / 1h / 2h / 3h';
    return `Mốc nhắc kế tiếp: ${nextOffset} phút`;
  }, [dueNow, nextOffset]);

  async function handleEnableNotification() {
    const result = await requestReminderPermission();
    setPermission(result);
  }

  return (
    <AppLayout
      title="Trang chủ"
      subtitle={`Xin chào, ${userName}!`}
      footer={
        <Button variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="size-4" />
          Đổi tên / Đăng xuất
        </Button>
      }
    >
      {permission !== 'granted' && (
        <Button variant="secondary" className="w-full" onClick={() => void handleEnableNotification()}>
          <BellRing className="size-4" />
          Bật thông báo ôn tập
        </Button>
      )}
      <div className="grid gap-3">
        {menuItems.map(({ path, label, desc, icon: Icon }) => (
          (path !== '/words' || isThaoUser) && (
          <Card
            key={path}
            className={cn(
              'cursor-pointer py-4 transition-colors hover:bg-accent/50',
              path === '/flashcard' && dueNow && 'border-primary bg-primary/10 ring-2 ring-primary/30'
            )}
            onClick={() => {
              if (path === '/flashcard') {
                resetReminderAnchor();
              }
              navigate(path);
            }}
          >
            <CardHeader className="flex-row items-center gap-4 space-y-0 px-4">
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">{label}</CardTitle>
                <CardDescription>
                  {path === '/flashcard' ? flashcardHint : desc}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
          )
        ))}
        {import.meta.env.DEV && isThaoUser && (
          <Card
            className="cursor-pointer py-4 transition-colors hover:bg-accent/50"
            onClick={() => navigate('/settings-debug')}
          >
            <CardHeader className="flex-row items-center gap-4 space-y-0 px-4">
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Settings className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">Settings Debug</CardTitle>
                <CardDescription>Debug notification mốc ôn tập</CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
