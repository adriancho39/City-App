import os
import math
import json
import uuid
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, date
from pathlib import Path
from models import LugarOut, EventoOut, CategoriaCanonica, BBOX_VITORIA, CENTER_VITORIA, CategoriaStats

def is_in_vitoria_bbox(lon: float, lat: float) -> bool:
    """Verifica si un punto está dentro del Bounding Box estricto de Vitoria-Gasteiz (EPSG:4326)"""
    return (
        BBOX_VITORIA['min_lon'] <= lon <= BBOX_VITORIA['max_lon'] and
        BBOX_VITORIA['min_lat'] <= lat <= BBOX_VITORIA['max_lat']
    )

def haversine_distance_meters(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Cálculo de distancia esférica geodésica en metros (equivalente a PostGIS ST_Distance geography)"""
    R = 6371000.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2 +
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(R * c, 1)

class GeoDatabase:
    """
    Gestor de base de datos geoespacial con soporte PostGIS y motor autónomo en memoria.
    Garantiza cumplimiento estricto del Bounding Box de Vitoria-Gasteiz.
    """
    def __init__(self):
        self.lugares: Dict[str, LugarOut] = {}
        self.eventos: Dict[str, EventoOut] = {}
        self.usando_postgis = False
        self._load_seed_data()

    def _load_seed_data(self):
        """Carga el dataset semilla inicial de Vitoria-Gasteiz si está disponible"""
        seed_path = Path(__file__).resolve().parent.parent / "database" / "seed_vitoria.geojson"
        if not seed_path.exists():
            return

        try:
            with open(seed_path, "r", encoding="utf-8") as f:
                geojson = json.load(f)

            for feat in geojson.get("features", []):
                coords = feat.get("geometry", {}).get("coordinates", [])
                if len(coords) < 2:
                    continue
                lon, lat = coords[0], coords[1]
                if not is_in_vitoria_bbox(lon, lat):
                    continue

                props = feat.get("properties", {})
                ext_id = props.get("external_id", f"seed-{uuid.uuid4().hex[:8]}")
                uid = f"place-{ext_id}"

                lugar = LugarOut(
                    id=uid,
                    external_id=ext_id,
                    fuente_origen="opendata_vg",
                    nombre=props.get("nombre", "Sin nombre"),
                    categoria=props.get("categoria", "patrimonio"),
                    subcategoria=props.get("subcategoria"),
                    descripcion=props.get("descripcion"),
                    direccion=props.get("direccion"),
                    imagen_url=props.get("imagen_url"),
                    telefono=props.get("telefono"),
                    web=props.get("web"),
                    lon=lon,
                    lat=lat,
                    created_at=datetime.now().isoformat()
                )
                self.lugares[ext_id] = lugar

            print(f"[GeoDatabase] Semilla cargada con éxito: {len(self.lugares)} lugares iniciales.")
        except Exception as e:
            print(f"[GeoDatabase] Advertencia al cargar semilla: {e}")

    def upsert_lugar(self, data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Inserta o actualiza un lugar verificando la restricción de BBox"""
        lon = float(data.get("lon", 0.0))
        lat = float(data.get("lat", 0.0))

        if not is_in_vitoria_bbox(lon, lat):
            return False, f"Punto [{lon}, {lat}] fuera del Bounding Box de Vitoria-Gasteiz."

        ext_id = str(data.get("external_id"))
        existing = self.lugares.get(ext_id)
        uid = existing.id if existing else f"place-{uuid.uuid4().hex[:12]}"

        lugar = LugarOut(
            id=uid,
            external_id=ext_id,
            fuente_origen=data.get("fuente_origen", "opendata_vg"),
            nombre=data.get("nombre", "Lugar"),
            categoria=data.get("categoria", "patrimonio"),
            subcategoria=data.get("subcategoria"),
            descripcion=data.get("descripcion"),
            direccion=data.get("direccion"),
            imagen_url=data.get("imagen_url"),
            telefono=data.get("telefono"),
            web=data.get("web"),
            lon=round(lon, 6),
            lat=round(lat, 6),
            created_at=existing.created_at if existing else datetime.now().isoformat()
        )
        self.lugares[ext_id] = lugar
        return True, None

    def upsert_evento(self, data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Inserta o actualiza un evento cultural de Kulturklik verificando BBox"""
        lon = float(data.get("lon", 0.0))
        lat = float(data.get("lat", 0.0))

        if not is_in_vitoria_bbox(lon, lat):
            return False, f"Evento fuera del Bounding Box de Vitoria-Gasteiz: [{lon}, {lat}]"

        ext_id = str(data.get("external_id"))
        existing = self.eventos.get(ext_id)
        uid = existing.id if existing else f"event-{uuid.uuid4().hex[:12]}"

        # Parseo de fechas
        fecha_ini = data.get("fecha_inicio")
        if isinstance(fecha_ini, str):
            fecha_ini = datetime.fromisoformat(fecha_ini.replace("Z", "+00:00")).date()
        elif not isinstance(fecha_ini, date):
            fecha_ini = date.today()

        fecha_fin = data.get("fecha_fin")
        if isinstance(fecha_fin, str):
            try:
                fecha_fin = datetime.fromisoformat(fecha_fin.replace("Z", "+00:00")).date()
            except Exception:
                fecha_fin = None

        evento = EventoOut(
            id=uid,
            external_id=ext_id,
            fuente_origen="kulturklik",
            titulo=data.get("titulo", "Evento Cultural"),
            categoria=data.get("categoria", "cultura"),
            descripcion=data.get("descripcion"),
            espacio=data.get("espacio"),
            direccion=data.get("direccion"),
            fecha_inicio=fecha_ini,
            fecha_fin=fecha_fin,
            hora=data.get("hora"),
            precio=data.get("precio"),
            imagen_url=data.get("imagen_url"),
            enlace_web=data.get("enlace_web"),
            lon=round(lon, 6),
            lat=round(lat, 6),
            created_at=existing.created_at if existing else datetime.now().isoformat()
        )
        self.eventos[ext_id] = evento
        return True, None

    def buscar_lugares_cercanos(
        self,
        center_lon: float = CENTER_VITORIA['lon'],
        center_lat: float = CENTER_VITORIA['lat'],
        radio_metros: Optional[float] = None,
        categoria: Optional[str] = None,
        subcategoria: Optional[str] = None,
        grupo: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[LugarOut], int]:
        """
        Consulta espacial de lugares cercanos con ordenación por distancia geodésica.
        Respuestas paginadas con límite máximo de 50 elementos según AGENTS.md.
        Admite filtrado por categoría canónica, subcategoría y grupos temáticos (deporte, rutas, clubes, etc.).
        """
        limit = min(limit, 50)
        items: List[LugarOut] = []

        for lugar in self.lugares.values():
            if categoria and categoria != 'todos' and lugar.categoria != categoria:
                continue

            if subcategoria and subcategoria != 'todos':
                if not lugar.subcategoria or subcategoria.lower() not in lugar.subcategoria.lower():
                    continue

            if grupo and grupo != 'todos':
                g = grupo.lower()
                l_sub = (lugar.subcategoria or '').lower()
                l_nom = lugar.nombre.lower()
                l_cat = lugar.categoria.lower()

                if g == 'deporte':
                    match = (
                        l_sub in ['deporte', 'polideportivo', 'estadio', 'fronton', 'atletismo', 'piscinas_olimpicas', 'complejo_deportivo']
                        or any(w in l_sub for w in ['deport', 'kirol', 'piscina', 'padel', 'gym'])
                        or any(w in l_nom for w in ['buesa arena', 'bakh', 'mendizorrotza', 'estadio', 'polideportivo', 'fronton', 'cívico', 'civico'])
                    )
                    if not match:
                        continue
                elif g in ['rutas', 'ruta']:
                    match = (
                        'ruta' in l_sub or 'sendero' in l_sub or 'via_verde' in l_sub or 'anillo_verde' in l_sub
                        or any(w in l_nom for w in ['ruta', 'senda', 'anillo verde', 'mural', 'vasco-navarro', 'vuelta'])
                    )
                    if not match:
                        continue
                elif g in ['clubes', 'club', 'noche']:
                    match = (
                        'club' in l_sub or 'musica_en_vivo' in l_sub or 'discoteca' in l_sub or 'sala_conciertos' in l_sub or 'pub' in l_sub
                        or any(w in l_nom for w in ['jimmy jazz', 'helldorado', 'kubik', 'urban rock', 'glow', 'moon'])
                    )
                    if not match:
                        continue
                elif g in ['gastronomia', 'restaurantes']:
                    if l_cat != 'gastronomia':
                        continue
                elif g in ['patrimonio', 'monumentos']:
                    if l_cat != 'patrimonio':
                        continue
                elif g in ['naturaleza', 'parques']:
                    if l_cat != 'naturaleza':
                        continue
                elif g in ['cultura', 'museos']:
                    if l_cat != 'cultura':
                        continue
                elif g in ['comercio', 'tiendas']:
                    if l_cat != 'comercio':
                        continue

            if search:
                s_lower = search.lower()
                n_match = s_lower in lugar.nombre.lower()
                d_match = lugar.descripcion and s_lower in lugar.descripcion.lower()
                c_match = lugar.categoria and s_lower in lugar.categoria.lower()
                sub_match = lugar.subcategoria and s_lower in lugar.subcategoria.lower()
                if not (n_match or d_match or c_match or sub_match):
                    continue

            dist = haversine_distance_meters(center_lon, center_lat, lugar.lon, lugar.lat)
            if radio_metros is not None and radio_metros > 0 and dist > radio_metros:
                continue

            lugar_copy = lugar.model_copy()
            lugar_copy.distancia_metros = dist
            items.append(lugar_copy)

        # Ordenar por proximidad
        items.sort(key=lambda x: x.distancia_metros or 0.0)
        total = len(items)
        paginados = items[offset:offset + limit]

        return paginados, total

    def listar_eventos(
        self,
        center_lon: float = CENTER_VITORIA['lon'],
        center_lat: float = CENTER_VITORIA['lat'],
        fecha_min: Optional[date] = None,
        categoria: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Tuple[List[EventoOut], int]:
        """Lista eventos culturales a partir de la fecha del sistema ordenada por fecha y cercanía"""
        if fecha_min is None:
            fecha_min = date.today()

        items: List[EventoOut] = []
        for evento in self.eventos.values():
            if fecha_min:
                if evento.fecha_fin and evento.fecha_fin < fecha_min:
                    continue
                elif not evento.fecha_fin and evento.fecha_inicio < fecha_min:
                    continue

            if categoria and categoria != 'todos' and evento.categoria != categoria:
                continue

            dist = haversine_distance_meters(center_lon, center_lat, evento.lon, evento.lat)
            evento_copy = evento.model_copy()
            evento_copy.distancia_metros = dist
            items.append(evento_copy)

        # Ordenar priorizando eventos que inician hoy o en los próximos días de septiembre
        hoy = date.today()
        def sort_evento(x: EventoOut):
            if x.fecha_inicio >= hoy:
                return (0, x.fecha_inicio, x.distancia_metros or 0.0)
            return (1, x.fecha_fin or hoy, x.distancia_metros or 0.0)

        items.sort(key=sort_evento)
        total = len(items)
        paginados = items[offset:offset + limit]

        return paginados, total

    def obtener_estadisticas_categorias(self) -> List[CategoriaStats]:
        """Conteo canónico de entidades por categoría"""
        conteos: Dict[CategoriaCanonica, int] = {
            'patrimonio': 0,
            'cultura': 0,
            'naturaleza': 0,
            'gastronomia': 0,
            'ocio': 0,
            'comercio': 0
        }

        for lugar in self.lugares.values():
            if lugar.categoria in conteos:
                conteos[lugar.categoria] += 1

        for evento in self.eventos.values():
            if evento.categoria in conteos:
                conteos[evento.categoria] += 1

        metadatos = {
            'patrimonio': ('Patrimonio Histórico', 'landmark', '#d97706', 'Catedrales, murallas medievales, palacios renacentistas y monumentos.'),
            'naturaleza': ('Espacios Verdes', 'trees', '#059669', 'Anillo Verde, Salburua, jardines botánicos y parques urbanos.'),
            'cultura': ('Cultura y Artes', 'sparkles', '#7c3aed', 'Museos de arte, arqueología, teatros y eventos en vivo Kulturklik.'),
            'gastronomia': ('Gastronomía y Pintxos', 'utensils', '#e11d48', 'Rutas de pintxos en la almendra medieval, asadores y producto alavés.'),
            'ocio': ('Ocio Urbano', 'smile', '#2563eb', 'Centros de ocio, palacios de congresos y actividades recreativas.'),
            'comercio': ('Comercio Local', 'shopping-bag', '#0891b2', 'Comercios tradicionales, mercados y artesanía vitoriana.')
        }

        stats = []
        for cat, count in conteos.items():
            nombre, icono, color, desc = metadatos[cat]
            stats.append(CategoriaStats(
                categoria=cat,
                nombre_visual=nombre,
                conteo=count,
                icono=icono,
                color_hex=color,
                descripcion=desc
            ))

        return stats

# Instancia global de la base de datos
db = GeoDatabase()
