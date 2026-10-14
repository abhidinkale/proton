import { lazy, Suspense, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useMedplumProfile, useMedplum } from '@medplum/react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientProfile from './pages/PatientProfile';
import Consultation from './pages/Consultation';
import DocumentReview from './pages/DocumentReview';
import Assistant from './pages/Assistant';
import Settings from './pages/Settings';
import { authService } from './services/auth';

// Lazy-load the landing page since it's only for unauthenticated visitors
const LandingPage = lazy(() => import('./pages/LandingPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const medplum = useMedplum();
  const profile = useMedplumProfile();
  const user = authService.getCurrentUser();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // If medplum stays in loading state for more than 2.5 seconds (e.g. unreachable local Medplum on Vercel),
    // stop blocking and redirect unauthenticated users to login or let session auth take over
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);
  
  if (medplum.isLoading() && !user && !timedOut) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-raised)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">proton</span>
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Verifying clinical credentials</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Loading your workspace</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile && !user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/welcome" element={
        <Suspense fallback={
          <div className="min-h-screen bg-[var(--color-surface-raised)] flex items-center justify-center">
            <span className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">proton</span>
          </div>
        }>
          <LandingPage />
        </Suspense>
      } />
      <Route path="/landing" element={<Navigate to="/welcome" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
      <Route path="/patients/:id" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
      <Route path="/consultation" element={<ProtectedRoute><Consultation /></ProtectedRoute>} />
      <Route path="/consultations/*" element={<ProtectedRoute><Consultation /></ProtectedRoute>} />
      <Route path="/document-review" element={<ProtectedRoute><DocumentReview /></ProtectedRoute>} />
      <Route path="/assistant" element={<ProtectedRoute><Assistant /></ProtectedRoute>} />
      <Route path="/documents/review" element={<ProtectedRoute><DocumentReview /></ProtectedRoute>} />
      <Route path="/review" element={<ProtectedRoute><DocumentReview /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
