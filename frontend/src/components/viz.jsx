export function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return new Intl.NumberFormat('es-MX').format(n);
}

export function fmtMoney(v) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return (
    '$' +
    new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  );
}

export function fmtTrimestre(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q} ${d.getUTCFullYear()}`;
}

export function fmtMes(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (!Number.isNaN(d.getTime()) && /^\d{4}-\d{2}/.test(String(v))) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return String(v);
}

const ACCENTS = {
  slate: 'text-slate-800',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  blue: 'text-blue-700',
  red: 'text-red-700',
};

export function StatCard({ label, value, sub, accent = 'slate' }) {
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${ACCENTS[accent] || ACCENTS.slate}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export function Rating({ value }) {
  const v = Number(value) || 0;
  const pct = Math.max(0, Math.min(100, (v / 5) * 100));
  const color = v >= 4 ? 'bg-emerald-500' : v >= 3 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold w-10 text-right tabular-nums">{v.toFixed(2)}</span>
    </div>
  );
}

export function Progress({ pct, color = 'bg-emerald-500' }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${color}`} style={{ width: `${p}%` }} />
    </div>
  );
}

export function BarList({ items, color = 'bg-slate-600', format }) {
  if (!items || items.length === 0) return <p className="text-sm text-gray-500">Sin datos.</p>;
  const max = Math.max(...items.map((i) => Number(i.value) || 0), 1);
  const fmt = format || ((x) => fmtNum(x));
  return (
    <div className="space-y-2">
      {items.map((it, i) => {
        const pct = ((Number(it.value) || 0) / max) * 100;
        return (
          <div key={i} className="flex items-center gap-3 text-sm">
            <div className="w-32 sm:w-40 truncate text-gray-700" title={String(it.label)}>
              {it.label}
            </div>
            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
              <div className={`h-full ${color} rounded`} style={{ width: `${pct}%` }} />
            </div>
            <div className="w-16 text-right font-semibold text-gray-800 tabular-nums">
              {fmt(it.value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
