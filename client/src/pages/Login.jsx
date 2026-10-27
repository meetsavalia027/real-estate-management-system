import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Field from '../components/Field';

const DEMO = [
  ['Buyer', 'buyer@demo.com'], ['Tenant', 'tenant@demo.com'], ['Owner', 'owner@demo.com'],
  ['Agent', 'agent@demo.com'], ['Builder', 'builder@demo.com'], ['Admin', 'admin@demo.com'],
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(email, password);
      navigate(params.get('next') || (user.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container auth-page">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Log in</h1>
        <p className="muted">Welcome back. Log in to manage your shortlist, listings and enquiries.</p>
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <Field label="Email" id="email">
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" id="password">
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <button type="submit" className="btn btn-primary full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="small center">New here? <Link to="/register">Create an account</Link></p>
      </form>

      <aside className="demo-box">
        <h2>Demo accounts</h2>
        <p className="small muted">Password for all: <code>Demo@123</code>. Click one to fill the form.</p>
        <div className="demo-list">
          {DEMO.map(([role, mail]) => (
            <button key={mail} type="button" className="demo-acc" onClick={() => { setEmail(mail); setPassword('Demo@123'); setError(''); }}>
              <strong>{role}</strong><span>{mail}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
