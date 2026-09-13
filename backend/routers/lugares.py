from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException
from models import LugarOut, GeoJSONFeatureCollection, GeoJSONFeature, GeoJSONGeometry, CategoriaStats, CENTER_VITORIA
from database import db

router = APIRouter(prefix="/lugares", tags=["Lugares"])

@router.get("/cercanos", response_model=GeoJSONFeatureCollection)
def obtener_lugares_cercanos(
    lat: float = Query(CENTER_VITORIA["lat"], description="Latitud del centro de búsqueda"),
    lon: float = Query(CENTER_VITORIA["lon"], description="Longitud del centro de búsqueda"),
    radio: Optional[float] = Query(None, description="Radio de búsqueda en metros (ej. 500, 1000, 3000)"),
    categoria: Optional[str] = Query(None, description="Filtro por categoría canónica"),
    search: Optional[str] = Query(None, description="Término de búsqueda léxica"),
    limit: int = Query(50, ge=1, le=50, description="Paginación máxima de 50 elementos según AGENTS.md"),
    offset: int = Query(0, ge=0)
):
    """
    Endpoint geoespacial principal: devuelve lugares cercanos en formato GeoJSON RFC 7946 [lon, lat].
    Ordenados por distancia geodésica ascendente.
    """
    lugares, total = db.buscar_lugares_cercanos(
        center_lon=lon,
        center_lat=lat,
        radio_metros=radio,
        categoria=categoria,
        search=search,
        limit=limit,
        offset=offset
    )

    features = []
    for l in lugares:
        features.append(GeoJSONFeature(
            type="Feature",
            geometry=GeoJSONGeometry(
                type="Point",
                coordinates=[l.lon, l.lat]  # Orden RFC 7946: [longitud, latitud]
            ),
            properties={
                "id": l.id,
                "external_id": l.external_id,
                "fuente_origen": l.fuente_origen,
                "nombre": l.nombre,
                "categoria": l.categoria,
                "subcategoria": l.subcategoria,
                "descripcion": l.descripcion,
                "direccion": l.direccion,
                "imagen_url": l.imagen_url,
                "telefono": l.telefono,
                "web": l.web,
                "distancia_metros": l.distancia_metros
            }
        ))

    return GeoJSONFeatureCollection(
        type="FeatureCollection",
        features=features,
        total=total
    )

@router.get("", response_model=List[LugarOut])
def listar_lugares(
    categoria: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=50),
    offset: int = Query(0, ge=0)
):
    """Lista lugares con paginación máxima de 50 elementos"""
    lugares, _ = db.buscar_lugares_cercanos(
        categoria=categoria,
        search=search,
        limit=limit,
        offset=offset
    )
    return lugares

@router.get("/categorias", response_model=List[CategoriaStats])
def obtener_categorias():
    """Devuelve estadísticas y conteo de las categorías canónicas"""
    return db.obtener_estadisticas_categorias()

@router.get("/{id}", response_model=LugarOut)
def obtener_lugar_detalle(id: str):
    """Obtiene el detalle completo de un lugar por su UUID o external_id"""
    for l in db.lugares.values():
        if l.id == id or l.external_id == id:
            return l
    raise HTTPException(status_code=404, detail="Lugar no encontrado en Vitoria-Gasteiz")
