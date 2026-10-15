// -----------------------------------------------------------------------------
// Integration configuration: defaults (mirroring the manifest `config_schema`),
// normalization, the list of stations and the refresh pace the API quota
// allows.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Choices of the `refresh_minutes` select, in minutes.
export const REFRESH_CHOICES = ['5', '10', '15', '30', '60'];

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js).
export const DEFAULT_CONFIG = {
  api_key: '',
  station_ids: '',
  refresh_minutes: '5',
  language: 'fr',
};

// The Weather Company grants a PWS contributor key 1,500 calls a day and 30 a
// minute. The integration keeps 10 % of the daily quota for the restarts, the
// "Test" button and the user's other tools sharing the key.
export const DAILY_CALL_BUDGET = 1350;
export const MAX_STATIONS = 10;

// A station id as Weather Underground prints it (IPARIS123, KCASANFR1234):
// letters and digits. Anything else is a typo or a pasted URL.
const STATION_ID = /^[A-Za-z0-9]{3,32}$/;

/**
 * Merge the user config with the defaults and force the types.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const language = String(raw.language ?? DEFAULT_CONFIG.language);
  const refresh = String(raw.refresh_minutes ?? DEFAULT_CONFIG.refresh_minutes);
  return {
    api_key: String(raw.api_key ?? '').trim(),
    station_ids: String(raw.station_ids ?? ''),
    refresh_minutes: REFRESH_CHOICES.includes(refresh) ? refresh : DEFAULT_CONFIG.refresh_minutes,
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
  };
}

/**
 * The stations to follow: the ids of `station_ids` (commas, semicolons or
 * spaces), deduplicated whatever their case, capped at MAX_STATIONS.
 * The id is sent to the API as typed (the HACS integration warns it is case
 * sensitive); the platform id of the device is its upper-case form, so a
 * station retyped in another case stays the same device.
 * @param {{ station_ids: string }} config
 * @returns {{ stations: { id: string, platformId: string }[], invalid: string[], ignored: string[] }}
 */
export function parseStations(config) {
  const stations = [];
  const invalid = [];
  const ignored = [];
  const seen = new Set();
  for (const token of config.station_ids.split(/[\s,;]+/)) {
    if (token === '') {
      continue;
    }
    if (!STATION_ID.test(token)) {
      invalid.push(token);
      continue;
    }
    const platformId = token.toUpperCase();
    if (seen.has(platformId)) {
      continue;
    }
    seen.add(platformId);
    if (stations.length >= MAX_STATIONS) {
      ignored.push(token);
      continue;
    }
    stations.push({ id: token, platformId });
  }
  return { stations, invalid, ignored };
}

/** The API key and at least one valid station id are filled in. */
export function isConfigured(config) {
  return config.api_key !== '' && parseStations(config).stations.length > 0;
}

/**
 * Minutes between two reads of each station: the user's choice, slowed down
 * when the stations would exceed the daily budget (5 stations every 5 minutes
 * is 1,440 calls a day: they are then read every 6 minutes).
 * @param {{ refresh_minutes: string }} config
 * @param {number} stationCount
 */
export function refreshMinutes(config, stationCount) {
  const chosen = Number(config.refresh_minutes);
  const floor = Math.ceil((Math.max(stationCount, 1) * 24 * 60) / DAILY_CALL_BUDGET);
  return Math.max(chosen, floor);
}
