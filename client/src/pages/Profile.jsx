import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Field from '../components/Field';
import { formatDate, ROLE_LABELS } from '../utils/format';

/** Increment 1 — user and profile management. */
export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', city: user.city || '' });
  const [errors, setErrors] = useState({});
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwErrors, setPwErrors] = useState({});

  async function saveProfile(e) {
    e.preventDefault();
    setErrors({});
    try {
      const d = await api('/auth/me', { method: 'PUT', body: form });
      setUser(d.user);
      toast('Profile saved.');
    } catch (err) {
      setErrors(err.fields || {});
      toast(err.message, 'error');
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwErrors({});
    try {
      await api('/auth/me/password', { method: 'PUT', body: pw });
      setPw({ currentPassword: '', newPassword: '' });
      toast('Password changed.');
    } catch (err) {
      setPwErrors(err.fields || {});
      toast(err.message, 'error');
    }
  }

  return (
    <div className="container narrow">
      <header className="page-head">
        <div>
          <h1>Profile</h1>
          <p className="muted">{ROLE_LABELS[user.role]} account, {user.email}, member since {formatDate(user.createdAt)}</p>
        </div>
      </header>

      <form className="card form-card" onSubmit={saveProfile} noValidate>
        <h2>Personal details</h2>
        <div className="form-grid">
          <Field label="Full name" id="p-name" error={errors.name}><input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Mobile number" id="p-phone" error={errors.phone}><input id="p-phone" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="City" id="p-city"><input id="p-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
        </div>
        <button type="submit" className="btn btn-primary">Save profile</button>
      </form>

      <form className="card form-card" onSubmit={changePassword} noValidate>
        <h2>Change password</h2>
        <div className="form-grid">
          <Field label="Current password" id="pw-cur" error={pwErrors.currentPassword}>
            <input id="pw-cur" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </Field>
          <Field label="New password" id="pw-new" error={pwErrors.newPassword} hint="At least 8 characters with letters and numbers">
            <input id="pw-new" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          </Field>
        </div>
        <button type="submit" className="btn btn-primary">Change password</button>
      </form>
    </div>
  );
}
