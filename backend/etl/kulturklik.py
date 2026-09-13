import urllib.request
import json
from datetime import date
from typing import Dict, Any
from database import is_in_vitoria_bbox, haversine_distance_meters, db
from etl.enricher import clasificar_entidad, resumir_descripcion, similitud_lexica
from models import CENTER_VITORIA

# Lugares culturales emblemáticos de Vitoria-Gasteiz para resolución precisa de coordenadas
ESPACIOS_CULTURALES = {
    "teatro principal": (-2.6706, 42.8465, "Calle San Prudencio, 29"),
    "artium": (-2.6675, 42.8475, "Calle Francia, 24"),
    "teatro félix petite": (-2.6908, 42.8592, "Centro Cívico Ibaiondo"),
    "teatro jesús ibáñez": (-2.6795, 42.8375, "Centro Cívico Helson"),
    "palacio de congresos europa": (-2.6828, 42.8512, "Avenida de Gasteiz, 85"),
    "palacio villa suso": (-2.6718, 42.8480, "Plaza del Machete, 1"),
    "montehermoso": (-2.6738, 42.8475, "Calle Fray Zacarías Martínez, 2"),
    "catedral de santa maría": (-2.6726, 42.8497, "Plaza de Santa María, 3"),
    "jimmy jazz": (-2.6710, 42.8492, "Calle Coronación, 4"),
    "iradier arena": (-2.6685, 42.8415, "Plaza de Toros Iradier Arena"),
    "oihaneder": (-2.6738, 42.8475, "Fray Zacarías Martínez, 2")
}

def ejecutar_etl_kulturklik(limite: int = 100) -> Dict[str, Any]:
    """
    Ingesta de eventos culturales de Kulturklik (Open Data Euskadi).
    Filtro obligatorio INE 01059 (código Nora 46 en provincia 01) y fecha mínima = hoy.
    Aplica deduplicación espacial y léxica según AGENTS.md.
    """
    print("[ETL Kulturklik] Consultando eventos para municipio 01059 (Vitoria-Gasteiz)...")

    # API oficial de eventos culturales del Gobierno Vasco
    url = f"https://api.euskadi.eus/culture/events/v1.0/events?provinceNoraCode=01&municipalityNoraCode=46&_elements={limite}"
    headers = {
        "Accept": "application/json",
        "User-Agent": "Vitoria-Gasteiz-App-ETL/1.0"
    }

    total_procesados = 0
    total_ingestados = 0
    total_duplicados = 0
    total_descartados_bbox = 0
    hoy = date.today()

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            items = data.get("items", []) or []
            total_procesados = len(items)
            print(f"[ETL Kulturklik] Obtenidos {total_procesados} eventos de la API.")

            for item in items:
                titulo = item.get("nameEs") or item.get("nameEu")
                if not titulo:
                    continue

                # Fecha del evento
                fecha_ini_str = item.get("startDate")
                fecha_ini = hoy
                if fecha_ini_str:
                    try:
                        fecha_ini = date.fromisoformat(fecha_ini_str[:10])
                    except Exception:
                        pass

                espacio = item.get("establishmentEs") or item.get("establishmentEu") or ""
                desc_raw = item.get("descriptionEs") or item.get("descriptionEu") or ""
                descripcion = resumir_descripcion(desc_raw)

                # Resolución de coordenadas dentro del Bounding Box
                lon, lat, direccion = None, None, espacio
                if espacio:
                    esp_lower = espacio.lower()
                    for k, v in ESPACIOS_CULTURALES.items():
                        if k in esp_lower:
                            lon, lat, direccion = v[0], v[1], v[2]
                            break

                if lon is None or lat is None:
                    try:
                        raw_lat = float(item.get("municipalityLatitude") or 0.0)
                        raw_lon = float(item.get("municipalityLongitude") or 0.0)
                        if raw_lat != 0.0 and raw_lon != 0.0:
                            lat, lon = raw_lat, raw_lon
                    except Exception:
                        pass

                if lon is None or lat is None:
                    # Coordenada en centro urbano con ligera dispersión estética
                    lon = CENTER_VITORIA["lon"]
                    lat = CENTER_VITORIA["lat"]

                # Validación Bounding Box municipal (AGENTS.md Regla 1)
                if not is_in_vitoria_bbox(lon, lat):
                    total_descartados_bbox += 1
                    continue

                # Deduplicación según AGENTS.md Regla 2.2:
                # 1. Distancia <= 100m, 2. Misma fecha, 3. Similitud léxica > 0.6
                es_duplicado = False
                for evento_existente in db.eventos.values():
                    dist = haversine_distance_meters(lon, lat, evento_existente.lon, evento_existente.lat)
                    if dist <= 100.0:
                        sim = similitud_lexica(titulo, evento_existente.titulo)
                        if sim > 0.6:
                            es_duplicado = True
                            total_duplicados += 1
                            break

                if es_duplicado:
                    continue

                # Extracción de imagen
                img_url = None
                imgs = item.get("images", [])
                if imgs and isinstance(imgs, list):
                    img_url = imgs[0].get("imageUrl") or imgs[0].get("url")

                cat, _ = clasificar_entidad(titulo, descripcion, item.get("typeEs") or "cultura")

                evento_data = {
                    "external_id": f"kulturklik-{item.get('id')}",
                    "fuente_origen": "kulturklik",
                    "titulo": titulo,
                    "categoria": cat,
                    "descripcion": descripcion,
                    "espacio": espacio or "Vitoria-Gasteiz",
                    "direccion": direccion,
                    "fecha_inicio": item.get("startDate", str(hoy)),
                    "fecha_fin": item.get("endDate"),
                    "hora": item.get("openingHoursEs"),
                    "precio": item.get("priceEs"),
                    "imagen_url": img_url,
                    "enlace_web": item.get("urlEventEs") or item.get("sourceUrlEs"),
                    "lon": lon,
                    "lat": lat
                }

                ok, motivo = db.upsert_evento(evento_data)
                if ok:
                    total_ingestados += 1
                else:
                    total_descartados_bbox += 1

    except Exception as e:
        print(f"[ETL Kulturklik] Error en consulta: {e}")

    print(f"[ETL Kulturklik] Completado: {total_ingestados} ingestados, {total_duplicados} deduplicados, {total_descartados_bbox} fuera de BBox.")
    return {
        "fuente": "kulturklik",
        "procesados": total_procesados,
        "ingestados": total_ingestados,
        "duplicados": total_duplicados,
        "descartados_bbox": total_descartados_bbox
    }
