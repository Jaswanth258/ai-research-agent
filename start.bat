@echo off
echo ==============================================
echo   Starting Agentic Research Bot (Web Mode)
echo ==============================================

echo [1/2] Starting Python Backend API on port 8000...
start "Backend API" cmd /c ".\venv\Scripts\activate && python main.py --web"

echo [2/2] Starting Vite Frontend on port 5173...
start "Frontend UI" cmd /c "cd frontend && npm run dev"

echo.
echo Both servers are starting up!
echo Navigate your browser to http://localhost:5173
echo.
pause
