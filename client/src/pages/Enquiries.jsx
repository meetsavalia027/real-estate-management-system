import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Loading from '../components/Loading';
import { EnquiryMiniList } from './Dashboard';
import { isProvider } from '../utils/format';

/** Increment 3 — enquiry inbox (sent and received). */
export default function Enquiries() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const box = params.get('box') || (isProvider(user) ? 'received' : 'sent');
  const [items, setItems] = useState(null);

  useEffect(() => {
    setItems(null);
    api('/enquiries', { query: { box } }).then((d) => setItems(d.items));
  }, [box]);

  return (
    <div className="container narrow">
      <header className="page-head"><h1>Enquiries</h1></header>
      <div className="tabs" role="tablist">
        {[['received', 'Received'], ['sent', 'Sent']].map(([v, l]) => (
          <button key={v} type="button" role="tab" aria-selected={box === v} className={box === v ? 'on' : ''} onClick={() => setParams({ box: v })}>{l}</button>
        ))}
      </div>
      {!items ? <Loading /> : (
        <EnquiryMiniList
          items={items}
          received={box === 'received'}
          empty={box === 'received' ? 'Nobody has contacted you yet.' : 'You have not sent any enquiries yet. Open a listing and use "Send an enquiry".'}
        />
      )}
    </div>
  );
}
