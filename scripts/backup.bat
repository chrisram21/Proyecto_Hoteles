@echo off
REM ============================================================
REM  backup.bat - Respaldo full de hotel_db (PostgreSQL + MongoDB)
REM  Proyecto Final BD III - Escenario Hotel
REM  Editar el bloque CONFIG antes de usar.
REM ============================================================

REM --------- CONFIG (ajustar) ---------
set PG_BIN=C:\Program Files\PostgreSQL\18\bin
set PGUSER=postgres
set PGHOST=localhost
set PGDATABASE=hotel_db
set PGPASSWORD=CirceChild
set BACKUP_DIR=C:\backups
set MONGO_BIN=C:\Program Files\MongoDB\Tools\100\bin
REM  mongodump viene de "MongoDB Database Tools"; si no se reconoce,
REM  instalalo o agrega su carpeta al PATH.

REM --------- timestamp yyyyMMdd_HHmmss ---------
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set STAMP=%%i

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo [1/2] Backup full de PostgreSQL...
"%PG_BIN%\pg_dump.exe" -U %PGUSER% -h %PGHOST% -F c -d %PGDATABASE% -f "%BACKUP_DIR%\hotel_db_full_%STAMP%.backup"
if errorlevel 1 ( echo ERROR en pg_dump & goto :fin )

echo [2/2] Backup de MongoDB...
"%MONGO_BIN%\mongodump.exe" --db=%PGDATABASE% --out="%BACKUP_DIR%\mongo_%STAMP%"
if errorlevel 1 ( echo ERROR en mongodump & goto :fin )

echo.
echo Respaldo completado en %BACKUP_DIR%
echo   - PostgreSQL: hotel_db_full_%STAMP%.backup
echo   - MongoDB:    mongo_%STAMP%\

:fin
set PGPASSWORD=
pause
