from typing import Optional, List
from fastapi import APIRouter, Query, BackgroundTasks
from models import EventoOut, GeoJSONFeatureCollection, GeoJSONFeature, GeoJSONGeometry, CENTER_VITORIA
from database import db
from etl.kulturklik import ejecutar_etl_kulturklik
from etl.opendata_vg import ejecutar_etl_opendata

router = APIRouter(prefix="/eventos", tags=["Eventos"])

@router.get("", response_model=List[EventoOut])
def listar_eventos(
    categoria: Optional[str] = Query(None),
    fecha_min: Optional[str] = Query(None, description="Fecha mínima (YYYY-MM-DD), por defecto hoy"),
    limit: int = Query(50, ge=1, le=50, description="Límite máximo de 50 según AGENTS.md"),
    offset: int = Query(0, ge=0)
):
    """Lista eventos culturales de Vitoria-Gasteiz desde la fecha actual"""
    from datetime import date
    f_date = date.fromisoformat(fecha_min) if fecha_min else None
    eventos, _ = db.listar_eventos(categoria=categoria, fecha_min=f_date, limit=limit, offset=offset)
    return eventos

@router.get("/cercanos", response_model=GeoJSONFeatureCollection)
def obtener_eventos_cercanos(
    lat: float = Query(CENTER_VITORIA["lat"]),
    lon: float = Query(CENTER_VITORIA["lon"]),
    categoria: Optional[str] = Query(None),
    fecha_min: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=50),
    offset: int = Query(0, ge=0)
):
    """Devuelve eventos en formato GeoJSON RFC 7946 [lon, lat]"""
    from datetime import date
    f_date = date.fromisoformat(fecha_min) if fecha_min else None
    eventos, total = db.listar_eventos(
        center_lon=lon,
        center_lat=lat,
        categoria=categoria,
        fecha_min=f_date,
        limit=limit,
        offset=offset
    )

    features = []
    for e in eventos:
        features.append(GeoJSONFeature(
            type="Feature",
            geometry=GeoJSONGeometry(
                type="Point",
                coordinates=[e.lon, e.lat]  # [longitud, latitud]
            ),
            properties={
                "id": e.id,
                "external_id": e.external_id,
                "titulo": e.titulo,
                "categoria": e.categoria,
                "descripcion": e.descripcion,
                "espacio": e.espacio,
                "direccion": e.direccion,
                "fecha_inicio": str(e.fecha_inicio),
                "fecha_fin": str(e.fecha_fin) if e.fecha_fin else None,
                "hora": e.hora,
                "precio": e.precio,
                "imagen_url": e.imagen_url,
                "enlace_web": e.enlace_web,
                "distancia_metros": e.distancia_metros
            }
        ))

    return GeoJSONFeatureCollection(
        type="FeatureCollection",
        features=features,
        total=total
    )

@router.post("/sync")
def sincronizar_eventos(background_tasks: BackgroundTasks):
    """Dispara la ingesta de datos en segundo plano desde Kulturklik y Open Data VG"""
    def _run_sync():
        ejecutar_etl_opendata()
        ejecutar_etl_kulturklik()

    background_tasks.add_task(_run_sync)
    return {
        "status": "sincronizacion_iniciada",
        "mensaje": "La tarea de ingesta ETL se está ejecutando en segundo plano."
    }
