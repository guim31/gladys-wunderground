// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface. German says "du", Spanish "usted" (test/i18n.test.js).
// Brand names (Weather Underground, The Weather Company) are not translated.
// -----------------------------------------------------------------------------

/** Feature names, frozen when the user adds the device (config `language`). */
export const FEATURE_NAMES = {
  en: {
    temperature: 'Temperature',
    feels_like: 'Feels like',
    dew_point: 'Dew point',
    humidity: 'Humidity',
    pressure: 'Pressure',
    wind_speed: 'Wind speed',
    wind_gust: 'Wind gusts',
    wind_direction: 'Wind direction',
    rain_rate: 'Rain rate',
    rain_today: 'Rain today',
    uv_index: 'UV index',
    illuminance: 'Light (solar radiation)',
    observation_age: 'Observation age',
  },
  fr: {
    temperature: 'Température',
    feels_like: 'Température ressentie',
    dew_point: 'Point de rosée',
    humidity: 'Humidité',
    pressure: 'Pression atmosphérique',
    wind_speed: 'Vitesse du vent',
    wind_gust: 'Rafales',
    wind_direction: 'Direction du vent',
    rain_rate: 'Intensité de pluie',
    rain_today: 'Pluie du jour',
    uv_index: 'Indice UV',
    illuminance: 'Luminosité (rayonnement solaire)',
    observation_age: "Âge de l'observation",
  },
  de: {
    temperature: 'Temperatur',
    feels_like: 'Gefühlte Temperatur',
    dew_point: 'Taupunkt',
    humidity: 'Luftfeuchtigkeit',
    pressure: 'Luftdruck',
    wind_speed: 'Windgeschwindigkeit',
    wind_gust: 'Windböen',
    wind_direction: 'Windrichtung',
    rain_rate: 'Regenintensität',
    rain_today: 'Regen heute',
    uv_index: 'UV-Index',
    illuminance: 'Helligkeit (Sonnenstrahlung)',
    observation_age: 'Alter der Messung',
  },
  es: {
    temperature: 'Temperatura',
    feels_like: 'Sensación térmica',
    dew_point: 'Punto de rocío',
    humidity: 'Humedad',
    pressure: 'Presión atmosférica',
    wind_speed: 'Velocidad del viento',
    wind_gust: 'Ráfagas de viento',
    wind_direction: 'Dirección del viento',
    rain_rate: 'Intensidad de lluvia',
    rain_today: 'Lluvia de hoy',
    uv_index: 'Índice UV',
    illuminance: 'Luminosidad (radiación solar)',
    observation_age: 'Antigüedad de la observación',
  },
};

