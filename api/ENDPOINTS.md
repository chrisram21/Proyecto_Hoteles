# API de Gestión Hotelera — Documentación de Endpoints

La API es una **capa fina** sobre las dos bases de datos. No contiene lógica de negocio: solo
invoca funciones, stored procedures, vistas y pipelines que **ya existen** en PostgreSQL y MongoDB.

- Base URL: `http://localhost:3000`
- Formato: JSON (request y response).
- CORS habilitado para el frontend (`http://localhost:5173`).

## Manejo de errores

| Situación | Respuesta |
|-----------|-----------|
| Una EXCEPTION de PL/pgSQL (`RAISE EXCEPTION`, código `P0001`) o una violación de integridad (`23xxx`) | `HTTP 400` con `{ "error": "<mensaje del procedure>" }` |
| `normalizarResena` rechaza una calificación inválida | `HTTP 400` con `{ "error": "Calificación inválida en ..." }` |
| El documento no pasa el validador `$jsonSchema` de Mongo (error 121) | `HTTP 400` con `{ "error": "..." }` |
| Cualquier otro error inesperado | `HTTP 500` con `{ "error": "Error interno del servidor" }` |

Esto permite que el frontend muestre directamente el mensaje en español que define la base.

---

## Endpoints PostgreSQL (transaccional)

### POST `/reservas`
- **Objeto BD:** `CALL sp_realizar_reserva(p_id_huesped, p_id_habitacion, p_fecha_inicio, p_fecha_fin, p_num_huespedes, INOUT p_id_reserva)`
- **Crea** reserva + factura preliminar. El id se devuelve por el parámetro `INOUT` (se pasa `NULL`).
- **Requerimiento:** OC — alta de reserva con validación de solape, mantenimiento y capacidad.
- **Body:**
  ```json
  { "id_huesped": 3, "id_habitacion": 12, "fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-04", "num_huespedes": 2 }
  ```
- **Response 201:**
  ```json
  { "id_reserva": 87 }
  ```
- **Error 400 (ejemplo):**
  ```json
  { "error": "La habitacion 12 ya esta reservada en ese rango" }
  ```

### POST `/reservas/:id/checkout`
- **Objeto BD:** `CALL sp_checkout(p_id_reserva, p_monto_pago, p_metodo)`
- **Cierra** factura, registra pago, completa la reserva y deja la habitación en limpieza.
- **Requerimiento:** OC — check-out.
- **Body:**
  ```json
  { "monto_pago": 450.00, "metodo": "tarjeta" }
  ```
- **Response 200:**
  ```json
  { "ok": true, "id_reserva": 87, "mensaje": "Check-out realizado" }
  ```
- **Error 400 (ejemplo):** `{ "error": "La reserva no esta en curso" }`

### POST `/facturas/:id/pagos`
- **Objeto BD:** `CALL sp_registrar_pago(p_id_factura, p_monto, p_metodo)`
- **Registra** un pago sobre una factura.
- **Requerimiento:** OC — pagos parciales.
- **Body:**
  ```json
  { "monto": 100.00, "metodo": "efectivo" }
  ```
- **Response 201:**
  ```json
  { "ok": true, "id_factura": 54, "mensaje": "Pago registrado" }
  ```
- **Error 400 (ejemplo):** `{ "error": "El pago excede el saldo de la factura" }`

### GET `/reservas/:id/saldo`
- **Objeto BD:** `SELECT fn_saldo_reserva(:id)`
- **Requerimiento:** consulta de saldo (total factura − pagos).
- **Response 200:**
  ```json
  { "id_reserva": 87, "saldo": 350.00 }
  ```

### GET `/disponibilidad/ahora`
- **Objeto BD:** `SELECT * FROM v_disponibilidad_inmediata`
- **Columnas:** `id_habitacion, numero, piso, tipo, capacidad, precio_noche`.
- **Response 200:** array de habitaciones libres ahora.

### GET `/disponibilidad?tipo=&inicio=&fin=`
- **Objeto BD:** `SELECT * FROM fn_disponibilidad_rango(:tipo, :inicio, :fin)`
- **Query:** `tipo` (id_tipo), `inicio` (DATE), `fin` (DATE).
- **Columnas:** `id_habitacion, numero, piso, precio_noche`.
- **Ejemplo:** `/disponibilidad?tipo=2&inicio=2026-07-01&fin=2026-07-04`

### GET `/huespedes/hospedados`
- **Objeto BD:** `SELECT * FROM v_huespedes_hospedados`
- **Columnas:** `id_reserva, id_huesped, huesped, habitacion, check_in, check_out_estimado, dias_transcurridos`.

