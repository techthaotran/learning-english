import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Library } from 'lucide-react';
import { loginUser, registerUser } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

type AuthMode = 'login' | 'register';

export default function LoginPage() {
  const navigate = useNavigate();
  const { userName, loading: authLoading, refresh } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && userName) {
      navigate('/', { replace: true });
    }
  }, [authLoading, userName, navigate]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError('');
    setPassword('');
    setConfirmPassword('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) return;

    if (mode === 'register' && password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        await loginUser({ username: trimmedUsername, password });
      } else {
        await registerUser({ username: trimmedUsername, password });
      }
      await refresh();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <AppLayout className="justify-center">
        <p className="text-muted-foreground text-center text-sm">Đang tải...</p>
      </AppLayout>
    );
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
            <CardTitle className="text-lg">
              {mode === 'login' ? 'Đăng nhập' : 'Đăng ký tài khoản'}
            </CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Nhập username và mật khẩu để tiếp tục'
                : 'Tạo tài khoản mới để lưu từ vựng cá nhân'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ví dụ: minh"
                  autoComplete="username"
                  autoFocus
                  required
                  pattern="[a-zA-Z0-9_]+"
                  title="Chỉ chữ cái không dấu, số và dấu gạch dưới"
                />
                <p className="text-muted-foreground text-xs">
                  Chỉ dùng chữ cái không dấu (a-z), số và _
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ít nhất 6 ký tự"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                />
              </div>
              {mode === 'register' && (
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                </div>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading
                  ? 'Đang xử lý...'
                  : mode === 'login'
                    ? 'Đăng nhập'
                    : 'Đăng ký'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate('/dictionary')}
              >
                <Library className="size-4" />
                Xem từ điển (không cần đăng nhập)
              </Button>
              <p className="text-muted-foreground text-center text-sm">
                {mode === 'login' ? (
                  <>
                    Chưa có tài khoản?{' '}
                    <button
                      type="button"
                      className="text-primary font-medium hover:underline"
                      onClick={() => switchMode('register')}
                    >
                      Đăng ký
                    </button>
                  </>
                ) : (
                  <>
                    Đã có tài khoản?{' '}
                    <button
                      type="button"
                      className="text-primary font-medium hover:underline"
                      onClick={() => switchMode('login')}
                    >
                      Đăng nhập
                    </button>
                  </>
                )}
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
