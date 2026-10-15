// -----------------------------------------------------------------------------
// One PWS observation, as the API sends it with `units=m`, turned into the
// values the integration publishes.
//
// Shape of the API object (field list of the official documentation, the
// same the HACS and openHAB integrations read):
//   stationID, obsTimeUtc (ISO 8601), obsTimeLocal ("2026-10-15 14:05:00"),
//   epoch (s), neighborhood, country, softwareType, lat, lon, qcStatus,
//   realtimeFrequency, humidity (%), winddir (°), uv, solarRadiation (W/m²),
//   metric: { temp, heatIndex, dewpt, windChill (°C), windSpeed, windGust
//             (km/h), pressure (hPa = mb, sea level), precipRate (mm/h),
//             precipTotal (mm since local midnight), elev (m) }
// A sensor the station does not have, or that sent nothing, is null.
// -----------------------------------------------------------------------------

/** A finite number, or null (null, undefined, "", NaN). */
function num(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const round = (value, digits) =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

// Weather Underground has no lux: an Ecowitt station measures lux and uploads
// lux / 126.7 as W/m² (the factor of its firmware and of the Ecowitt tools).
// Multiplying back gives Gladys the light-sensor value it can display; for a
// pyranometer (Davis) it is an approximation of daylight, as said in the docs.
export const LUX_PER_WATT_PER_SQUARE_METER = 126.7;

/**
 * "Feels like": the heat index when it is above the temperature, the wind
 * chill when it is below, else the temperature (the API fills both with the
 * temperature when they do not apply).
 */
export function feelsLike(temperature, heatIndex, windChill) {
  if (temperature === null) {
    return null;
  }
  if (heatIndex !== null && heatIndex > temperature) {
    return heatIndex;
  }
  if (windChill !== null && windChill < temperature) {
    return windChill;
  }
  return temperature;
}

const CARDINALS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
];

/** 16-point compass direction of an angle in degrees ("N", "NNE"…), null if unknown. */
export function cardinal(degrees) {
  if (degrees === null) {
    return null;
  }
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return CARDINALS[index];
}

/**
 * @param {object} raw one entry of `observations`
 * @returns {object} the normalized observation (numbers or null)
 */
export function parseObservation(raw) {
  const metric = raw.metric && typeof raw.metric === 'object' ? raw.metric : {};
  const temperature = num(metric.temp);
  const heatIndex = num(metric.heatIndex);
  const windChill = num(metric.windChill);
  const solar = num(raw.solarRadiation);
  const parsedTime = Date.parse(raw.obsTimeUtc);
  const epoch = num(raw.epoch);
  const observedAt = Number.isFinite(parsedTime)
    ? parsedTime
    : epoch === null
      ? null
      : epoch * 1000;
  const windDirection = num(raw.winddir);

  return {
    stationId: typeof raw.stationID === 'string' ? raw.stationID : null,
    neighborhood:
      typeof raw.neighborhood === 'string' && raw.neighborhood.trim() !== ''
        ? raw.neighborhood.trim()
        : null,
    country: typeof raw.country === 'string' ? raw.country : null,
    softwareType: typeof raw.softwareType === 'string' ? raw.softwareType : null,
    observedAt,
    observedAtLocal: typeof raw.obsTimeLocal === 'string' ? raw.obsTimeLocal : null,
    // -1: not checked, 0: flagged as possibly wrong, 1: passed the checks.
    qcStatus: num(raw.qcStatus),
    temperature,
    dewPoint: num(metric.dewpt),
    feelsLike: feelsLike(temperature, heatIndex, windChill),
    humidity: num(raw.humidity),
    windSpeed: num(metric.windSpeed),
    windGust: num(metric.windGust),
    windDirection: windDirection === null ? null : Math.round(windDirection) % 360,
    pressure: num(metric.pressure),
    rainRate: num(metric.precipRate),
    rainToday: num(metric.precipTotal),
    uvIndex: num(raw.uv),
    solarRadiation: solar,
    illuminance: solar === null ? null : Math.round(solar * LUX_PER_WATT_PER_SQUARE_METER),
    elevation: round(num(metric.elev), 1),
  };
}

/** Minutes elapsed since the observation, null when its time is unknown. */
export function ageMinutes(observation, now) {
  if (!observation || observation.observedAt === null) {
    return null;
  }
  return Math.max(0, Math.floor((now - observation.observedAt) / 60000));
}
