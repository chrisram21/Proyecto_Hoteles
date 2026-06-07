import { useState } from 'react';
import Reservas from './components/Reservas';
import Checkout from './components/Checkout';
import Reportes from './components/Reportes';
import Explorar from './components/Explorar';

const SECCIONES = [
  { id: 'explorar', label: 'Explorar' },
  { id: 'reservas', label: 'Reservas' },
  { id: 'checkout', label: 'Check-out / Pagos' },
  { id: 'reportes', label: 'Reportes' },
];

export default function App() {
  const [seccion, setSeccion] = useState('explorar');
  const [prefill, setPrefill] = useState(null);

  function irACheckout(payload) {
    setPrefill({ ...payload, nonce: Date.now() });
    setSeccion('checkout');
  }

  return (
    <div className="min-h-screen flex bg-gray-50 text-gray-900">
      <aside className="w-60 bg-slate-800 text-slate-100 flex flex-col">
        <div className="px-5 py-5 text-lg font-bold border-b border-slate-700">
          Hotel BD III
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeccion(s.id)}
              className={`w-full text-left px-4 py-2 rounded-md text-sm transition ${
                seccion === s.id ? 'bg-slate-600 font-semibold' : 'hover:bg-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 text-xs text-slate-400 border-t border-slate-700">
          Persistencia poliglota: PostgreSQL + MongoDB
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {seccion === 'explorar' && <Explorar onCheckout={irACheckout} onPago={irACheckout} />}
        {seccion === 'reservas' && <Reservas />}
        {seccion === 'checkout' && <Checkout prefill={prefill} />}
        {seccion === 'reportes' && <Reportes />}
      </main>
    </div>
  );
}
