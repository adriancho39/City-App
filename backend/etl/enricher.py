import re
from difflib import SequenceMatcher
from typing import Tuple
from models import CategoriaCanonica

# Categorías canónicas según AGENTS.md
REGLAS_CLASIFICACION = {
    'patrimonio': [
        'catedral', 'muralla', 'palacio', 'torre', 'convento', 'iglesia', 'monumento',
        'arquillos', 'virgen blanca', 'machete', 'cordon', 'escoriaza', 'montehermoso',
        'villasuso', 'villa suso', 'casco medieval', 'casco historico', 'almendra medieval',
        'santa maria', 'san miguel', 'san vicente', 'san pedro', 'patrimonio', 'historico'
    ],
    'naturaleza': [
        'parque', 'jardin', 'anillo verde', 'salburua', 'olarizu', 'zabalgana',
        'armentia', 'humedal', 'ataria', 'botanico', 'bosque', 'senda', 'rio',
        'verde', 'arbol', 'florida', 'prado', 'arriaga', 'judimendi', 'medio ambiente'
    ],
    'cultura': [
        'museo', 'artium', 'bibat', 'bellas artes', 'armeria', 'ciencias naturales',
        'teatro', 'concierto', 'exposicion', 'musica', 'danza', 'cine', 'kultur',
        'festival', 'literatura', 'conferencia', 'taller cultural', 'espectaculo',
        'kulturklik', 'centro civico', 'danza', 'opera', 'jazz'
    ],
    'gastronomia': [
        'restaurante', 'asador', 'sidreria', 'taberna', 'bar', 'pintxo', 'gastronomia',
        'comida', 'abastos', 'mercado de abastos', 'vino', 'rioja alavesa',
        'txakoli', 'degustacion', 'menu del dia', 'cocina vasca', 'gastro'
    ],
    'ocio': [
        'palacio europa', 'concierto', 'ocio', 'recreativo', 'cine', 'deporte',
        'actividad familiar', 'ludoteca', 'pista de hielo', 'mendizorrotza', 'gamonal'
    ],
    'comercio': [
        'comercio', 'tienda', 'mercado', 'calle dato', 'artesania', 'compras'
    ]
}

def limpiar_html(texto: str) -> str:
    """Elimina etiquetas HTML y entidades codificadas (AGENTS.md Regla 3.1)"""
    if not texto:
        return ""
    limpio = re.sub(r'<[^>]+>', ' ', texto)
    limpio = re.sub(r'&[a-zA-Z]+;', ' ', limpio)
    limpio = re.sub(r'\s+', ' ', limpio).strip()
    return limpio

def resumir_descripcion(texto: str, max_palabras: int = 45) -> str:
    """
    Genera un resumen informativo conciso de máximo 2 oraciones (30-45 palabras)
    en tono informativo neutro, según AGENTS.md Regla 4.
    """
    limpio = limpiar_html(texto)
    if not limpio:
        return ""
    
    # Separar oraciones
    oraciones = re.split(r'(?<=[.!?])\s+', limpio)
    resumen = " ".join(oraciones[:2])
    palabras = resumen.split()
    
    if len(palabras) > max_palabras:
        resumen = " ".join(palabras[:max_palabras]) + "..."
        
    return resumen

def clasificar_entidad(nombre: str, descripcion: str = "", tipo_origen: str = "") -> Tuple[CategoriaCanonica, str]:
    """Clasifica el recurso en una de las categorías canónicas de AGENTS.md"""
    texto = f"{nombre} {descripcion} {tipo_origen}".lower()

    mejor_cat: CategoriaCanonica = 'cultura'
    mejor_score = 0

    for cat, palabras in REGLAS_CLASIFICACION.items():
        score = 0
        for p in palabras:
            if p in texto:
                score += 3 if p in nombre.lower() else 1
        if score > mejor_score:
            mejor_score = score
            mejor_cat = cat  # type: ignore

    # Subcategoría descriptiva orientada a grupos de búsqueda
    t_lower = texto.lower()
    if any(w in t_lower for w in ['fronton', 'piscina', 'polideport', 'estadio', 'baskonia', 'alaves', 'atletismo', 'gimnas', 'bakh', 'cancha', 'deporte', 'kirol']):
        subcat = 'deporte'
        mejor_cat = 'ocio'
    elif any(w in t_lower for w in ['ruta', 'senda', 'anillo verde', 'mural', 'vasco-navarro', 'itinerario', 'camino']):
        subcat = 'ruta'
    elif any(w in t_lower for w in ['club', 'discoteca', 'pub', 'sala de conciert', 'rock', 'helldorado', 'jimmy jazz']):
        subcat = 'club'
        mejor_cat = 'ocio'
    elif any(w in t_lower for w in ['restaurante', 'asador', 'sidreria', 'taberna', 'pintxo', 'gastro']):
        subcat = 'restaurante'
        mejor_cat = 'gastronomia'
    elif any(w in t_lower for w in ['parque', 'jardin', 'humedal', 'botanico', 'bosque']):
        subcat = 'naturaleza'
    elif any(w in t_lower for w in ['catedral', 'muralla', 'palacio', 'torre', 'monumento']):
        subcat = 'monumento'
        mejor_cat = 'patrimonio'
    else:
        subcat = tipo_origen.lower() if tipo_origen else mejor_cat

    return mejor_cat, subcat

def similitud_lexica(texto_a: str, texto_b: str) -> float:
    """Calcula similitud de cadenas (equivalente a pg_trgm similarity > 0.6 según AGENTS.md Regla 2.2)"""
    if not texto_a or not texto_b:
        return 0.0
    return SequenceMatcher(None, texto_a.lower(), texto_b.lower()).ratio()
