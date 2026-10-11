import { Routes, Route, Navigate } from 'react-router-dom';
import { useMedplumProfile, useMedplum } from '@medplum/react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientProfile from './pages/PatientProfile';
import Consultation from './pages/Consultation';
import DocumentReview from './pages/DocumentReview';
import Settings from './pages/Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const medplum = useMedplum();
  const profile = useMedplumProfile();
  
  if (medplum.isLoading()) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span>Verifying clinical credentials...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
      <Route path="/patients/:id" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
      <Route path="/consultation" element={<ProtectedRoute><Consultation /></ProtectedRoute>} />
      <Route path="/consultations/*" element={<ProtectedRoute><Consultation /></ProtectedRoute>} />
      <Route path="/document-review" element={<ProtectedRoute><DocumentReview /></ProtectedRoute>} />
      <Route path="/documents/review" element={<ProtectedRoute><DocumentReview /></ProtectedRoute>} />
      <Route path="/review" element={<ProtectedRoute><DocumentReview /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
