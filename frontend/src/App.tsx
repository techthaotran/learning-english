import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import AddWordPage from './pages/AddWordPage';
import SearchPage from './pages/SearchPage';
import FlashcardPage from './pages/FlashcardPage';
import DashboardPage from './pages/DashboardPage';
import WordManagePage from './pages/WordManagePage';
import SettingsDebugPage from './pages/SettingsDebugPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add"
        element={
          <ProtectedRoute>
            <AddWordPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <SearchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/flashcard"
        element={
          <ProtectedRoute>
            <FlashcardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/words"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <WordManagePage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings-debug"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <SettingsDebugPage />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
