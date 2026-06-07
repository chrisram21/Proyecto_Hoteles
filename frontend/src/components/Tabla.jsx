export default function Tabla({ datos }) {
  if (!datos || datos.length === 0) {
    return <p className="text-sm text-gray-500">Sin resultados.</p>;
  }
  const columnas = Object.keys(datos[0]);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border border-gray-200">
        <thead className="bg-gray-100">
          <tr>
            {columnas.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-semibold text-gray-700 border-b">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.map((fila, i) => (
            <tr key={i} className="odd:bg-white even:bg-gray-50">
              {columnas.map((c) => (
                <td key={c} className="px-3 py-2 border-b text-gray-800">
                  {formatear(fila[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatear(valor) {
  if (valor === null || valor === undefined) return '-';
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
}
