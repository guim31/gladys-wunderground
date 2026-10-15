// -----------------------------------------------------------------------------
// The container's own polling timer.
//
// The station devices are published with `should_poll: true` and a one-minute
// `poll_frequency`, but the core cannot be trusted to call onPoll: Gladys
// 5.2.x skips devices created without `should_poll`, and a device keeps the
// polling fields it was created with (GladysAssistant/Gladys#3198). So the
// container reads the stations by itself, once per period, and the core's
// onPoll stays as a fallback.
//
// No double reads, the quota is precious: the timer skips a station read less
// than half a period ago, and the core's onPoll (every minute) reads only a
// station not read for 90 % of a period — while the timer runs, the core's
// polls are answered from the last observation (its age is still published).
// Only the stations the user added to Gladys are read.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'poller' });

/**
 * @param {object} options
 * @param {import('./hub.js').StationHub} options.hub
 * @param {boolean} [options.timers] run the periodic timer (tests may turn it off)
 * @param {number} [options.periodMs] override of the hub's period (tests)
 * @param {() => Promise<void>} [options.onPolled] after a cycle or a poll that read the API
 */
export function createPoller({ hub, timers = true, periodMs, onPolled = async () => {} }) {
  let timer = null;
  let stopped = true;
  const period = () => periodMs ?? hub.periodMs();

  /**
   * Read the station unless it was read less than `minGap` periods ago.
   * @returns {Promise<boolean>} the API was called
   */
  async function pollStation(station, minGap) {
    const entry = hub.cache.get(station.platformId);
    const elapsed = entry ? hub.now() - entry.readAt : Infinity;
    if (elapsed < period() * minGap) {
      logger.debug(`${station.id}: read ${Math.round(elapsed / 1000)} s ago, served from cache`);
      // The age of the observation still moves.
      await hub.publish(station).catch(() => {});
      return false;
    }
    await hub.poll(station);
    return true;
  }

  /** One cycle: every added station, one after the other (30 calls/min max). */
  async function cycle() {
    if (hub.gladys.connected === false) {
      logger.debug('Gladys unreachable: cycle skipped');
      return;
    }
    if (!hub.isConfigured()) {
      return;
    }
    let read = false;
    for (const station of hub.createdStations()) {
      read = (await pollStation(station, 0.5)) || read;
    }
    if (read) {
      await onPolled();
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await cycle();
      } catch (err) {
        logger.error(`Polling cycle failed (${err.message})`);
      } finally {
        schedule();
      }
    }, period());
    timer.unref?.();
  }

  return {
    cycle,

    /** (Re)start the timer: the first cycle runs one period from now. */
    start() {
      stopped = false;
      schedule();
    },

    /**
     * The core's onPoll (fallback): reads the station unless the timer did
     * within 90 % of a period.
     * @param {{ external_id: string }} device
     */
    async pollFromCore(device) {
      const station = hub.stationByDevice(device.external_id);
      if (!station || !hub.isConfigured()) {
        logger.debug(`onPoll ignored for ${device.external_id}`);
        return;
      }
      if (await pollStation(station, 0.9)) {
        await onPolled();
      }
    },

    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
  };
}
