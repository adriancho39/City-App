import React from 'react';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';

export interface Place {
  id: string;
  external_id: string;
  nombre: string;
  categoria: string;
  subcategoria?: string;
  descripcion?: string;
  direccion?: string;
  imagen_url?: string;
  telefono?: string;
  web?: string;
  lon: number;
  lat: number;
  distancia_metros?: number;
}

interface PlaceCardProps {
  place: Place;
  isActive: boolean;
  onSelect: (place: Place) => void;
}

const CATEGORIA_BADGES: Record<string, { bg: string; text: string; icon: string }> = {
  patrimonio: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: '🏛️' },
  naturaleza: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: '🌳' },
  cultura: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', icon: '🎭' },
  gastronomia: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', icon: '🍷' },
  ocio: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: '🎡' },
  comercio: { bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-700', icon: '🛍️' },
};

export const PlaceCard: React.FC<PlaceCardProps> = ({ place, isActive, onSelect }) => {
  const badge = CATEGORIA_BADGES[place.categoria.toLowerCase()] || CATEGORIA_BADGES.cultura;
  const distFormatted = place.distancia_metros !== undefined
    ? place.distancia_metros >= 1000
      ? `${(place.distancia_metros / 1000).toFixed(1)} km`
      : `${Math.round(place.distancia_metros)} m`
    : null;

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;

  return (
    <article
      onClick={() => onSelect(place)}
      className={`group relative flex gap-3.5 p-3.5 rounded-2xl border transition-all cursor-pointer bg-white ${
        isActive
          ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20 bg-emerald-50/20'
          : 'border-slate-200/90 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      {/* Thumbnail de alta resolución */}
      <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 relative border border-slate-200/50">
        {place.imagen_url ? (
          <img
            src={place.imagen_url}
            alt={place.nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl bg-slate-100">
            {badge.icon}
          </div>
        )}
        <span className="absolute bottom-1 right-1 text-xs bg-black/50 backdrop-blur-sm p-0.5 rounded">
          {badge.icon}
        </span>
      </div>

      {/* Contenido textual */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text}`}
            >
              {place.subcategoria || place.categoria}
            </span>
            {distFormatted && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <Navigation className="w-2.5 h-2.5" />
                {distFormatted}
              </span>
            )}
          </div>

          <h3 className="text-xs md:text-sm font-bold text-slate-900 leading-snug line-clamp-1 group-hover:text-vitoria-forest transition-colors">
            {place.nombre}
          </h3>

          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed font-normal">
            {place.descripcion || place.direccion || 'Lugar de interés en Vitoria-Gasteiz.'}
          </p>
        </div>

        {/* Footer con acciones */}
        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
          <div className="flex items-center gap-1 truncate max-w-[170px]">
            <MapPin className="w-3 h-3 flex-shrink-0 text-slate-400" />
            <span className="truncate">{place.direccion || 'Vitoria-Gasteiz'}</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Cómo llegar con Google Maps"
              className="p-1 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
            >
              <Navigation className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-600" />
            </a>
            {place.web && (
              <a
                href={place.web}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Visitar web oficial"
                className="p-1 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-600" />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
