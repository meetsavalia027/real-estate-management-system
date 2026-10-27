import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PropertyCard from '../components/PropertyCard';
import Icon from '../components/Icon';
import { isProvider } from '../utils/format';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('sale');
  const [city, setCity] = useState('');
  const [q, setQ] = useState('');
  const [cities, setCities] = useState([]);
  const [latest, setLatest] = useState([]);

  useEffect(() => {
    api('/properties/meta/cities').then((d) => setCities(d.cities)).catch(() => {});
    api('/properties', { query: { limit: 8, sort: 'newest' } }).then((d) => setLatest(d.items)).catch(() => {});
  }, []);

  function submit(e) {
    e.preventDefault();
    const params = new URLSearchParams({ listingType: mode });
    if (city) params.set('city', city);
    if (q.trim()) params.set('q', q.trim());
    navigate(`/properties?${params}`);
  }

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
          <h1>Every listing here is checked before it goes live.</h1>
          <p className="hero-sub">
            Search homes, offices and plots across Indian cities, shortlist the ones you like,
            and talk directly to owners, agents and builders.
          </p>

          <form className="search-console" onSubmit={submit} role="search">
            <div className="segmented" role="tablist" aria-label="Buy or rent">
              {[['sale', 'Buy'], ['rent', 'Rent']].map(([v, l]) => (
                <button key={v} type="button" role="tab" aria-selected={mode === v} className={mode === v ? 'on' : ''} onClick={() => setMode(v)}>{l}</button>
              ))}
            </div>
            <div className="console-row">
              <label className="sr-only" htmlFor="home-city">City</label>
              <select id="home-city" value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">All cities</option>
                {cities.map((c) => <option key={c.city} value={c.city}>{c.city}</option>)}
              </select>
              <label className="sr-only" htmlFor="home-q">Locality or project</label>
              <input id="home-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Locality, project or keyword, e.g. Vesu" />
              <button type="submit" className="btn btn-accent"><Icon name="search" /> Search</button>
            </div>
          </form>

          {cities.length > 0 && (
            <div className="city-chips" aria-label="Browse by city">
              {cities.map((c) => (
                <Link key={c.city} to={`/properties?city=${encodeURIComponent(c.city)}`} className="chip-link">
                  {c.city} <span>{c.listings}</span>
                </Link>
              ))}
            </div>
          )}
          </div>
          <BlueprintDrawing />
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>Newly listed</h2>
          <Link to="/properties" className="link">See all listings</Link>
        </div>
        <div className="grid">
          {latest.map((p) => <PropertyCard key={p.id} property={p} />)}
        </div>
      </section>

      <section className="container section">
        <div className="how">
          <div>
            <h3>Looking for a home</h3>
            <p>Filter by budget, bedrooms and area, save listings to your shortlist and send enquiries without sharing your number publicly.</p>
            <Link to="/properties" className="btn btn-primary">Start searching</Link>
          </div>
          <div>
            <h3>Have a property to sell or rent</h3>
            <p>Owners, agents and builders can post listings with photos. Our team reviews each one, and you manage every enquiry from one dashboard.</p>
            {isProvider(user)
              ? <Link to="/post-property" className="btn btn-accent">Post a property</Link>
              : !user && <Link to="/register?role=owner" className="btn btn-accent">Create an owner account</Link>}
          </div>
        </div>
      </section>
    </>
  );
}

/** Decorative front-elevation drawing, in the style of an architect's blueprint. */
function BlueprintDrawing() {
  return (
    <svg className="hero-drawing" viewBox="0 0 420 390" aria-hidden="true">
      <g fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth="1.6" strokeLinejoin="round">
        <line x1="20" y1="300" x2="400" y2="300" />
        <polyline points="55,150 210,58 365,150" />
        <polyline points="290,105 290,72 312,72 312,118" />
        <rect x="70" y="150" width="280" height="150" />
        <line x1="70" y1="226" x2="350" y2="226" strokeDasharray="5 5" />
        <rect x="100" y="168" width="58" height="40" /><line x1="129" y1="168" x2="129" y2="208" />
        <rect x="181" y="168" width="58" height="40" /><line x1="210" y1="168" x2="210" y2="208" />
        <rect x="262" y="168" width="58" height="40" /><line x1="291" y1="168" x2="291" y2="208" />
        <rect x="100" y="246" width="58" height="36" /><line x1="129" y1="246" x2="129" y2="282" />
        <rect x="262" y="246" width="58" height="36" /><line x1="291" y1="246" x2="291" y2="282" />
        <rect x="188" y="240" width="44" height="60" /><circle cx="224" cy="272" r="2" />
        <line x1="170" y1="300" x2="250" y2="300" strokeWidth="3" />
      </g>
      <g stroke="#E9A20A" strokeWidth="1.3" fill="none">
        <line x1="70" y1="330" x2="350" y2="330" />
        <line x1="70" y1="322" x2="70" y2="338" /><line x1="350" y1="322" x2="350" y2="338" />
        <line x1="388" y1="150" x2="388" y2="300" />
        <line x1="380" y1="150" x2="396" y2="150" /><line x1="380" y1="300" x2="396" y2="300" />
        <line x1="388" y1="58" x2="388" y2="150" strokeDasharray="3 4" />
      </g>
      <g fill="#E9A20A" fontFamily="var(--body)" fontSize="13" fontWeight="600">
        <text x="210" y="352" textAnchor="middle">12.0 m</text>
        <text x="404" y="228" transform="rotate(90 404 228)" textAnchor="middle">6.4 m</text>
      </g>
      <text x="20" y="382" fill="rgba(255,255,255,0.55)" fontFamily="var(--body)" fontSize="12">Front elevation, scale 1:100</text>
    </svg>
  );
}
