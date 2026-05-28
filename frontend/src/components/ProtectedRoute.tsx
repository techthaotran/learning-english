import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getUserName } from '../utils/storage';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const userName = getUserName();
  if (!userName) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