### GET `/reportes/ocupacion`
- **Objeto BD:** `SELECT * FROM mv_ocupacion_mensual` (vista materializada)
- **Columnas:** `mes, tipo, reservas, noches_vendidas, ingresos_hospedaje, ingresos_consumos`.
- **Requerimiento:** RC — ocupación e ingresos por mes/tipo.

### GET `/reportes/top-huespedes`
- **Objeto BD:** `SELECT * FROM mv_top_huespedes` (vista materializada)
- **Columnas:** `id_huesped, huesped, total_estadias, gasto_total`.
- **Requerimiento:** RC — ranking de huéspedes.

### Endpoints de apoyo (SELECT directo, solo lectura)

| Endpoint | Tabla | Uso |
|----------|-------|-----|
| GET `/tipos-habitacion` | `tipo_habitacion` | Poblar selects del formulario |
| GET `/huespedes` | `huesped` | Poblar selects / listado en "Explorar" |
| GET `/servicios` | `servicio_extra` | Catálogo de servicios |

---

## Endpoints de lectura para la sección "Explorar" (SELECT directo, solo lectura)

Endpoints **aditivos** que alimentan las tablas navegables del frontend. No tocan objetos de BD,
son solo `SELECT`.

### GET `/reservas?estado=`
- **Objeto BD:** `SELECT` con joins `reserva` + `huesped` + `habitacion` + `LEFT JOIN factura`.
- **Query opcional:** `estado` (`pendiente`, `confirmada`, `en_curso`, `completada`, `cancelada`, `no_show`).
- **Devuelve:** una fila por reserva con id, huésped (nombre completo), número de habitación, fechas,
  estado, y `id_factura` + `total` de la factura asociada.
- **Ejemplo:** `/reservas?estado=en_curso`
- **Response 200:**
  ```json
  [
    { "id_reserva": 87, "id_huesped": 3, "huesped": "Ana Perez", "id_habitacion": 12, "habitacion": "301", "fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-04", "estado": "en_curso", "id_factura": 54, "total": 450.00 }
  ]
  ```
- **Uso UI:** tabla de Reservas; las filas `en_curso` muestran el botón **Check-out**.

### GET `/reservas/:id/detalle`
- **Objeto BD:** `SELECT * FROM reserva`, `SELECT * FROM factura WHERE id_reserva`, y `fn_saldo_reserva`.
- **Devuelve:** la reserva, sus facturas y el saldo pendiente.
- **Response 200:**
  ```json
  { "reserva": { "id_reserva": 87, "estado": "en_curso" }, "facturas": [ { "id_factura": 54, "total": 450.00, "estado": "pendiente" } ], "saldo": 350.00 }
  ```
- **Uso UI:** modal de detalle al hacer clic en el id de una reserva.

### GET `/habitaciones`
- **Objeto BD:** `SELECT` join `habitacion` + `tipo_habitacion`.
- **Devuelve:** `id_habitacion, numero, piso, estado, id_tipo, tipo`.
- **Response 200:**
  ```json
  [ { "id_habitacion": 12, "numero": "301", "piso": 3, "estado": "disponible", "id_tipo": 2, "tipo": "Doble" } ]
  ```

### GET `/facturas?estado=&reserva=`
- **Objeto BD:** `SELECT id_factura, id_reserva, total, estado FROM factura`.
- **Query opcional:** `estado` (`pendiente`, `pagada_parcial`, `pagada`), `reserva` (id_reserva).
- **Response 200:**
  ```json
  [ { "id_factura": 54, "id_reserva": 87, "total": 450.00, "estado": "pendiente" } ]
  ```
- **Uso UI:** tabla de Facturas; las filas `pendiente`/`pagada_parcial` muestran **Registrar pago**.

---

## Endpoints MongoDB (datos flexibles)

> Los campos `huesped_id` y `reserva_id` se guardan/filtran como `Int32` (BSON).

### POST `/resenas`
- **Lógica:** importa y usa `normalizarResena(datos)` de `normalizarResena.js` (valida calificaciones
  1–5, normaliza los arrays de aspectos y calcula el promedio), luego `insertOne` en la colección
  `resenas` respetando el validador `$jsonSchema`. La inserción se hace con el driver nativo
  (`mongoose.connection.db.collection('resenas')`) para preservar los tipos `Int32`.
- **Requerimiento:** RC — alta de reseñas con denormalización del promedio.
- **Body:**
  ```json
  {
    "reserva_id": 87,
    "huesped_id": 3,
    "fecha": "2026-07-05",
    "calificaciones": { "limpieza": 5, "atencion": 4, "ubicacion": 5, "confort": 4, "calidad_precio": 3 },
    "comentario": "Muy buena estadia",
    "aspectos_destacables": ["Limpieza", "trato"],
    "aspectos_mejorables": ["wifi"]
  }
  ```
