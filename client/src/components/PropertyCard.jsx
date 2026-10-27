import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { bedsLabel, formatArea, formatPrice, FURNISH_LABELS, timeAgo } from '../utils/format';
import Icon from './Icon';
import StatusBadge from './StatusBadge';

export default function PropertyCard({ property: p, showStatus = false, onUnsave }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(!!p.isFavourite);
  const canSave = !user || (user.role !== 'admin' && user.id !== p.ownerId);

  async function toggleSave(e) {
    e.preventDefault();
    if (!user) { navigate(`/login?next=/properties/${p.id}`); return; }
    try {
      await api(`/favourites/${p.id}`, { method: saved ? 'DELETE' : 'POST' });
      setSaved(!saved);
      toast(saved ? 'Removed from shortlist.' : 'Added to your shortlist.');
      if (saved && onUnsave) onUnsave(p.id);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <article className="card property-card">
      <Link to={`/properties/${p.id}`} className="card-media">
        {p.coverImage ? <img src={p.coverImage} alt="" loading="lazy" /> : <div className="no-photo">No photos yet</div>}
        <span className={`tag tag-${p.listingType}`}>{p.listingType === 'rent' ? 'For rent' : 'For sale'}</span>
        {showStatus && <StatusBadge status={p.status} />}
      </Link>
      {canSave && p.status === 'approved' && (
        <button type="button" className={`save-btn${saved ? ' saved' : ''}`} onClick={toggleSave}
          aria-pressed={saved} aria-label={saved ? 'Remove from shortlist' : 'Add to shortlist'}>
          <Icon name="heart" filled={saved} />
        </button>
      )}
      <div className="card-body">
        <p className="price">{formatPrice(p.price, p.listingType)}</p>
        <h3 className="card-title"><Link to={`/properties/${p.id}`}>{p.title}</Link></h3>
        <p className="location"><Icon name="pin" size={15} />{p.locality}, {p.city}</p>
        <ul className="spec-strip">
          <li>{bedsLabel(p)}</li>
          <li>{formatArea(p.areaSqft)}</li>
        </ul>
        <p className="muted small card-foot">
          {p.propertyType !== 'plot' ? `${FURNISH_LABELS[p.furnishing]}, posted` : 'Posted'} {timeAgo(p.createdAt)}
        </p>
      </div>
    </article>
  );
}
