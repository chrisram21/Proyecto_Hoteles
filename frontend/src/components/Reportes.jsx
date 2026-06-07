import { useState } from 'react';
import { api } from '../api';
import Mensaje from './Mensaje';
import {
  StatCard,
  Rating,
  Progress,
  BarList,
  fmtNum,
  fmtMoney,
  fmtTrimestre,
  fmtMes,
} from './viz';

const REPORTES = [
  {
    id: 'ocupacion',
    label: 'Ocupacion mensual',
    path: '/reportes/ocupacion',
    desc: 'Reservas, noches vendidas e ingresos por mes y tipo de habitacion (vista materializada).',
  },
  {
    id: 'top',
    label: 'Top huespedes',
    path: '/reportes/top-huespedes',
    desc: 'Ranking de huespedes por gasto total y cantidad de estadias.',
  },
  {
    id: 'satisfaccion',
    label: 'Satisfaccion',
    path: '/reportes/satisfaccion',
    desc: 'Promedio de cada metrica de las resenas, agrupado por trimestre (escala 1 a 5).',
  },
  {
    id: 'aspectos',
    label: 'Aspectos mejorables',
    path: '/reportes/aspectos-mejorables',
    desc: 'Aspectos que los huespedes piden mejorar, ordenados por menciones y con su tendencia trimestral.',
  },
  {
    id: 'incidencias',
    label: 'Incidencias',
    path: '/reportes/incidencias',
    desc: 'Incidencias por categoria, tasa de resolucion y tiempo promedio de resolucion.',
  },
  {
    id: 'perfil',
    label: 'Perfil recurrente',
    path: '/reportes/perfil-recurrente',
    desc: 'Cruza PostgreSQL + MongoDB: perfil de los huespedes con mas de 3 estadias completadas.',
  },
];

