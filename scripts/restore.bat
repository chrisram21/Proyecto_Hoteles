@echo off
REM ============================================================
REM  restore.bat - Restauracion sobre base LIMPIA + validacion
REM  Proyecto Final BD III - Escenario Hotel
REM  Uso:  restore.bat C:\backups\hotel_db_full_XXXX.backup
REM ============================================================

REM --------- CONFIG (ajustar) ---------
set PG_BIN=C:\Program Files\PostgreSQL\18\bin
set PGUSER=postgres
set PGHOST=localhost
set PGPASSWORD=CirceChild
set RESTORE_DB=hotel_db_restore

if "%~1"=="" (
  echo Uso: restore.bat ruta\al\hotel_db_full_XXXX.backup
  goto :fin
)

echo [1/3] Creando base limpia %RESTORE_DB%...
"%PG_BIN%\dropdb.exe" -U %PGUSER% -h %PGHOST% --if-exists %RESTORE_DB%
"%PG_BIN%\createdb.exe" -U %PGUSER% -h %PGHOST% %RESTORE_DB%
if errorlevel 1 ( echo ERROR al crear la base & goto :fin )

echo [2/3] Restaurando backup full...
"%PG_BIN%\pg_restore.exe" -U %PGUSER% -h %PGHOST% --no-owner -d %RESTORE_DB% "%~1"

echo [3/3] Validando integridad...
echo --- Conteos (comparar con la base original) ---
"%PG_BIN%\psql.exe" -U %PGUSER% -h %PGHOST% -d %RESTORE_DB% -c "SELECT 'reservas' AS tabla, COUNT(*) FROM reserva UNION ALL SELECT 'consumos', COUNT(*) FROM consumo UNION ALL SELECT 'facturas', COUNT(*) FROM factura;"
echo --- Funciones y procedures restaurados ---
"%PG_BIN%\psql.exe" -U %PGUSER% -h %PGHOST% -d %RESTORE_DB% -c "SELECT proname FROM pg_proc WHERE proname LIKE 'fn_%%' OR proname LIKE 'sp_%%';"
echo --- Vistas materializadas ---
"%PG_BIN%\psql.exe" -U %PGUSER% -h %PGHOST% -d %RESTORE_DB% -c "SELECT matviewname FROM pg_matviews;"
echo --- Exclusion constraint anti-solape ---
"%PG_BIN%\psql.exe" -U %PGUSER% -h %PGHOST% -d %RESTORE_DB% -c "SELECT conname FROM pg_constraint WHERE conname='no_solape_reserva';"

echo.
echo Restauracion y validacion completadas sobre %RESTORE_DB%.

:fin
set PGPASSWORD=
pause
