import { useEffect, useState } from 'react';
import { api } from '../api';
import Badge from './Badge';
import Mensaje from './Mensaje';

function monto(v) {
  if (v === null || v === undefined) return '-';
  return Number(v).toFixed(2);
}

export default function DetalleReserva({ id, onCerrar }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .get(`/reservas/${id}/detalle`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onCerrar}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Reserva #{id}</h2>
          <button onClick={onCerrar} className="text-gray-500 hover:text-gray-800 text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="p-6 space-y-6">
          <Mensaje error={error} />
          {!data && !error && <p className="text-sm text-gray-500">Cargando...</p>}

          {data && (
            <>
              <div>
                <h3 className="font-semibold mb-2">Datos de la reserva</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {Object.entries(data.reserva).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <dt className="text-gray-500">{k}:</dt>
                      <dd className="text-gray-800">
                        {k === 'estado' ? <Badge estado={v} /> : v === null ? '-' : String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Facturas</h3>
                {data.facturas.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin facturas.</p>
                ) : (
                  <table className="min-w-full text-sm border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left border-b">Id factura</th>
                        <th className="px-3 py-2 text-left border-b">Total</th>
                        <th className="px-3 py-2 text-left border-b">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.facturas.map((f) => (
                        <tr key={f.id_factura}>
                          <td className="px-3 py-2 border-b">{f.id_factura}</td>
                          <td className="px-3 py-2 border-b">{monto(f.total)}</td>
                          <td className="px-3 py-2 border-b">
                            <Badge estado={f.estado} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="text-sm">
                Saldo pendiente: <span className="font-semibold">{monto(data.saldo)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
