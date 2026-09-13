import React, { useState, useEffect } from 'react';
import { MapView } from './components/MapView';
import { FilterBar, GrupoType } from './components/FilterBar';
import { PlaceCard, Place } from './components/PlaceCard';
import { EventList, Evento } from './components/EventList';
import { X, Navigation, Globe, Phone, RefreshCw } from 'lucide-react';

const API_BASE = '/api/v1';

export const App: React.FC = () => {
  const [grupo, setGrupo] = useState<GrupoType>('todos');
  const [radio, setRadio] = useState<number | null>(null);
  const [search, setSearch] = useState<string>('');
  const [tab, setTab] = useState<'lugares' | 'eventos'>('lugares');
  const [centro, setCentro] = useState<{ lon: number; lat: number }>({ lon: -2.6716, lat: 42.8467 });

  const [lugares, setLugares] = useState<Place[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [lugarSeleccionado, setLugarSeleccionado] = useState<Place | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  // Monitor offline state
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cargar Lugares desde /api/v1/lugares/cercanos con soporte para toda la ciudad y grupos
  const cargarLugares = async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      params.append('lat', centro.lat.toString());
      params.append('lon', centro.lon.toString());
      if (radio !== null) params.append('radio', radio.toString());
      if (grupo !== 'todos') params.append('grupo', grupo);
      if (search.trim()) params.append('search', search.trim());
      params.append('limit', '50');

      const res = await fetch(`${API_BASE}/lugares/cercanos?${params.toString()}`);
      if (res.ok) {
        const geojson = await res.json();
        const lista: Place[] = (geojson.features || []).map((f: any) => ({
          id: f.properties.id,
          external_id: f.properties.external_id,
          nombre: f.properties.nombre,
          categoria: f.properties.categoria,
          subcategoria: f.properties.subcategoria,
          descripcion: f.properties.descripcion,
          direccion: f.properties.direccion,
          imagen_url: f.properties.imagen_url,
          telefono: f.properties.telefono,
          web: f.properties.web,
          lon: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1],
          distancia_metros: f.properties.distancia_metros,
        }));
        setLugares(lista);
      }
    } catch (err) {
      console.warn('Error al cargar lugares:', err);
    } finally {
      setCargando(false);
    }
  };

  // Cargar Eventos actualizados desde /api/v1/eventos
  const cargarEventos = async () => {
    try {
      const params = new URLSearchParams();
      if (grupo !== 'todos' && !['deporte', 'rutas', 'clubes'].includes(grupo)) {
        params.append('categoria', grupo);
      }
      params.append('limit', '50');

      const res = await fetch(`${API_BASE}/eventos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEventos(data || []);
      }
    } catch (err) {
      console.warn('Error al cargar eventos:', err);
    }
  };

  useEffect(() => {
    cargarLugares();
    cargarEventos();
  }, [centro, radio, grupo, search]);

  const handleSyncETL = async () => {
    setIsSyncing(true);
    try {
      await fetch(`${API_BASE}/eventos/sync`, { method: 'POST' });
      setTimeout(async () => {
        await cargarLugares();
        await cargarEventos();
        setIsSyncing(false);
      }, 2500);
    } catch (e) {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-slate-100">
      {/* Offline Alert Banner */}
      {isOffline && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2">
          <span>⚠️</span>
          <span>Modo Offline activo: consultando caché local de Vitoria-Gasteiz</span>
        </div>
      )}

      {/* Sidebar Panel: Filtros y Tarjetas */}
      <section className="w-full md:w-[480px] lg:w-[520px] h-[50vh] md:h-full flex flex-col bg-white border-r border-slate-200 shadow-xl z-20 overflow-hidden">
        {/* Header Branding */}
        <header className="px-5 py-3.5 bg-gradient-to-r from-vitoria-forest to-vitoria-emerald text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-lg shadow-inner">
              🌲
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight">GasteizGo</h1>
              <p className="text-[11px] text-emerald-200 font-medium">Toda Vitoria-Gasteiz • Deporte, Rutas, Ocio y Cultura</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSyncETL}
              disabled={isSyncing}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white text-xs font-bold flex items-center gap-1"
              title="Sincronizar datos con Kulturklik y Open Data VG"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-300' : ''}`} />
              <span className="hidden sm:inline">ETL</span>
            </button>
          </div>
        </header>

        {/* FilterBar Integrada */}
        <FilterBar
          grupoActivo={grupo}
          onSelectGrupo={setGrupo}
          radioActivo={radio}
          onSelectRadio={setRadio}
          searchQuery={search}
          onSearchChange={setSearch}
          tabActiva={tab}
          onSelectTab={setTab}
          conteoLugares={lugares.length}
          conteoEventos={eventos.length}
        />

        {/* Feed de Tarjetas con Scroll Independiente */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3 bg-slate-50">
          {tab === 'lugares' ? (
            cargando ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium">Explorando Vitoria-Gasteiz al completo...</span>
              </div>
            ) : lugares.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-slate-500 p-6">
                <span className="text-3xl mb-1">🗺️</span>
                <h4 className="font-bold text-sm">No se encontraron lugares con este filtro</h4>
                <p className="text-xs text-slate-400 mt-1">Prueba a seleccionar 'Todo VG' en la distancia o pulsar 'Todo Vitoria'.</p>
              </div>
            ) : (
              lugares.map((lugar) => (
                <PlaceCard
                  key={lugar.id}
                  place={lugar}
                  isActive={lugarSeleccionado?.id === lugar.id}
                  onSelect={(p) => setLugarSeleccionado(p)}
                />
              ))
            )
          ) : (
            <EventList
              eventos={eventos}
              onSelectEvento={(e) => {
                setCentro({ lon: e.lon, lat: e.lat });
              }}
            />
          )}
        </div>
      </section>

      {/* Main Map View */}
      <main className="flex-1 h-[50vh] md:h-full relative z-10">
        <MapView
          lugares={lugares}
          eventos={eventos}
          tabActiva={tab}
          radioMetros={radio}
          centro={centro}
          onCenterChange={setCentro}
          onSelectLugar={(p) => setLugarSeleccionado(p)}
          lugarActivoId={lugarSeleccionado?.id}
        />
      </main>

      {/* Detail Modal / Drawer for Selected Place */}
      {lugarSeleccionado && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLugarSeleccionado(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLugarSeleccionado(null)}
              className="absolute top-4 right-4 z-10 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {lugarSeleccionado.imagen_url && (
              <div className="w-full h-56 relative bg-slate-100">
                <img
                  src={lugarSeleccionado.imagen_url}
                  alt={lugarSeleccionado.nombre}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-6 flex flex-col gap-3.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg">
                  {lugarSeleccionado.subcategoria || lugarSeleccionado.categoria}
                </span>
                {lugarSeleccionado.distancia_metros !== undefined && (
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                    🚶 {lugarSeleccionado.distancia_metros >= 1000
                      ? `${(lugarSeleccionado.distancia_metros / 1000).toFixed(1)} km`
                      : `${Math.round(lugarSeleccionado.distancia_metros)} metros`}
                  </span>
                )}
              </div>

              <h2 className="text-xl font-extrabold text-slate-900 leading-tight">
                {lugarSeleccionado.nombre}
              </h2>

              {lugarSeleccionado.direccion && (
                <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <span>📍</span>
                  <span>{lugarSeleccionado.direccion}</span>
                </p>
              )}

              {lugarSeleccionado.descripcion && (
                <p className="text-sm text-slate-600 leading-relaxed pt-1">
                  {lugarSeleccionado.descripcion}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100 mt-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${lugarSeleccionado.lat},${lugarSeleccionado.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-xl bg-vitoria-forest hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Cómo llegar (GPS)</span>
                </a>

                {lugarSeleccionado.web && (
                  <a
                    href={lugarSeleccionado.web}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Web oficial</span>
                  </a>
                )}

                {lugarSeleccionado.telefono && (
                  <a
                    href={`tel:${lugarSeleccionado.telefono}`}
                    className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Llamar</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
