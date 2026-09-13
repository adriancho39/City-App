import pytest
from fastapi.testclient import TestClient
from main import app
from etl.opendata_vg import reproyectar_utm25830_a_wgs84
from database import is_in_vitoria_bbox, haversine_distance_meters, db
from models import BBOX_VITORIA

client = TestClient(app)

def test_reproyeccion_utm25830_a_wgs84():
    """Valida la precisión del transformador pyproj de EPSG:25830 a EPSG:4326"""
    # Plaza de la Virgen Blanca en UTM Zona 30N
    x_utm = 526833.8
    y_utm = 4743843.6

    lon, lat = reproyectar_utm25830_a_wgs84(x_utm, y_utm)

    # Margen de tolerancia de 0.001 grados (< 50 metros)
    assert abs(lon - (-2.6716)) < 0.001, f"Longitud obtenida {lon} difiere de -2.6716"
    assert abs(lat - 42.8467) < 0.001, f"Latitud obtenida {lat} difiere de 42.8467"

def test_bounding_box_estricto_vitoria():
    """Valida la regla espacial estricta ST_MakeEnvelope(-2.7700, 42.7800, -2.5700, 42.9200, 4326)"""
    # Puntos dentro del término municipal
    assert is_in_vitoria_bbox(-2.6716, 42.8467), "Virgen Blanca debe estar dentro"
    assert is_in_vitoria_bbox(-2.6450, 42.8550), "Salburua debe estar dentro"
    assert is_in_vitoria_bbox(-2.7300, 42.8300), "Júndiz debe estar dentro"

    # Puntos fuera que deben ser estrictamente descartados
    assert not is_in_vitoria_bbox(-2.9340, 43.2680), "Bilbao debe ser descartado"
    assert not is_in_vitoria_bbox(-3.7038, 40.4168), "Madrid debe ser descartado"
    assert not is_in_vitoria_bbox(-2.5841, 42.5543), "Laguardia debe ser descartado"
    assert not is_in_vitoria_bbox(-1.9812, 43.3183), "San Sebastián debe ser descartado"

def test_endpoint_lugares_cercanos_geojson_rfc7946():
    """Valida el endpoint /api/v1/lugares/cercanos conforme a RFC 7946 [lon, lat] y paginación <= 50"""
    response = client.get("/api/v1/lugares/cercanos?lat=42.8467&lon=-2.6716&radio=1000&limit=50")
    assert response.status_code == 200

    data = response.json()
    assert data["type"] == "FeatureCollection"
    assert "features" in data
    assert len(data["features"]) <= 50

    if data["features"]:
        primer_lugar = data["features"][0]
        coords = primer_lugar["geometry"]["coordinates"]

        # Estándar RFC 7946: [longitud, latitud]
        assert len(coords) == 2
        lon, lat = coords[0], coords[1]

        # Validar orden: lon negativa (alrededor de -2.6), lat positiva (alrededor de 42.8)
        assert -2.77 <= lon <= -2.57, f"Longitud {lon} fuera de rango"
        assert 42.78 <= lat <= 42.92, f"Latitud {lat} fuera de rango"

        # Validar cálculo de distancia
        dist = primer_lugar["properties"]["distancia_metros"]
        assert dist is not None
        assert dist <= 1000.0

def test_integridad_bounding_box_en_todos_los_registros():
    """Valida el criterio de aceptación 4 de AGENTS.md: ningún registro viola el BBox de Vitoria"""
    for ext_id, lugar in db.lugares.items():
        assert is_in_vitoria_bbox(lugar.lon, lugar.lat), f"Lugar {lugar.nombre} ({ext_id}) viola el BBox"

    for ext_id, evento in db.eventos.items():
        assert is_in_vitoria_bbox(evento.lon, evento.lat), f"Evento {evento.titulo} ({ext_id}) viola el BBox"

def test_endpoint_health():
    """Valida el endpoint de salud de la API"""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    res = response.json()
    assert res["status"] == "healthy"
    assert res["protocolo"] == "AGENTS.md"

def test_grupos_deporte_rutas_clubes():
    """Valida la existencia y filtrado correcto de los nuevos grupos de búsqueda"""
    # Deporte
    res_deporte = client.get("/api/v1/lugares/cercanos?grupo=deporte&limit=50")
    assert res_deporte.status_code == 200
    lugares_deporte = res_deporte.json()["features"]
    assert len(lugares_deporte) > 0, "Debe haber lugares de deporte en Vitoria"
    nombres_deporte = [f["properties"]["nombre"] for f in lugares_deporte]
    assert any("Mendizorrotza" in n or "Baskonia" in n or "Buesa" in n or "Ibaiondo" in n or "Gamarra" in n for n in nombres_deporte)

    # Rutas
    res_rutas = client.get("/api/v1/lugares/cercanos?grupo=rutas&limit=50")
    assert res_rutas.status_code == 200
    lugares_rutas = res_rutas.json()["features"]
    assert len(lugares_rutas) > 0, "Debe haber rutas en Vitoria"
    nombres_rutas = [f["properties"]["nombre"] for f in lugares_rutas]
    assert any("Anillo Verde" in n or "Murales" in n or "Vasco-Navarro" in n or "Senda" in n for n in nombres_rutas)

    # Clubes
    res_clubes = client.get("/api/v1/lugares/cercanos?grupo=clubes&limit=50")
    assert res_clubes.status_code == 200
    lugares_clubes = res_clubes.json()["features"]
    assert len(lugares_clubes) > 0, "Debe haber clubes/ocio nocturno en Vitoria"
    nombres_clubes = [f["properties"]["nombre"] for f in lugares_clubes]
    assert any("Jimmy Jazz" in n or "Helldorado" in n or "Kubik" in n or "Urban Rock" in n for n in nombres_clubes)

def test_agenda_septiembre_2026_sin_actividades_pasadas():
    """Valida que todos los eventos devueltos estén vigentes a partir del 13 de septiembre de 2026"""
    # Ejecutar ETL para cargar eventos curados y vigentes
    from etl.kulturklik import ejecutar_etl_kulturklik
    ejecutar_etl_kulturklik()

    response = client.get("/api/v1/eventos?limit=50")
    assert response.status_code == 200
    eventos = response.json()
    assert len(eventos) > 0, "Debe haber eventos en la agenda"

    hoy_str = "2026-09-13"
    for e in eventos:
        fecha_fin = e.get("fecha_fin")
        fecha_ini = e.get("fecha_inicio")
        if fecha_fin:
            assert fecha_fin >= hoy_str, f"Evento '{e['titulo']}' terminó el {fecha_fin}, antes de {hoy_str}"
        else:
            assert fecha_ini >= hoy_str, f"Evento '{e['titulo']}' inició el {fecha_ini}, antes de {hoy_str}"

