import Icon from './Icon';

export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i += 1) nums.push(i);
  return (
    <nav className="pagination" aria-label="Pages">
      <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <Icon name="chevronLeft" />
      </button>
      {nums.map((n) => (
        <button key={n} type="button" className={`page-num${n === page ? ' active' : ''}`} onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}>
          {n}
        </button>
      ))}
      <button type="button" className="btn btn-ghost" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <Icon name="chevronRight" />
      </button>
    </nav>
  );
}
