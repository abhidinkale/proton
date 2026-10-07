import { Routes, Route, Navigate } from 'react-router-dom';
import { useMedplumProfile } from '@medplum/react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientProfile from './pages/PatientProfile';
import Consultation from './pages/Consultation';
import DocumentReview from './pages/DocumentReview';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const profile = useMedplumProfile();
  
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
