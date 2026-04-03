/**
 * Convert country name or ISO code to flag emoji.
 * Supports common country names (English), ISO 3166-1 alpha-2 and alpha-3 codes.
 */

const COUNTRY_TO_ISO2: Record<string, string> = {
  // Common names
  'vietnam': 'VN', 'viet nam': 'VN',
  'france': 'FR', 'japan': 'JP', 'korea': 'KR', 'south korea': 'KR',
  'china': 'CN', 'thailand': 'TH', 'singapore': 'SG', 'malaysia': 'MY',
  'indonesia': 'ID', 'philippines': 'PH', 'australia': 'AU',
  'united states': 'US', 'usa': 'US', 'united kingdom': 'GB', 'uk': 'GB',
  'germany': 'DE', 'italy': 'IT', 'spain': 'ES', 'canada': 'CA',
  'brazil': 'BR', 'india': 'IN', 'russia': 'RU', 'mexico': 'MX',
  'netherlands': 'NL', 'belgium': 'BE', 'switzerland': 'CH',
  'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK', 'finland': 'FI',
  'poland': 'PL', 'portugal': 'PT', 'czech republic': 'CZ', 'czechia': 'CZ',
  'austria': 'AT', 'ireland': 'IE', 'new zealand': 'NZ',
  'south africa': 'ZA', 'taiwan': 'TW', 'hong kong': 'HK',
  'cambodia': 'KH', 'laos': 'LA', 'myanmar': 'MM', 'nepal': 'NP',
  'mongolia': 'MN', 'pakistan': 'PK', 'bangladesh': 'BD', 'sri lanka': 'LK',
  'turkey': 'TR', 'egypt': 'EG', 'kenya': 'KE', 'ethiopia': 'ET',
  'morocco': 'MA', 'nigeria': 'NG', 'argentina': 'AR', 'colombia': 'CO',
  'chile': 'CL', 'peru': 'PE', 'ukraine': 'UA', 'romania': 'RO',
  'hungary': 'HU', 'greece': 'GR', 'israel': 'IL', 'croatia': 'HR',
  'slovakia': 'SK', 'slovenia': 'SI', 'serbia': 'RS', 'bulgaria': 'BG',
  'lithuania': 'LT', 'latvia': 'LV', 'estonia': 'EE',
  'luxembourg': 'LU', 'iceland': 'IS', 'malta': 'MT', 'cyprus': 'CY',
  'united arab emirates': 'AE', 'uae': 'AE', 'saudi arabia': 'SA',
  'qatar': 'QA', 'kuwait': 'KW', 'bahrain': 'BH', 'oman': 'OM',
  // ISO Alpha-3 → Alpha-2
  'VNM': 'VN', 'VIE': 'VN', 'FRA': 'FR', 'JPN': 'JP', 'KOR': 'KR',
  'CHN': 'CN', 'THA': 'TH', 'SGP': 'SG', 'MYS': 'MY', 'IDN': 'ID',
  'PHL': 'PH', 'AUS': 'AU', 'USA': 'US', 'GBR': 'GB', 'DEU': 'DE',
  'ITA': 'IT', 'ESP': 'ES', 'CAN': 'CA', 'BRA': 'BR', 'IND': 'IN',
  'RUS': 'RU', 'MEX': 'MX', 'NLD': 'NL', 'BEL': 'BE', 'CHE': 'CH',
  'SWE': 'SE', 'NOR': 'NO', 'DNK': 'DK', 'FIN': 'FI', 'POL': 'PL',
  'PRT': 'PT', 'CZE': 'CZ', 'AUT': 'AT', 'IRL': 'IE', 'NZL': 'NZ',
  'ZAF': 'ZA', 'TWN': 'TW', 'HKG': 'HK', 'KHM': 'KH', 'LAO': 'LA',
  'MMR': 'MM', 'NPL': 'NP', 'MNG': 'MN', 'PAK': 'PK', 'BGD': 'BD',
  'LKA': 'LK', 'TUR': 'TR', 'EGY': 'EG', 'KEN': 'KE', 'ETH': 'ET',
  'MAR': 'MA', 'NGA': 'NG', 'ARG': 'AR', 'COL': 'CO', 'CHL': 'CL',
  'PER': 'PE', 'UKR': 'UA', 'ROU': 'RO', 'HUN': 'HU', 'GRC': 'GR',
  'ISR': 'IL', 'HRV': 'HR', 'SVK': 'SK', 'SVN': 'SI', 'SRB': 'RS',
  'BGR': 'BG', 'LTU': 'LT', 'LVA': 'LV', 'EST': 'EE', 'LUX': 'LU',
  'ISL': 'IS', 'MLT': 'MT', 'CYP': 'CY', 'ARE': 'AE', 'SAU': 'SA',
  'QAT': 'QA', 'KWT': 'KW', 'BHR': 'BH', 'OMN': 'OM',
};

function iso2ToFlag(iso2: string): string {
  const code = iso2.toUpperCase();
  if (code.length !== 2) return '';
  return String.fromCodePoint(
    ...code.split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

export function countryToFlag(input: string | undefined | null): string {
  if (!input || input === 'undefined') return '';

  const trimmed = input.trim();
  if (!trimmed) return '';

  // Already a flag emoji (starts with regional indicator)
  if (trimmed.codePointAt(0)! >= 0x1F1E6 && trimmed.codePointAt(0)! <= 0x1F1FF) {
    return trimmed;
  }

  // Try as ISO Alpha-2 directly
  if (trimmed.length === 2) {
    return iso2ToFlag(trimmed);
  }

  // Try as ISO Alpha-3 or country name
  const iso2 = COUNTRY_TO_ISO2[trimmed] || COUNTRY_TO_ISO2[trimmed.toLowerCase()];
  if (iso2) return iso2ToFlag(iso2);

  return '';
}
