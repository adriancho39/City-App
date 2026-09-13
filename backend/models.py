from typing import Optional, List, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime

# Categorías canónicas permitidas por AGENTS.md (Regla 4)
CategoriaCanonica = Literal[
    'patrimonio',
    'cultura',
    'naturaleza',
    'gastronomia',
    'ocio',
    'comercio'
]

# Bounding Box oficial de Vitoria-Gasteiz (EPSG:4326)
BBOX_VITORIA = {
    'min_lon': -2.7700,
    'max_lon': -2.5700,
    'min_lat': 42.7800,
    'max_lat': 42.9200
}

CENTER_VITORIA = {
    'lon': -2.6716,
    'lat': 42.8467
}

class Coordenadas(BaseModel):
    lon: float = Field(..., description="Longitud en EPSG:4326 (X)")
    lat: float = Field(..., description="Latitud en EPSG:4326 (Y)")

    @field_validator('lon')
    @classmethod
    def validar_longitud(cls, v: float) -> float:
        if not (BBOX_VITORIA['min_lon'] <= v <= BBOX_VITORIA['max_lon']):
            raise ValueError(f"Longitud {v} fuera del Bounding Box de Vitoria-Gasteiz [{BBOX_VITORIA['min_lon']}, {BBOX_VITORIA['max_lon']}]")
        return round(v, 6)

    @field_validator('lat')
    @classmethod
    def validar_latitud(cls, v: float) -> float:
        if not (BBOX_VITORIA['min_lat'] <= v <= BBOX_VITORIA['max_lat']):
            raise ValueError(f"Latitud {v} fuera del Bounding Box de Vitoria-Gasteiz [{BBOX_VITORIA['min_lat']}, {BBOX_VITORIA['max_lat']}]")
        return round(v, 6)

class LugarBase(BaseModel):
    external_id: str
    fuente_origen: str = "opendata_vg"
    nombre: str
    categoria: CategoriaCanonica
    subcategoria: Optional[str] = None
    descripcion: Optional[str] = None
    direccion: Optional[str] = None
    imagen_url: Optional[str] = None
    telefono: Optional[str] = None
    web: Optional[str] = None
    lon: float
    lat: float
    distancia_metros: Optional[float] = None

class LugarOut(LugarBase):
    id: str
    created_at: Optional[str] = None

class EventoBase(BaseModel):
    external_id: str
    fuente_origen: str = "kulturklik"
    titulo: str
    categoria: CategoriaCanonica = "cultura"
    descripcion: Optional[str] = None
    espacio: Optional[str] = None
    direccion: Optional[str] = None
    fecha_inicio: date
    fecha_fin: Optional[date] = None
    hora: Optional[str] = None
    precio: Optional[str] = None
    imagen_url: Optional[str] = None
    enlace_web: Optional[str] = None
    lon: float
    lat: float
    distancia_metros: Optional[float] = None

class EventoOut(EventoBase):
    id: str
    created_at: Optional[str] = None

# Estándar GeoJSON RFC 7946: Coordenadas siempre [longitud, latitud]
class GeoJSONGeometry(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: List[float] = Field(..., description="[longitud, latitud] según RFC 7946")

class GeoJSONFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: GeoJSONGeometry
    properties: Dict[str, Any]

class GeoJSONFeatureCollection(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: List[GeoJSONFeature]
    total: int

class CategoriaStats(BaseModel):
    categoria: CategoriaCanonica
    nombre_visual: str
    conteo: int
    icono: str
    color_hex: str
    descripcion: str
