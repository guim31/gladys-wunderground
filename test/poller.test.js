// -----------------------------------------------------------------------------
// The container refreshes the stations by itself: the core may never call
// onPoll (GladysAssistant/Gladys#3198, a device created without should_poll
// keeps it). This test never calls onPoll.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { NOW, createAll, createWorld, ids, observation } from './helpers/world.js';

test('the states refresh on the internal timer, without any onPoll', async () => {
  // 1 ms of test time is 10 s of station time: a 30 ms period is 5 minutes.
  const start = Date.now();
  const clock = {
    get value() {
      return NOW + (Date.now() - start) * 10000;
    },
  };
  const world = await createWorld({ clock, timers: true, periodMs: 30 });
  const { gladys, api, app } = world;
  let corePolls = 0;
  const pollFromCore = app.poller.pollFromCore;
  app.poller.pollFromCore = (device) => {
    corePolls += 1;
    return pollFromCore(device);
  };
  await createAll(world);
  const temperature = ids(gladys).feature('temperature');
  assert.equal(gladys.fake.lastState(temperature), 17.4);

  api.stations.IGLADYS42 = observation('current-full.json', {
    obsTimeUtc: new Date(clock.value).toISOString(),
    metric: { temp: 18.6 },
  });
  for (let i = 0; i < 100 && gladys.fake.lastState(temperature) !== 18.6; i += 1) {
    await sleep(10);
  }
  assert.equal(gladys.fake.lastState(temperature), 18.6);
  assert.ok(api.callsFor('IGLADYS42') >= 2, 'read again by the timer');
  assert.equal(corePolls, 0);
  await app.stop();

  // Stopped: no more reads.
  const calls = api.calls.length;
  await sleep(80);
  assert.equal(api.calls.length, calls);
});

test('only the stations added to Gladys are read by the timer', async () => {
  const clock = { value: NOW };
  const world = await createWorld({
    clock,
    config: { station_ids: 'IGLADYS42, IGLADYS7' },
    stations: { IGLADYS42: observation(), IGLADYS7: observation('current-minimal.json') },
  });
  const { gladys, api, app } = world;
  await gladys.fake.deviceCreated(structuredClone(gladys.fake.discoveredDevices[0]));
  clock.value += 5 * 60000;
  await app.poller.cycle();
  assert.equal(api.callsFor('IGLADYS42'), 2);
  assert.equal(api.callsFor('IGLADYS7'), 1, 'read at start only');
  await app.stop();
});

test('Gladys away: the cycle waits', async () => {
  const clock = { value: NOW };
  const world = await createWorld({ clock });
  await createAll(world);
  await world.gladys.disconnect();
  clock.value += 5 * 60000;
  await world.app.poller.cycle();
  assert.equal(world.api.calls.length, 1);
  await world.app.stop();
});
