import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Loading from '../components/Loading';
import PropertyCard from '../components/PropertyCard';
import StatusBadge from '../components/StatusBadge';
import { formatNumber, formatPrice, isProvider, ROLE_LABELS, timeAgo } from '../utils/format';

/** Increment 3 — role-specific dashboards. */
export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  return (
    <div className="container dash">
      <header className="page-head">
        <div>
          <h1>Hello, {user.name.split(' ')[0]}</h1>
          <p className="muted">{ROLE_LABELS[user.role]} dashboard</p>
        </div>
        {isProvider(user) && <Link to="/post-property" className="btn btn-accent">Post a property</Link>}
        {!isProvider(user) && <Link to="/properties" className="btn btn-primary">Search properties</Link>}
      </header>
      {isProvider(user) ? <ProviderDashboard /> : <SeekerDashboard />}
    </div>
  );
}

function Stat({ value, label, tone }) {
  return (
    <div className={`stat${tone ? ` stat-${tone}` : ''}`}>
      <span className="stat-value">{formatNumber(value)}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function SeekerDashboard() {
  const [stats, setStats] = useState(null);
  const [saved, setSaved] = useState(null);
  const [enquiries, setEnquiries] = useState(null);

  useEffect(() => {
    api('/dashboard').then((d) => setStats(d.stats));
    api('/favourites').then((d) => setSaved(d.items));
    api('/enquiries', { query: { box: 'sent' } }).then((d) => setEnquiries(d.items));
  }, []);

  if (!stats || !saved || !enquiries) return <Loading />;
  return (
    <>
      <div className="stats">
        <Stat value={stats.saved} label="Saved properties" />
        <Stat value={stats.enquiries} label="Enquiries sent" />
        <Stat value={stats.replied} label="Replies received" tone="good" />
      </div>

      <section className="section">
        <div className="section-head"><h2>My shortlist</h2></div>
        {saved.length === 0 ? (
          <div className="empty small-empty">
            <p>You have not saved any properties yet. Tap the heart on a listing to add it here.</p>
            <Link to="/properties" className="btn btn-primary">Browse properties</Link>
          </div>
        ) : (
          <div className="grid">
            {saved.map((p) => <PropertyCard key={p.id} property={p} showStatus={p.status !== 'approved'} onUnsave={(id) => setSaved(saved.filter((x) => x.id !== id))} />)}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head"><h2>Recent enquiries</h2><Link to="/enquiries" className="link">View all</Link></div>
        <EnquiryMiniList items={enquiries.slice(0, 5)} empty="You have not sent any enquiries yet." />
      </section>
    </>
  );
}

function ProviderDashboard() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState(null);
  const [received, setReceived] = useState(null);

  const load = useCallback(() => {
    api('/dashboard').then((d) => setStats(d.stats));
    api('/properties/mine').then((d) => setItems(d.items));
    api('/enquiries', { query: { box: 'received' } }).then((d) => setReceived(d.items));
  }, []);
  useEffect(load, [load]);

  async function setStatus(p, status) {
    try {
      await api(`/properties/${p.id}/status`, { method: 'PATCH', body: { status } });
      toast(status === 'approved' ? 'Listing is live again.' : `Marked as ${status}.`);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function remove(p) {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    try {
      await api(`/properties/${p.id}`, { method: 'DELETE' });
      toast('Listing deleted.');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (!stats || !items || !received) return <Loading />;
  return (
    <>
      <div className="stats">
        <Stat value={stats.live} label="Live listings" tone="good" />
        <Stat value={stats.pending} label="Waiting for review" tone="warn" />
        <Stat value={stats.views} label="Total views" />
        <Stat value={stats.awaitingReply} label="Enquiries awaiting your reply" tone={stats.awaitingReply ? 'alert' : ''} />
      </div>

      <section className="section">
        <div className="section-head"><h2>My listings</h2><span className="muted">{items.length} total</span></div>
        {items.length === 0 ? (
          <div className="empty small-empty">
            <p>You have no listings yet. Post your first property to start receiving enquiries.</p>
            <Link to="/post-property" className="btn btn-accent">Post a property</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Listing</th><th>Status</th><th>Price</th><th>Views</th><th>Enquiries</th><th>Saved</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="cell-listing">
                        {p.coverImage ? <img src={p.coverImage} alt="" /> : <span className="thumb-empty" />}
                        <div>
                          <Link to={`/properties/${p.id}`}>{p.title}</Link>
                          <span className="muted small">{p.locality}, {p.city}, posted {timeAgo(p.createdAt)}</span>
                          {p.status === 'rejected' && <span className="error-text small">Reason: {p.rejectionReason}</span>}
                        </div>
                      </div>
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td className="nowrap">{formatPrice(p.price, p.listingType)}</td>
                    <td>{formatNumber(p.views)}</td>
                    <td>{p.enquiryCount}</td>
                    <td>{p.savedCount}</td>
                    <td>
                      <div className="actions">
                        <Link to={`/properties/${p.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
                        {p.status === 'approved' && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(p, p.listingType === 'sale' ? 'sold' : 'rented')}>
                            Mark {p.listingType === 'sale' ? 'sold' : 'rented'}
                          </button>
                        )}
                        {['sold', 'rented'].includes(p.status) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(p, 'approved')}>Relist</button>}
                        <button type="button" className="btn btn-ghost btn-sm danger" onClick={() => remove(p)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head"><h2>Enquiries received</h2><Link to="/enquiries?box=received" className="link">View all</Link></div>
        <EnquiryMiniList items={received.slice(0, 5)} received empty="No enquiries yet. They will appear here when someone contacts you about a listing." />
      </section>
    </>
  );
}

export function EnquiryMiniList({ items, received = false, empty }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="enquiry-list">
      {items.map((e) => (
        <li key={e.id}>
          <Link to={`/enquiries/${e.id}`} className={`enquiry-row${received && e.status === 'open' ? ' needs-reply' : ''}`}>
            {e.property.coverImage ? <img src={e.property.coverImage} alt="" /> : <span className="thumb-empty" />}
            <div className="enquiry-text">
              <strong>{e.property.title}</strong>
              <span className="muted small">{received ? `From ${e.sender.name}` : `To ${e.receiver.name}`}, {timeAgo(e.updatedAt)}</span>
              <span className="last-msg">{e.lastMessage}</span>
            </div>
            <StatusBadge status={e.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
