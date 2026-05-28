import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { registerParticipant } from '@/api/client';
import { getUserName, setUserName } from '@/utils/storage';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const navigate = useNavigate();
  const [name, setName] = useState(getUserName());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await registerParticipant(name);
      setUserName(name);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout className="justify-center">
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-2xl shadow-lg">
          <BookOpen className="size-8" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Học Tiếng Anh</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Flashcard & spaced repetition
          </p>
        </div>
        <Card className="w-full py-4">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Bắt đầu học</CardTitle>
            <CardDescription>Nhập tên để theo dõi tiến độ cá nhân</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="userName">Tên của bạn</Label>
                <Input
                  id="userName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Minh"
                  autoFocus
                  required
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Đang vào...' : 'Vào ứng dụng'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
