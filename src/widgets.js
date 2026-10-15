// -----------------------------------------------------------------------------
// The dashboard widget "station": the last observation of one station.
//
// Served from the last observation the poller read, never from a new API
// call (the quota). The tiles of a station added to Gladys are bound to its
// features, so they move with the published states without a refresh; the
// rows of the status list are rebuilt on each pull (ttl 60 s) and after each
// read (requestWidgetRefresh).
//
// Content budget of the core (applied before resolving the references): at
// most 8 components, 2 texts, 6 tiles, 1 focal, 1 status list. Here: one
// heading, five tiles, the temperature chart of the day (added station only),
// one status list.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { WIDGET_TEXT, formatNumber, pick } from './i18n.js';
import { cardinal, ageMinutes } from './wu/observation.js';
import { isStale } from './station.js';

export const WIDGET = { STATION: 'station' };

const TILES = [
  { key: 'temperature', text: 'temperature', unit: '°C', value: (o) => o.temperature },
  { key: 'humidity', text: 'humidity', unit: '%', value: (o) => o.humidity },
  { key: 'wind_speed', text: 'wind', unit: 'km/h', value: (o) => o.windSpeed },
  { key: 'rain_today', text: 'rainToday', unit: 'mm', value: (o) => o.rainToday },
  { key: 'pressure', text: 'pressure', unit: 'hPa', value: (o) => o.pressure },
];

const text = (value, variant = 'body') => ({ type: 'text', text: value, variant });

/** "14:05" from the local time of the API ("2026-10-15 14:05:00"). */
function localTime(observation) {
  const match = /(\d{2}):(\d{2})/.exec(observation.observedAtLocal ?? '');
  return match ? `${match[1]}:${match[2]}` : null;
}

/**
 * @param {object} options
 * @param {{ id: string, platformId: string }} options.station
 * @param {object | null} options.observation normalized
 * @param {(key: string) => string} options.featureId external id of a feature
 * @param {Set<string> | null} options.createdFeatures features of the device in Gladys
 * @param {string} options.language
 * @param {number} options.now
 */
export function buildStationContent({
  station,
  observation,
  featureId,
  createdFeatures,
  language,
  now,
}) {
  const t = pick(WIDGET_TEXT, language);
  const title = observation?.neighborhood
    ? `${observation.neighborhood} · ${station.platformId}`
    : station.platformId;
  const components = [text(title.slice(0, 40), 'heading')];

  if (!observation) {
    components.push(text(t.waiting));
    return { ttl_seconds: 60, components };
  }

  const fmt = (value, digits = 1) => formatNumber(value, language, digits);
  for (const tile of TILES) {
    const id = featureId(tile.key);
    if (createdFeatures?.has(id)) {
      components.push({ type: 'value', label: t[tile.text], device_feature: id });
    } else if (tile.value(observation) !== null) {
      components.push({
        type: 'value',
        label: t[tile.text],
        value: tile.value(observation),
        unit: tile.unit,
      });
    }
  }

  const temperatureId = featureId('temperature');
  if (createdFeatures?.has(temperatureId)) {
    components.push({
      type: 'chart',
      device_features: [temperatureId],
      interval: 'last-day',
      chart_type: 'line',
      unit: '°C',
    });
  }

  const stale = isStale(observation, now);
  const age = ageMinutes(observation, now);
  const time = localTime(observation);
  const items = [];
  if (age !== null) {
    const ago = t.age(age);
    items.push({
      label: t.observed,
      value: (stale ? `${t.stale} · ${ago}` : time ? `${time} · ${ago}` : ago).slice(0, 40),
      color: stale ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
      icon: stale ? 'alert-triangle' : 'clock',
    });
  }
  const rows = [
    ['feelsLike', observation.feelsLike, (v) => `${fmt(v)} °C`],
    ['dewPoint', observation.dewPoint, (v) => `${fmt(v)} °C`],
    ['gust', observation.windGust, (v) => `${fmt(v)} km/h`],
    [
      'direction',
      observation.windDirection,
      (v) => `${cardinal(v)} (${v}°)`,
      observation.windSpeed === null,
    ],
    ['rainRate', observation.rainRate, (v) => `${fmt(v)} mm/h`],
    ['uv', observation.uvIndex, (v) => fmt(v)],
    ['solar', observation.solarRadiation, (v) => `${fmt(v, 0)} W/m²`],
  ];
  for (const [key, value, render, hidden] of rows) {
    if (value !== null && !hidden) {
      items.push({ label: t[key], value: render(value), color: WIDGET_COLORS.NEUTRAL });
    }
  }
  if (items.length > 0) {
    components.push({ type: 'status', items });
  }
  return { ttl_seconds: 60, components };
}

/** The content when the integration is not configured, or the station unknown. */
export function messageContent(language, key) {
  const t = pick(WIDGET_TEXT, language);
  return { ttl_seconds: 60, components: [text(t[key])] };
}
