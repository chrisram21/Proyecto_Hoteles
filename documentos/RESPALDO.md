# Estrategia de Respaldo — Proyecto Hotel BD III

Cubre el requisito **5.6** del enunciado: backup full, backup incremental, política de retención y demostración de restauración. El respaldo formal se centra en **PostgreSQL** (donde viven los datos transaccionales críticos); **MongoDB** se respalda con `mongodump`, que es lo razonable para el alcance del proyecto.

Los comandos están automatizados en `backup.bat` (respaldar) y `restore.bat` (restaurar y validar). Antes de usarlos, editá el bloque de configuración de cada `.bat` (ruta del `bin` de PostgreSQL, usuario, contraseña y carpeta de destino).

---

## 1. Backup full — `pg_dump`

El backup completo usa `pg_dump` en **formato custom** (`-F c`): un archivo comprimido con todo el contenido de `hotel_db` — esquema, datos y todos los objetos (funciones, procedures, vistas, vistas materializadas, el *exclusion constraint* y la extensión `btree_gist`).

```bat
pg_dump -U postgres -h localhost -F c -d hotel_db -f hotel_db_full_<fecha>.backup
```

**Por qué es consistente:** `pg_dump` corre dentro de una transacción interna, así que toma una **foto coherente** de la base en el instante en que se ejecuta, aunque haya operaciones en curso. Es el punto de restauración completo de la estrategia. El formato custom además permite restaurar selectivamente con `pg_restore`.

## 2. Backup incremental — WAL archiving

PostgreSQL escribe cada cambio primero en el **WAL** (Write-Ahead Log) antes de aplicarlo a las tablas. Archivar esos segmentos de WAL es la forma de respaldo **incremental**: en lugar de volver a copiar toda la base, se guarda solo el registro de los cambios desde el último full, lo que permite recuperar hasta el último momento.

Se activa **una sola vez** en `postgresql.conf` y requiere reiniciar el servicio de PostgreSQL:

```conf
wal_level = replica
archive_mode = on
archive_command = 'copy "%p" "C:\\backups\\wal\\%f"'
```

- `%p` es la ruta del segmento de WAL completado y `%f` su nombre; el `archive_command` lo copia a la carpeta de archivado.
- Con esto, el respaldo full diario + los WAL archivados entre fulls dan recuperación incremental.

> **Nota de alcance:** para este proyecto, la **demostración de restauración** se hace con el backup full (es lo que se valida en vivo). El WAL archiving queda activado y documentado como el mecanismo incremental; montar un PITR (point-in-time recovery) completo excede lo que pide el enunciado.

## 3. Backup de MongoDB — `mongodump`

```bat
mongodump --db=hotel_db --out=mongo_<fecha>
```

Respalda las 3 colecciones (`perfiles_huesped`, `incidencias`, `resenas`) con sus validadores e índices. Se restaura con `mongorestore --db=hotel_db mongo_<fecha>\hotel_db`.

## 4. Política de retención

| Tipo de respaldo | Frecuencia | Retención |
|---|---|---|
| Full PostgreSQL (`pg_dump`) | Diario (de noche, junto al refresh de las materializadas) | 7 días |
| WAL archivados | Continuo | Hasta el siguiente full diario |
| Full semanal | Domingos | 4 semanas |
| MongoDB (`mongodump`) | Diario | 7 días |

**Justificación:** los fulls diarios cubren la recuperación reciente; el full semanal a 4 semanas da margen ante errores detectados tarde; los WAL permiten recuperar hasta el último momento sin esperar al siguiente full. El refresh nocturno de las materializadas y el backup full se programan en la misma ventana de baja carga.

## 5. Restauración (demostración en vivo)

Se hace sobre una base **limpia** y se valida la integridad comparando con la base original. Está automatizado en `restore.bat`:

1. Crear una base limpia (`hotel_db_restore`).
2. `pg_restore` del archivo full sobre esa base.
3. **Validar integridad**: contar filas y verificar que los objetos existen.

```bat
createdb -U postgres -h localhost hotel_db_restore
pg_restore -U postgres -h localhost --no-owner -d hotel_db_restore hotel_db_full_<fecha>.backup
```

Consultas de validación (deben coincidir con la base original):

```sql
SELECT COUNT(*) FROM reserva;     -- 322
SELECT COUNT(*) FROM consumo;     -- 1037
SELECT COUNT(*) FROM factura;     -- 322

-- los objetos también deben haberse restaurado, no solo los datos:
SELECT proname FROM pg_proc WHERE proname LIKE 'fn_%' OR proname LIKE 'sp_%';
SELECT matviewname FROM pg_matviews;
SELECT conname FROM pg_constraint WHERE conname = 'no_solape_reserva';
```

Si los conteos coinciden y aparecen las funciones (`fn_*`/`sp_*`), las vistas materializadas y el constraint `no_solape_reserva`, la restauración fue **íntegra**. Ese es el momento que se muestra en la defensa.

## 6. Uso de los scripts

```bat
REM respaldar (genera full de Postgres + mongodump, con fecha en el nombre)
backup.bat

REM restaurar sobre base limpia y validar (pasar el archivo .backup generado)
restore.bat C:\backups\hotel_db_full_20260607_030000.backup
```

---

