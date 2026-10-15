// -----------------------------------------------------------------------------
// The Weather Company "PWS Observations - Current Conditions" API (v2), the
// one Weather Underground hands to the contributors of a personal weather
// station: https://api.weather.com/v2/pws/observations/current
//
// What it answers (documented, and what the HACS integration wundergroundpws
// relies on):
//   200  { observations: [ { ...one observation... } ] }, the newest record of
//        the last 60 minutes;
//   204  no content: no record in the last 60 minutes (station offline) — or
//        a station id the API does not know: the two cannot be told apart;
//   401  invalid API key (body: { errors: [ { error: { code, message } } ] });
//   429  quota exceeded (1,500 calls a day, 30 a minute, per key).
//
// The API key travels in the query string: the URL is never logged nor put in
// an error message.
// -----------------------------------------------------------------------------

export const API_URL = 'https://api.weather.com/v2/pws/observations/current';
const TIMEOUT_MS = 15000;

/** Why a request failed, for the status message and the back-off. */
export const ERROR_KINDS = {
  AUTH: 'auth', // 401/403: the key is refused
  RATE_LIMIT: 'rate_limit', // 429
  BAD_REQUEST: 'bad_request', // 400: a station id the API rejects
  SERVER: 'server', // 5xx, other statuses
  NETWORK: 'network', // DNS, refused connection, timeout
  INVALID_RESPONSE: 'invalid_response', // not the documented JSON
};

export class WuApiError extends Error {
  /**
   * @param {string} kind one of ERROR_KINDS
   * @param {string} message never contains the API key
   * @param {{ status?: number, code?: string }} [details]
   */
  constructor(kind, message, { status, code } = {}) {
    super(message);
    this.name = 'WuApiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

/** The request URL (contains the key: never log it). */
export function observationUrl(apiKey, stationId) {
  const query = new URLSearchParams({
    stationId,
    format: 'json',
    units: 'm', // metric: °C, km/h, hPa (mb), mm
    numericPrecision: 'decimal', // 21.4 rather than 21
    apiKey,
  });
  return `${API_URL}?${query}`;
}

/** The first error code of an error body, if the API sent one (CDN-0001…). */
function errorCode(body) {
  const first = body?.errors?.[0];
  const code = first?.error?.code ?? first?.code;
  return typeof code === 'string' ? code.slice(0, 40) : undefined;
}

/**
 * Read the current observation of one station.
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string} options.stationId as typed by the user
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<object | null>} the raw observation, or null when the API
 *   has no record of the last 60 minutes (204)
 * @throws {WuApiError}
 */
export async function fetchObservation({
  apiKey,
  stationId,
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = TIMEOUT_MS,
}) {
  let response;
  try {
    response = await fetchImpl(observationUrl(apiKey, stationId), {
      headers: { Accept: 'application/json', 'User-Agent': 'gladys-wunderground' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason =
      err?.name === 'TimeoutError' || err?.name === 'AbortError'
        ? `no answer within ${timeoutMs / 1000} s`
        : (err?.cause?.code ?? err?.code ?? 'connection failed');
    throw new WuApiError(ERROR_KINDS.NETWORK, `api.weather.com unreachable (${reason})`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text().catch(() => '');
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const code = errorCode(body);
    const details = { status: response.status, code };
    const suffix = code ? `HTTP ${response.status}, ${code}` : `HTTP ${response.status}`;
    if (response.status === 401 || response.status === 403) {
      throw new WuApiError(ERROR_KINDS.AUTH, `API key refused (${suffix})`, details);
    }
    if (response.status === 429) {
      throw new WuApiError(ERROR_KINDS.RATE_LIMIT, `API quota exceeded (${suffix})`, details);
    }
    if (response.status === 400 || response.status === 404) {
      throw new WuApiError(
        ERROR_KINDS.BAD_REQUEST,
        `station ${stationId} refused by the API (${suffix})`,
        details,
      );
    }
    throw new WuApiError(ERROR_KINDS.SERVER, `API error (${suffix})`, details);
  }

  const observation = body?.observations?.[0];
  if (!observation || typeof observation !== 'object') {
    throw new WuApiError(ERROR_KINDS.INVALID_RESPONSE, 'unexpected answer from the API', {
      status: response.status,
    });
  }
  return observation;
}
