import { useNavigate } from 'react-router-dom';
import { Bug } from 'lucide-react';
import { getUserName } from '@/utils/storage';
import { debugSetElapsedMinutes } from '@/utils/studyReminder';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SettingsDebugPage() {
  const navigate = useNavigate();
  const userName = getUserName();
  const isThaoUser = userName === 'Thảo';

  function handleDebugTrigger(minutes: number) {
    debugSetElapsedMinutes(minutes);
    navigate('/');
  }

  if (!isThaoUser) {
    return (
      <AppLayout title="Settings Debug" onBack={() => navigate('/')}>
        <Alert variant="destructive">
          <AlertDescription>Bạn không có quyền truy cập màn hình này.</AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Settings Debug"
      subtitle="Debug notification mốc ôn tập"
      onBack={() => navigate('/')}
    >
      <div className="grid gap-2 rounded-lg border border-dashed p-3">
        <p className="text-muted-foreground flex items-center gap-2 text-xs">
          <Bug className="size-3.5" />
          Debug reminder (dev only)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => handleDebugTrigger(31)}>
            Trigger 30m
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleDebugTrigger(61)}>
            Trigger 1h
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleDebugTrigger(121)}>
            Trigger 2h
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleDebugTrigger(181)}>
            Trigger 3h
          </Button>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => handleDebugTrigger(0)}>
          Reset reminder
        </Button>
      </div>
    </AppLayout>
  );
}
