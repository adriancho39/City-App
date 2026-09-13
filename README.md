# GasteizGo — PWA de Turismo y Ocio Urbano en Vitoria-Gasteiz

Aplicación Web Progresiva (**PWA**) y plataforma geoespacial de ocio y turismo urbano estrictamente acotada a la ciudad de **Vitoria-Gasteiz**.

Desarrollada bajo estándares de arquitectura geoespacial de alto rendimiento con **PostgreSQL + PostGIS**, un pipeline de scraping e ingesta multifuente (**Kulturklik 01059** + **Portal Open Data Municipal / GeoVitoria** con conversión de coordenadas **UTM EPSG:25830 a EPSG:4326**), modelado semántico en **4 categorías canónicas** y un frontend interactivo con **Leaflet** centrado en la Plaza de la Virgen Blanca `[-2.6716, 42.8467]` con filtrado dinámico por radios de proximidad (**500m, 1km, 3km**).

---

## 🏛️ Características Principales

1. **Base de Datos Geoespacial (PostgreSQL 16 + PostGIS 3.4)**:
   - Esquema DDL en [`backend/src/db/schema.sql`](backend/src/db/schema.sql) con habilitación de extensión `postgis`.
   - Restricción estricta de Bounding Box requerida:
     ```sql
     CONSTRAINT check_vitoria_bbox CHECK (
         ST_Within(geom, ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326))
     )
     ```
   - Trigger `check_vitoria_bbox_trigger` para rechazar o descartar cualquier inserción fuera de los límites de la ciudad.
   - Índice espacial `GIST` en la columna geométrica para acelerar consultas de proximidad `ST_DWithin`.
   - Motor Dual inteligente: opera directamente con PostgreSQL/PostGIS cuando está disponible o activa el motor geoespacial autónomo en memoria/SQLite replicando exactamente el bounding box y la distancia geodésica.

2. **Pipeline de Ingesta & Conversión Espacial**:
   - **Kulturklik API**: Ingesta continua de la agenda cultural, conciertos, teatro y exposiciones del municipio `01059` (código NORA `46` de Álava / INE `01059`).
   - **Open Data Municipal / GeoVitoria**: Ingestor de monumentos, patrimonio, zonas verdes y hostelería.
   - **Transformación de Coordenadas**: Conversor geodésico de **UTM EPSG:25830 (ETRS89 / UTM huso 30N)** a **WGS84 EPSG:4326** mediante proyección inversa ellipsoidal de Gauss-Krüger/GRS80 y `proj4`.
   - **Descarte de Anomalías**: Validador estricto que rechaza cualquier registro que caiga fuera de `ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)`.

3. **Clasificación en 4 Categorías Canónicas**:
   - 🏛️ **Patrimonio**: Catedral de Santa María ("Abierto por Obras"), Muralla Medieval del siglo XI, Los Arquillos, Palacio de Montehermoso, Casa del Cordón, Palacio Escoriaza-Esquivel, Plaza del Machete.
   - 🌳 **Naturaleza**: Anillo Verde de Vitoria-Gasteiz (Humedales de Salburua y Ataria, Jardín Botánico de Olarizu, Bosque de Armentia, Zabalgana), Parque de la Florida, Parque del Prado.
   - 🎭 **Cultura**: Museo Artium de Arte Contemporáneo Vasco, Museo Bibat (Arqueología y Naipes Fournier), Museo de Bellas Artes, Teatro Principal Antzokia y eventos en vivo de Kulturklik.
   - 🍷 **Gastronomía**: Rutas de pintxos del Casco Medieval (calles Cuchillería, Zapatería, Correría), Mercado de Abastos y Gastro-Gune, asadores alaveses tradicionales y locales gastronómicos reconocidos.

4. **Frontend PWA & Mapa Interactivo**:
   - Mapa Leaflet centrado en `[-2.6716, 42.8467]` (Plaza de la Virgen Blanca) con cartografía clara de alta resolución.
   - **Filtrado por Radio de Proximidad**: Selector interactivo (`Todos`, `500 m`, `1 km`, `3 km`) con renderizado del círculo dinámico de proximidad en el mapa.
   - Posibilidad de cambiar el punto central de proximidad haciendo clic en cualquier punto del mapa de Vitoria-Gasteiz o usando la geolocalización GPS.
   - PWA completa: `manifest.json`, iconos adaptativos y `sw.js` (Service Worker) con caché offline para explorar la ciudad sin conexión de datos.

---

## 🚀 Inicio Rápido

### Requisitos Previos
- Node.js (v18 o superior) y npm
- (Opcional) Docker y Docker Compose para levantar PostgreSQL con PostGIS