/** Status messages of the Configuration screen (setConnectionStatus). */
export const STATUS = {
  notConfigured: {
    en: 'Enter your Weather Underground API key and at least one station id.',
    fr: "Saisissez votre clé d'API Weather Underground et au moins un identifiant de station.",
    de: 'Gib deinen Weather Underground API-Schlüssel und mindestens eine Stations-ID ein.',
    es: 'Introduzca su clave de API de Weather Underground y al menos un identificador de estación.',
  },
  authFailed: {
    en: 'Weather Underground refuses the API key: check it on wunderground.com, under API Keys.',
    fr: "Weather Underground refuse la clé d'API : vérifiez-la sur wunderground.com, rubrique API Keys.",
    de: 'Weather Underground lehnt den API-Schlüssel ab: Prüfe ihn auf wunderground.com unter API Keys.',
    es: 'Weather Underground rechaza la clave de API: compruébela en wunderground.com, en API Keys.',
  },
  rateLimited: {
    en: 'API quota exceeded (1,500 calls a day per key): reads resume in 15 minutes.',
    fr: "Quota de l'API dépassé (1 500 appels par jour et par clé) : reprise des relevés dans 15 minutes.",
    de: 'API-Kontingent überschritten (1.500 Aufrufe pro Tag und Schlüssel): Abfragen gehen in 15 Minuten weiter.',
    es: 'Cuota de la API superada (1.500 llamadas al día por clave): las lecturas se reanudan en 15 minutos.',
  },
  unreachable: {
    en: 'The Weather Underground API does not answer: check the Internet connection of Gladys.',
    fr: "L'API Weather Underground ne répond pas : vérifiez la connexion Internet de Gladys.",
    de: 'Die Weather Underground API antwortet nicht: Prüfe die Internetverbindung von Gladys.',
    es: 'La API de Weather Underground no responde: compruebe la conexión a Internet de Gladys.',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les journaux de l'intégration.",
    de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
  publishFailed: {
    en: 'Gladys refused the station devices, check the integration logs.',
    fr: "Gladys a refusé les appareils des stations, consultez les journaux de l'intégration.",
    de: 'Gladys hat die Stationsgeräte abgelehnt, sieh dir die Protokolle der Integration an.',
    es: 'Gladys ha rechazado los dispositivos de las estaciones, consulte los registros de la integración.',
  },
};

/** Tooltip of the transport badge of a station that stopped reporting. */
export const TRANSPORT = {
  stale: {
    en: 'No recent observation: the station stopped sending data to Weather Underground.',
    fr: "Pas d'observation récente : la station n'envoie plus de données à Weather Underground.",
    de: 'Keine aktuelle Messung: Die Station sendet keine Daten mehr an Weather Underground.',
    es: 'Sin observación reciente: la estación ha dejado de enviar datos a Weather Underground.',
  },
};

/** The report of the "Test the connection" action, one table per language. */
export const REPORT = {
  en: {
    notConfigured: STATUS.notConfigured.en,
    authFailed: STATUS.authFailed.en,
    rateLimited: STATUS.rateLimited.en,
    ok: (id, temperature, age) => `${id}: OK, ${temperature}, ${age} min ago.`,
    noData: (id) => `${id}: no observation in the last hour (offline station or unknown id).`,
    failed: (id) => `${id}: the API does not answer.`,
    refused: (id) => `${id}: id refused by the API.`,
    invalid: (list) => `Ignored, not a station id: ${list}.`,
    ignored: (list, max) => `Ignored, ${max} stations at most: ${list}.`,
    pace: (minutes) => `Each station is read every ${minutes} min.`,
  },
  fr: {
    notConfigured: STATUS.notConfigured.fr,
    authFailed: STATUS.authFailed.fr,
    rateLimited: STATUS.rateLimited.fr,
    ok: (id, temperature, age) => `${id} : OK, ${temperature}, il y a ${age} min.`,
    noData: (id) =>
      `${id} : aucune observation depuis une heure (station hors ligne ou identifiant inconnu).`,
    failed: (id) => `${id} : l'API ne répond pas.`,
    refused: (id) => `${id} : identifiant refusé par l'API.`,
    invalid: (list) => `Ignorés, ce ne sont pas des identifiants de station : ${list}.`,
    ignored: (list, max) => `Ignorées, ${max} stations au plus : ${list}.`,
    pace: (minutes) => `Chaque station est relevée toutes les ${minutes} min.`,
  },
  de: {
    notConfigured: STATUS.notConfigured.de,
    authFailed: STATUS.authFailed.de,
    rateLimited: STATUS.rateLimited.de,
    ok: (id, temperature, age) => `${id}: OK, ${temperature}, vor ${age} Min.`,
    noData: (id) =>
      `${id}: keine Messung in der letzten Stunde (Station offline oder unbekannte ID).`,
    failed: (id) => `${id}: Die API antwortet nicht.`,
    refused: (id) => `${id}: ID von der API abgelehnt.`,
    invalid: (list) => `Ignoriert, keine Stations-ID: ${list}.`,
    ignored: (list, max) => `Ignoriert, höchstens ${max} Stationen: ${list}.`,
    pace: (minutes) => `Jede Station wird alle ${minutes} Min. abgefragt.`,
  },
  es: {
    notConfigured: STATUS.notConfigured.es,
    authFailed: STATUS.authFailed.es,
    rateLimited: STATUS.rateLimited.es,
    ok: (id, temperature, age) => `${id}: OK, ${temperature}, hace ${age} min.`,
    noData: (id) =>
      `${id}: ninguna observación en la última hora (estación desconectada o identificador desconocido).`,
    failed: (id) => `${id}: la API no responde.`,
    refused: (id) => `${id}: identificador rechazado por la API.`,
    invalid: (list) => `Ignorados, no son identificadores de estación: ${list}.`,
    ignored: (list, max) => `Ignoradas, ${max} estaciones como máximo: ${list}.`,
    pace: (minutes) => `Cada estación se consulta cada ${minutes} min.`,
  },
};

/** Texts of the dashboard widget, one table per language. */
export const WIDGET_TEXT = {
  en: {
    temperature: 'Temperature',
    humidity: 'Humidity',
    wind: 'Wind',
    rainToday: 'Rain today',
    pressure: 'Pressure',
    observed: 'Observed',
    age: (minutes) => `${minutes} min ago`,
    stale: 'Station silent',
    feelsLike: 'Feels like',
    dewPoint: 'Dew point',
    gust: 'Gusts',
    direction: 'Wind direction',
    rainRate: 'Rain rate',
    uv: 'UV index',
    solar: 'Solar radiation',
    source: 'Data: Weather Underground',
    notConfigured: 'Enter the API key and a station id in the integration configuration.',
    noStation: 'Pick a station in the widget settings.',
    waiting: 'No observation yet: the station has not reported for an hour, or is being read.',
  },
  fr: {
    temperature: 'Température',
    humidity: 'Humidité',
    wind: 'Vent',
    rainToday: 'Pluie du jour',
    pressure: 'Pression',
    observed: 'Observation',
    age: (minutes) => `il y a ${minutes} min`,
    stale: 'Station muette',
    feelsLike: 'Ressenti',
    dewPoint: 'Point de rosée',
    gust: 'Rafales',
    direction: 'Direction du vent',
    rainRate: 'Intensité de pluie',
    uv: 'Indice UV',
    solar: 'Rayonnement solaire',
    source: 'Données : Weather Underground',
    notConfigured: "Saisissez la clé d'API et un identifiant de station dans la configuration.",
    noStation: 'Choisissez une station dans les réglages du widget.',
    waiting:
      "Pas encore d'observation : la station n'a rien envoyé depuis une heure, ou la lecture est en cours.",
  },
  de: {
    temperature: 'Temperatur',
    humidity: 'Feuchtigkeit',
    wind: 'Wind',
    rainToday: 'Regen heute',
    pressure: 'Luftdruck',
    observed: 'Messung',
    age: (minutes) => `vor ${minutes} Min.`,
    stale: 'Station stumm',
    feelsLike: 'Gefühlt',
    dewPoint: 'Taupunkt',
    gust: 'Böen',
    direction: 'Windrichtung',
    rainRate: 'Regenintensität',
    uv: 'UV-Index',
    solar: 'Sonnenstrahlung',
    source: 'Daten: Weather Underground',
    notConfigured: 'Gib den API-Schlüssel und eine Stations-ID in der Konfiguration ein.',
    noStation: 'Wähle eine Station in den Widget-Einstellungen.',
    waiting:
      'Noch keine Messung: Die Station hat seit einer Stunde nichts gesendet, oder sie wird gerade abgefragt.',
  },
  es: {
    temperature: 'Temperatura',
    humidity: 'Humedad',
    wind: 'Viento',
    rainToday: 'Lluvia hoy',
    pressure: 'Presión',
    observed: 'Observación',
    age: (minutes) => `hace ${minutes} min`,
    stale: 'Estación sin datos',
    feelsLike: 'Sensación',
    dewPoint: 'Punto de rocío',
    gust: 'Ráfagas',
    direction: 'Dirección del viento',
    rainRate: 'Intensidad de lluvia',
    uv: 'Índice UV',
    solar: 'Radiación solar',
    source: 'Datos: Weather Underground',
    notConfigured: 'Introduzca la clave de API y un identificador de estación en la configuración.',
    noStation: 'Elija una estación en los ajustes del widget.',
    waiting:
      'Aún no hay observación: la estación no ha enviado nada desde hace una hora, o se está consultando.',
  },
};

/** The language of a table, English as a fallback. */
export function pick(table, language) {
  return table[language] ?? table.en;
}

/** One multi-language object from a function of the language table. */
export function translate(tables, render) {
  return Object.fromEntries(Object.entries(tables).map(([lang, table]) => [lang, render(table)]));
}

/** Format a number for a language (decimal comma in fr/de/es). */
export function formatNumber(value, language, digits = 1) {
  const locale = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' }[language] ?? 'en-GB';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
}
