const COLORES = {
  pendiente: 'bg-amber-100 text-amber-800',
  confirmada: 'bg-blue-100 text-blue-800',
  en_curso: 'bg-emerald-100 text-emerald-800',
  completada: 'bg-gray-200 text-gray-700',
  cancelada: 'bg-red-100 text-red-700',
  no_show: 'bg-red-100 text-red-700',
  pagada: 'bg-emerald-100 text-emerald-800',
  pagada_parcial: 'bg-amber-100 text-amber-800',
  disponible: 'bg-emerald-100 text-emerald-800',
  ocupada: 'bg-blue-100 text-blue-800',
  limpieza: 'bg-amber-100 text-amber-800',
  mantenimiento: 'bg-red-100 text-red-700',
};

export default function Badge({ estado }) {
  if (estado === null || estado === undefined || estado === '') return <span>-</span>;
  const cls = COLORES[estado] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {estado}
    </span>
  );
}
