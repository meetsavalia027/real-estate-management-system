import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Field from '../components/Field';

const ROLE_OPTIONS = [
  ['buyer', 'Buyer', 'I want to buy a property'],
  ['tenant', 'Tenant', 'I want to rent a property'],
  ['owner', 'Owner / Landlord', 'I want to sell or rent out my property'],
  ['agent', 'Agent', 'I list properties for my clients'],
  ['builder', 'Builder / Developer', 'I promote new projects'],
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '', password: '', role: params.get('role') || 'buyer' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    try {
      const user = await register(form);
      navigate(['owner', 'agent', 'builder'].includes(user.role) ? '/post-property' : '/properties', { replace: true });
    } catch (err) {
      setError(err.message);
      setErrors(err.fields || {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container auth-page single">
      <form className="card auth-card wide" onSubmit={submit} noValidate>
        <h1>Create your account</h1>
        <p className="muted">Choose the account type that matches what you want to do.</p>
        {error && <p className="alert alert-error" role="alert">{error}</p>}

        <fieldset className="role-picker">
          <legend>Account type</legend>
          {ROLE_OPTIONS.map(([v, l, d]) => (
            <label key={v} className={`role-opt${form.role === v ? ' on' : ''}`}>
              <input type="radio" name="role" value={v} checked={form.role === v} onChange={set('role')} />
              <strong>{l}</strong>
              <span>{d}</span>
            </label>
          ))}
          {errors.role && <small className="error-text">{errors.role}</small>}
        </fieldset>

        <div className="form-grid">
          <Field label="Full name" id="name" error={errors.name}>
            <input id="name" value={form.name} onChange={set('name')} autoComplete="name" />
          </Field>
          <Field label="Email" id="email" error={errors.email}>
            <input id="email" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          </Field>
          <Field label="Mobile number" id="phone" error={errors.phone} hint="10 digits, shown only to logged-in users">
            <input id="phone" inputMode="numeric" maxLength={10} value={form.phone} onChange={set('phone')} autoComplete="tel-national" />
          </Field>
          <Field label="City" id="city">
            <input id="city" value={form.city} onChange={set('city')} autoComplete="address-level2" />
          </Field>
          <Field label="Password" id="password" error={errors.password} hint="At least 8 characters with letters and numbers">
            <input id="password" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          </Field>
        </div>
        <button type="submit" className="btn btn-primary full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="small center">Already registered? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
