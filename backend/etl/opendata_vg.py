import urllib.request
import urllib.parse
import json
from typing import List, Dict, Any, Tuple
from pyproj import Transformer
from database import is_in_vitoria_bbox, db
from etl.enricher import clasificar_entidad, resumir_descripcion

# Transformador de alta precisión obligatorio según AGENTS.md Regla 2.1
# EPSG:25830 (ETRS89 / UTM huso 30N) -> EPSG:4326 (WGS84 lon, lat)
transformer_25830_to_4326 = Transformer.from_crs("EPSG:25830", "EPSG:4326", always_xy=True)

def reproyectar_utm25830_a_wgs84(x: float, y: float) -> Tuple[float, float]:
    """Reproyecta coordenadas de UTM 30N (EPSG:25830) a WGS84 (EPSG:4326 lon, lat)"""
    lon, lat = transformer_25830_to_4326.transform(x, y)
    return round(lon, 6), round(lat, 6)

def ejecutar_etl_opendata() -> Dict[str, Any]:
    """
    Consume conjuntos de datos del portal municipal de Vitoria-Gasteiz y GeoVitoria,
    reproyecta las coordenadas UTM a EPSG:4326 y valida el Bounding Box municipal.
    """
    print("[ETL Open Data VG] Iniciando ingesta municipal y reproyección EPSG:25830...")

    capas_municipales = [
        {"id": "131", "nombre": "Monumentos", "cat_default": "patrimonio", "subcat_default": "monumento"},
        {"id": "64", "nombre": "Parques y jardines", "cat_default": "naturaleza", "subcat_default": "parque"},
        {"id": "130", "nombre": "Restaurantes", "cat_default": "gastronomia", "subcat_default": "restaurante"},
        {"id": "172", "nombre": "Museos", "cat_default": "cultura", "subcat_default": "museo"},
        {"id": "59", "nombre": "Centros Cívicos", "cat_default": "ocio", "subcat_default": "deporte"},
        {"id": "75", "nombre": "Frontones y Deporte", "cat_default": "ocio", "subcat_default": "deporte"},
        {"id": "95", "nombre": "Ruta de los Murales", "cat_default": "cultura", "subcat_default": "ruta"},
    ]

    total_procesados = 0
    total_ingestados = 0
    total_descartados_bbox = 0

    url_base = "https://www.vitoria-gasteiz.org/j16-02w/capaAction.do?accion=CARGAR_ELEMENTOS_CAPA&idioma=ES"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

    for capa in capas_municipales:
        try:
            data = urllib.parse.urlencode({"g": capa["id"], "app": "j16", "charset": "UTF-8"}).encode("utf-8")
            req = urllib.request.Request(url_base, data=data, headers=headers)
            with urllib.request.urlopen(req, timeout=6) as resp:
                resultado = json.loads(resp.read().decode("utf-8", errors="ignore"))
                elementos = resultado.get("elementos", []) or []
                total_procesados += len(elementos)

                for el in elementos:
                    nombre = el.get("nombre")
                    if not nombre:
                        continue

                    desc_raw = el.get("descripcion") or ""
                    descripcion = resumir_descripcion(desc_raw)

                    # Obtención de coordenadas y reproyección si vienen en EPSG:25830
                    lon, lat = None, None
                    if el.get("utmX") and el.get("utmY"):
                        try:
                            ux = float(el["utmX"])
                            uy = float(el["utmY"])
                            lon, lat = reproyectar_utm25830_a_wgs84(ux, uy)
                        except Exception:
                            pass
                    elif el.get("longitud") and el.get("latitud"):
                        try:
                            lon = float(el["longitud"])
                            lat = float(el["latitud"])
                        except Exception:
                            pass

                    if lon is None or lat is None:
                        continue

                    # Validación obligatoria de Bounding Box (AGENTS.md Regla 1)
                    if not is_in_vitoria_bbox(lon, lat):
                        total_descartados_bbox += 1
                        continue

                    cat, subcat = clasificar_entidad(nombre, descripcion, capa["nombre"])

                    foto = el.get("foto")
                    imagen_url = f"https://www.vitoria-gasteiz.org/docs/j16/img/fotos/{foto}" if foto else None

                    lugar_data = {
                        "external_id": f"vg-{capa['id']}-{el.get('id', abs(hash(nombre)))}",
                        "fuente_origen": "opendata_vg",
                        "nombre": nombre,
                        "categoria": cat,
                        "subcategoria": subcat,
                        "descripcion": descripcion,
                        "direccion": el.get("direccion") or "Vitoria-Gasteiz",
                        "imagen_url": imagen_url,
                        "web": el.get("linkRelacionadoUrl"),
                        "lon": lon,
                        "lat": lat
                    }

                    ok, motivo = db.upsert_lugar(lugar_data)
                    if ok:
                        total_ingestados += 1
                    else:
                        total_descartados_bbox += 1

        except Exception as e:
            print(f"[ETL Open Data VG] Capa {capa['nombre']}: {e}")

    print(f"[ETL Open Data VG] Completado: {total_ingestados} ingestados, {total_descartados_bbox} fuera de BBox.")
    return {
        "fuente": "opendata_vg",
        "procesados": total_procesados,
        "ingestados": total_ingestados,
        "descartados_bbox": total_descartados_bbox
    }
