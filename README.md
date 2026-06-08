# Sistema de Gestión Hotelera — Proyecto Final BD III

Sistema de gestión hotelera con **persistencia políglota**: **PostgreSQL** para el núcleo transaccional (reservas, facturación, pagos) y **MongoDB** para los datos flexibles (perfiles de huésped, incidencias, reseñas). Toda la lógica vive en la base de datos (funciones, stored procedures, vistas, vistas materializadas y pipelines de aggregation); la API es una capa fina que los expone por HTTP y el frontend los consume.

---

## Estructura del repositorio

```
/                      normalizarResena.js  (función compartida, la importa la API)
package.json         (dependencias de normalizarResena: mongodb)
/api                   API REST (Node + Express + pg + mongoose)    → puerto 3000
/documentos            documentación del proyecto (decisiones, performance, RESPALDO.md, bitácora IA)
/Faker                 generador de datos de prueba (seed.js + dependencias Faker)
/frontend              SPA (React + Vite + Tailwind)               → puerto 5173
/scripts               backup.bat, restore.bat
/sql                   scripts SQL: schema, funciones, procedures, vistas e índices
```

---

## Requisitos previos

- **PostgreSQL** 14 o superior (el proyecto se desarrolló en 18).
- **MongoDB** 6 o superior, y las **MongoDB Database Tools** (`mongodump`/`mongorestore`, necesarias para el respaldo).
- **Node.js** 18 o superior.
- Opcionales para administración: pgAdmin y MongoDB Compass.

---

## Instalación desde cero

### 1. PostgreSQL

1. **Crear la base.** En pgAdmin (clic derecho en Databases → Create → Database) o por consola:
   ```bash
   createdb -U postgres -h localhost hotel_db
   ```
2. **Crear las tablas.** Ejecutar `schema_hotel.sql` sobre `hotel_db` (crea las 12 tablas con sus PK, FK, CHECK y UNIQUE).
3. **Activar el anti-solape (RN-01).** Ejecutar después de las tablas:
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ALTER TABLE reserva ADD CONSTRAINT no_solape_reserva
     EXCLUDE USING gist (
       id_habitacion WITH =,
       daterange(fecha_inicio, fecha_fin) WITH &&
     )
     WHERE (estado IN ('confirmada','en_curso','completada'));
   ```
4. **Crear los objetos de base de datos.** Ejecutar los scripts SQL en este orden: funciones (`fn_*`), stored procedures (`sp_*`), vistas (`v_*`), vistas materializadas (`mv_*`) e índices.

### 2. MongoDB

1. **Crear la base y las colecciones con sus validadores e índices.** En la mongosh de Compass, conectado a `mongodb://localhost:27017`, ejecutar el script de setup de Mongo (`use hotel_db` + los `db.createCollection(...)` con `$jsonSchema` de `perfiles_huesped`, `incidencias` y `resenas`, y sus `createIndex(...)`).

### 3. Datos de prueba

Genera datos coherentes con Faker (respeta el exclusion constraint, las FK y las reglas de negocio). Desde la carpeta del generador:
```bash
npm install                 # instala pg, mongodb y @faker-js/faker
# editar el bloque CONFIG de seed.js (contraseña de Postgres)
node seed.js
```
Carga ~50 habitaciones, 80 huéspedes, 250+ reservas, 800+ consumos, 200+ facturas, 60 perfiles, 40 incidencias y 120 reseñas. Es re-ejecutable (limpia antes de cargar).

### 4. API

```bash
cd api
npm install
copy .env.example .env       # PowerShell: Copy-Item .env.example .env
# editar .env y poner la contraseña real de Postgres
npm run dev
```
Queda en `http://localhost:3000`. Verificación rápida: `http://localhost:3000/` responde `{ "ok": true, "servicio": "hotel-api" }`.

Contenido de `api/.env`:
```env
PORT=3000
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=hotel_db
PG_USER=postgres
PG_PASSWORD=tu_password_aqui
MONGO_URI=mongodb://localhost:27017/hotel_db
```

### 5. Frontend

En otra terminal:
```bash
cd frontend
npm install
copy .env.example .env       # opcional; por defecto apunta a http://localhost:3000
npm run dev
```
Queda en `http://localhost:5173`. Abrirlo en el navegador.

---

## Uso

El frontend tiene cuatro secciones:

1. **Explorar** — tablas navegables de reservas (con filtro por estado), habitaciones, huéspedes y facturas; las acciones parten de la tabla (botón Check-out en reservas en curso, Registrar pago en facturas con saldo).
2. **Reservas** — crear reserva y consultar disponibilidad por rango.
3. **Check-out / Pagos** — ver saldo, hacer check-out y registrar pagos.
4. **Reportes** — los reportes gerenciales (ocupación, top huéspedes, satisfacción, aspectos mejorables, incidencias, perfil recurrente).

---

## Respaldo y restauración

Ver `RESPALDO.md` para la estrategia completa. Scripts (Windows):
```bat
backup.bat                                   REM genera el respaldo full (Postgres + Mongo)
restore.bat C:\backups\hotel_db_full_XXXX.backup   REM restaura sobre base limpia y valida
```

---

## Documentación

- **`api/ENDPOINTS.md`** — cada endpoint de la API y a qué objeto de base de datos invoca.
- **Documento de decisiones de diseño (#3)** — justificación de cada decisión (motores, schema vs procedure, MongoDB).
- **Reporte de performance (#4)** — `EXPLAIN ANALYZE`, justificación de índices y estrategia de refresh.
- **`RESPALDO.md`** — estrategia de respaldo.
- **Bitácora de uso de IA** — qué se pidió a la IA, qué se modificó y qué errores se corrigieron.

---

## Nota sobre la persistencia políglota

El endpoint `GET /reportes/perfil-recurrente` es el que demuestra la integración de los dos motores: PostgreSQL calcula los huéspedes con más de 3 estadías (consulta transaccional) y MongoDB agrega sus preferencias, alergias e idiomas (datos de perfil). La aplicación une ambos resultados.
