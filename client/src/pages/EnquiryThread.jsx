import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import Loading from '../components/Loading';
import StatusBadge from '../components/StatusBadge';
import Icon from '../components/Icon';
import { formatPrice, ROLE_LABELS, timeAgo } from '../utils/format';

/** Increment 3 — conversation between a seeker and the listing owner. */
export default function EnquiryThread() {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  const load = useCallback(() => api(`/enquiries/${id}`).then(setData).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [data]);

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/enquiries/${id}/messages`, { method: 'POST', body: { message: reply } });
      setReply('');
      await load();
    } catch (err) {
      toast(err.fields?.message || err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    await api(`/enquiries/${id}/close`, { method: 'PATCH' });
    toast('Enquiry closed.');
    load();
  }

  if (error) return <div className="container narrow"><p className="alert alert-error">{error}</p><Link to="/enquiries">Back to enquiries</Link></div>;
  if (!data) return <Loading />;
  const { enquiry: e, otherParty: o, messages } = data;

  return (
    <div className="container narrow thread-page">
      <Link to="/enquiries" className="link back"><Icon name="chevronLeft" size={16} /> All enquiries</Link>

      <div className="card thread-head">
        {e.property.coverImage && <img src={e.property.coverImage} alt="" />}
        <div>
          <Link to={`/properties/${e.property.id}`} className="thread-title">{e.property.title}</Link>
          <p className="muted small">{e.property.locality}, {e.property.city}, {formatPrice(e.property.price, e.property.listingType)}</p>
          <StatusBadge status={e.status} />
        </div>
        <div className="thread-contact">
          <strong>{o.name}</strong>
          <span className="muted small">{ROLE_LABELS[o.role]}</span>
          {o.phone && <a href={`tel:${o.phone}`}><Icon name="phone" size={14} /> {o.phone}</a>}
          <a href={`mailto:${o.email}`}><Icon name="mail" size={14} /> {o.email}</a>
        </div>
      </div>

      <ol className="messages">
        {messages.map((m) => (
          <li key={m.id} className={`msg${m.mine ? ' mine' : ''}`}>
            <p>{m.body}</p>
            <small>{m.mine ? 'You' : m.senderName}, {timeAgo(m.createdAt)}</small>
          </li>
        ))}
        <li ref={endRef} aria-hidden="true" />
      </ol>

      {e.status === 'closed' ? (
        <p className="muted center">This enquiry is closed.</p>
      ) : (
        <form className="reply-box" onSubmit={send}>
          <label htmlFor="reply" className="sr-only">Your reply</label>
          <textarea id="reply" rows="3" value={reply} onChange={(ev) => setReply(ev.target.value)} placeholder="Write a reply" maxLength={1000} />
          <div className="row between">
            <button type="button" className="btn btn-ghost btn-sm" onClick={close}>Close enquiry</button>
            <button type="submit" className="btn btn-primary" disabled={busy || reply.trim().length < 5}>{busy ? 'Sending…' : 'Send reply'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
