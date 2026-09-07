# MineNav-X

AI-Powered Multi-Sensor Vehicle Navigation and Safety System for Low-Visibility Mining Environments.

## Structure
- `/backend`: FastAPI Python backend for simulation, sensor fusion, and safety engine.
- `/frontend`: React + Vite frontend for professional dashboard and visualization.

## Run Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Run Frontend
```bash
cd frontend
npm install
npm run dev
```
