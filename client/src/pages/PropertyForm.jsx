import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Field from '../components/Field';
import Icon from '../components/Icon';
import Loading from '../components/Loading';
import { FURNISH_LABELS, formatPrice, TYPE_LABELS } from '../utils/format';

const EMPTY = {
  listing_type: 'sale', property_type: 'apartment', title: '', description: '', city: '', locality: '', address: '',
  price: '', area_sqft: '', bedrooms: '2', bathrooms: '2', furnishing: 'unfurnished',
};
const MAX_IMAGES = 8;

/** Increment 1 — property listing management (add, edit, image upload). */
export default function PropertyForm() {
  const { id } = useParams();
  const editing = !!id;
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...EMPTY, city: user.city || '' });
  const [existing, setExisting] = useState([]);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(!editing);

  useEffect(() => {
    if (!editing) return;
    api(`/properties/${id}`).then(({ property: p }) => {
      if (p.ownerId !== user.id) { navigate(`/properties/${id}`, { replace: true }); return; }
      setForm({
        listing_type: p.listingType, property_type: p.propertyType, title: p.title, description: p.description || '',
        city: p.city, locality: p.locality, address: p.address || '', price: String(p.price), area_sqft: String(p.areaSqft),
        bedrooms: String(p.bedrooms), bathrooms: String(p.bathrooms), furnishing: p.furnishing,
      });
      setExisting(p.images || []);
      setLoaded(true);
    }).catch((e) => setError(e.message));
  }, [editing, id, navigate, user.id]);

  // Clean up preview URLs
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.preview)), [files]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const noRooms = ['plot', 'office', 'shop'].includes(form.property_type);

  function addFiles(e) {
    const chosen = Array.from(e.target.files || []);
    e.target.value = '';
    const room = MAX_IMAGES - existing.length - files.length;
    const ok = chosen.filter((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) && f.size <= 5 * 1024 * 1024);
    if (ok.length < chosen.length) toast('Some files were skipped. Use JPG, PNG or WebP images up to 5 MB.', 'error');
    if (ok.length > room) toast(`A listing can have up to ${MAX_IMAGES} photos.`, 'error');
    setFiles([...files, ...ok.slice(0, Math.max(room, 0)).map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  }

  async function removeExisting(img) {
    try {
      const d = await api(`/properties/${id}/images/${img.id}`, { method: 'DELETE' });
      setExisting(d.images);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setErrors({});
    const data = { ...form };
    if (noRooms) { data.bedrooms = '0'; }
    if (form.property_type === 'plot') { data.bathrooms = '0'; data.furnishing = 'unfurnished'; }
    try {
      if (editing) {
        const res = await api(`/properties/${id}`, { method: 'PUT', body: data });
        if (files.length) {
          const fd = new FormData();
          files.forEach((f) => fd.append('images', f.file));
          await api(`/properties/${id}/images`, { method: 'POST', form: fd });
        }
        toast(res.message);
        navigate(`/properties/${id}`);
      } else {
        const fd = new FormData();
        Object.entries(data).forEach(([k, v]) => fd.append(k, v));
        files.forEach((f) => fd.append('images', f.file));
        const res = await api('/properties', { method: 'POST', form: fd });
        toast(res.message);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
      setErrors(err.fields || {});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return error ? <div className="container narrow"><p className="alert alert-error">{error}</p></div> : <Loading />;

  return (
    <div className="container narrow form-page">
      <header className="page-head">
        <div>
          <h1>{editing ? 'Edit listing' : 'Post a property'}</h1>
          <p className="muted">{editing ? 'Changes to a live listing are saved straight away.' : 'Your listing goes live after an administrator checks it, usually within a day.'}</p>
        </div>
      </header>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <form onSubmit={submit} noValidate>
        <section className="card form-card">
          <h2>Basic details</h2>
          <div className="field">
            <span className="label">I want to</span>
            <div className="segmented">
              {[['sale', 'Sell'], ['rent', 'Rent out']].map(([v, l]) => (
                <button key={v} type="button" className={form.listing_type === v ? 'on' : ''} onClick={() => setForm({ ...form, listing_type: v })}>{l}</button>
              ))}
            </div>
          </div>
          <div className="form-grid">
            <Field label="Property type" id="ptype" error={errors.property_type}>
              <select id="ptype" value={form.property_type} onChange={set('property_type')}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Title" id="title" error={errors.title} hint="For example: 2 BHK flat near Law Garden with parking">
              <input id="title" value={form.title} onChange={set('title')} maxLength={120} />
            </Field>
          </div>
        </section>

        <section className="card form-card">
          <h2>Location</h2>
          <div className="form-grid">
            <Field label="City" id="city" error={errors.city}><input id="city" value={form.city} onChange={set('city')} /></Field>
            <Field label="Locality" id="locality" error={errors.locality}><input id="locality" value={form.locality} onChange={set('locality')} /></Field>
          </div>
          <Field label="Address or society name (optional)" id="address"><input id="address" value={form.address} onChange={set('address')} /></Field>
        </section>

        <section className="card form-card">
          <h2>Price and size</h2>
          <div className="form-grid">
            <Field label={form.listing_type === 'rent' ? 'Monthly rent (₹)' : 'Expected price (₹)'} id="price" error={errors.price}
              hint={Number(form.price) >= 1000 ? `Shown as ${formatPrice(Number(form.price), form.listing_type)}` : undefined}>
              <input id="price" type="number" min="1000" inputMode="numeric" value={form.price} onChange={set('price')} />
            </Field>
            <Field label="Area (sq ft)" id="area" error={errors.area_sqft}>
              <input id="area" type="number" min="50" inputMode="numeric" value={form.area_sqft} onChange={set('area_sqft')} />
            </Field>
            {!noRooms && (
              <Field label="Bedrooms" id="beds" error={errors.bedrooms}>
                <select id="beds" value={form.bedrooms} onChange={set('bedrooms')}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} BHK</option>)}
                </select>
              </Field>
            )}
            {form.property_type !== 'plot' && (
              <Field label="Bathrooms" id="baths" error={errors.bathrooms}>
                <select id="baths" value={form.bathrooms} onChange={set('bathrooms')}>
                  {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
            )}
            {form.property_type !== 'plot' && (
              <Field label="Furnishing" id="furn" error={errors.furnishing}>
                <select id="furn" value={form.furnishing} onChange={set('furnishing')}>
                  {Object.entries(FURNISH_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            )}
          </div>
          <Field label="Description" id="desc" error={errors.description} hint="Mention amenities, nearby landmarks, parking and availability.">
            <textarea id="desc" rows="5" value={form.description} onChange={set('description')} maxLength={3000} />
          </Field>
        </section>

        <section className="card form-card">
          <h2>Photos</h2>
          <p className="muted small">Add up to {MAX_IMAGES} photos (JPG, PNG or WebP, up to 5 MB each). The first photo is used as the cover.</p>
          <div className="photo-grid">
            {existing.map((img) => (
              <figure key={img.id} className="photo">
                <img src={img.url} alt="" />
                <button type="button" aria-label="Remove photo" onClick={() => removeExisting(img)}><Icon name="x" size={14} /></button>
              </figure>
            ))}
            {files.map((f, i) => (
              <figure key={f.preview} className="photo new">
                <img src={f.preview} alt="" />
                <button type="button" aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
              </figure>
            ))}
            {existing.length + files.length < MAX_IMAGES && (
              <label className="photo add">
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addFiles} />
                <Icon name="plus" size={22} />
                <span>Add photos</span>
              </label>
            )}
          </div>
        </section>

        <div className="form-actions">
          <Link to={editing ? `/properties/${id}` : '/dashboard'} className="btn btn-ghost">Cancel</Link>
          <button type="submit" className="btn btn-accent" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Submit for review'}
          </button>
        </div>
      </form>
    </div>
  );
}
