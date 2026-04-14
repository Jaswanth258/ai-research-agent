@echo off
echo ==============================================
echo   Starting Agentic Research Bot (Web Mode)
echo ==============================================

echo [0/2] Cleaning up old processes...
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr :8000') DO taskkill /F /PID %%T >nul 2>&1
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr :5173') DO taskkill /F /PID %%T >nul 2>&1

echo [1/2] Starting Python Backend API on port 8000...
start "Backend API" cmd /c ".\venv\Scripts\activate && python main.py --web"

echo [2/2] Starting Vite Frontend on port 5173...
start "Frontend UI" cmd /c "cd frontend && npm run dev"

echo.
echo Both servers are starting up!
echo Navigate your browser to http://localhost:5173
echo.
pause
