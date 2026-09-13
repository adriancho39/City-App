import { ScrapedPoiInput } from '../models/poi.js';
import { classifyPoi } from './classifier.js';
import { isWithinVitoriaBBox } from '../geo/bbox.js';
import { CONFIG } from '../config.js';

// Well-known cultural establishments in Vitoria-Gasteiz with precise coordinates
const VENUE_COORDINATES: Record<string, { lon: number; lat: number; address?: string }> = {
  'teatro principal': { lon: -2.6706, lat: 42.8465, address: 'Calle San Prudencio, 29' },
  'artium': { lon: -2.6675, lat: 42.8475, address: 'Calle Francia, 24' },
  'teatro félix petite': { lon: -2.6908, lat: 42.8592, address: 'Centro Cívico Ibaiondo' },
  'teatro jesús ibáñez': { lon: -2.6795, lat: 42.8375, address: 'Centro Cívico Helson' },
  'conservatorio jesús guridi': { lon: -2.6755, lat: 42.8420, address: 'Plaza de la Constitución, 9' },
  'jimmy jazz': { lon: -2.6710, lat: 42.8492, address: 'Calle Coronación de la Virgen Blanca, 4' },
  'iradier arena': { lon: -2.6685, lat: 42.8415, address: 'Plaza de Toros / Iradier Arena' },
  'palacio de congresos europa': { lon: -2.6828, lat: 42.8512, address: 'Avenida de Gasteiz, 85' },
  'palacio villa suso': { lon: -2.6718, lat: 42.8480, address: 'Plaza del Machete' },
  'montehermoso': { lon: -2.6738, lat: 42.8475, address: 'Calle Fray Zacarías Martínez, 2' },
  'catedral de santa maría': { lon: -2.6726, lat: 42.8497, address: 'Plaza de Santa María, 3' },
  'oihaneder': { lon: -2.6738, lat: 42.8475, address: 'Fray Zacarías Martínez, 2' },
};

/**
 * Scrapes cultural events from the Basque Government Kulturklik API for municipality 01059 (Vitoria-Gasteiz)
 */
export async function scrapeKulturklik(limit = 100): Promise<{
  scraped: ScrapedPoiInput[];
  rejectedCount: number;
  totalFetched: number;
}> {
  console.log(`[Kulturklik] Fetching events for municipality 01059 (Vitoria-Gasteiz, Nora: ${CONFIG.KULTURKLIK_MUNICIPALITY_NORA})...`);

  const url = `${CONFIG.KULTURKLIK_API_URL}?provinceNoraCode=${CONFIG.KULTURKLIK_PROVINCE_NORA}&municipalityNoraCode=${CONFIG.KULTURKLIK_MUNICIPALITY_NORA}&_elements=${limit}`;

  const scraped: ScrapedPoiInput[] = [];
  let rejectedCount = 0;
  let totalFetched = 0;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Vitoria-Gasteiz-Tourism-PWA/1.0',
      },
    });

    if (!res.ok) {
      throw new Error(`Kulturklik API responded with status ${res.status} ${res.statusText}`);
    }

    const data: any = await res.json();
    const items = data.items || [];
    totalFetched = items.length;

    console.log(`[Kulturklik] Retrieved ${items.length} items from API.`);

    for (const item of items) {
      const name = item.nameEs || item.nameEu || 'Evento Cultural';
      const desc = item.descriptionEs || item.descriptionEu || '';
      const type = item.typeEs || item.typeEu || 'Cultura';
      const establishment = item.establishmentEs || item.establishmentEu || '';

      // Determine geographic coordinates
      let lon: number | null = null;
      let lat: number | null = null;

      // 1. Check known establishment map
      if (establishment) {
        const estLower = establishment.toLowerCase();
        for (const [key, coords] of Object.entries(VENUE_COORDINATES)) {
          if (estLower.includes(key)) {
            lon = coords.lon;
            lat = coords.lat;
            break;
          }
        }
      }

      // 2. Check item latitude/longitude from API
      if (lon === null || lat === null) {
        const rawLat = parseFloat(item.municipalityLatitude || item.latitude);
        const rawLon = parseFloat(item.municipalityLongitude || item.longitude);
        if (!isNaN(rawLat) && !isNaN(rawLon) && rawLat !== 0) {
          lat = rawLat;
          lon = rawLon;
        }
      }

      // 3. Fallback to city center with slight jitter to prevent exact overlapping markers
      if (lon === null || lat === null) {
        lon = CONFIG.CENTER.lon + (Math.random() - 0.5) * 0.008;
        lat = CONFIG.CENTER.lat + (Math.random() - 0.5) * 0.008;
      }

      // Apply Bounding Box constraint: ST_MakeEnvelope(-2.77, 42.78, -2.57, 42.92, 4326)
      if (!isWithinVitoriaBBox(lon, lat)) {
        console.warn(`[Kulturklik] Discarding event "${name}" at [${lon}, ${lat}] - Outside Vitoria BBox.`);
        rejectedCount++;
        continue;
      }

      // Image URL extraction
      let imageUrl: string | undefined = undefined;
      if (item.images && Array.isArray(item.images) && item.images.length > 0) {
        imageUrl = item.images[0].imageUrl || item.images[0].url;
      }

      // Classification
      const classification = classifyPoi(name, `${desc} ${establishment}`, type, 'Cultura');

      scraped.push({
        external_id: `kulturklik-${item.id}`,
        source: 'kulturklik',
        name,
        category: classification.category,
        subcategory: classification.subcategory || type,
        description: desc.length > 500 ? desc.substring(0, 500) + '...' : desc,
        address: establishment || item.sourceNameEs || 'Vitoria-Gasteiz',
        image_url: imageUrl,
        website: item.urlEventEs || item.sourceUrlEs,
        price: item.priceEs || undefined,
        start_date: item.startDate,
        end_date: item.endDate,
        lon: Number(lon.toFixed(6)),
        lat: Number(lat.toFixed(6)),
        raw_data: {
          id: item.id,
          type: item.typeEs,
          establishment,
          openingHours: item.openingHoursEs,
        },
      });
    }
  } catch (err: any) {
    console.error(`[Kulturklik] Scraping failed: ${err.message}`);
  }

  console.log(`[Kulturklik] Finished: ${scraped.length} accepted, ${rejectedCount} rejected out of bbox.`);
  return { scraped, rejectedCount, totalFetched };
}
