import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useMedplumProfile, useMedplum } from '@medplum/react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CareLoop from './pages/CareLoop';
import Patients from './pages/Patients';
import PatientProfile from './pages/PatientProfile';
import Consultation from './pages/Consultation';
import DocumentReview from './pages/DocumentReview';
import Assistant from './pages/Assistant';
import Operations from './pages/Operations';
import Settings from './pages/Settings';
import Schedule from './pages/Schedule';
import Education from './pages/Education';
import Billing from './pages/Billing';
import MobileCapturePage from './pages/MobileCapturePage';
import SmartLaunch from './pages/SmartLaunch';
import ClinicStart from './pages/ClinicStart';
import ClinicJoin from './pages/ClinicJoin';
import ClinicAdmin from './pages/ClinicAdmin';
import { authService } from './services/auth';

// Lazy-load the landing page since it's only for unauthenticated visitors
const LandingPage = lazy(() => import('./pages/LandingPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const medplum = useMedplum();
  const profile = useMedplumProfile();
  const user = authService.getCurrentUser();
  
  // Deterministic Auth Guard: While Medplum is actively negotiating, allow if local session is valid
  if (medplum.isLoading() && !user) {
    return (
      <div className="min-h-screen bg-paper-2 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="text-xl font-bold tracking-tight text-ink">proton</span>
          <div className="text-center">
            <p className="text-sm font-medium text-ink">Verifying clinical credentials</p>
            <p className="text-xs text-ink-2 mt-1">Authenticating session with EHR boundary</p>
          </div>
        </div>
      </div>
    );
  }

  const activeUser = user || (profile ? authService.getCurrentUser() : null);

  // Fail-closed security rule: No profile and no active physician session -> redirect to login
  if (!profile && !activeUser) {
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
      {/* Public: a hospital opens a clinic before any account exists. */}
      <Route path="/clinic/start" element={<ClinicStart />} />
      {/* Public: the invited clinician signs in, then claims the membership. */}
      <Route path="/clinic/join" element={<ClinicJoin />} />
      <Route path="/login" element={<Login />} />
      <Route path="/capture" element={<MobileCapturePage />} />
      <Route path="/launch" element={<SmartLaunch />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/care-loop" element={<ProtectedRoute><CareLoop /></ProtectedRoute>} />
      <Route path="/clinic/admin" element={<ProtectedRoute><ClinicAdmin /></ProtectedRoute>} />
      <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
      <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
      <Route path="/patients/:id" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
      <Route path="/consultation" element={<ProtectedRoute><Consultation /></ProtectedRoute>} />
      <Route path="/consultations/*" element={<ProtectedRoute><Consultation /></ProtectedRoute>} />
      <Route path="/document-review" element={<ProtectedRoute><DocumentReview /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><DocumentReview /></ProtectedRoute>} />
      <Route path="/education" element={<ProtectedRoute><Education /></ProtectedRoute>} />
      <Route path="/knowledge" element={<ProtectedRoute><Education /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
      <Route path="/assistant" element={<ProtectedRoute><Assistant /></ProtectedRoute>} />
      <Route path="/operations" element={<ProtectedRoute><Operations /></ProtectedRoute>} />
      <Route path="/documents/review" element={<ProtectedRoute><DocumentReview /></ProtectedRoute>} />
      <Route path="/review" element={<ProtectedRoute><DocumentReview /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
