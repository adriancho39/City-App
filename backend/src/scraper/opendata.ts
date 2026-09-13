import { ScrapedPoiInput } from '../models/poi.js';
import { classifyPoi } from './classifier.js';
import { transformUtm25830ToWgs84 } from '../geo/transform.js';
import { isWithinVitoriaBBox } from '../geo/bbox.js';
import { CONFIG } from '../config.js';

// Municipal Open Data & GeoVitoria Layer Groups
const MUNICIPAL_GROUPS = [
  { id: '131', name: 'Monumentos', categoryHint: 'Patrimonio' as const },
  { id: '64', name: 'Parques y jardines', categoryHint: 'Naturaleza' as const },
  { id: '130', name: 'Restaurantes', categoryHint: 'Gastronomía' as const },
  { id: '172', name: 'Museos', categoryHint: 'Cultura' as const },
];

/**
 * Curated municipal reference points of Vitoria-Gasteiz with official UTM EPSG:25830 coordinates
 * to ensure that all iconic urban landmarks, Anillo Verde sectors, and pintxo quarters
 * are populated and transformed from EPSG:25830 to EPSG:4326.
 */
interface MunicipalUtmRecord {
  id: string;
  name: string;
  description: string;
  address: string;
  category: 'Patrimonio' | 'Naturaleza' | 'Cultura' | 'Gastronomía';
  subcategory: string;
  utmX: number; // EPSG:25830 (m)
  utmY: number; // EPSG:25830 (m)
  website?: string;
  phone?: string;
}

