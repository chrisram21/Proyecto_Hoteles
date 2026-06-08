/*
 * seed.js — Generador de datos de prueba (PostgreSQL + MongoDB)
 * Proyecto Final BD III — Escenario Hotel
 *
 * Uso:
 *   1) npm init -y
 *   2) npm install pg mongodb @faker-js/faker
 *   3) ajustar el bloque CONFIG (contraseña de Postgres)
 *   4) node seed.js
 *
 * El script LIMPIA los datos previos antes de generar, así que es re-ejecutable.
 */
const { Client } = require('pg');
const { MongoClient, Int32 } = require('mongodb');
const { fakerES: faker } = require('@faker-js/faker'); // si falla, usar: const { faker } = require('@faker-js/faker');

// ================== CONFIG (ajustar a tu entorno) ==================
const PG = {
  host: 'localhost',
  port: 5432,
  database: 'hotel_db',
  user: 'postgres',
  password: 'CirceChild', // <-- CAMBIAR por tu contraseña de Postgres
};
const MONGO_URL = 'mongodb://localhost:27017';
const MONGO_DB = 'hotel_db';

// ================== Helpers ==================
const ri = (min, max) => faker.number.int({ min, max });
const pick = (arr) => faker.helpers.arrayElement(arr);
const picks = (arr, n) => faker.helpers.arrayElements(arr, n);
const chance = (p) => faker.datatype.boolean(p);
const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
const fmt = (d) => d.toISOString().slice(0, 10);       // YYYY-MM-DD para columnas DATE
const round2 = (n) => Math.round(n * 100) / 100;
const HOY = new Date();

