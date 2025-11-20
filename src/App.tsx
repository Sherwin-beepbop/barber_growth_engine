import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BusinessProvider, useBusiness } from './contexts/BusinessContext';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import BookingsPage from './pages/BookingsPage';
import CustomersPage from './pages/CustomersPage';
import RetentionPage from './pages/RetentionPage';
import MessagesPage from './pages/MessagesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import Layout from './components/Layout';

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { business, loading: businessLoading } = useBusiness();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (authLoading || businessLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-zinc-800 rounded-full mx-auto mb-4"></div>
          <div className="h-4 bg-zinc-800 rounded w-48"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!business) {
    return <OnboardingPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'bookings':
        return <BookingsPage />;
      case 'customers':
        return <CustomersPage />;
      case 'retention':
        return <RetentionPage />;
      case 'messages':
        return <MessagesPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BusinessProvider>
        <AppContent />
      </BusinessProvider>
    </AuthProvider>
  );
}