export default function Reportes() {
  const [activo, setActivo] = useState('ocupacion');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const reporte = REPORTES.find((r) => r.id === activo);

  async function cargar(rep) {
    setActivo(rep.id);
    setError(null);
    setData(null);
    setCargando(true);
    try {
      setData(await api.get(rep.path));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <h1 className="text-2xl font-bold">Reportes gerenciales</h1>

      <div className="flex flex-wrap gap-2">
        {REPORTES.map((r) => (
          <button
            key={r.id}
            onClick={() => cargar(r)}
            className={`px-4 py-2 rounded-md text-sm border transition ${
              activo === r.id
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white hover:bg-gray-100 border-gray-300'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-600">{reporte.desc}</p>

      <section className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 space-y-4 min-h-[8rem]">
        {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
        <Mensaje error={error} />
        {!cargando && !error && data === null && (
          <p className="text-sm text-gray-500">Selecciona un reporte para cargarlo.</p>
        )}
        {!cargando && !error && data !== null && <Vista id={activo} data={data} />}
      </section>
    </div>
  );
}

function Vista({ id, data }) {
  if (id === 'ocupacion') return <Ocupacion rows={data} />;
  if (id === 'top') return <TopHuespedes rows={data} />;
  if (id === 'satisfaccion') return <Satisfaccion rows={data} />;
  if (id === 'aspectos') return <Aspectos rows={data} />;
  if (id === 'incidencias') return <Incidencias data={data} />;
  if (id === 'perfil') return <Perfil data={data} />;
  return null;
}

function Vacio() {
  return <p className="text-sm text-gray-500">Sin datos para mostrar.</p>;
}

function Ocupacion({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) return <Vacio />;
  const tot = rows.reduce(
    (a, r) => ({
      reservas: a.reservas + Number(r.reservas || 0),
      noches: a.noches + Number(r.noches_vendidas || 0),
      ingresos: a.ingresos + Number(r.ingresos_hospedaje || 0) + Number(r.ingresos_consumos || 0),
    }),
    { reservas: 0, noches: 0, ingresos: 0 }
  );
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Reservas" value={fmtNum(tot.reservas)} accent="blue" />
        <StatCard label="Noches vendidas" value={fmtNum(tot.noches)} accent="slate" />
        <StatCard label="Ingresos totales" value={fmtMoney(tot.ingresos)} accent="emerald" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <Th>Mes</Th>
              <Th>Tipo</Th>
              <Th right>Reservas</Th>
              <Th right>Noches</Th>
              <Th right>Hospedaje</Th>
              <Th right>Consumos</Th>
              <Th right>Total</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const total = Number(r.ingresos_hospedaje || 0) + Number(r.ingresos_consumos || 0);
              return (
                <tr key={i} className="odd:bg-white even:bg-gray-50">
                  <Td>{fmtMes(r.mes)}</Td>
                  <Td>{r.tipo}</Td>
                  <Td right>{fmtNum(r.reservas)}</Td>
                  <Td right>{fmtNum(r.noches_vendidas)}</Td>
                  <Td right>{fmtMoney(r.ingresos_hospedaje)}</Td>
                  <Td right>{fmtMoney(r.ingresos_consumos)}</Td>
                  <Td right>
                    <span className="font-semibold">{fmtMoney(total)}</span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopHuespedes({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) return <Vacio />;
  const max = Math.max(...rows.map((r) => Number(r.gasto_total) || 0), 1);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const pct = ((Number(r.gasto_total) || 0) / max) * 100;
        return (
          <div key={r.id_huesped ?? i} className="flex items-center gap-3 text-sm">
            <div className="w-7 text-center font-bold text-gray-400">{i + 1}</div>
            <div className="w-40 sm:w-52 truncate font-medium text-gray-800" title={r.huesped}>
              {r.huesped}
            </div>
            <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
              <div className="h-full bg-emerald-600 rounded" style={{ width: `${pct}%` }} />
            </div>
            <div className="w-24 text-right font-semibold tabular-nums">{fmtMoney(r.gasto_total)}</div>
            <div className="w-20 text-right text-gray-500 tabular-nums">
              {fmtNum(r.total_estadias)} est.
            </div>
          </div>
        );
      })}
    </div>
  );
}

const METRICAS = [
  ['limpieza', 'Limpieza'],
  ['atencion', 'Atencion'],
  ['ubicacion', 'Ubicacion'],
  ['confort', 'Confort'],
  ['calidad_precio', 'Calidad/precio'],
];

function Satisfaccion({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) return <Vacio />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {rows.map((r, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{fmtTrimestre(r.trimestre)}</h3>
            <span className="text-xs text-gray-500">{fmtNum(r.total_resenas)} resenas</span>
          </div>
          <div className="space-y-2">
            {METRICAS.map(([key, label]) => (
              <div key={key} className="grid grid-cols-[7rem,1fr] items-center gap-2">
                <span className="text-xs text-gray-600">{label}</span>
                <Rating value={r[key]} />
              </div>
            ))}
          </div>
          <div className="border-t pt-3 grid grid-cols-[7rem,1fr] items-center gap-2">
            <span className="text-sm font-semibold">Promedio</span>
            <Rating value={r.promedio_general} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Aspectos({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) return <Vacio />;
  const ranking = rows.map((r) => ({ label: r.aspecto, value: r.total }));
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Ranking por menciones</h3>
        <BarList items={ranking} color="bg-amber-500" />
      </div>
      <div>
        <h3 className="font-semibold mb-3">Tendencia trimestral</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((r, i) => {
            const tend = Array.isArray(r.tendencia) ? r.tendencia : [];
            const max = Math.max(...tend.map((t) => Number(t.menciones) || 0), 1);
            return (
              <div key={i} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">{r.aspecto}</span>
                  <span className="text-xs text-gray-500">{fmtNum(r.total)} en total</span>
                </div>
                <div className="space-y-1">
                  {tend.map((t, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-gray-600">{fmtTrimestre(t.trimestre)}</span>
                      <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded"
                          style={{ width: `${((Number(t.menciones) || 0) / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-6 text-right font-semibold">{fmtNum(t.menciones)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Incidencias({ data }) {
  const tasa = (data.tasa_resolucion && data.tasa_resolucion[0]) || {};
  const tiempo = (data.tiempo_resolucion_horas && data.tiempo_resolucion_horas[0]) || {};
  const categorias = Array.isArray(data.por_categoria) ? data.por_categoria : [];
  const horas = Number(tiempo.promedio_horas);
  const dias = Number.isNaN(horas) ? null : (horas / 24).toFixed(1);
  const pct = Number(tasa.porcentaje) || 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total incidencias" value={fmtNum(tasa.total)} accent="blue" />
        <StatCard
          label="Resueltas"
          value={`${fmtNum(tasa.resueltas)} / ${fmtNum(tasa.total)}`}
          accent="emerald"
        />
        <StatCard
          label="Tiempo prom. de resolucion"
          value={Number.isNaN(horas) ? '-' : `${horas.toFixed(1)} h`}
          sub={dias ? `~ ${dias} dias` : undefined}
          accent="amber"
        />
      </div>

      <div className="border rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">Tasa de resolucion</span>
          <span className="font-bold text-emerald-700">{pct.toFixed(1)}%</span>
        </div>
        <Progress pct={pct} />
      </div>

      <div>
        <h3 className="font-semibold mb-3">Incidencias por categoria</h3>
        <BarList
          items={categorias.map((c) => ({ label: c.categoria ?? '(sin categoria)', value: c.total }))}
          color="bg-blue-500"
        />
      </div>
    </div>
  );
}

function Perfil({ data }) {
  const p = data.perfiles || {};
  const ids = Array.isArray(data.huespedes_recurrentes) ? data.huespedes_recurrentes : [];
  const grupos = [
    ['Idiomas', p.idiomas, 'bg-blue-500'],
    ['Alergias', p.alergias, 'bg-red-400'],
    ['Tipo de almohada', p.almohada, 'bg-slate-500'],
    ['Vista preferida', p.vista, 'bg-emerald-500'],
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Huespedes recurrentes"
          value={fmtNum(data.total_recurrentes)}
          sub="Mas de 3 estadias completadas"
          accent="blue"
        />
        <div className="bg-white border rounded-lg p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Ids de huespedes</div>
          <div className="flex flex-wrap gap-1.5">
            {ids.length === 0 && <span className="text-sm text-gray-500">Sin datos.</span>}
            {ids.map((id) => (
              <span
                key={id}
                className="inline-block bg-gray-100 text-gray-700 rounded px-2 py-0.5 text-xs font-medium"
              >
                #{id}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {grupos.map(([titulo, items, color]) => (
          <div key={titulo} className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">{titulo}</h3>
            <BarList
              items={(Array.isArray(items) ? items : []).map((it) => ({
                label: it.valor ?? '(sin dato)',
                value: it.total,
              }))}
              color={color}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Th({ children, right }) {
  return (
    <th
      className={`px-3 py-2 font-semibold text-gray-700 border-b ${right ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  );
}

function Td({ children, right }) {
  return (
    <td className={`px-3 py-2 border-b text-gray-800 ${right ? 'text-right tabular-nums' : 'text-left'}`}>
      {children}
    </td>
  );
}