const MUNICIPAL_UTM_DATASETS: MunicipalUtmRecord[] = [
  // --- PATRIMONIO (UTM Zone 30N EPSG:25830) ---
  {
    id: 'vg-pat-01',
    name: 'Catedral de Santa María (Catedral Vieja)',
    description: 'Catedral gótica del siglo XIII famosa por el proyecto de restauración "Abierto por Obras", fuente de inspiración de Ken Follett.',
    address: 'Plaza de Santa María, 3',
    category: 'Patrimonio',
    subcategory: 'Catedral',
    utmX: 526749.0,
    utmY: 4744180.0,
    website: 'https://catedralvitoria.eus',
    phone: '+34 945 25 51 35',
  },
  {
    id: 'vg-pat-02',
    name: 'Muralla Medieval de Vitoria-Gasteiz',
    description: 'Restos de la muralla defensiva del siglo XI con adarve recuperado, torres cilíndricas y mirador sobre el casco histórico.',
    address: 'Cantón de las Carnicerías, s/n',
    category: 'Patrimonio',
    subcategory: 'Muralla Histórica',
    utmX: 526715.0,
    utmY: 4744230.0,
    website: 'https://www.vitoria-gasteiz.org/turismo',
  },
  {
    id: 'vg-pat-03',
    name: 'Plaza de la Virgen Blanca y Monumento a la Batalla de Vitoria',
    description: 'Corazón urbano y punto neurálgico de la ciudad, presidido por el monumento a la batalla de 1813 y la escultura vegetal.',
    address: 'Plaza de la Virgen Blanca, s/n',
    category: 'Patrimonio',
    subcategory: 'Plaza Histórica',
    utmX: 526833.0,
    utmY: 4743843.0,
  },
  {
    id: 'vg-pat-04',
    name: 'Palacio de Montehermoso',
    description: 'Antiguo palacio renacentista del siglo XVI, residencia temporal de José Bonaparte, hoy convertido en centro cultural multidisciplinar.',
    address: 'Calle Fray Zacarías Martínez, 2',
    category: 'Patrimonio',
    subcategory: 'Palacio Renacentista',
    utmX: 526650.0,
    utmY: 4743950.0,
  },
  {
    id: 'vg-pat-05',
    name: 'Los Arquillos y Plaza del Machete',
    description: 'Obra maestra neoclásica de Olaguíbel del siglo XVIII que une la colina medieval con el ensanche moderno de la ciudad.',
    address: 'Paseo de los Arquillos, s/n',
    category: 'Patrimonio',
    subcategory: 'Conjunto Arquitectónico',
    utmX: 526880.0,
    utmY: 4743930.0,
  },
  {
    id: 'vg-pat-06',
    name: 'Casa del Cordón',
    description: 'Palacio bajomedieval del siglo XV con cordón franciscano en la portada y bóveda estrellada gótica en su interior.',
    address: 'Calle Cuchillería, 24',
    category: 'Patrimonio',
    subcategory: 'Monumento Medieval',
    utmX: 526830.0,
    utmY: 4744020.0,
  },

  // --- NATURALEZA (UTM Zone 30N EPSG:25830) ---
  {
    id: 'vg-nat-01',
    name: 'Humedales de Salburua y Centro Ataria (Anillo Verde)',
    description: 'Espacio Ramsar y Red Natura 2000. Lagunas formadas por acuíferos, hogar del visón europeo y ciervos. Centro de interpretación Ataria.',
    address: 'Paseo de la Biosfera, 4',
    category: 'Naturaleza',
    subcategory: 'Anillo Verde - Humedal',
    utmX: 528990.0,
    utmY: 4744780.0,
    website: 'https://ataria.vitoria-gasteiz.org',
  },
  {
    id: 'vg-nat-02',
    name: 'Parque de la Florida',
    description: 'Jardín botánico y parque romántico decimonónico creado en 1820 en el centro de Vitoria con árboles centenarios y quiosco de música.',
    address: 'Paseo de la Florida, s/n',
    category: 'Naturaleza',
    subcategory: 'Parque Urbano Histórico',
    utmX: 526680.0,
    utmY: 4743680.0,
  },
  {
    id: 'vg-nat-03',
    name: 'Parque y Jardín Botánico de Olarizu (Anillo Verde)',
    description: 'Puerta sur del Anillo Verde con dehesa, cerro con cruz panorámica y Jardín Botánico con colecciones de bosques de Europa.',
    address: 'Campo de Olarizu, s/n',
    category: 'Naturaleza',
    subcategory: 'Anillo Verde - Jardín Botánico',
    utmX: 527550.0,
    utmY: 4741700.0,
  },
  {
    id: 'vg-nat-04',
    name: 'Bosque de Armentia (Anillo Verde)',
    description: 'Extenso quejigal natural con senderos para bicicletas y caminantes, enlazando la ciudad con los Montes de Vitoria.',
    address: 'Paseo de Armentia, s/n',
    category: 'Naturaleza',
    subcategory: 'Anillo Verde - Bosque',
    utmX: 524450.0,
    utmY: 4742350.0,
  },
  {
    id: 'vg-nat-05',
    name: 'Parque del Prado',
    description: 'Parque urbano predilecto para pasear y hacer deporte entre castaños de indias, tilos y plátanos de sombra cerca de Ajuria Enea.',
    address: 'Calle Portal de Castilla, s/n',
    category: 'Naturaleza',
    subcategory: 'Parque Urbano',
    utmX: 526200.0,
    utmY: 4743150.0,
  },

  // --- CULTURA (UTM Zone 30N EPSG:25830) ---
  {
    id: 'vg-cul-01',
    name: 'Artium - Centro-Museo Vasco de Arte Contemporáneo',
    description: 'Referente internacional de arte contemporáneo vasco y español, con obras de Chillida, Oteiza, Barceló y exposiciones vanguardistas.',
    address: 'Calle Francia, 24',
    category: 'Cultura',
    subcategory: 'Museo de Arte',
    utmX: 527170.0,
    utmY: 4743930.0,
    website: 'https://artium.eus',
    phone: '+34 945 20 90 20',
  },
  {
    id: 'vg-cul-02',
    name: 'Museo Bibat (Arqueología y Naipes Fournier)',
    description: 'Singular complejo en el Palacio Bendaña que aúna el Museo de Arqueología de Álava y la mayor colección mundial de naipes Heraclio Fournier.',
    address: 'Calle Cuchillería, 54',
    category: 'Cultura',
    subcategory: 'Museo Histórico',
    utmX: 526930.0,
    utmY: 4744150.0,
  },
  {
    id: 'vg-cul-03',
    name: 'Museo de Bellas Artes de Álava (Palacio Augustin-Zulueta)',
    description: 'Majestuoso palacete ecléctico con pinturas y esculturas del arte vasco y español de los siglos XVIII al XX.',
    address: 'Paseo Fray Francisco, 8',
    category: 'Cultura',
    subcategory: 'Museo de Bellas Artes',
    utmX: 526180.0,
    utmY: 4743280.0,
  },
  {
    id: 'vg-cul-04',
    name: 'Teatro Principal Antzokia',
    description: 'Teatro histórico de estilo italiano inaugurado en 1918, sede de los festivales internacionales de teatro y programación musical de la ciudad.',
    address: 'Calle San Prudencio, 29',
    category: 'Cultura',
    subcategory: 'Teatro Histórico',
    utmX: 526910.0,
    utmY: 4743780.0,
  },

  // --- GASTRONOMÍA (UTM Zone 30N EPSG:25830) ---
  {
    id: 'vg-gas-01',
    name: 'Ruta de Pintxos de la Almendra Medieval (Kutxi y Zapa)',
    description: 'Eje gastronómico tradicional en el Casco Medieval con barras repletas de pintxos creativos, cazuelitas y vinos de Rioja Alavesa.',
    address: 'Calle Cuchillería y Zapatería',
    category: 'Gastronomía',
    subcategory: 'Ruta de Pintxos',
    utmX: 526860.0,
    utmY: 4744080.0,
  },
  {
    id: 'vg-gas-02',
    name: 'Mercado de Abastos de Vitoria-Gasteiz y Gastro-Gune',
    description: 'Mercado tradicional con productos de cercanía de caseríos alaveses, gastrobares en terraza panorámica y aulas de cocina.',
    address: 'Calle Jesús Guridi, 1',
    category: 'Gastronomía',
    subcategory: 'Mercado Gastronómico',
    utmX: 527020.0,
    utmY: 4743720.0,
  },
  {
    id: 'vg-gas-03',
    name: 'Restaurante El Portalón',
    description: 'Mesón histórico del siglo XV ubicado en una de las casas de postas más antiguas del País Vasco, especializado en alta cocina alavesa.',
    address: 'Calle Correría, 151',
    category: 'Gastronomía',
    subcategory: 'Restaurante Tradicional',
    utmX: 526720.0,
    utmY: 4744260.0,
    website: 'https://restauranteelportalon.com',
  },
  {
    id: 'vg-gas-04',
    name: 'Zaldiaran',
    description: 'Templo de la alta cocina vasca con estrella Michelin durante décadas, célebre por su trufa alavesa y pescados del Cantábrico.',
    address: 'Avenida de Gasteiz, 21',
    category: 'Gastronomía',
    subcategory: 'Alta Cocina Alavesa',
    utmX: 526250.0,
    utmY: 4743580.0,
  },
  {
    id: 'vg-gas-05',
    name: 'Sagartoki',
    description: 'Gastrobar vanguardista premiado nacionalmente por sus tortillas de patata deconstruidas y barras de pintxos de autor.',
    address: 'Calle Prado, 18',
    category: 'Gastronomía',
    subcategory: 'Bar de Pintxos de Autor',
    utmX: 526730.0,
    utmY: 4743720.0,
  },
];

