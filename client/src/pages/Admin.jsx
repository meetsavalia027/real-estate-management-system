import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import Loading from '../components/Loading';
import StatusBadge from '../components/StatusBadge';
import {
  FLAG_LABELS, formatDate, formatNumber, formatPrice, ROLE_LABELS, STATUS_LABELS, timeAgo, TYPE_LABELS,
} from '../utils/format';

const TABS = [['overview', 'Overview'], ['moderation', 'Listing moderation'], ['flags', 'Reported listings'], ['users', 'Users']];

/** Increment 4 — administration: moderation, flagged/duplicate handling, reports. */
export default function Admin() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([t]) => t === params.get('tab')) ? params.get('tab') : 'overview';
  return (
    <div className="container admin">
      <header className="page-head"><div><h1>Admin panel</h1><p className="muted">Review listings, handle reports and monitor platform activity.</p></div></header>
      <div className="tabs" role="tablist">
        {TABS.map(([t, l]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setParams({ tab: t })}>{l}</button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'moderation' && <Moderation />}
      {tab === 'flags' && <Flags />}
      {tab === 'users' && <Users />}
    </div>
  );
}

function Bars({ title, rows, labels = {} }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="card report-card">
      <h3>{title}</h3>
      {rows.length === 0 && <p className="muted small">No data yet.</p>}
      <ul className="bars">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="bar-label">{labels[r.label] || r.label}</span>
            <span className="bar-track"><span className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} /></span>
            <span className="bar-value">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Week({ title, rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="card report-card">
      <h3>{title}</h3>
      <div className="week">
        {rows.map((r) => (
          <div key={r.date} className="day">
            <span className="day-bar" style={{ height: `${(r.value / max) * 100}%` }} title={`${r.value}`} />
            <span className="day-value">{r.value}</span>
            <span className="day-label">{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Overview() {
  const [r, setR] = useState(null);
  useEffect(() => { api('/admin/reports').then(setR); }, []);
  if (!r) return <Loading label="Building reports" />;
  const t = r.totals;
  return (
    <>
      <div className="stats">
        <div className="stat"><span className="stat-value">{t.users}</span><span className="stat-label">Registered users</span></div>
        <div className="stat stat-good"><span className="stat-value">{t.live}</span><span className="stat-label">Live listings</span></div>
        <Link to="/admin?tab=moderation" className="stat stat-warn"><span className="stat-value">{t.pending}</span><span className="stat-label">Waiting for review</span></Link>
        <Link to="/admin?tab=flags" className={`stat${t.openFlags ? ' stat-alert' : ''}`}><span className="stat-value">{t.openFlags}</span><span className="stat-label">Open reports</span></Link>
        <div className="stat"><span className="stat-value">{t.enquiries}</span><span className="stat-label">Enquiries</span></div>
        <div className="stat"><span className="stat-value">{t.responseRate}%</span><span className="stat-label">Enquiries answered</span></div>
        <div className="stat"><span className="stat-value">{formatNumber(t.views)}</span><span className="stat-label">Listing views</span></div>
      </div>
      <div className="report-grid">
        <Bars title="Live listings by city" rows={r.listingsByCity} />
        <Bars title="Live listings by type" rows={r.listingsByType} labels={TYPE_LABELS} />
        <Bars title="All listings by status" rows={r.listingsByStatus} labels={STATUS_LABELS} />
        <Bars title="Users by account type" rows={r.usersByRole} labels={ROLE_LABELS} />
        <Week title="New listings, last 7 days" rows={r.newListings} />
        <Week title="New enquiries, last 7 days" rows={r.newEnquiries} />
        <div className="card report-card">
          <h3>Most viewed listings</h3>
          <ol className="top-list">
            {r.topViewed.map((p) => <li key={p.id}><Link to={`/properties/${p.id}`}>{p.title}</Link><span className="muted small">{p.city}, {formatNumber(p.views)} views</span></li>)}
          </ol>
        </div>
      </div>
    </>
  );
}

const MOD_FILTERS = [['pending', 'Pending'], ['duplicate', 'Possible duplicates'], ['approved', 'Live'], ['rejected', 'Rejected'], ['', 'All']];

function Moderation() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => api('/admin/properties', { query: { status } }).then(setData), [status]);
  useEffect(() => { setData(null); load(); }, [load]);

  async function act(p, action) {
    try {
      await api(`/admin/properties/${p.id}`, { method: 'PATCH', body: action === 'reject' ? { action, reason } : { action } });
      toast(action === 'approve' ? `Approved "${p.title}". The owner has been notified.` : 'Listing rejected. The owner has been notified.');
      setRejecting(null);
      setReason('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <>
      <div className="chips filter-row">
        {MOD_FILTERS.map(([v, l]) => (
          <button key={l} type="button" className={`chip${status === v ? ' on' : ''}`} onClick={() => setStatus(v)}>
            {l}{data && v && data.counts[v] !== undefined ? ` (${data.counts[v]})` : ''}
          </button>
        ))}
      </div>
      {!data ? <Loading /> : data.items.length === 0 ? (
        <p className="empty small-empty">Nothing here. {status === 'pending' ? 'All submitted listings have been reviewed.' : ''}</p>
      ) : (
        <ul className="mod-list">
          {data.items.map((p) => (
            <li key={p.id} className="card mod-item">
              <div className="mod-main">
                {p.coverImage ? <img src={p.coverImage} alt="" /> : <span className="thumb-empty big" />}
                <div className="mod-text">
                  <div className="row wrap">
                    <StatusBadge status={p.status} />
                    {p.isDuplicateSuspect && p.status === 'pending' && (
                      <span className="badge badge-duplicate">Possible duplicate of <Link to={`/properties/${p.duplicateOf}`}>#{p.duplicateOf}</Link></span>
                    )}
                    {p.openFlags > 0 && <span className="badge badge-rejected">{p.openFlags} open report{p.openFlags > 1 ? 's' : ''}</span>}
                  </div>
                  <Link to={`/properties/${p.id}`} className="mod-title">#{p.id} {p.title}</Link>
                  <p className="small">{formatPrice(p.price, p.listingType)}, {TYPE_LABELS[p.propertyType]}, {formatNumber(p.areaSqft)} sq ft, {p.locality}, {p.city}</p>
                  <p className="muted small">By {p.owner.name} ({ROLE_LABELS[p.owner.role]}), submitted {timeAgo(p.createdAt)}</p>
                  {p.status === 'rejected' && <p className="error-text small">Reason: {p.rejectionReason}</p>}
                </div>
                <div className="actions vertical">
                  {['pending', 'rejected'].includes(p.status) && <button type="button" className="btn btn-success btn-sm" onClick={() => act(p, 'approve')}>Approve</button>}
                  {['pending', 'approved'].includes(p.status) && (
                    <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => { setRejecting(rejecting === p.id ? null : p.id); setReason(p.isDuplicateSuspect ? `Duplicate of listing #${p.duplicateOf}.` : ''); }}>
                      {p.status === 'approved' ? 'Take down' : 'Reject'}
                    </button>
                  )}
                </div>
              </div>
              {rejecting === p.id && (
                <form className="reject-form" onSubmit={(e) => { e.preventDefault(); act(p, 'reject'); }}>
                  <label htmlFor={`reason-${p.id}`}>Reason shown to the owner</label>
                  <input id={`reason-${p.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: photos do not match the address" autoFocus />
                  <button type="submit" className="btn btn-danger btn-sm" disabled={!reason.trim()}>Confirm</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Flags() {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const [items, setItems] = useState(null);
  const load = useCallback(() => api('/admin/flags', { query: { status } }).then((d) => setItems(d.items)), [status]);
  useEffect(() => { setItems(null); load(); }, [load]);

  async function act(f, action) {
    try {
      const d = await api(`/admin/flags/${f.id}`, { method: 'PATCH', body: { action } });
      toast(d.message);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <>
      <div className="chips filter-row">
        {[['open', 'Open'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']].map(([v, l]) => (
          <button key={v} type="button" className={`chip${status === v ? ' on' : ''}`} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>
      {!items ? <Loading /> : items.length === 0 ? <p className="empty small-empty">No {status} reports.</p> : (
        <ul className="mod-list">
          {items.map((f) => (
            <li key={f.id} className="card mod-item">
              <div className="mod-main">
                <div className="mod-text">
                  <span className="badge badge-rejected">{FLAG_LABELS[f.reason]}</span>
                  <Link to={`/properties/${f.property.id}`} className="mod-title">#{f.property.id} {f.property.title}</Link>
                  <p className="small">{f.property.locality}, {f.property.city}. Listed by {f.property.ownerName}. Listing is {STATUS_LABELS[f.property.status].toLowerCase()}.</p>
                  {f.details && <blockquote className="quote">{f.details}</blockquote>}
                  <p className="muted small">Reported by {f.reporter}, {timeAgo(f.createdAt)}</p>
                </div>
                {f.status === 'open' && (
                  <div className="actions vertical">
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => act(f, 'resolve')}>Take listing down</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(f, 'dismiss')}>Dismiss report</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Users() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const load = useCallback(() => api('/admin/users').then((d) => setItems(d.items)), []);
  useEffect(() => { load(); }, [load]);

  async function toggle(u) {
    try {
      await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { isActive: !u.isActive } });
      toast(u.isActive ? `${u.name} suspended.` : `${u.name} reactivated.`);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (!items) return <Loading />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Account type</th><th>City</th><th>Listings</th><th>Joined</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {items.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{ROLE_LABELS[u.role]}</td>
              <td>{u.city || '—'}</td>
              <td>{u.listings}</td>
              <td className="nowrap">{formatDate(u.createdAt)}</td>
              <td>{u.isActive ? <span className="badge badge-approved">Active</span> : <span className="badge badge-rejected">Suspended</span>}</td>
              <td>{u.role !== 'admin' && <button type="button" className={`btn btn-ghost btn-sm${u.isActive ? ' danger' : ''}`} onClick={() => toggle(u)}>{u.isActive ? 'Suspend' : 'Reactivate'}</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
