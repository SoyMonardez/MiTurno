@echo off
title MiTurno - Iniciando...
color 0A

echo.
echo  ╔══════════════════════════════════════╗
echo  ║          MiTurno - Inicio            ║
echo  ╚══════════════════════════════════════╝
echo.

:: Verificar si Docker Desktop está corriendo
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo  [!] Docker Desktop no está corriendo. Iniciando...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo  [.] Esperando que Docker esté listo...
    :esperar
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 goto esperar
    echo  [OK] Docker Desktop listo.
) else (
    echo  [OK] Docker Desktop ya está corriendo.
)

echo.
echo  [.] Levantando servicios...
cd /d "%~dp0"
docker compose up -d

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║  MiTurno está corriendo                          ║
echo  ║                                                  ║
echo  ║  Página principal:  http://localhost:5173        ║
echo  ║  Panel admin:       http://localhost:5173/admin  ║
echo  ║  API docs:          http://localhost:8000/docs   ║
echo  ║                                                  ║
echo  ║  Admin: usuario=admin  dni=30111222              ║
echo  ║         contraseña=admin1234                     ║
echo  ╚══════════════════════════════════════════════════╝
echo.
echo  Presioná cualquier tecla para abrir el navegador...
pause >nul
start http://localhost:5173
