import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Place } from './PlaceCard';
import { Evento } from './EventList';

// Bounding Box estricto de Vitoria-Gasteiz (AGENTS.md Regla 1 y 3.3)
const VITORIA_BBOX: L.LatLngBoundsLiteral = [
  [42.7800, -2.7700], // Suroeste
  [42.9200, -2.5700], // Noreste
];

const VITORIA_CENTER: [number, number] = [42.8467, -2.6716]; // [lat, lon]

// Distritos y barrios estratégicos para navegación en toda la ciudad
export const DISTRITOS_VITORIA = [
  { nombre: '🌍 Toda la Ciudad', lat: 42.8467, lon: -2.6716, zoom: 13 },
  { nombre: '🏛️ Centro & Almendra', lat: 42.8467, lon: -2.6716, zoom: 15 },
  { nombre: '🌳 Salburua & Buesa', lat: 42.8550, lon: -2.6450, zoom: 15 },
  { nombre: '🏢 Zabalgana', lat: 42.8420, lon: -2.7050, zoom: 15 },
  { nombre: '🚆 Lakua & Ibaiondo', lat: 42.8630, lon: -2.6850, zoom: 15 },
  { nombre: '⚽ Mendizorrotza', lat: 42.8365, lon: -2.6860, zoom: 15 },
  { nombre: '🌲 Armentia', lat: 42.8290, lon: -2.7010, zoom: 15 },
  { nombre: '🌻 Olarizu', lat: 42.8270, lon: -2.6625, zoom: 15 },
];

const PINS_CONFIG: Record<string, { bg: string; border: string; icon: string }> = {
  deporte: { bg: '#0284c7', border: '#0369a1', icon: '⚽' },
  ruta: { bg: '#65a30d', border: '#4d7c0f', icon: '🥾' },
  club: { bg: '#9333ea', border: '#7e22ce', icon: '🌙' },
  patrimonio: { bg: '#d97706', border: '#b45309', icon: '🏛️' },
  naturaleza: { bg: '#059669', border: '#047857', icon: '🌳' },
  cultura: { bg: '#4f46e5', border: '#4338ca', icon: '🎭' },
  gastronomia: { bg: '#e11d48', border: '#be123c', icon: '🍷' },
  ocio: { bg: '#2563eb', border: '#1d4ed8', icon: '🎡' },
  comercio: { bg: '#0d9488', border: '#0f766e', icon: '🛍️' },
};

function resolverEstiloPin(item: any): { bg: string; border: string; icon: string } {
  const sub = (item.subcategoria || '').toLowerCase();
  const cat = (item.categoria || 'cultura').toLowerCase();

  if (sub.includes('deport') || sub.includes('polideport') || sub.includes('estadio') || sub.includes('fronton') || sub.includes('piscina') || sub.includes('kirol')) {
    return PINS_CONFIG.deporte;
  }
  if (sub.includes('ruta') || sub.includes('sendero') || sub.includes('via_verde') || sub.includes('anillo')) {
    return PINS_CONFIG.ruta;
  }
  if (sub.includes('club') || sub.includes('discoteca') || sub.includes('pub') || sub.includes('conciert')) {
    return PINS_CONFIG.club;
  }

  return PINS_CONFIG[cat] || PINS_CONFIG.cultura;
}

interface MapViewProps {
  lugares: Place[];
  eventos: Evento[];
  tabActiva: 'lugares' | 'eventos';
  radioMetros: number | null;
  centro: { lon: number; lat: number };
  onCenterChange: (center: { lon: number; lat: number }) => void;
  onSelectLugar: (lugar: Place) => void;
  lugarActivoId?: string;
}

