import { useEffect, useState } from 'react';
import { api } from '../api';
import Mensaje from './Mensaje';

export default function Checkout({ prefill }) {
  const [idReserva, setIdReserva] = useState('');
  const [saldo, setSaldo] = useState(null);
  const [errSaldo, setErrSaldo] = useState(null);

  const [checkoutForm, setCheckoutForm] = useState({ monto_pago: '', metodo: 'efectivo' });
  const [msgCheckout, setMsgCheckout] = useState(null);
  const [errCheckout, setErrCheckout] = useState(null);

  const [pagoForm, setPagoForm] = useState({ id_factura: '', monto: '', metodo: 'efectivo' });
  const [pagoSaldo, setPagoSaldo] = useState(null);
  const [msgPago, setMsgPago] = useState(null);
  const [errPago, setErrPago] = useState(null);

  async function obtenerSaldo(id) {
    const data = await api.get(`/reservas/${id}/saldo`);
    return data.saldo;
  }

  useEffect(() => {
    if (!prefill) return;
    if (prefill.tipo === 'checkout' && prefill.reservaId != null) {
      const id = String(prefill.reservaId);
      setIdReserva(id);
      setMsgCheckout(null);
      setErrCheckout(null);
      setErrSaldo(null);
      obtenerSaldo(id)
        .then((s) => {
          setSaldo(s);
          setCheckoutForm((f) => ({ ...f, monto_pago: s != null ? String(s) : '' }));
        })
        .catch((err) => setErrSaldo(err.message));
    }
    if (prefill.tipo === 'pago' && prefill.facturaId != null) {
      setPagoForm((f) => ({ ...f, id_factura: String(prefill.facturaId) }));
      setMsgPago(null);
      setErrPago(null);
      setPagoSaldo(null);
      if (prefill.reservaId != null) {
        obtenerSaldo(prefill.reservaId)
          .then(setPagoSaldo)
          .catch(() => {});
      }
    }
  }, [prefill]);

  async function consultarSaldo(e) {
    e.preventDefault();
    setErrSaldo(null);
    setSaldo(null);
    try {
      setSaldo(await obtenerSaldo(idReserva));
    } catch (err) {
      setErrSaldo(err.message);
    }
  }

  async function hacerCheckout(e) {
    e.preventDefault();
    setErrCheckout(null);
    setMsgCheckout(null);
    try {
      const data = await api.post(`/reservas/${idReserva}/checkout`, {
        monto_pago: Number(checkoutForm.monto_pago),
        metodo: checkoutForm.metodo,
      });
      setMsgCheckout(data.mensaje || 'Check-out realizado');
      try {
        setSaldo(await obtenerSaldo(idReserva));
      } catch {
        setSaldo(null);
      }
    } catch (err) {
      setErrCheckout(err.message);
    }
  }

  async function registrarPago(e) {
    e.preventDefault();
    setErrPago(null);
    setMsgPago(null);
    try {
      const data = await api.post(`/facturas/${pagoForm.id_factura}/pagos`, {
        monto: Number(pagoForm.monto),
        metodo: pagoForm.metodo,
      });
      setMsgPago(data.mensaje || 'Pago registrado');
      if (prefill && prefill.reservaId != null) {
        try {
          setPagoSaldo(await obtenerSaldo(prefill.reservaId));
        } catch {
          setPagoSaldo(null);
        }
      }
    } catch (err) {
      setErrPago(err.message);
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-2xl font-bold">Check-out / Pagos</h1>
      <p className="text-sm text-gray-500">
        Tip: podes iniciar estas acciones desde la seccion <strong>Explorar</strong> y el id se carga solo.
      </p>

      <section className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Consultar reserva</h2>
        <form onSubmit={consultarSaldo} className="flex items-end gap-4">
          <label className="text-sm flex-1">
            Id reserva
            <input
              type="number"
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={idReserva}
              onChange={(e) => setIdReserva(e.target.value)}
              required
            />
          </label>
          <button className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-700">
            Ver saldo
          </button>
        </form>
        {saldo !== null && (
          <div className="text-sm">
            Saldo pendiente: <span className="font-semibold">{saldo}</span>
          </div>
        )}
        <Mensaje error={errSaldo} />
      </section>

      <section className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Check-out</h2>
        <form onSubmit={hacerCheckout} className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            Monto pago
            <input
              type="number"
              step="0.01"
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={checkoutForm.monto_pago}
              onChange={(e) => setCheckoutForm({ ...checkoutForm, monto_pago: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            Metodo
            <select
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={checkoutForm.metodo}
              onChange={(e) => setCheckoutForm({ ...checkoutForm, metodo: e.target.value })}
            >
              <option value="efectivo">efectivo</option>
              <option value="tarjeta">tarjeta</option>
              <option value="transferencia">transferencia</option>
            </select>
          </label>
          <div className="col-span-2">
            <button className="bg-emerald-700 text-white px-4 py-2 rounded-md text-sm hover:bg-emerald-600">
              Realizar check-out (reserva {idReserva || '-'})
            </button>
          </div>
        </form>
        <Mensaje error={errCheckout} ok={msgCheckout} />
      </section>

      <section className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Registrar pago sobre factura</h2>
        {pagoSaldo !== null && (
          <div className="text-sm">
            Saldo pendiente de la reserva: <span className="font-semibold">{pagoSaldo}</span>
          </div>
        )}
        <form onSubmit={registrarPago} className="grid grid-cols-3 gap-4">
          <label className="text-sm">
            Id factura
            <input
              type="number"
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={pagoForm.id_factura}
              onChange={(e) => setPagoForm({ ...pagoForm, id_factura: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            Monto
            <input
              type="number"
              step="0.01"
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={pagoForm.monto}
              onChange={(e) => setPagoForm({ ...pagoForm, monto: e.target.value })}
              required
            />
          </label>
          <label className="text-sm">
            Metodo
            <select
              className="mt-1 w-full border rounded-md px-3 py-2"
              value={pagoForm.metodo}
              onChange={(e) => setPagoForm({ ...pagoForm, metodo: e.target.value })}
            >
              <option value="efectivo">efectivo</option>
              <option value="tarjeta">tarjeta</option>
              <option value="transferencia">transferencia</option>
            </select>
          </label>
          <div className="col-span-3">
            <button className="bg-slate-800 text-white px-4 py-2 rounded-md text-sm hover:bg-slate-700">
              Registrar pago
            </button>
          </div>
        </form>
        <Mensaje error={errPago} ok={msgPago} />
      </section>
    </div>
  );
}
