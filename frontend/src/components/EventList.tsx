import React from 'react';
import { Calendar, Clock, MapPin, ExternalLink, Sparkles } from 'lucide-react';

export interface Evento {
  id: string;
  external_id: string;
  titulo: string;
  categoria: string;
  descripcion?: string;
  espacio?: string;
  direccion?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  hora?: string;
  precio?: string;
  imagen_url?: string;
  enlace_web?: string;
  lon: number;
  lat: number;
  distancia_metros?: number;
}

interface EventListProps {
  eventos: Evento[];
  onSelectEvento: (evento: Evento) => void;
  eventoActivoId?: string;
}

function formatFechaBadge(fechaIni: string, fechaFin?: string): { texto: string; color: string } {
  const hoyStr = '2026-09-13';

  if (fechaIni === hoyStr) {
    return { texto: '🔥 Hoy, 13 Sept', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  }
  if (fechaIni === '2026-09-14') {
    return { texto: 'Mañana, 14 Sept', color: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
  if (fechaIni < hoyStr && fechaFin && fechaFin >= hoyStr) {
    const finObj = new Date(fechaFin);
    const finStr = isNaN(finObj.getTime())
      ? fechaFin
      : finObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    return { texto: `En curso • Hasta ${finStr}`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }

  const iniObj = new Date(fechaIni);
  const iniStr = isNaN(iniObj.getTime())
    ? fechaIni
    : iniObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  return { texto: iniStr, color: 'bg-purple-50 text-purple-700 border-purple-200' };
}

export const EventList: React.FC<EventListProps> = ({
  eventos,
  onSelectEvento,
  eventoActivoId,
}) => {
  if (eventos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
        <div className="text-4xl mb-2">🎭</div>
        <h4 className="font-bold text-sm text-slate-700">Sin eventos activos</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          No hay eventos programados en este radio de proximidad o categoría a partir de hoy.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Banner Informativo de Fecha Actual */}
      <div className="bg-purple-50/80 border border-purple-200/80 rounded-2xl p-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <span className="font-semibold text-purple-900">
            Agenda Cultural en Vitoria-Gasteiz: <span className="font-extrabold">Septiembre / Octubre 2026</span>
          </span>
        </div>
        <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
          {eventos.length} actos
        </span>
      </div>

      {eventos.map((ev) => {
        const isActive = ev.id === eventoActivoId;
        const badge = formatFechaBadge(ev.fecha_inicio, ev.fecha_fin);

        return (
          <article
            key={ev.id}
            onClick={() => onSelectEvento(ev)}
            className={`flex flex-col gap-2 p-3.5 rounded-2xl border transition-all cursor-pointer bg-white ${
              isActive
                ? 'border-purple-500 shadow-md ring-2 ring-purple-500/20 bg-purple-50/20'
                : 'border-slate-200/90 hover:border-slate-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                <Calendar className="w-3 h-3" />
                <span>{badge.texto}</span>
                {ev.hora && (
                  <>
                    <span className="opacity-40">•</span>
                    <Clock className="w-3 h-3" />
                    <span>{ev.hora}</span>
                  </>
                )}
              </div>

              {ev.precio && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {ev.precio}
                </span>
              )}
            </div>

            <h3 className="text-xs md:text-sm font-bold text-slate-900 leading-snug line-clamp-2">
              {ev.titulo}
            </h3>

            {ev.descripcion && (
              <p className="text-[11px] text-slate-500 line-clamp-2 font-normal leading-relaxed">
                {ev.descripcion}
              </p>
            )}

            <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              <div className="flex items-center gap-1 truncate max-w-[220px]">
                <MapPin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                <span className="truncate font-medium">{ev.espacio || ev.direccion || 'Vitoria-Gasteiz'}</span>
              </div>

              {ev.enlace_web && (
                <a
                  href={ev.enlace_web}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-purple-700 hover:text-purple-900 font-bold hover:underline"
                >
                  <span>Kulturklik</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
};
