import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { userName, loading } = useAuth();

  if (loading) {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm">
        Đang tải...
      </div>
    );
  }

  if (!userName) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
