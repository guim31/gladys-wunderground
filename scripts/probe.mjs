#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Probe of the real Weather Company API, read-only, through the integration's
// own client (src/wu/client.js). Needs network access to api.weather.com.
//
//   node scripts/probe.mjs
//       1. a fake key must be refused: 401, the error code of the body;
//       2. an unknown station with a fake key: still 401 (the key is checked first).
//
//   WU_API_KEY=<your key> node scripts/probe.mjs IPARIS123 [OTHER456…]
//       3. each station: the field names and types of the observation (the
//          fixtures of test/fixtures/wu/ assume them), then the values the
//          integration would publish;
//       4. an id that cannot exist: 204 expected;
//       5. the 5-day forecast with the same key: allowed or not (status only).
//
// The key is read from the environment, never printed, and never put in a
// printed URL. Nothing is written, nothing is sent but GET requests.
// -----------------------------------------------------------------------------

import { WuApiError, fetchObservation } from '../src/wu/client.js';
import { ageMinutes, parseObservation } from '../src/wu/observation.js';

const FAKE_KEY = '00000000000000000000000000000000';
const realKey = process.env.WU_API_KEY?.trim();
const stations = process.argv.slice(2);
let failures = 0;

function check(label, ok, detail = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) {
    failures += 1;
  }
}

/** Never let the key reach the output, whatever the error says. */
const safe = (text) => (realKey ? String(text).split(realKey).join('<key>') : String(text));

/** Field name → type, nested one level (the `metric` block). */
function shape(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [child, v] of Object.entries(value)) {
        out[`${key}.${child}`] = v === null ? 'null' : typeof v;
      }
    } else {
      out[key] = value === null ? 'null' : typeof value;
    }
  }
  return out;
}

async function attempt(label, fn) {
  try {
    return { value: await fn() };
  } catch (err) {
    if (err instanceof WuApiError) {
      return { error: err };
    }
    console.log(`FAIL ${label} — unexpected ${err?.name}: ${safe(err?.message)}`);
    failures += 1;
    return { error: err };
  }
}

// 1-2. A fake key.
for (const stationId of ['IPARIS1', 'ZZZNOTASTATION0']) {
  const { value, error } = await attempt('fake key', () =>
    fetchObservation({ apiKey: FAKE_KEY, stationId }),
  );
  check(
    `fake key refused (${stationId})`,
    error?.kind === 'auth',
    error ? `${error.kind}, HTTP ${error.status}, code ${error.code ?? 'none'}` : `got ${value}`,
  );
}

if (!realKey) {
  console.log('No WU_API_KEY: steps 3 to 5 skipped.');
} else {
  // 3. Real stations.
  for (const stationId of stations) {
    const { value: raw, error } = await attempt(stationId, () =>
      fetchObservation({ apiKey: realKey, stationId }),
    );
    if (error) {
      check(`${stationId} read`, false, `${error.kind}: ${safe(error.message)}`);
      continue;
    }
    if (raw === null) {
      check(`${stationId} read`, true, '204: no observation in the last hour');
      continue;
    }
    const fields = shape(raw);
    check(`${stationId} has a metric block`, 'metric.temp' in fields);
    console.log(`     fields: ${JSON.stringify(fields)}`);
    const o = parseObservation(raw);
    console.log(`     parsed: ${JSON.stringify({ ...o, ageMinutes: ageMinutes(o, Date.now()) })}`);
  }

  // 4. An id that cannot exist.
  const { value, error } = await attempt('unknown id', () =>
    fetchObservation({ apiKey: realKey, stationId: 'ZZZNOTASTATION0' }),
  );
  check(
    'unknown station: 204',
    value === null && !error,
    error ? `${error.kind}, HTTP ${error.status}` : '',
  );

  // 5. The forecast with a PWS key (not used by the integration yet).
  try {
    const query = new URLSearchParams({
      geocode: '48.85,2.35',
      format: 'json',
      units: 'm',
      language: 'fr-FR',
      apiKey: realKey,
    });
    const response = await fetch(`https://api.weather.com/v3/wx/forecast/daily/5day?${query}`, {
      signal: AbortSignal.timeout(15000),
    });
    console.log(`INFO 5-day forecast with this key: HTTP ${response.status}`);
  } catch (err) {
    console.log(`INFO 5-day forecast: ${safe(err?.cause?.code ?? err?.message)}`);
  }
}

console.log(failures === 0 ? 'Probe passed.' : `Probe: ${failures} failure(s).`);
process.exitCode = failures === 0 ? 0 : 1;
