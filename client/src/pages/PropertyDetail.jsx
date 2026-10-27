import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Icon from '../components/Icon';
import Loading from '../components/Loading';
import PropertyCard from '../components/PropertyCard';
import StatusBadge from '../components/StatusBadge';
import {
  bedsLabel, formatArea, formatDate, formatPrice, formatNumber, FLAG_LABELS, FURNISH_LABELS, pricePerSqft, ROLE_LABELS, TYPE_LABELS,
} from '../utils/format';

/** Increment 2 — property details with image gallery. Increment 3/4 — enquiry, shortlist, report. */
export default function PropertyDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);

  const load = useCallback(() => {
    api(`/properties/${id}`).then((d) => { setData(d); setActive(0); }).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => { setData(null); setError(''); load(); window.scrollTo({ top: 0 }); }, [load]);

  if (error) {
    return (
      <div className="container narrow empty">
        <h1>Listing not available</h1>
        <p>{error} It may have been sold, rented or removed.</p>
        <Link to="/properties" className="btn btn-primary">Browse other listings</Link>
      </div>
    );
  }
  if (!data) return <Loading />;

  const p = data.property;
  const images = p.images || [];
  const isOwner = user && user.id === p.ownerId;
  const isAdmin = user && user.role === 'admin';
  const canInteract = user && !isOwner && !isAdmin && p.status === 'approved';

  async function toggleSave() {
    if (!user) { navigate(`/login?next=/properties/${p.id}`); return; }
    try {
      await api(`/favourites/${p.id}`, { method: p.isFavourite ? 'DELETE' : 'POST' });
      toast(p.isFavourite ? 'Removed from shortlist.' : 'Added to your shortlist.');
      setData({ ...data, property: { ...p, isFavourite: !p.isFavourite } });
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  const facts = [
    ['Property type', TYPE_LABELS[p.propertyType]],
    ['Configuration', bedsLabel(p)],
    ['Built-up area', formatArea(p.areaSqft)],
    ['Bathrooms', p.bathrooms || '—'],
    ['Furnishing', p.propertyType === 'plot' ? '—' : FURNISH_LABELS[p.furnishing]],
    ['Posted on', formatDate(p.createdAt)],
  ];

  return (
    <div className="container detail-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/properties">Properties</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/properties?city=${encodeURIComponent(p.city)}`}>{p.city}</Link>
        <span aria-hidden="true">/</span>
        <span>{p.locality}</span>
      </nav>

      {(isOwner || isAdmin) && p.status !== 'approved' && (
        <div className={`alert ${p.status === 'rejected' ? 'alert-error' : 'alert-info'}`}>
          <StatusBadge status={p.status} />{' '}
          {p.status === 'pending' && 'This listing is waiting for an administrator to approve it. Only you can see it.'}
          {p.status === 'rejected' && <>Not approved: {p.rejectionReason} Edit the listing to send it for review again.</>}
          {['sold', 'rented'].includes(p.status) && 'This listing is closed and hidden from search.'}
        </div>
      )}

      <div className="detail-layout">
        <div className="detail-main">
          <div className="gallery">
            <div className="gallery-main">
              {images.length ? <img src={images[active].url} alt={`Photo ${active + 1} of ${p.title}`} /> : <div className="no-photo">No photos yet</div>}
              {images.length > 1 && (
                <>
                  <button type="button" className="gallery-nav prev" aria-label="Previous photo" onClick={() => setActive((active - 1 + images.length) % images.length)}><Icon name="chevronLeft" /></button>
                  <button type="button" className="gallery-nav next" aria-label="Next photo" onClick={() => setActive((active + 1) % images.length)}><Icon name="chevronRight" /></button>
                  <span className="gallery-count">{active + 1} / {images.length}</span>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="thumbs">
                {images.map((img, i) => (
                  <button key={img.id} type="button" className={i === active ? 'on' : ''} onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`}>
                    <img src={img.url} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <header className="detail-head">
            <div>
              <span className={`tag tag-${p.listingType} static`}>{p.listingType === 'rent' ? 'For rent' : 'For sale'}</span>
              <h1>{p.title}</h1>
              <p className="location"><Icon name="pin" size={16} />{p.address ? `${p.address}, ` : ''}{p.locality}, {p.city}</p>
            </div>
            <div className="detail-price">
              <p className="price big">{formatPrice(p.price, p.listingType)}</p>
              {pricePerSqft(p) && <p className="muted small">{pricePerSqft(p)}</p>}
            </div>
          </header>

          <dl className="facts">
            {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>

          <section className="block">
            <h2>About this property</h2>
            <p className="prose">{p.description || 'The owner has not added a description yet.'}</p>
            <p className="muted small"><Icon name="eye" size={15} /> Viewed {formatNumber(p.views)} times</p>
          </section>
        </div>

        <aside className="detail-side">
          <div className="card side-card">
            <h2>Listed by</h2>
            <p className="owner-name">{p.owner.name}</p>
            <p className="owner-role">{ROLE_LABELS[p.owner.role]}</p>
            <p className="muted small">{p.owner.activeListings} live listing{p.owner.activeListings === 1 ? '' : 's'}, member since {formatDate(p.owner.memberSince)}</p>
            {user ? (
              <ul className="contact">
                {p.owner.phone && <li><Icon name="phone" size={16} /><a href={`tel:${p.owner.phone}`}>{p.owner.phone}</a></li>}
                {p.owner.email && <li><Icon name="mail" size={16} /><a href={`mailto:${p.owner.email}`}>{p.owner.email}</a></li>}
              </ul>
            ) : (
              <p className="small"><Link to={`/login?next=/properties/${p.id}`}>Log in</Link> to see the phone number and email.</p>
            )}

            {isOwner && (
              <div className="stack">
                <Link to={`/properties/${p.id}/edit`} className="btn btn-primary full">Edit listing</Link>
                <Link to="/dashboard" className="btn btn-ghost full">Go to my listings</Link>
              </div>
            )}

            {!isOwner && !isAdmin && p.status === 'approved' && (
              <button type="button" className={`btn full ${p.isFavourite ? 'btn-saved' : 'btn-ghost'}`} onClick={toggleSave} aria-pressed={p.isFavourite}>
                <Icon name="heart" filled={p.isFavourite} /> {p.isFavourite ? 'Saved to shortlist' : 'Save to shortlist'}
              </button>
            )}
          </div>

          {canInteract && <EnquiryBox property={p} onSent={load} />}
          {!user && p.status === 'approved' && (
            <div className="card side-card">
              <h2>Interested?</h2>
              <p className="small">Create a free account to send an enquiry to the {ROLE_LABELS[p.owner.role].toLowerCase()}.</p>
              <Link to={`/login?next=/properties/${p.id}`} className="btn btn-accent full">Log in to send an enquiry</Link>
            </div>
          )}
          {canInteract && <ReportBox property={p} onReported={load} />}
        </aside>
      </div>

      {data.similar.length > 0 && (
        <section className="section">
          <h2>Similar properties in {p.city}</h2>
          <div className="grid">{data.similar.map((s) => <PropertyCard key={s.id} property={s} />)}</div>
        </section>
      )}
    </div>
  );
}

function EnquiryBox({ property, onSent }) {
  const toast = useToast();
  const [message, setMessage] = useState(`Hi, I am interested in "${property.title}". Is it still available? I would like to schedule a visit.`);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await api('/enquiries', { method: 'POST', body: { propertyId: property.id, message } });
      toast(d.message);
      onSent();
    } catch (err) {
      setError(err.fields?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card side-card" onSubmit={send}>
      <h2>Send an enquiry</h2>
      {property.myEnquiryId && (
        <p className="small">You have already contacted this {property.owner.role}. <Link to={`/enquiries/${property.myEnquiryId}`}>Open the conversation</Link></p>
      )}
      <label htmlFor="enq" className="sr-only">Message</label>
      <textarea id="enq" rows="5" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
      {error && <small className="error-text">{error}</small>}
      <button type="submit" className="btn btn-accent full" disabled={busy}>{busy ? 'Sending…' : 'Send enquiry'}</button>
    </form>
  );
}

function ReportBox({ property, onReported }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('fake');
  const [details, setDetails] = useState('');

  if (property.myFlag) {
    return <p className="muted small report-note"><Icon name="flag" size={14} /> You reported this listing ({FLAG_LABELS[property.myFlag.reason].toLowerCase()}). Status: {property.myFlag.status}.</p>;
  }

  async function submit(e) {
    e.preventDefault();
    try {
      const d = await api(`/properties/${property.id}/flag`, { method: 'POST', body: { reason, details } });
      toast(d.message);
      onReported();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  if (!open) {
    return <button type="button" className="link-btn report-link" onClick={() => setOpen(true)}><Icon name="flag" size={14} /> Report this listing</button>;
  }
  return (
    <form className="card side-card" onSubmit={submit}>
      <h2>Report this listing</h2>
      <label htmlFor="flag-reason" className="sub-label">What is wrong?</label>
      <select id="flag-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
        {Object.entries(FLAG_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <label htmlFor="flag-details" className="sub-label">Details (optional)</label>
      <textarea id="flag-details" rows="3" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Tell the admin what you noticed" />
      <div className="row">
        <button type="submit" className="btn btn-danger">Send report</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

