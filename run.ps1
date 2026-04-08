Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Starting Agentic Research Bot (Web Mode)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

Write-Host "`n[1/2] Starting Python Backend API on port 8000..." -ForegroundColor Yellow
Start-Process -NoNewWindow -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", ".\venv\Scripts\activate; python main.py --web"

Start-Sleep -Seconds 2

Write-Host "[2/2] Starting Vite Frontend on port 5173..." -ForegroundColor Yellow
Start-Process -NoNewWindow -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "`nBoth servers are starting up!" -ForegroundColor Green
Write-Host "Navigate your browser to http://localhost:5173" -ForegroundColor Green
Write-Host "`nPress Ctrl+C to stop both servers when you are done.`n"
