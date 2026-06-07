# Proyecto Hotel BD III — Guía de instalación y arranque

Sistema de gestión hotelera con **persistencia políglota**: PostgreSQL (transaccional) + MongoDB
(datos flexibles). El repo contiene dos proyectos:

```
/api        API REST (Node.js + Express + pg + mongoose)   -> puerto 3000
/frontend   SPA (React + Vite + Tailwind)                  -> puerto 5173
normalizarResena.js   (raíz) función compartida que la API importa
```

> La API **no crea esquema ni datos**: ambas bases ya existen con sus funciones, procedures, vistas,
> vistas materializadas y colecciones. La API solo los invoca por HTTP.

## Requisitos previos

- Node.js 18 o superior (la API usa `node --watch` en modo dev).
- PostgreSQL corriendo en `localhost:5432` con la base `hotel_db` ya cargada.
- MongoDB corriendo en `localhost:27017` con la base `hotel_db` ya cargada.

## 1. Instalar dependencias de la raíz

`normalizarResena.js` vive en la raíz y necesita `mongodb` (para el tipo `Int32`). Desde la carpeta
raíz del proyecto:

```bash
npm install
```

## 2. Levantar la API

```bash
cd api
npm install
copy .env.example .env        # en PowerShell: Copy-Item .env.example .env
# editar .env y poner la contraseña real de Postgres
npm run dev                   # o: npm start
```

La API queda en `http://localhost:3000`. Prueba rápida: abrir `http://localhost:3000/` debe
responder `{ "ok": true, "servicio": "hotel-api" }`.

### Contenido de `api/.env`

```env
PORT=3000

PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=hotel_db
PG_USER=postgres
PG_PASSWORD=tu_password_aqui

MONGO_URI=mongodb://localhost:27017/hotel_db
```

## 3. Levantar el frontend

En otra terminal:

```bash
cd frontend
npm install
copy .env.example .env        # opcional; por defecto apunta a http://localhost:3000
npm run dev
```

El frontend queda en `http://localhost:5173`. Abrirlo en el navegador.

### Contenido de `frontend/.env` (opcional)

```env
VITE_API_URL=http://localhost:3000
```

## 4. Secciones del frontend

1. **Explorar** — tablas navegables de Reservas (con filtro por estado), Habitaciones, Huéspedes y
   Facturas (`GET /reservas`, `/habitaciones`, `/huespedes`, `/facturas`). Las acciones parten de la
   tabla: botón **Check-out** en reservas `en_curso` y **Registrar pago** en facturas
   `pendiente`/`pagada_parcial` (precargan el id en la sección correspondiente). Badges de color por
   estado y modal de detalle de reserva (`GET /reservas/:id/detalle`).
2. **Reservas** — crear reserva (`POST /reservas`) con selects de huésped y tipo, y la habitación
   poblada por disponibilidad (`GET /disponibilidad`); más una consulta de disponibilidad por rango.
3. **Check-out / Pagos** — ver saldo (`GET /reservas/:id/saldo`), check-out
   (`POST /reservas/:id/checkout`) y pagos (`POST /facturas/:id/pagos`).
4. **Reportes** — vista a medida por reporte gerencial (ocupación, top huéspedes, satisfacción,
   aspectos mejorables, incidencias, perfil recurrente) con tarjetas-resumen, barras y ratings.

## 5. Documentación de la API

Ver `api/ENDPOINTS.md`: detalla cada endpoint, qué objeto de base de datos invoca, parámetros,
ejemplos de request/response y qué requerimiento (RC/OC) cubre. Al final lista los **nombres de
esquema** (tablas y columnas) usados por los endpoints de lectura.

## Notas

- El frontend usa `fetch` nativo (sin axios).
- El código no lleva comentarios; la explicación vive en los `.md`.
- El endpoint estrella para la defensa es `GET /reportes/perfil-recurrente`: hace **dos** consultas
  (PostgreSQL + MongoDB) y demuestra la persistencia políglota.