export const MapView: React.FC<MapViewProps> = ({
  lugares,
  eventos,
  tabActiva,
  radioMetros,
  centro,
  onCenterChange,
  onSelectLugar,
  lugarActivoId,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const proximityCircleRef = useRef<L.Circle | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);

  // 1. Inicialización del Mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: VITORIA_CENTER,
      zoom: 13,
      minZoom: 11,
      maxZoom: 19,
      maxBounds: VITORIA_BBOX, // Navegación bloqueada al Bounding Box municipal (AGENTS.md Regla 3.3)
      maxBoundsViscosity: 0.8,
      zoomControl: false,
    });

    // Teselas CartoDB Voyager oficiales con API Key
    const cartoKey = import.meta.env.VITE_CARTO_API_KEY || 'cb1_3j0b_1_4d602ffc3a4aaf07e24b001b';
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${cartoKey}`, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);

    // Marcador de origen de proximidad pulsante
    const centerIcon = L.divIcon({
      html: `
        <div class="origin-pulse-marker" title="Centro del radio de proximidad">
          <div class="origin-pulse-ring"></div>
          <div class="origin-pulse-dot"></div>
        </div>
      `,
      className: 'origin-marker-container',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    centerMarkerRef.current = L.marker(VITORIA_CENTER, {
      icon: centerIcon,
      zIndexOffset: 1000,
    }).addTo(map);

    // Permitir clic en el mapa para desplazar el centro de proximidad
    map.on('click', (e: L.LeafletMouseEvent) => {
      onCenterChange({ lon: e.latlng.lng, lat: e.latlng.lat });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Actualizar marcador y círculo de radio de proximidad
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const centerLatLng: [number, number] = [centro.lat, centro.lon];

    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLatLng(centerLatLng);
    }

    if (proximityCircleRef.current) {
      map.removeLayer(proximityCircleRef.current);
      proximityCircleRef.current = null;
    }

    if (radioMetros !== null && radioMetros > 0) {
      proximityCircleRef.current = L.circle(centerLatLng, {
        radius: radioMetros,
        color: '#059669',
        fillColor: '#10b981',
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '6, 6',
      }).addTo(map);

      map.fitBounds(proximityCircleRef.current.getBounds(), {
        padding: [30, 30],
        maxZoom: radioMetros <= 500 ? 16 : radioMetros <= 1000 ? 15 : radioMetros <= 3000 ? 14 : 13,
      });
    }
  }, [centro, radioMetros]);

  // 3. Renderizar marcadores de Lugares o Eventos
  useEffect(() => {
    if (!markersLayerRef.current) return;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    const items = tabActiva === 'lugares' ? lugares : eventos;

    items.forEach((item: any) => {
      const style = resolverEstiloPin(item);
      const isSelected = item.id === lugarActivoId;

      const iconHtml = `
        <div class="custom-marker ${isSelected ? 'marker-active' : ''}" style="background: ${style.bg}; border-color: ${style.border};">
          <span class="marker-symbol">${style.icon}</span>
        </div>
      `;

      const markerIcon = L.divIcon({
        html: iconHtml,
        className: 'marker-container',
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -38],
      });

      const marker = L.marker([item.lat, item.lon], { icon: markerIcon });
      const titulo = item.nombre || item.titulo;
      const distStr = item.distancia_metros !== undefined
        ? item.distancia_metros >= 1000
          ? `${(item.distancia_metros / 1000).toFixed(1)} km`
          : `${Math.round(item.distancia_metros)} m`
        : '';

      marker.bindPopup(`
        <div class="flex flex-col gap-1.5 min-w-[200px] max-w-[240px]">
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white" style="background: ${style.bg};">
              ${style.icon} ${item.subcategoria || item.categoria}
            </span>
          </div>
          <h4 class="font-bold text-xs md:text-sm text-slate-900 leading-tight">${titulo}</h4>
          ${item.direccion ? `<p class="text-[11px] text-slate-500 line-clamp-1">📍 ${item.direccion}</p>` : ''}
          ${distStr ? `<p class="text-[11px] font-semibold text-emerald-700">🚶 A ${distStr}</p>` : ''}
          ${item.fecha_inicio ? `<p class="text-[11px] font-medium text-purple-700">📅 ${item.fecha_inicio}</p>` : ''}
        </div>
      `);

      marker.on('click', () => {
        if (tabActiva === 'lugares') {
          onSelectLugar(item);
        }
      });

      layer.addLayer(marker);
    });
  }, [lugares, eventos, tabActiva, lugarActivoId]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Selector Rápido de Barrios / Distritos (Cobertura de toda la ciudad) */}
      <div className="absolute top-4 left-4 right-16 z-20 overflow-x-auto no-scrollbar flex items-center gap-1.5 py-1 px-1">
        {DISTRITOS_VITORIA.map((d) => (
          <button
            key={d.nombre}
            onClick={() => {
              onCenterChange({ lon: d.lon, lat: d.lat });
              mapRef.current?.flyTo([d.lat, d.lon], d.zoom, { duration: 0.7 });
            }}
            className="bg-white/95 hover:bg-slate-50 backdrop-blur-md px-3 py-1.5 rounded-full shadow-md border border-slate-200 text-slate-700 text-xs font-bold whitespace-nowrap transition-all hover:text-emerald-700 hover:border-emerald-300"
            title={`Ir a ${d.nombre}`}
          >
            {d.nombre}
          </button>
        ))}
      </div>

      {/* Floating GPS and Locate Button */}
      <div className="absolute bottom-6 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={() => {
            if ('geolocation' in navigator) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const { longitude, latitude } = pos.coords;
                  if (longitude >= -2.77 && longitude <= -2.57 && latitude >= 42.78 && latitude <= 42.92) {
                    onCenterChange({ lon: longitude, lat: latitude });
                    mapRef.current?.flyTo([latitude, longitude], 15, { duration: 0.6 });
                  } else {
                    alert('Tu ubicación actual está fuera del término municipal de Vitoria-Gasteiz.');
                  }
                },
                (err) => alert('No se pudo obtener la geolocalización: ' + err.message)
              );
            }
          }}
          className="bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-200 text-slate-700 hover:text-emerald-700 hover:bg-slate-50 transition-all flex items-center justify-center text-sm font-bold"
          title="Mi ubicación GPS en Vitoria"
        >
          <span>📍</span>
        </button>
      </div>

      {/* Floating Info Banner */}
      <div className="absolute bottom-4 left-4 z-20 hidden md:flex items-center gap-2 bg-white/90 backdrop-blur-md py-1.5 px-3 rounded-full border border-slate-200 text-[11px] font-medium text-slate-600 shadow-sm">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Vitoria-Gasteiz • Bounding Box Completo EPSG:4326</span>
      </div>
    </div>
  );
};
