import PublicBookingPage from './pages/PublicBookingPage';

export default function PublicApp() {
  const pathParts = window.location.pathname.split('/');
  const businessId = pathParts[pathParts.length - 1];

  return <PublicBookingPage />;
}
