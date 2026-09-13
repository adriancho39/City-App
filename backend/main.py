import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from models import BBOX_VITORIA, CENTER_VITORIA
from database import db
from routers import lugares, eventos
from etl.opendata_vg import ejecutar_etl_opendata
from etl.kulturklik import ejecutar_etl_kulturklik

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("==================================================================")
    print("[SERVER] Vitoria-Gasteiz PWA Backend (FastAPI + PostGIS)")
    print(f"[BBOX] ST_MakeEnvelope({BBOX_VITORIA['min_lon']}, {BBOX_VITORIA['min_lat']}, {BBOX_VITORIA['max_lon']}, {BBOX_VITORIA['max_lat']}, 4326)")
    print(f"[CENTER] Centro Urbano: [{CENTER_VITORIA['lon']}, {CENTER_VITORIA['lat']}]")
    print("==================================================================")
    
    # Ingesta inicial de datos al arrancar
    try:
        ejecutar_etl_opendata()
        ejecutar_etl_kulturklik(limite=50)
    except Exception as e:
        print(f"[Lifespan] Advertencia en ingesta inicial: {e}")

    yield
    print("[Lifespan] Finalizando servicios del backend...")

app = FastAPI(
    title="Guía Vitoria-Gasteiz API",
    description="API REST geoespacial para turismo y ocio urbano en Vitoria-Gasteiz según protocolo AGENTS.md",
    version="1.0.0",
    lifespan=lifespan
)

# CORS para comunicación con el Frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montaje estricto de routers bajo el prefijo /api/v1 (AGENTS.md Regla 3.2)
api_v1 = FastAPI()
api_v1.include_router(lugares.router)
api_v1.include_router(eventos.router)

@api_v1.get("/health")
def healthcheck_v1():
    return {
        "status": "healthy",
        "protocolo": "AGENTS.md",
        "bounding_box": BBOX_VITORIA,
        "centro": CENTER_VITORIA,
        "total_lugares": len(db.lugares),
        "total_eventos": len(db.eventos)
    }

app.mount("/api/v1", api_v1)

@app.get("/health")
def healthcheck_root():
    return {
        "status": "ok",
        "api_v1": "/api/v1",
        "ciudad": "Vitoria-Gasteiz"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
