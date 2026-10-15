// -----------------------------------------------------------------------------
// The "station" widget: valid against the core vocabulary and budget, bound to
// the features that exist, served without an API call.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { buildStationContent } from '../src/widgets.js';
import { WIDGET_TEXT } from '../src/i18n.js';
import { parseObservation } from '../src/wu/observation.js';
import { NOW, createAll, createWorld, ids, observation } from './helpers/world.js';

const LANGS = ['en', 'fr', 'de', 'es'];

const get = async (gladys, options = {}) => {
  const ack = await gladys.fake.widgetGet('station', options);
  assert.equal(ack.success, true, ack.error);
  return ack.data.content;
};

test('a station added in Gladys: live tiles, the chart of the day, the status rows', async () => {
  const world = await createWorld();
  const { gladys, api, app } = world;
  await createAll(world);
  const calls = api.calls.length;
  for (const language of LANGS) {
    const content = await get(gladys, { language });
    assert.deepEqual(validateWidgetContent(content), [], language);
    assert.equal(content.components.length, 8);
    const featureIds = content.components
      .filter((c) => c.type === 'value')
      .map((c) => c.device_feature);
    const created = new Set(gladys.fake.devices[0].features.map((f) => f.external_id));
    assert.equal(featureIds.length, 5);
    for (const id of featureIds) {
      assert.ok(created.has(id), `${id} is a feature of the created device`);
    }
    const chart = content.components.find((c) => c.type === 'chart');
    assert.deepEqual(chart.device_features, [ids(gladys).feature('temperature')]);
    const status = content.components.find((c) => c.type === 'status');
    assert.equal(status.items[0].label, WIDGET_TEXT[language].observed);
    assert.equal(status.items[0].color, 'success');
  }
  const fr = await get(gladys, { language: 'fr' });
  assert.equal(fr.components[0].text, 'Les Chartreux · IGLADYS42');
  assert.deepEqual(
    fr.components.find((c) => c.type === 'status').items.map((i) => `${i.label}: ${i.value}`),
    [
      'Observation: 14:05 · il y a 3 min',
      'Ressenti: 17,4 °C',
      'Point de rosée: 10,3 °C',
      'Rafales: 19,8 km/h',
      'Direction du vent: WSW (247°)',
      'Intensité de pluie: 0 mm/h',
      'Indice UV: 3',
      'Rayonnement solaire: 413 W/m²',
    ],
  );
  assert.equal(api.calls.length, calls, 'the widget never calls the API');
  await app.stop();
});

test('a station not added yet: inline values, no chart', async () => {
  const { gladys, app } = await createWorld();
  const content = await get(gladys, { language: 'en' });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(
    content.components.find((c) => c.type === 'chart'),
    undefined,
  );
  assert.deepEqual(
    content.components.filter((c) => c.type === 'value').map((c) => [c.label, c.value, c.unit]),
    [
      ['Temperature', 17.4, '°C'],
      ['Humidity', 63, '%'],
      ['Wind', 11.2, 'km/h'],
      ['Rain today', 2.4, 'mm'],
      ['Pressure', 1016.93, 'hPa'],
    ],
  );
  await app.stop();
});

test('the station picked in the settings, a minimal station', async () => {
  const world = await createWorld({
    config: { station_ids: 'IGLADYS42, IGLADYS7' },
    stations: { IGLADYS42: observation(), IGLADYS7: observation('current-minimal.json') },
  });
  const content = await get(world.gladys, {
    language: 'de',
    settings: { station: ids(world.gladys, 'IGLADYS7').device },
  });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].text, 'IGLADYS7');
  assert.deepEqual(
    content.components.filter((c) => c.type === 'value').map((c) => c.label),
    ['Temperatur', 'Feuchtigkeit', 'Luftdruck'],
  );
  const rows = content.components.find((c) => c.type === 'status').items.map((i) => i.label);
  assert.deepEqual(rows, ['Messung', 'Gefühlt', 'Taupunkt']);
  await world.app.stop();
});

test('a silent station is flagged, not shown as current', () => {
  const o = parseObservation(observation());
  const content = buildStationContent({
    station: { id: 'IGLADYS42', platformId: 'IGLADYS42' },
    observation: o,
    featureId: (key) => `x:${key}`,
    createdFeatures: null,
    language: 'en',
    now: NOW + 60 * 60000,
  });
  const first = content.components.find((c) => c.type === 'status').items[0];
  assert.deepEqual(first, {
    label: 'Observed',
    value: 'Station silent · 63 min ago',
    color: 'warning',
    icon: 'alert-triangle',
  });
});

test('not configured, no observation yet, unknown station: a sentence', async () => {
  const unconfigured = await createWorld({ config: { api_key: '' } });
  const a = await get(unconfigured.gladys, { language: 'es' });
  assert.deepEqual(a.components, [
    { type: 'text', text: WIDGET_TEXT.es.notConfigured, variant: 'body' },
  ]);
  await unconfigured.app.stop();

  const silent = await createWorld({ stations: {} });
  const b = await get(silent.gladys, { language: 'en' });
  assert.deepEqual(validateWidgetContent(b), []);
  assert.equal(b.components[1].text, WIDGET_TEXT.en.waiting);
  const c = await get(silent.gladys, { language: 'fr', settings: { station: 'ext:other' } });
  assert.equal(c.components[0].text, WIDGET_TEXT.fr.noStation);
  await silent.app.stop();
});
