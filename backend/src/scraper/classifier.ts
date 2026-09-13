import { CategoryType } from '../config.js';

export interface ClassificationRule {
  category: CategoryType;
  keywords: string[];
}

const RULES: ClassificationRule[] = [
  {
    category: 'Patrimonio',
    keywords: [
      'catedral', 'muralla', 'palacio', 'torre', 'convento', 'iglesia', 'monumento',
      'arquillos', 'virgen blanca', 'machete', 'cordon', 'escoriaza', 'montehermoso',
      'villasuso', 'villa suso', 'casco medieval', 'casco historico', 'almendra medieval',
      'santa maria', 'san miguel', 'san vicente', 'san pedro', 'san francisco',
      'casa del cordon', 'patrimonio', 'historico', 'arquitectura', 'escultura', 'estatua'
    ],
  },
  {
    category: 'Naturaleza',
    keywords: [
      'parque', 'jardin', 'anillo verde', 'salburua', 'olarizu', 'zabalgana',
      'armentia', 'humedal', 'ataria', 'botanico', 'bosque', 'senda', 'rio',
      'verde', 'arbol', 'florida', 'prado', 'arriaga', 'judimendi', 'molinuevo',
      'biodiversidad', 'fauna', 'flora', 'medio ambiente', 'natural', 'paseo natural'
    ],
  },
  {
    category: 'Cultura',
    keywords: [
      'museo', 'artium', 'bibat', 'bellas artes', 'armeria', 'ciencias naturales',
      'teatro', 'concierto', 'exposicion', 'musica', 'danza', 'cine', 'kultur',
      'festival', 'literatura', 'conferencia', 'taller cultural', 'espectaculo',
      'auditorio', 'sala', 'kulturklik', 'centro civico', 'obra de teatro'
    ],
  },
  {
    category: 'Gastronomía',
    keywords: [
      'restaurante', 'asador', 'sidreria', 'taberna', 'bar', 'pintxo', 'gastronomia',
      'comida', 'abastos', 'mercado de abastos', 'enologia', 'vino', 'rioja alavesa',
      'txakoli', 'degustacion', 'menu del dia', 'cocina vasca', 'gastronomico', 'bodega'
    ],
  },
];

/**
 * Classifies an item into one of the 4 canonical categories:
 * 'Patrimonio', 'Naturaleza', 'Cultura', or 'Gastronomía'
 */
export function classifyPoi(
  name: string,
  description?: string,
  rawType?: string,
  defaultCategory?: CategoryType
): { category: CategoryType; subcategory?: string } {
  const text = `${name} ${description || ''} ${rawType || ''}`.toLowerCase();

  // 1. Direct group / type hints from GeoVitoria or Kulturklik
  if (rawType) {
    const rawLower = rawType.toLowerCase();
    if (rawLower.includes('monumento') || rawLower.includes('patrimonio') || rawLower.includes('palacio')) {
      return { category: 'Patrimonio', subcategory: 'Monumentos y Patrimonio' };
    }
    if (rawLower.includes('parque') || rawLower.includes('jardin') || rawLower.includes('anillo')) {
      return { category: 'Naturaleza', subcategory: 'Espacios Naturales' };
    }
    if (rawLower.includes('restauran') || rawLower.includes('gastronom') || rawLower.includes('asador')) {
      return { category: 'Gastronomía', subcategory: 'Restauración y Pintxos' };
    }
    if (rawLower.includes('museo') || rawLower.includes('teatro') || rawLower.includes('evento') || rawLower.includes('cultur')) {
      return { category: 'Cultura', subcategory: rawType };
    }
  }

  // 2. Keyword scoring across the text
  let bestCategory: CategoryType = defaultCategory || 'Cultura';
  let bestScore = 0;

  for (const rule of RULES) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        // Higher weight if keyword is in the title
        if (name.toLowerCase().includes(kw)) {
          score += 3;
        } else {
          score += 1;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.category;
    }
  }

  // Subcategory refinement
  let subcategory = '';
  switch (bestCategory) {
    case 'Patrimonio':
      subcategory = text.includes('catedral') ? 'Catedral' : text.includes('palacio') ? 'Palacio' : 'Monumento Histórico';
      break;
    case 'Naturaleza':
      subcategory = text.includes('anillo') || text.includes('salburua') || text.includes('olarizu') ? 'Anillo Verde' : 'Parque Urbano';
      break;
    case 'Cultura':
      subcategory = text.includes('museo') ? 'Museo' : text.includes('teatro') ? 'Teatro' : 'Evento Cultural';
      break;
    case 'Gastronomía':
      subcategory = text.includes('pintxo') ? 'Bar de Pintxos' : text.includes('asador') ? 'Asador' : 'Restaurante';
      break;
  }

  return { category: bestCategory, subcategory };
}
