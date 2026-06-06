@echo off
echo Starting Backend...
cd backend
start cmd /k "python -m venv venv && call venv\Scripts\activate && pip install -r requirements.txt && python main.py"

echo Starting Frontend...
cd ../frontend
start cmd /k "npm run dev"

echo Both services are starting...
