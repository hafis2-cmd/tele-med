import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ConfirmationProvider } from './context/ConfirmationContext';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import ReminderService from './components/ReminderService';
import FloatingFAQ from './components/FloatingFAQ';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Diagnosis = lazy(() => import('./pages/Diagnosis'));
const MedicalStore = lazy(() => import('./pages/MedicalStore'));
const Profile = lazy(() => import('./pages/Profile'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Consultation = lazy(() => import('./pages/Consultation'));
const Prescriptions = lazy(() => import('./pages/Prescriptions'));
const Payments = lazy(() => import('./pages/Payments'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Doctors = lazy(() => import('./pages/Doctors'));
const Patients = lazy(() => import('./pages/Patients'));
const Messages = lazy(() => import('./pages/Messages'));
const CallHistory = lazy(() => import('./pages/CallHistory'));
const Login = lazy(() => import('./pages/Login'));
const SharedDiagnosis = lazy(() => import('./pages/SharedDiagnosis'));

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || !profile) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
};

// Placeholder components for other pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
    <h2 className="text-2xl font-bold mb-2">{title}</h2>
    <p>This feature is coming soon in the next update.</p>
  </div>
);

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/shared-diagnosis/:shareId" element={<SharedDiagnosis />} />
        <Route path="/login" element={user && profile ? <Navigate to="/" /> : <Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/diagnosis" element={<Diagnosis />} />
                    <Route path="/store" element={<MedicalStore />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/appointments" element={<Appointments />} />
                    <Route path="/consultation" element={<Consultation />} />
                    <Route path="/prescriptions" element={<Prescriptions />} />
                    <Route path="/payments" element={<Payments />} />
                    <Route path="/subscription" element={<Subscription />} />
                    <Route path="/doctors" element={<Doctors />} />
                    <Route path="/patients" element={<Patients />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/call-history" element={<CallHistory />} />
                  </Routes>
                </Suspense>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ConfirmationProvider>
            <ReminderService />
            <Router>
              <FloatingFAQ />
              <AppRoutes />
            </Router>
          </ConfirmationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