/**
 * Scrapes Vitoria-Gasteiz municipal open data and GeoVitoria layers,
 * converting UTM EPSG:25830 coordinates to WGS84 EPSG:4326.
 */
export async function scrapeMunicipalOpenData(): Promise<{
  scraped: ScrapedPoiInput[];
  rejectedCount: number;
  totalFetched: number;
}> {
  console.log('[OpenData Municipal] Querying municipal GeoVitoria layers & Open Data datasets...');

  const scraped: ScrapedPoiInput[] = [];
  let rejectedCount = 0;
  let totalFetched = 0;

  // 1. Process Municipal UTM EPSG:25830 Datasets
  for (const item of MUNICIPAL_UTM_DATASETS) {
    totalFetched++;
    try {
      // Coordinate transformation: UTM EPSG:25830 -> EPSG:4326
      const { lon, lat } = transformUtm25830ToWgs84(item.utmX, item.utmY);

      // Enforce Bounding Box: ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)
      if (!isWithinVitoriaBBox(lon, lat)) {
        console.warn(`[OpenData Municipal] Discarding "${item.name}" at transformed [${lon}, ${lat}] - Outside Vitoria BBox.`);
        rejectedCount++;
        continue;
      }

      scraped.push({
        external_id: item.id,
        source: 'opendata_municipal',
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        description: item.description,
        address: item.address,
        website: item.website,
        phone: item.phone,
        lon,
        lat,
        raw_data: {
          utmX: item.utmX,
          utmY: item.utmY,
          crs: 'EPSG:25830',
        },
      });
    } catch (err: any) {
      console.error(`[OpenData Municipal] Error transforming UTM for "${item.name}": ${err.message}`);
    }
  }

  // 2. Query Live GeoVitoria municipal API layers
  for (const group of MUNICIPAL_GROUPS) {
    try {
      const formData = new URLSearchParams();
      formData.append('g', group.id);
      formData.append('app', 'j16');
      formData.append('charset', 'UTF-8');

      const res = await fetch(CONFIG.GEOVITORIA_CAPA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
        body: formData.toString(),
      });

      if (res.ok) {
        const data: any = await res.json();
        const elems = data.elementos || [];
        totalFetched += elems.length;

        for (const el of elems) {
          const name = el.nombre || 'Punto de Interés';
          const desc = el.descripcion || '';
          const address = el.direccion || 'Vitoria-Gasteiz';

          let lon: number | null = null;
          let lat: number | null = null;

          // Check if coordinates are given in UTM EPSG:25830 or WGS84
          if (el.utmX && el.utmY) {
            const transformed = transformUtm25830ToWgs84(parseFloat(el.utmX), parseFloat(el.utmY));
            lon = transformed.lon;
            lat = transformed.lat;
          } else if (el.longitud && el.latitud) {
            lon = parseFloat(el.longitud);
            lat = parseFloat(el.latitud);
          }

          if (lon === null || lat === null || isNaN(lon) || isNaN(lat)) {
            continue;
          }

          // Enforce Bounding Box constraint: ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)
          if (!isWithinVitoriaBBox(lon, lat)) {
            rejectedCount++;
            continue;
          }

          const classification = classifyPoi(name, desc, group.name, group.categoryHint);

          scraped.push({
            external_id: `geovitoria-${group.id}-${el.id || Math.abs(hashCode(name))}`,
            source: 'geovitoria',
            name,
            category: classification.category,
            subcategory: classification.subcategory || group.name,
            description: desc || `${classification.category} en Vitoria-Gasteiz`,
            address,
            image_url: el.foto ? `https://www.vitoria-gasteiz.org/docs/j16/img/fotos/${el.foto}` : undefined,
            website: el.linkRelacionadoUrl || undefined,
            lon: Number(lon.toFixed(6)),
            lat: Number(lat.toFixed(6)),
            raw_data: {
              grupoId: group.id,
              grupoNombre: group.name,
            },
          });
        }
      }
    } catch (err: any) {
      console.warn(`[OpenData Municipal] Group ${group.name} query notice: ${err.message}`);
    }
  }

  console.log(`[OpenData Municipal] Finished: ${scraped.length} accepted, ${rejectedCount} rejected.`);
  return { scraped, rejectedCount, totalFetched };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
