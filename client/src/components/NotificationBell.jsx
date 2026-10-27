import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { timeAgo } from '../utils/format';
import Icon from './Icon';

const POLL_MS = 15000;

/** Increment 4 — in-app notifications with unread count. */
export default function NotificationBell() {
  const [data, setData] = useState({ unread: 0, items: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const load = useCallback(() => api('/notifications').then(setData).catch(() => {}), []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { load(); setOpen(false); }, [location.pathname, load]);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function openItem(n) {
    if (!n.isRead) await api(`/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {});
    setOpen(false);
    if (n.link) navigate(n.link);
    load();
  }

  async function readAll() {
    await api('/notifications/read-all', { method: 'POST' });
    load();
  }

  return (
    <div className="bell" ref={ref}>
      <button type="button" className="icon-btn" aria-label={`Notifications, ${data.unread} unread`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="bell" size={20} />
        {data.unread > 0 && <span className="bell-count">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div className="dropdown bell-panel">
          <div className="bell-head">
            <strong>Notifications</strong>
            {data.unread > 0 && <button type="button" className="link-btn" onClick={readAll}>Mark all as read</button>}
          </div>
          {data.items.length === 0 && <p className="muted small pad">You have no notifications yet.</p>}
          <ul>
            {data.items.map((n) => (
              <li key={n.id}>
                <button type="button" className={`note${n.isRead ? '' : ' unread'}`} onClick={() => openItem(n)}>
                  <span>{n.message}</span>
                  <small className="muted">{timeAgo(n.createdAt)}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
