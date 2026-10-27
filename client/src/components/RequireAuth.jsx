import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './Loading';

/** Shows children only to logged-in users (optionally only to some roles). */
export default function RequireAuth({ roles, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="container narrow empty">
        <h1>This page is not available for your account</h1>
        <p>Your account type cannot open this page. Log in with a different account if you need it.</p>
      </div>
    );
  }
  return children;
}
