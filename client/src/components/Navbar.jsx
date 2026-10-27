import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isProvider, ROLE_LABELS } from '../utils/format';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => { setMenuOpen(false); setNavOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const type = new URLSearchParams(location.search).get('listingType');
  const onSearch = location.pathname === '/properties';

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="brand" aria-label="REMS home">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="var(--blue)" />
            <path d="M7 16 16 8l9 8v9h-6v-6h-6v6H7z" fill="#fff" />
            <circle cx="24" cy="9" r="3" fill="var(--marigold)" />
          </svg>
          <span className="brand-text">REMS<small>Real Estate Management System</small></span>
        </Link>

        <button type="button" className="nav-toggle" aria-expanded={navOpen} aria-controls="main-nav" onClick={() => setNavOpen(!navOpen)}>
          Menu
        </button>

        <nav id="main-nav" className={`nav-links${navOpen ? ' open' : ''}`}>
          <NavLink to="/properties?listingType=sale" className={() => (onSearch && type === 'sale' ? 'active' : '')}>Buy</NavLink>
          <NavLink to="/properties?listingType=rent" className={() => (onSearch && type === 'rent' ? 'active' : '')}>Rent</NavLink>
          {user && user.role !== 'admin' && <NavLink to="/dashboard">Dashboard</NavLink>}
          {user && user.role !== 'admin' && <NavLink to="/enquiries">Enquiries</NavLink>}
          {user && user.role === 'admin' && <NavLink to="/admin">Admin panel</NavLink>}
          {(!user || isProvider(user)) && (
            <Link to={user ? '/post-property' : '/register?role=owner'} className="btn btn-accent btn-sm">Post property</Link>
          )}
        </nav>

        <div className="nav-user">
          {user ? (
            <>
              <NotificationBell />
              <div className="user-menu" ref={menuRef}>
                <button type="button" className="avatar-btn" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
                  <span className="avatar">{user.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                  <span className="avatar-name">{user.name.split(' ')[0]}</span>
                </button>
                {menuOpen && (
                  <div className="dropdown">
                    <div className="dropdown-head">
                      <strong>{user.name}</strong>
                      <span className="muted small">{ROLE_LABELS[user.role]}</span>
                    </div>
                    <Link to="/profile">Profile and password</Link>
                    {user.role !== 'admin' && <Link to="/dashboard">Dashboard</Link>}
                    <button type="button" onClick={() => { logout(); navigate('/'); }}>Log out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign up</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
