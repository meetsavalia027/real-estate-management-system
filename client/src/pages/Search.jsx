import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import PropertyCard from '../components/PropertyCard';
import Pagination from '../components/Pagination';
import Loading from '../components/Loading';
import Icon from '../components/Icon';
import { formatNumber, TYPE_LABELS, FURNISH_LABELS } from '../utils/format';

const SALE_BUDGETS = [2000000, 5000000, 7500000, 10000000, 20000000, 50000000];
const RENT_BUDGETS = [10000, 20000, 30000, 50000, 100000, 300000];
const budgetLabel = (v) => (v >= 10000000 ? `₹${v / 10000000} Cr` : v >= 100000 ? `₹${v / 100000} L` : `₹${formatNumber(v)}`);
const FILTER_KEYS = ['listingType', 'propertyType', 'city', 'locality', 'minPrice', 'maxPrice', 'bedrooms', 'furnishing', 'minArea', 'maxArea', 'q'];

/** Increment 2 — search, advanced filters, sorting and pagination. */
export default function Search() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [cities, setCities] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [keyword, setKeyword] = useState(params.get('q') || '');

  const query = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const listingType = params.get('listingType') || '';
  const types = (params.get('propertyType') || '').split(',').filter(Boolean);
  const budgets = listingType === 'rent' ? RENT_BUDGETS : SALE_BUDGETS;

  useEffect(() => { api('/properties/meta/cities').then((d) => setCities(d.cities)).catch(() => {}); }, []);
  useEffect(() => {
    setError('');
    api('/properties', { query }).then(setData).catch((e) => setError(e.message));
  }, [query]);
  useEffect(() => { setKeyword(params.get('q') || ''); }, [params]);

  function update(changes, resetPage = true) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v === '' || v === null || v === undefined ? next.delete(k) : next.set(k, v)));
    if (resetPage) next.delete('page');
    setParams(next);
  }
  function toggleType(t) {
    const set = new Set(types);
    if (set.has(t)) set.delete(t); else set.add(t);
    update({ propertyType: [...set].join(',') });
  }
  const activeFilters = FILTER_KEYS.filter((k) => params.get(k)).length;

  return (
    <div className="container search-page">
      <div className="search-top">
        <form className="keyword" onSubmit={(e) => { e.preventDefault(); update({ q: keyword.trim() }); }} role="search">
          <Icon name="search" />
          <label className="sr-only" htmlFor="kw">Search listings</label>
          <input id="kw" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Search by locality, project or keyword" />
          <button type="submit" className="btn btn-primary btn-sm">Search</button>
        </form>
        <button type="button" className="btn btn-ghost filters-toggle" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
          <Icon name="filter" /> Filters{activeFilters ? ` (${activeFilters})` : ''}
        </button>
      </div>

      <div className="search-layout">
        <aside className={`filters${showFilters ? ' open' : ''}`} aria-label="Filters">
          <div className="filter-block">
            <h3>Looking to</h3>
            <div className="segmented small">
              {[['', 'All'], ['sale', 'Buy'], ['rent', 'Rent']].map(([v, l]) => (
                <button key={l} type="button" className={listingType === v ? 'on' : ''} onClick={() => update({ listingType: v, minPrice: '', maxPrice: '' })}>{l}</button>
              ))}
            </div>
          </div>

          <div className="filter-block">
            <h3>Property type</h3>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <label key={v} className="check">
                <input type="checkbox" checked={types.includes(v)} onChange={() => toggleType(v)} /> {l}
              </label>
            ))}
          </div>

          <div className="filter-block">
            <h3><label htmlFor="f-city">City</label></h3>
            <select id="f-city" value={params.get('city') || ''} onChange={(e) => update({ city: e.target.value })}>
              <option value="">All cities</option>
              {cities.map((c) => <option key={c.city} value={c.city}>{c.city} ({c.listings})</option>)}
            </select>
            <label htmlFor="f-loc" className="sub-label">Locality</label>
            <input id="f-loc" defaultValue={params.get('locality') || ''} key={params.get('locality') || 'loc'}
              placeholder="e.g. Satellite" onBlur={(e) => update({ locality: e.target.value.trim() })}
              onKeyDown={(e) => { if (e.key === 'Enter') update({ locality: e.target.value.trim() }); }} />
          </div>

          <div className="filter-block">
            <h3>Budget {listingType === 'rent' ? '(per month)' : ''}</h3>
            <div className="pair">
              <select aria-label="Minimum budget" value={params.get('minPrice') || ''} onChange={(e) => update({ minPrice: e.target.value })}>
                <option value="">No min</option>
                {budgets.map((b) => <option key={b} value={b}>{budgetLabel(b)}</option>)}
              </select>
              <select aria-label="Maximum budget" value={params.get('maxPrice') || ''} onChange={(e) => update({ maxPrice: e.target.value })}>
                <option value="">No max</option>
                {budgets.map((b) => <option key={b} value={b}>{budgetLabel(b)}</option>)}
              </select>
            </div>
          </div>

          <div className="filter-block">
            <h3>Bedrooms</h3>
            <div className="chips">
              {[['', 'Any'], ['1', '1 BHK'], ['2', '2 BHK'], ['3', '3 BHK'], ['4', '4+ BHK']].map(([v, l]) => (
                <button key={l} type="button" className={`chip${(params.get('bedrooms') || '') === v ? ' on' : ''}`} onClick={() => update({ bedrooms: v })}>{l}</button>
              ))}
            </div>
          </div>

          <div className="filter-block">
            <h3>Area (sq ft)</h3>
            <div className="pair">
              <input type="number" min="0" aria-label="Minimum area" placeholder="Min" defaultValue={params.get('minArea') || ''} key={`min${params.get('minArea')}`}
                onBlur={(e) => update({ minArea: e.target.value })} />
              <input type="number" min="0" aria-label="Maximum area" placeholder="Max" defaultValue={params.get('maxArea') || ''} key={`max${params.get('maxArea')}`}
                onBlur={(e) => update({ maxArea: e.target.value })} />
            </div>
          </div>

          <div className="filter-block">
            <h3><label htmlFor="f-furn">Furnishing</label></h3>
            <select id="f-furn" value={params.get('furnishing') || ''} onChange={(e) => update({ furnishing: e.target.value })}>
              <option value="">Any</option>
              {Object.entries(FURNISH_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          {activeFilters > 0 && <button type="button" className="btn btn-ghost full" onClick={() => setParams({})}>Clear all filters</button>}
        </aside>

        <section className="results">
          <div className="results-head">
            <p>{data ? <><strong>{formatNumber(data.total)}</strong> {data.total === 1 ? 'property' : 'properties'} found</> : ' '}</p>
            <label className="sort">
              Sort by
              <select value={params.get('sort') || 'newest'} onChange={(e) => update({ sort: e.target.value })}>
                <option value="newest">Newest first</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="area_desc">Largest area</option>
                <option value="popular">Most viewed</option>
              </select>
            </label>
          </div>

          {error && <p className="alert alert-error">{error}</p>}
          {!data && !error && <Loading label="Finding properties" />}
          {data && data.items.length === 0 && (
            <div className="empty">
              <h2>No properties match these filters</h2>
              <p>Try a wider budget, another city or fewer filters.</p>
              <button type="button" className="btn btn-primary" onClick={() => setParams({})}>Clear all filters</button>
            </div>
          )}
          {data && data.items.length > 0 && (
            <>
              <div className="grid">{data.items.map((p) => <PropertyCard key={p.id} property={p} />)}</div>
              <Pagination page={data.page} pages={data.pages} onChange={(n) => { update({ page: n }, false); window.scrollTo({ top: 0 }); }} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
