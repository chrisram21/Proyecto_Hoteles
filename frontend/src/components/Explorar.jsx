import { useEffect, useState } from 'react';
import { api } from '../api';
import Badge from './Badge';
import Mensaje from './Mensaje';
import DetalleReserva from './DetalleReserva';

const TABS = [
  { id: 'reservas', label: 'Reservas' },
  { id: 'habitaciones', label: 'Habitaciones' },
  { id: 'huespedes', label: 'Huespedes' },
  { id: 'facturas', label: 'Facturas' },
];

const ESTADOS_RESERVA = [
  'pendiente',
  'confirmada',
  'en_curso',
  'completada',
  'cancelada',
  'no_show',
];

function fecha(v) {
  if (!v) return '-';
  return String(v).slice(0, 10);
}

function monto(v) {
  if (v === null || v === undefined) return '-';
  return Number(v).toFixed(2);
}

export default function Explorar({ onCheckout, onPago }) {
  const [tab, setTab] = useState('reservas');
  const [datos, setDatos] = useState([]);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [detalleId, setDetalleId] = useState(null);

  async function cargar() {
    setError(null);
    setCargando(true);
    setDatos([]);
    try {
      let path = `/${tab}`;
      if (tab === 'reservas' && filtroEstado) {
        path += `?estado=${encodeURIComponent(filtroEstado)}`;
      }
      const res = await api.get(path);
      setDatos(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [tab, filtroEstado]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Explorar</h1>
        <button
          onClick={cargar}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white hover:bg-gray-100"
        >
          Actualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm border transition ${
              tab === t.id
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white hover:bg-gray-100 border-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'reservas' && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Filtrar por estado:</span>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="border rounded-md px-3 py-1.5"
          >
            <option value="">Todos</option>
            {ESTADOS_RESERVA.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="bg-white rounded-lg shadow-sm border p-4">
        {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
        <Mensaje error={error} />
        {!cargando && !error && datos.length === 0 && (
          <p className="text-sm text-gray-500">Sin resultados.</p>
        )}
        {!cargando && datos.length > 0 && tab === 'reservas' && (
          <TablaReservas datos={datos} onCheckout={onCheckout} onVerDetalle={setDetalleId} />
        )}
        {!cargando && datos.length > 0 && tab === 'habitaciones' && (
          <TablaHabitaciones datos={datos} />
        )}
        {!cargando && datos.length > 0 && tab === 'huespedes' && (
          <TablaGenerica datos={datos} />
        )}
        {!cargando && datos.length > 0 && tab === 'facturas' && (
          <TablaFacturas datos={datos} onPago={onPago} />
        )}
      </section>

      {detalleId !== null && (
        <DetalleReserva id={detalleId} onCerrar={() => setDetalleId(null)} />
      )}
    </div>
  );
}

function Th({ children }) {
  return <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">{children}</th>;
}

function Td({ children }) {
  return <td className="px-3 py-2 border-b text-gray-800">{children}</td>;
}

function TablaReservas({ datos, onCheckout, onVerDetalle }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <Th>Id</Th>
            <Th>Huesped</Th>
            <Th>Habitacion</Th>
            <Th>Check-in</Th>
            <Th>Check-out</Th>
            <Th>Estado</Th>
            <Th>Total</Th>
            <Th>Accion</Th>
          </tr>
        </thead>
        <tbody>
          {datos.map((r) => (
            <tr key={r.id_reserva} className="odd:bg-white even:bg-gray-50">
              <Td>
                <button
                  onClick={() => onVerDetalle(r.id_reserva)}
                  className="text-blue-700 hover:underline"
                >
                  {r.id_reserva}
                </button>
              </Td>
              <Td>{r.huesped}</Td>
              <Td>{r.habitacion}</Td>
              <Td>{fecha(r.fecha_inicio)}</Td>
              <Td>{fecha(r.fecha_fin)}</Td>
              <Td>
                <Badge estado={r.estado} />
              </Td>
              <Td>{monto(r.total)}</Td>
              <Td>
                {r.estado === 'en_curso' && (
                  <button
                    onClick={() => onCheckout({ tipo: 'checkout', reservaId: r.id_reserva })}
                    className="bg-emerald-700 text-white px-3 py-1 rounded-md text-xs hover:bg-emerald-600"
                  >
                    Check-out
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaHabitaciones({ datos }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <Th>Id</Th>
            <Th>Numero</Th>
            <Th>Piso</Th>
            <Th>Tipo</Th>
            <Th>Estado</Th>
          </tr>
        </thead>
        <tbody>
          {datos.map((h) => (
            <tr key={h.id_habitacion} className="odd:bg-white even:bg-gray-50">
              <Td>{h.id_habitacion}</Td>
              <Td>{h.numero}</Td>
              <Td>{h.piso}</Td>
              <Td>{h.tipo}</Td>
              <Td>
                <Badge estado={h.estado} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaFacturas({ datos, onPago }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <Th>Id factura</Th>
            <Th>Id reserva</Th>
            <Th>Total</Th>
            <Th>Estado</Th>
            <Th>Accion</Th>
          </tr>
        </thead>
        <tbody>
          {datos.map((f) => (
            <tr key={f.id_factura} className="odd:bg-white even:bg-gray-50">
              <Td>{f.id_factura}</Td>
              <Td>{f.id_reserva}</Td>
              <Td>{monto(f.total)}</Td>
              <Td>
                <Badge estado={f.estado} />
              </Td>
              <Td>
                {(f.estado === 'pendiente' || f.estado === 'pagada_parcial') && (
                  <button
                    onClick={() =>
                      onPago({ tipo: 'pago', facturaId: f.id_factura, reservaId: f.id_reserva })
                    }
                    className="bg-slate-800 text-white px-3 py-1 rounded-md text-xs hover:bg-slate-700"
                  >
                    Registrar pago
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaGenerica({ datos }) {
  const columnas = Object.keys(datos[0]);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            {columnas.map((c) => (
              <Th key={c}>{c}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {datos.map((fila, i) => (
            <tr key={i} className="odd:bg-white even:bg-gray-50">
              {columnas.map((c) => (
                <Td key={c}>{fila[c] === null || fila[c] === undefined ? '-' : String(fila[c])}</Td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