- **Response 201:**
  ```json
  { "ok": true, "id": "66b0...", "promedio": 4.2 }
  ```
- **Error 400 (ejemplo):** `{ "error": "Calificación inválida en \"limpieza\": debe ser un entero entre 1 y 5" }`

### GET `/reportes/satisfaccion` — **RC-08**
- **Pipeline:** agrupa `resenas` por trimestre (`$dateTrunc` unit `quarter`) y promedia (`$avg`) cada
  métrica de `calificaciones` más el `promedio`.
- **Response 200 (ejemplo):**
  ```json
  [
    { "trimestre": "2026-04-01T00:00:00Z", "limpieza": 4.6, "atencion": 4.3, "ubicacion": 4.8, "confort": 4.2, "calidad_precio": 3.9, "promedio_general": 4.36, "total_resenas": 25 }
  ]
  ```

### GET `/reportes/aspectos-mejorables` — **RC-09**
- **Pipeline:** `$unwind` de `aspectos_mejorables` → agrupa por (aspecto, trimestre) contando menciones
  → reagrupa por aspecto guardando la tendencia trimestral en un array → ordena por total desc.
- **Response 200 (ejemplo):**
  ```json
  [
    { "aspecto": "wifi", "total": 14, "tendencia": [ { "trimestre": "2026-01-01T00:00:00Z", "menciones": 6 }, { "trimestre": "2026-04-01T00:00:00Z", "menciones": 8 } ] }
  ]
  ```

### GET `/reportes/incidencias` — **RC-10**
- **Pipeline único con `$facet`** (tres salidas):
  - `por_categoria`: conteo por `categoria`.
  - `tasa_resolucion`: `resueltas / total * 100` (resueltas = `estado_resolucion === 'resuelta'`).
  - `tiempo_resolucion_horas`: `max(acciones.fecha) − fecha_reporte` promediado, en horas. Filtra
    solo documentos con `estado_resolucion: 'resuelta'` y al menos una acción (`"acciones.0": { $exists: true }`)
    para no dividir por documentos sin acciones. Cada elemento de `acciones` tiene
    `descripcion`, `responsable` y `fecha`.
- **Response 200 (ejemplo):**
  ```json
  {
    "por_categoria": [ { "categoria": "limpieza", "total": 8 } ],
    "tasa_resolucion": [ { "total": 30, "resueltas": 24, "porcentaje": 80.0 } ],
    "tiempo_resolucion_horas": [ { "promedio_horas": 5.4 } ]
  }
  ```

### GET `/reportes/perfil-recurrente` — **RC-11 (políglota)**
- **Paso 1 (PostgreSQL):** `SELECT id_huesped FROM reserva WHERE estado = 'completada' GROUP BY id_huesped HAVING COUNT(*) > 3`.
- **Paso 2 (MongoDB):** esa lista (casteada a `Int32`) se pasa a un pipeline sobre `perfiles_huesped`
  con `$match { huesped_id: { $in: [...] } }` (ids casteados a `Int32`) y un `$facet` que hace
  `$unwind` de `idiomas` y `alergias`, y agrupa por `preferencias.tipo_almohada` y `preferencias.vista`.
- **Response 200 (ejemplo):**
  ```json
  {
    "huespedes_recurrentes": [3, 7, 15],
    "total_recurrentes": 3,
    "perfiles": {
      "idiomas": [ { "valor": "es", "total": 3 } ],
      "alergias": [ { "valor": "gluten", "total": 1 } ],
      "almohada": [ { "valor": "viscoelastica", "total": 2 } ],
      "vista": [ { "valor": "mar", "total": 2 } ]
    }
  }
  ```
- **Por qué importa:** es el endpoint que **cruza los dos motores** y demuestra la persistencia políglota.

---

## Nombres de esquema usados (confirmados contra la base real)

Nombres que no estaban en el enunciado y fueron confirmados; ya están aplicados en
`src/controllers/reportesController.js`:

- Tabla de reservas: **`reserva`** con columnas `id_huesped` y `estado` (valor `'completada'`).
- Colección `incidencias`: campo de estado **`estado_resolucion`** (valor `'resuelta'`), campo
  `categoria`, campo `fecha_reporte`, y `acciones` como array de objetos con `descripcion`,
  `responsable` y `fecha`.
- Colección `perfiles_huesped`: arrays `idiomas` y `alergias`, y objeto `preferencias` con
  **`tipo_almohada`** y `vista`.
- En `incidencias` y `perfiles_huesped`, los campos `huesped_id` y `reserva_id` están guardados
  como `Int32`; en RC-11 los ids del `$in` se castean a `Int32`.
- Tablas de apoyo: claves `id_tipo` (`tipo_habitacion`), `id_huesped` (`huesped`),
  `id_servicio` (`servicio_extra`).