### 1. Levantar Base de Datos PostGIS (Opcional)
Si dispones de Docker, inicia el contenedor PostGIS:
```bash
docker compose up -d
```
> *Nota*: Si no dispones de Docker o PostgreSQL local, el backend activa automáticamente su **Stand-alone PostGIS Geo-Engine**, permitiendo ejecutar la aplicación al 100% sin dependencias externas.

### 2. Instalar y Ejecutar el Backend
```bash
cd backend
npm install
npm run build
npm start
```
El backend se iniciará en `http://localhost:3001` y ejecutará la ingesta inicial de Kulturklik y Open Data municipal.

### 3. Ejecutar el Frontend en Modo Desarrollo (Opcional)
```bash
cd frontend
npm install
npm run dev
```
Accede a `http://localhost:5173`. En producción, el propio backend sirve la PWA compilada directamente en `http://localhost:3001`.

---

## 🧪 Ejecución de Tests Automatizados

La suite de pruebas verifica la transformación UTM EPSG:25830 -> EPSG:4326, la estricta restricción de Bounding Box y el clasificador de categorías:

```bash
cd backend
npm test
```

### Resultados de Verificación:
```text
--- Running Geo & Spatial Transformation Tests ---
  [UTM Transform] Plaza de la Virgen Blanca: UTM [526833.8, 4743843.6] -> WGS84 [-2.6716, 42.8467]
  ✅ PASS: Longitude transform matches Plaza de la Virgen Blanca: -2.6716
  ✅ PASS: Latitude transform matches Plaza de la Virgen Blanca: 42.8467
  ✅ PASS: Catedral de Santa María lon transform: -2.672622
  ✅ PASS: Catedral de Santa María lat transform: 42.849732
  ✅ PASS: Virgen Blanca (-2.6716, 42.8467) is accepted inside BBOX
  ✅ PASS: Salburua Wetlands (-2.645, 42.855) is accepted inside BBOX
  ✅ PASS: Júndiz West (-2.73, 42.83) is accepted inside BBOX
  ✅ PASS: Bilbao (-2.93, 43.26) is strictly rejected outside BBOX
  ✅ PASS: Madrid (-3.70, 40.41) is strictly rejected outside BBOX
  ✅ PASS: Laguardia (-2.58, 42.55) is strictly rejected outside BBOX
  ✅ PASS: San Sebastián (-1.98, 43.32) is strictly rejected outside BBOX
  [Distance] Virgen Blanca -> Catedral de Santa María: 343.4m
  ✅ PASS: Distance from center to Old Cathedral is ~340m (actual: 343.4m)
  ✅ PASS: Catedral de Santa María falls inside 500m proximity radius
  [Distance] Virgen Blanca -> Salburua Ataria: 2356.7m
  ✅ PASS: Distance to Salburua is within ~2.3km (actual: 2356.7m)
  ✅ PASS: Salburua Ataria falls inside 3km proximity radius

--- Running Scraper & Classification Tests ---
  ✅ PASS: Catedral de Santa María categorized as Patrimonio
  ✅ PASS: Muralla Medieval categorized as Patrimonio
  ✅ PASS: Humedales de Salburua categorized as Naturaleza
  ✅ PASS: Parque de la Florida categorized as Naturaleza
  ✅ PASS: Artium categorized as Cultura
  ✅ PASS: Teatro Principal categorized as Cultura
  ✅ PASS: Bar de Pintxos categorized as Gastronomía
  ✅ PASS: Store accepts point inside Vitoria BBox
  ✅ PASS: Store discards point outside Vitoria BBox
  ✅ PASS: 500m query returns the center point (distance 0m)
```

---

## 📡 Endpoints de la API REST

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado del servicio, base de datos y BBOX constraint |
| `GET` | `/api/categories` | Estadísticas y conteo de POIs por cada una de las 4 categorías |
| `GET` | `/api/pois` | Consulta de POIs con filtros (`lat`, `lon`, `radius`, `category`, `search`) |
| `GET` | `/api/pois/:id` | Detalle exhaustivo de un punto de interés o evento |
| `POST` | `/api/scrape/trigger` | Disparador manual para refrescar datos desde Kulturklik y Open Data |

### Ejemplo de Consulta con Radio de Proximidad:
```bash
# POIs a menos de 500 metros de la Plaza de la Virgen Blanca
curl "http://localhost:3001/api/pois?lat=42.8467&lon=-2.6716&radius=500"

# POIs de Gastronomía a menos de 1 km
curl "http://localhost:3001/api/pois?lat=42.8467&lon=-2.6716&radius=1000&category=Gastronom%C3%ADa"
```

---

## 📱 Capacidades PWA y Offline
- **Manifest**: Especificado en `frontend/public/manifest.json`.
- **Service Worker**: Ubicado en `frontend/public/sw.js`. Caching estático de aplicación + caching de respuestas de la API REST + caching de teselas de mapas para uso turístico en exteriores y zonas sin cobertura.
