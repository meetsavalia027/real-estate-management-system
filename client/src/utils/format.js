/** Formatting helpers using Indian conventions (lakh / crore). */
const trim = (n) => Number(n.toFixed(2)).toString();

export function formatPrice(price, listingType) {
  let text;
  if (price >= 10000000) text = `₹${trim(price / 10000000)} Cr`;
  else if (price >= 100000) text = `₹${trim(price / 100000)} L`;
  else text = `₹${price.toLocaleString('en-IN')}`;
  return listingType === 'rent' ? `${text}/month` : text;
}

export const formatNumber = (n) => Number(n || 0).toLocaleString('en-IN');
export const formatArea = (a) => `${formatNumber(a)} sq ft`;

export function pricePerSqft(p) {
  if (p.listingType !== 'sale' || !p.areaSqft) return null;
  return `₹${formatNumber(Math.round(p.price / p.areaSqft))} per sq ft`;
}

/** Parse SQLite "YYYY-MM-DD HH:MM:SS" (UTC) into a Date. */
export const toDate = (s) => new Date(`${String(s).replace(' ', 'T')}Z`);

export function timeAgo(s) {
  const sec = Math.max(1, Math.round((Date.now() - toDate(s).getTime()) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day > 1 ? 's' : ''} ago`;
  return toDate(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const formatDate = (s) => toDate(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export const ROLE_LABELS = {
  buyer: 'Buyer', tenant: 'Tenant', owner: 'Owner / Landlord', agent: 'Agent', builder: 'Builder / Developer', admin: 'Administrator',
};
export const TYPE_LABELS = { apartment: 'Apartment', house: 'Independent house', villa: 'Villa', plot: 'Plot', office: 'Office space', shop: 'Shop' };
export const FURNISH_LABELS = { unfurnished: 'Unfurnished', 'semi-furnished': 'Semi-furnished', furnished: 'Furnished' };
export const STATUS_LABELS = { pending: 'Pending review', approved: 'Live', rejected: 'Rejected', sold: 'Sold', rented: 'Rented', open: 'Awaiting reply', replied: 'Replied', closed: 'Closed' };
export const FLAG_LABELS = { fake: 'Fake or fraudulent', duplicate: 'Duplicate listing', wrong_info: 'Wrong price or details', not_available: 'No longer available', other: 'Other' };

export const PROVIDER_ROLES = ['owner', 'agent', 'builder'];
export const SEEKER_ROLES = ['buyer', 'tenant'];
export const isProvider = (u) => !!u && PROVIDER_ROLES.includes(u.role);

export function bedsLabel(p) {
  if (['plot', 'office', 'shop'].includes(p.propertyType)) return TYPE_LABELS[p.propertyType];
  return `${p.bedrooms} BHK`;
}
