import { useEffect, useState } from 'react';
import { api } from '../api';
import Tabla from './Tabla';
import Mensaje from './Mensaje';

export default function Reservas() {
  const [huespedes, setHuespedes] = useState([]);
  const [tipos, setTipos] = useState([]);

  const [form, setForm] = useState({
    id_huesped: '',
    id_tipo: '',
    id_habitacion: '',
    fecha_inicio: '',
    fecha_fin: '',
    num_huespedes: 1,
  });
  const [habitacionesDisp, setHabitacionesDisp] = useState([]);
  const [buscandoHab, setBuscandoHab] = useState(false);
  const [resReserva, setResReserva] = useState(null);
  const [errReserva, setErrReserva] = useState(null);

  const [busqueda, setBusqueda] = useState({ tipo: '', inicio: '', fin: '' });
  const [disponibles, setDisponibles] = useState([]);
  const [errDisp, setErrDisp] = useState(null);

  useEffect(() => {
    api.get('/huespedes').then(setHuespedes).catch(() => {});
    api.get('/tipos-habitacion').then(setTipos).catch(() => {});
  }, []);

  useEffect(() => {
    const { id_tipo, fecha_inicio, fecha_fin } = form;
    if (!id_tipo || !fecha_inicio || !fecha_fin) {
      setHabitacionesDisp([]);
      return;
    }
    let activo = true;
    setBuscandoHab(true);
    const q = new URLSearchParams({ tipo: id_tipo, inicio: fecha_inicio, fin: fecha_fin }).toString();
    api
      .get(`/disponibilidad?${q}`)
      .then((data) => {
        if (!activo) return;
        setHabitacionesDisp(data);
        setForm((f) => ({
          ...f,
          id_habitacion: data.some((h) => String(h.id_habitacion) === String(f.id_habitacion))
            ? f.id_habitacion
            : '',
        }));
      })
      .catch(() => activo && setHabitacionesDisp([]))
      .finally(() => activo && setBuscandoHab(false));
    return () => {
      activo = false;
    };
  }, [form.id_tipo, form.fecha_inicio, form.fecha_fin]);

  async function crearReserva(e) {
    e.preventDefault();
    setErrReserva(null);
    setResReserva(null);
    try {
      const data = await api.post('/reservas', {
        id_huesped: Number(form.id_huesped),
        id_habitacion: Number(form.id_habitacion),
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
        num_huespedes: Number(form.num_huespedes),
      });
      setResReserva(`Reserva creada con id ${data.id_reserva}`);
    } catch (err) {
      setErrReserva(err.message);
    }
  }

  async function consultarDisponibilidad(e) {
    e.preventDefault();
    setErrDisp(null);
    setDisponibles([]);
    try {
      const q = new URLSearchParams({
        tipo: busqueda.tipo,
        inicio: busqueda.inicio,
        fin: busqueda.fin,
      }).toString();
      setDisponibles(await api.get(`/disponibilidad?${q}`));
    } catch (err) {
      setErrDisp(err.message);
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold">Reservas</h1>

      <section className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Crear reserva</h2>
        <form onSubmit={crearReserva} className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            Huesped
            <select
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={form.id_huesped}
              onChange={(e) => setForm({ ...form, id_huesped: e.target.value })}
              required
            >
              <option value="">Seleccionar...</option>
              {huespedes.map((h) => (
                <option key={h.id_huesped} value={h.id_huesped}>
                  {h.nombre || h.id_huesped} {h.apellido || ''}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Tipo de habitacion
            <select
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={form.id_tipo}
              onChange={(e) => setForm({ ...form, id_tipo: e.target.value })}
              required
            >
              <option value="">Seleccionar...</option>
              {tipos.map((t) => (
                <option key={t.id_tipo} value={t.id_tipo}>
                  {t.nombre || t.descripcion || t.id_tipo}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Fecha inicio
            <input
              type="date"
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={form.fecha_inicio}
              onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
              required
            />
          </label>

          <label className="text-sm">
            Fecha fin
            <input
              type="date"
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={form.fecha_fin}
              onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
              required
            />
          </label>

          <label className="text-sm col-span-2">
            Habitacion disponible
            <select
              className="mt-1 w-full border rounded-md px-3 py-2 disabled:bg-gray-100"
              value={form.id_habitacion}
              onChange={(e) => setForm({ ...form, id_habitacion: e.target.value })}
              required
              disabled={!form.id_tipo || !form.fecha_inicio || !form.fecha_fin}
            >
              <option value="">
                {buscandoHab
                  ? 'Buscando...'
                  : habitacionesDisp.length === 0
                  ? 'Elegi tipo y fechas para ver disponibles'
                  : 'Seleccionar...'}
              </option>
              {habitacionesDisp.map((h) => (
                <option key={h.id_habitacion} value={h.id_habitacion}>
                  Hab. {h.numero} (piso {h.piso}) - ${h.precio_noche}/noche
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            Num huespedes
            <input
              type="number"
              min="1"
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={form.num_huespedes}
              onChange={(e) => setForm({ ...form, num_huespedes: e.target.value })}
              required
            />
          </label>

          <div className="col-span-2">
            <button className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-700">
              Crear reserva
            </button>
          </div>
        </form>
        <Mensaje error={errReserva} ok={resReserva} />
      </section>

      <section className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Consultar disponibilidad por rango</h2>
        <form onSubmit={consultarDisponibilidad} className="grid grid-cols-3 gap-4">
          <label className="text-sm">
            Tipo
            <select
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={busqueda.tipo}
              onChange={(e) => setBusqueda({ ...busqueda, tipo: e.target.value })}
              required
            >
              <option value="">Seleccionar...</option>
              {tipos.map((t) => (
                <option key={t.id_tipo} value={t.id_tipo}>
                  {t.nombre || t.descripcion || t.id_tipo}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Inicio
            <input
              type="date"
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={busqueda.inicio}
              onChange={(e) => setBusqueda({ ...busqueda, inicio: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            Fin
            <input
              type="date"
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={busqueda.fin}
              onChange={(e) => setBusqueda({ ...busqueda, fin: e.target.value })}
              required
            />
          </label>
          <div className="col-span-3">
            <button className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-700">
              Consultar
            </button>
          </div>
        </form>
        <Mensaje error={errDisp} />
        <Tabla datos={disponibles} />
      </section>
    </div>
  );
}