async function main() {
  const pg = new Client(PG);
  await pg.connect();
  const mongo = new MongoClient(MONGO_URL);
  await mongo.connect();
  const mdb = mongo.db(MONGO_DB);

  // ---------- Limpieza (re-ejecutable) ----------
  console.log('Limpiando datos previos...');
  await pg.query(`TRUNCATE log_auditoria, pago, factura, consumo, reserva,
    servicio_extra, categoria_servicio, tipo_habitacion_comodidad, comodidad,
    habitacion, huesped, tipo_habitacion RESTART IDENTITY CASCADE`);
  for (const c of ['perfiles_huesped', 'incidencias', 'resenas']) {
    await mdb.collection(c).deleteMany({});
  }

  // ---------- 1. tipo_habitacion ----------
  const tiposData = [
    { nombre: 'Individual', capacidad: 1, precio: 350, desc: 'Habitacion individual' },
    { nombre: 'Doble', capacidad: 2, precio: 550, desc: 'Habitacion doble estandar' },
    { nombre: 'Suite', capacidad: 4, precio: 1200, desc: 'Suite de lujo' },
    { nombre: 'Familiar', capacidad: 6, precio: 1500, desc: 'Habitacion familiar amplia' },
  ];
  const tipos = [];
  for (const t of tiposData) {
    const { rows } = await pg.query(
      `INSERT INTO tipo_habitacion (nombre, capacidad, precio_noche, descripcion)
       VALUES ($1,$2,$3,$4) RETURNING id_tipo`,
      [t.nombre, t.capacidad, t.precio, t.desc]);
    tipos.push({ id: rows[0].id_tipo, ...t });
  }

  // ---------- 2. comodidad ----------
  const comodidadesData = ['WiFi', 'TV por cable', 'Minibar', 'Aire acondicionado',
    'Jacuzzi', 'Balcon', 'Caja fuerte', 'Vista al mar', 'Escritorio', 'Cafetera'];
  const comodidades = [];
  for (const nombre of comodidadesData) {
    const { rows } = await pg.query(
      `INSERT INTO comodidad (nombre) VALUES ($1) RETURNING id_comodidad`, [nombre]);
    comodidades.push(rows[0].id_comodidad);
  }

  // ---------- 3. tipo_habitacion_comodidad (M:N) ----------
  for (const t of tipos) {
    for (const idCom of picks(comodidades, ri(3, 6))) {
      await pg.query(
        `INSERT INTO tipo_habitacion_comodidad (id_tipo, id_comodidad) VALUES ($1,$2)`,
        [t.id, idCom]);
    }
  }

  // ---------- 4. habitacion (50 en 5 pisos) ----------
  const habitaciones = [];
  for (let piso = 1; piso <= 5; piso++) {
    for (let n = 1; n <= 10; n++) {
      const numero = `${piso}${String(n).padStart(2, '0')}`;
      const t = pick(tipos);
      const { rows } = await pg.query(
        `INSERT INTO habitacion (id_tipo, numero, piso, estado)
         VALUES ($1,$2,$3,'disponible') RETURNING id_habitacion`,
        [t.id, numero, piso]);
      habitaciones.push({ id: rows[0].id_habitacion, tipo: t });
    }
  }

  // ---------- 5. huesped (80) ----------
  const huespedes = [];
  for (let i = 0; i < 80; i++) {
    const nombre = faker.person.firstName();
    const apellido = faker.person.lastName();
    const { rows } = await pg.query(
      `INSERT INTO huesped (nombre, apellido, documento, email, telefono)
       VALUES ($1,$2,$3,$4,$5) RETURNING id_huesped`,
      [nombre, apellido, faker.string.numeric(13),
       faker.internet.email({ firstName: nombre, lastName: apellido }).toLowerCase(),
       faker.phone.number()]);
    huespedes.push({ id: rows[0].id_huesped, nombre, apellido });
  }

  // ---------- 6 + 7. categoria_servicio + servicio_extra ----------
  const catalogo = {
    'minibar': [['Agua', 15], ['Refresco', 20], ['Cerveza', 35], ['Snack', 25]],
    'lavanderia': [['Lavado de ropa', 60], ['Planchado', 40]],
    'spa': [['Masaje', 250], ['Facial', 200], ['Sauna', 150]],
    'restaurante': [['Desayuno', 75], ['Almuerzo', 120], ['Cena', 150], ['Room service', 90]],
    'transporte': [['Traslado aeropuerto', 180], ['Alquiler de auto', 400], ['Tour ciudad', 220]],
  };
  const servicios = [];
  for (const [cat, items] of Object.entries(catalogo)) {
    const { rows } = await pg.query(
      `INSERT INTO categoria_servicio (nombre) VALUES ($1) RETURNING id_categoria`, [cat]);
    const idCat = rows[0].id_categoria;
    for (const [nombre, precio] of items) {
      const r = await pg.query(
        `INSERT INTO servicio_extra (id_categoria, nombre, precio)
         VALUES ($1,$2,$3) RETURNING id_servicio`, [idCat, nombre, precio]);
      servicios.push({ id: r.rows[0].id_servicio, precio });
    }
  }

  // ---------- 8. reserva (no solapadas, mezcla de estados) ----------
  const WINDOW_INICIO = addDays(HOY, -365);
  const WINDOW_DIAS = 425; // 365 dias atras + 60 adelante
  const reservas = [];
  for (const hab of habitaciones) {
    const count = ri(6, 7);
    const starts = Array.from({ length: count }, () => ri(0, 420)).sort((a, b) => a - b);
    for (let i = 0; i < count; i++) {
      const startDay = starts[i];
      const nextStart = (i + 1 < count) ? starts[i + 1] : WINDOW_DIAS;
      const maxDur = Math.min(8, nextStart - startDay - 1); // -1 deja al menos 1 dia de hueco
      if (maxDur < 1) continue;                               // sin espacio: se salta
      const dur = ri(1, maxDur);
      const fIni = addDays(WINDOW_INICIO, startDay);
      const fFin = addDays(fIni, dur);

      // estado coherente con las fechas
      let estado, checkin = null, checkout = null;
      if (fFin < HOY) {
        const roll = ri(1, 10);
        estado = roll <= 8 ? 'completada' : (roll === 9 ? 'cancelada' : 'no_show');
        if (estado === 'completada') { checkin = fIni; checkout = fFin; }
      } else if (fIni <= HOY && HOY <= fFin) {
        estado = 'en_curso'; checkin = fIni;
      } else {
        estado = chance(0.7) ? 'confirmada' : 'pendiente';
      }

      const huesped = pick(huespedes);
      const numH = ri(1, hab.tipo.capacidad);          // RN-03: no excede capacidad
      const total = round2(dur * hab.tipo.precio);
      const { rows } = await pg.query(
        `INSERT INTO reserva
          (id_huesped, id_habitacion, fecha_inicio, fecha_fin, fecha_checkin_real,
           fecha_checkout_real, num_huespedes, total_estimado, estado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id_reserva`,
        [huesped.id, hab.id, fmt(fIni), fmt(fFin), checkin, checkout, numH, total, estado]);
      reservas.push({ id: rows[0].id_reserva, huespedId: huesped.id, habId: hab.id,
        estado, fIni, fFin, total, consumoTotal: 0 });
    }
  }

  // ---------- estados de habitacion coherentes ----------
  const ocupadas = new Set(reservas.filter(r => r.estado === 'en_curso').map(r => r.habId));
  for (const habId of ocupadas) {
    await pg.query(`UPDATE habitacion SET estado='ocupada' WHERE id_habitacion=$1`, [habId]);
  }
  const libres = habitaciones.filter(h => !ocupadas.has(h.id));
  for (const h of picks(libres, 2)) {
    await pg.query(`UPDATE habitacion SET estado='mantenimiento' WHERE id_habitacion=$1`, [h.id]);
  }

  // ---------- 9. consumo (solo completada / en_curso) ----------
  const elegibles = reservas.filter(r => r.estado === 'completada' || r.estado === 'en_curso');
  let totalConsumos = 0;
  for (const r of elegibles) {
    const toDate = r.fFin < HOY ? r.fFin : HOY;
    for (let i = 0; i < ri(3, 7); i++) {
      const s = pick(servicios);
      const cant = ri(1, 3);
      await pg.query(
        `INSERT INTO consumo (id_reserva, id_servicio, cantidad, precio_unitario, fecha_consumo)
         VALUES ($1,$2,$3,$4,$5)`,
        [r.id, s.id, cant, s.precio, faker.date.between({ from: r.fIni, to: toDate })]);
      r.consumoTotal = round2(r.consumoTotal + cant * s.precio);
      totalConsumos++;
    }
  }

  // ---------- 10 + 11. factura (1:1 por reserva) + pago ----------
  let facturasConPago = 0;
  for (const r of reservas) {
    let total, fEmision = null;
    if (r.estado === 'completada') { total = round2(r.total + r.consumoTotal); fEmision = r.fFin; }
    else if (r.estado === 'cancelada' || r.estado === 'no_show') { total = round2(r.total * 0.25); fEmision = r.fIni; } // costo de cancelacion
    else if (r.estado === 'en_curso') { total = round2(r.total + r.consumoTotal); }
    else { total = r.total; } // confirmada / pendiente

    const fr = await pg.query(
      `INSERT INTO factura (id_reserva, total, estado, fecha_emision)
       VALUES ($1,$2,'pendiente',$3) RETURNING id_factura`,
      [r.id, total, fEmision]);
    const idFactura = fr.rows[0].id_factura;

    // pagos (RN-06: nunca exceden el total)
    let pagar = 0;
    if (r.estado === 'completada') pagar = chance(0.8) ? total : round2(total * ri(40, 80) / 100);
    else if (r.estado === 'en_curso') pagar = chance(0.5) ? round2(total * ri(30, 60) / 100) : 0;
    else if (r.estado === 'cancelada') pagar = chance(0.7) ? total : 0;

    if (pagar > 0) {
      const enDos = chance(0.4) && pagar > 1;
      const montos = enDos ? [round2(pagar / 2), round2(pagar - round2(pagar / 2))] : [pagar];
      for (const m of montos) {
        await pg.query(
          `INSERT INTO pago (id_factura, monto, metodo, fecha_pago) VALUES ($1,$2,$3,$4)`,
          [idFactura, m, pick(['efectivo', 'tarjeta', 'transferencia']), fEmision || r.fIni]);
      }
      // estado de la factura segun lo pagado (RN-07)
      await pg.query(`UPDATE factura SET estado=$1 WHERE id_factura=$2`,
        [pagar >= total ? 'pagada' : 'pagada_parcial', idFactura]);
      facturasConPago++;
    }
  }

  // ========================= MongoDB =========================
  // ---------- perfiles_huesped (60) ----------
  const almohadas = ['plumas', 'espuma', 'memory foam', 'firme'];
  const vistas = ['mar', 'ciudad', 'jardin', 'piscina'];
  const idiomasPool = ['es', 'en', 'fr', 'de', 'pt'];
  const alergiasPool = ['mariscos', 'polen', 'mani', 'lacteos', 'gluten'];
  const restriccionesPool = ['vegetariano', 'vegano', 'sin gluten', 'kosher'];
  const niveles = ['bronce', 'plata', 'oro', 'platino'];
  const perfilesDocs = picks(huespedes, 60).map(h => {
    const doc = {
      huesped_id: new Int32(h.id),
      preferencias: {
        tipo_almohada: pick(almohadas),
        temperatura: new Int32(ri(18, 24)),
        vista: pick(vistas),
      },
      idiomas: picks(idiomasPool, ri(1, 3)),
      actualizado_en: faker.date.recent({ days: 200 }),
    };
    if (chance(0.5)) doc.alergias = picks(alergiasPool, ri(1, 2));
    if (chance(0.4)) doc.restricciones_alimentarias = picks(restriccionesPool, ri(1, 2));
    if (chance(0.3)) doc.peticiones_especiales = picks(['late checkout', 'cuna', 'piso alto', 'lejos del ascensor'], ri(1, 2));
    if (chance(0.6)) doc.programa_lealtad = {
      nivel: pick(niveles), puntos: new Int32(ri(0, 50000)),
      miembro_desde: faker.date.past({ years: 5 }),
    };
    return doc;
  });
  await mdb.collection('perfiles_huesped').insertMany(perfilesDocs);

  // ---------- incidencias (40) ----------
  const categorias = ['queja', 'solicitud', 'observacion'];
  const estadosInc = ['abierta', 'en_proceso', 'resuelta'];
  const responsables = ['Carlos M.', 'Ana L.', 'Recepcion', 'Mantenimiento', 'Gerencia'];
  const accionesPool = ['Se contacto al huesped', 'Se envio personal', 'Se reemplazo el equipo',
    'Se ofrecio compensacion', 'Se resolvio la solicitud'];
  const incidenciasDocs = picks(elegibles, Math.min(40, elegibles.length)).map(r => {
    const estado = pick(estadosInc);
    const toDate = r.fFin < HOY ? r.fFin : HOY;
    const fReporte = faker.date.between({ from: r.fIni, to: toDate });
    const acciones = [];
    let fAccion = fReporte;
    const nAcc = estado === 'abierta' ? 0 : ri(1, 3);
    for (let i = 0; i < nAcc; i++) {
      fAccion = addDays(fAccion, ri(0, 2));
      acciones.push({ descripcion: pick(accionesPool), responsable: pick(responsables), fecha: new Date(fAccion) });
    }
    return {
      reserva_id: new Int32(r.id),
      huesped_id: new Int32(r.huespedId),
      categoria: pick(categorias),
      descripcion: faker.lorem.sentence(),
      estado_resolucion: estado,
      fecha_reporte: fReporte,
      acciones,
    };
  });
  await mdb.collection('incidencias').insertMany(incidenciasDocs);

  // ---------- resenas (120, solo completadas, una por reserva) ----------
  const completadas = reservas.filter(r => r.estado === 'completada');
  const aspectosPool = ['limpieza', 'atencion', 'ubicacion', 'confort', 'wifi', 'precio', 'desayuno', 'ruido', 'estacionamiento'];
  const resenasDocs = picks(completadas, Math.min(120, completadas.length)).map(r => {
    const cal = { limpieza: ri(1, 5), atencion: ri(1, 5), ubicacion: ri(1, 5), confort: ri(1, 5), calidad_precio: ri(1, 5) };
    const prom = round2((cal.limpieza + cal.atencion + cal.ubicacion + cal.confort + cal.calidad_precio) / 5);
    return {
      reserva_id: new Int32(r.id),
      huesped_id: new Int32(r.huespedId),
      fecha: addDays(r.fFin, ri(0, 5)),
      calificaciones: {
        limpieza: new Int32(cal.limpieza), atencion: new Int32(cal.atencion),
        ubicacion: new Int32(cal.ubicacion), confort: new Int32(cal.confort),
        calidad_precio: new Int32(cal.calidad_precio),
      },
      promedio: prom,
      comentario: faker.lorem.sentences(2),
      aspectos_destacables: picks(aspectosPool, ri(1, 3)),
      aspectos_mejorables: picks(aspectosPool, ri(0, 2)),
    };
  });
  await mdb.collection('resenas').insertMany(resenasDocs);

  // ---------- Resumen ----------
  console.log('--- Resumen de carga ---');
  console.log('Habitaciones:    ', habitaciones.length);
  console.log('Huespedes:       ', huespedes.length);
  console.log('Reservas:        ', reservas.length,
    `(en_curso: ${reservas.filter(r => r.estado === 'en_curso').length}, completadas: ${completadas.length})`);
  console.log('Consumos:        ', totalConsumos);
  console.log('Facturas:        ', reservas.length, `(con pago: ${facturasConPago})`);
  console.log('Perfiles (Mongo):', perfilesDocs.length);
  console.log('Incidencias:     ', incidenciasDocs.length);
  console.log('Resenas:         ', resenasDocs.length);
  if (completadas.length < 120) console.log('AVISO: menos de 120 completadas; volve a correr para mas reseñas.');

  await pg.end();
  await mongo.close();
  console.log('Carga completada.');
}

main().catch(e => { console.error(e); process.exit(1); });