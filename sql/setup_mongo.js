// ============================================================
// setup_mongo.js — Creación de colecciones con validadores e índices
// Proyecto Final BD III — Sistema de Gestión Hotelera
//
// Uso: pegar en la mongosh de Compass estando conectado a localhost:27017
//      o ejecutar: mongosh hotel_db setup_mongo.js
// ============================================================

use hotel_db

// ── 1. perfiles_huesped ─────────────────────────────────────
db.createCollection("perfiles_huesped", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["huesped_id", "preferencias", "idiomas"],
      properties: {
        huesped_id: {
          bsonType: "int",
          description: "FK logica a huesped.id_huesped en PostgreSQL"
        },
        preferencias: {
          bsonType: "object",
          required: ["tipo_almohada", "temperatura", "vista"],
          properties: {
            tipo_almohada: { bsonType: "string" },
            temperatura:   { bsonType: "int", minimum: 16, maximum: 30 },
            vista:         { bsonType: "string" }
          }
        },
        idiomas: {
          bsonType: "array",
          minItems: 1,
          items: { bsonType: "string" }
        },
        alergias: {
          bsonType: "array",
          items: { bsonType: "string" }
        },
        restricciones_alimentarias: {
          bsonType: "array",
          items: { bsonType: "string" }
        },
        peticiones_especiales: {
          bsonType: "array",
          items: { bsonType: "string" }
        },
        programa_lealtad: {
          bsonType: "object",
          properties: {
            nivel:          { bsonType: "string", enum: ["bronce", "plata", "oro", "platino"] },
            puntos:         { bsonType: "int", minimum: 0 },
            miembro_desde:  { bsonType: "date" }
          }
        },
        actualizado_en: { bsonType: "date" }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})

db.perfiles_huesped.createIndex(
  { huesped_id: 1 },
  { unique: true, name: "idx_perfiles_huesped_id" }
)

print("perfiles_huesped creada con validador e indice")

// ── 2. incidencias ──────────────────────────────────────────
db.createCollection("incidencias", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["reserva_id", "huesped_id", "categoria", "descripcion",
                 "estado_resolucion", "fecha_reporte"],
      properties: {
        reserva_id:        { bsonType: "int" },
        huesped_id:        { bsonType: "int" },
        categoria:         { bsonType: "string", enum: ["queja", "solicitud", "observacion"] },
        descripcion:       { bsonType: "string" },
        estado_resolucion: { bsonType: "string", enum: ["abierta", "en_proceso", "resuelta"] },
        fecha_reporte:     { bsonType: "date" },
        acciones: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["descripcion", "responsable", "fecha"],
            properties: {
              descripcion:  { bsonType: "string" },
              responsable:  { bsonType: "string" },
              fecha:        { bsonType: "date" }
            }
          }
        }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})

db.incidencias.createIndex({ reserva_id: 1 }, { name: "idx_incidencias_reserva" })
db.incidencias.createIndex({ categoria: 1 },  { name: "idx_incidencias_categoria" })

print("incidencias creada con validador e indices")

// ── 3. resenas ──────────────────────────────────────────────
db.createCollection("resenas", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["reserva_id", "huesped_id", "fecha", "calificaciones", "promedio"],
      properties: {
        reserva_id: { bsonType: "int" },
        huesped_id: { bsonType: "int" },
        fecha:      { bsonType: "date" },
        calificaciones: {
          bsonType: "object",
          required: ["limpieza", "atencion", "ubicacion", "confort", "calidad_precio"],
          properties: {
            limpieza:       { bsonType: "int", minimum: 1, maximum: 5 },
            atencion:       { bsonType: "int", minimum: 1, maximum: 5 },
            ubicacion:      { bsonType: "int", minimum: 1, maximum: 5 },
            confort:        { bsonType: "int", minimum: 1, maximum: 5 },
            calidad_precio: { bsonType: "int", minimum: 1, maximum: 5 }
          }
        },
        promedio:             { bsonType: "double" },
        comentario:           { bsonType: "string" },
        aspectos_destacables: { bsonType: "array", items: { bsonType: "string" } },
        aspectos_mejorables:  { bsonType: "array", items: { bsonType: "string" } }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
})

db.resenas.createIndex({ reserva_id: 1 }, { unique: true, name: "idx_resenas_reserva" })
db.resenas.createIndex({ fecha: 1 },       { name: "idx_resenas_fecha" })

print("resenas creada con validador e indices")
print("Setup de MongoDB completado.")
