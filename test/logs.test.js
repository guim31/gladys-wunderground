// -----------------------------------------------------------------------------
// Quiet logs: a normal cycle writes nothing at the info level, a failure that
// lasts writes one line when it starts and one when it ends, and no secret of
// the configuration ever reaches the logs — even at the debug level.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_KEY, NOW, createAll, createWorld, observation } from './helpers/world.js';

/** Capture what the SDK logger writes (console.log / console.error). */
function captureLogs(t) {
  const lines = [];
  const record =
    (stream) =>
    (...args) =>
      lines.push({ stream, text: args.map(String).join(' ') });
  t.mock.method(console, 'log', record('out'));
  t.mock.method(console, 'error', record('err'));
  return lines;
}

const atLevel = (lines, level) => lines.filter((l) => l.text.includes(`[${level}]`));

test('a normal cycle writes nothing at the info level', async (t) => {
  const clock = { value: NOW };
  const world = await createWorld({ clock });
  await createAll(world);
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'info';
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = captureLogs(t);
  for (let i = 0; i < 3; i += 1) {
    clock.value += 5 * 60000;
    world.api.stations.IGLADYS42 = observation('current-full.json', {
      obsTimeUtc: new Date(clock.value - 60000).toISOString(),
      metric: { temp: 17 + i },
    });
    await world.app.poller.cycle();
    await world.gladys.fake.poll(world.gladys.fake.devices[0]);
    await world.gladys.fake.widgetGet('station', { language: 'fr' });
  }
  assert.deepEqual(lines, []);
  await world.app.stop();
});

test('a lasting failure: one warning, then one line when it ends', async (t) => {
  const clock = { value: NOW };
  const world = await createWorld({ clock });
  await createAll(world);
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'info';
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = captureLogs(t);
  world.api.fail = 'ECONNREFUSED';
  for (let i = 0; i < 4; i += 1) {
    clock.value += 5 * 60000;
    await world.app.poller.cycle();
  }
  world.api.fail = null;
  clock.value += 5 * 60000;
  world.api.stations.IGLADYS42 = observation('current-full.json', {
    obsTimeUtc: new Date(clock.value).toISOString(),
  });
  await world.app.poller.cycle();
  assert.deepEqual(
    lines.map((l) => l.text.replace(/^\[[^\]]+\] /, '')),
    [
      '[WARN] [wunderground] Weather Underground: api.weather.com unreachable (ECONNREFUSED)',
      '[INFO] [wunderground] Weather Underground API answers again',
    ],
  );
  await world.app.stop();
});

test('no secret in the logs, whatever happens, even at the debug level', async (t) => {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'debug';
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  const lines = captureLogs(t);
  const clock = { value: NOW };
  // Every path: start, refused key, fixed key, device added, polls, errors, quota, test action.
  const world = await createWorld({ clock, config: { api_key: 'secret-key-that-is-refused' } });
  await world.gladys.fake.action('test_connection');
  await world.gladys.fake.configUpdated({ api_key: API_KEY, station_ids: 'IGLADYS42, IGLADYS5' });
  await createAll(world);
  world.api.fail = 'ETIMEDOUT';
  clock.value += 5 * 60000;
  await world.app.poller.cycle();
  world.api.fail = null;
  world.api.stations.IGLADYS42 = { status: 429, body: '' };
  clock.value += 5 * 60000;
  await world.app.poller.cycle();
  await world.gladys.fake.action('test_connection');
  await world.gladys.fake.widgetGet('station', { language: 'en' });
  await world.app.stop();

  assert.ok(lines.length > 10, 'the debug level shows the details');
  assert.ok(atLevel(lines, 'DEBUG').length > 0);
  for (const { text } of lines) {
    assert.doesNotMatch(text, new RegExp(API_KEY), text);
    assert.doesNotMatch(text, /secret-key-that-is-refused/, text);
    assert.doesNotMatch(text, /apiKey=/, text);
  }
});
