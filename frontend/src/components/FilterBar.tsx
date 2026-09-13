import React from 'react';
import { Search, MapPin, Compass, Sparkles } from 'lucide-react';

export type GrupoType =
  | 'todos'
  | 'deporte'
  | 'rutas'
  | 'clubes'
  | 'gastronomia'
  | 'patrimonio'
  | 'naturaleza'
  | 'cultura'
  | 'comercio';

interface FilterBarProps {
  grupoActivo: GrupoType;
  onSelectGrupo: (grupo: GrupoType) => void;
  radioActivo: number | null;
  onSelectRadio: (radio: number | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  tabActiva: 'lugares' | 'eventos';
  onSelectTab: (tab: 'lugares' | 'eventos') => void;
  conteoLugares: number;
  conteoEventos: number;
}

const GRUPOS_CONFIG: { id: GrupoType; label: string; icon: string; color: string }[] = [
  { id: 'todos', label: 'Todo Vitoria', icon: '🌟', color: 'bg-slate-900 text-white' },
  { id: 'deporte', label: 'Deporte & Kirol', icon: '⚽', color: 'bg-sky-600 text-white' },
  { id: 'rutas', label: 'Rutas & Senderos', icon: '🥾', color: 'bg-lime-600 text-white' },
  { id: 'clubes', label: 'Clubes & Noche', icon: '🌙', color: 'bg-purple-600 text-white' },
  { id: 'gastronomia', label: 'Gastronomía', icon: '🍷', color: 'bg-rose-600 text-white' },
  { id: 'patrimonio', label: 'Patrimonio', icon: '🏛️', color: 'bg-amber-600 text-white' },
  { id: 'naturaleza', label: 'Naturaleza & Anillo', icon: '🌳', color: 'bg-emerald-600 text-white' },
  { id: 'cultura', label: 'Cultura & Arte', icon: '🎭', color: 'bg-indigo-600 text-white' },
  { id: 'comercio', label: 'Comercio & Mercados', icon: '🛍️', color: 'bg-teal-600 text-white' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  grupoActivo,
  onSelectGrupo,
  radioActivo,
  onSelectRadio,
  searchQuery,
  onSearchChange,
  tabActiva,
  onSelectTab,
  conteoLugares,
  conteoEventos,
}) => {
  return (
    <div className="flex flex-col gap-3 p-4 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm sticky top-0 z-20">
      {/* Tabs Selector: Lugares y Rutas vs Agenda Cultural */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex bg-slate-100 p-1 rounded-xl w-full">
          <button
            onClick={() => onSelectTab('lugares')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tabActiva === 'lugares'
                ? 'bg-white text-vitoria-forest shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Lugares, Rutas y Clubes</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-200/70 rounded-full font-semibold">
              {conteoLugares}
            </span>
          </button>
          <button
            onClick={() => onSelectTab('eventos')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              tabActiva === 'eventos'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Agenda Sept/Oct 2026</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-full font-semibold">
              {conteoEventos}
            </span>
          </button>
        </div>
      </div>

      {/* Barra de búsqueda con estética glassmorphic */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar polideportivos, rutas, bares, catedral, salas de fiesta..."
          className="w-full pl-10 pr-4 py-2 text-xs md:text-sm bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
        />
      </div>

      {/* Selector de Radio de Proximidad */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-emerald-600" />
            Filtro de Distancia
          </span>
          <span className="text-emerald-700 normal-case font-semibold text-[11px]">
            {radioActivo ? `Radio: ${radioActivo >= 1000 ? `${radioActivo / 1000} km` : `${radioActivo} m`}` : 'Todo el Término Municipal'}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { label: 'Todo VG', value: null },
            { label: '500 m', value: 500 },
            { label: '1 km', value: 1000 },
            { label: '3 km', value: 3000 },
            { label: '6 km', value: 6000 },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => onSelectRadio(item.value)}
              className={`py-1.5 px-1.5 text-xs font-bold rounded-lg border transition-all text-center ${
                radioActivo === item.value
                  ? 'bg-vitoria-forest text-white border-vitoria-forest shadow-sm ring-2 ring-emerald-500/20'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Carrusel horizontal de Grupos de Búsqueda Temáticos */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 pb-0.5">
        {GRUPOS_CONFIG.map((g) => {
          const isSelected = grupoActivo === g.id;
          return (
            <button
              key={g.id}
              onClick={() => onSelectGrupo(g.id)}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                isSelected
                  ? `${g.color} border-transparent shadow-sm scale-105 ring-2 ring-slate-400/30`
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{g.icon}</span>
              <span>{g.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
