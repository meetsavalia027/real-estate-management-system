import { STATUS_LABELS } from '../utils/format';

export default function StatusBadge({ status, children }) {
  return <span className={`badge badge-${status}`}>{children || STATUS_LABELS[status] || status}</span>;
}
