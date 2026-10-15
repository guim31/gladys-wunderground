// -----------------------------------------------------------------------------
// Registers every SDK handler on a GladysIntegration (or the SDK's fake
// Gladys) and returns the hub, so index.js stays a few lines and the tests
// drive the very same wiring.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, refreshMinutes } from './config.js';
import { StationHub } from './hub.js';
import { STATUS } from './i18n.js';
import { createPoller } from './poller.js';
import { stationIds } from './station.js';
import { WIDGET, buildStationContent, messageContent } from './widgets.js';

const logger = createLogger({ name: 'wunderground-app' });

export const ACTION = { TEST: 'test_connection' };

/**
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams
 * @param {typeof fetch} [options.fetch]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the polling timer
 * @param {number} [options.periodMs] polling period override
 */
export function registerHandlers(gladys, options = {}) {
  const hub = new StationHub({ gladys, fetch: options.fetch, now: options.now });
  const poller = createPoller({
    hub,
    timers: options.timers ?? true,
    periodMs: options.periodMs,
    // After the reads, the status rows of the widget changed: one nudge per
    // cycle (the core rate-limits it to one per 10 s per widget).
    onPolled: () => requestRefresh(),
  });

  // Resolved once the first configuration is applied; every handler waits
  // for it, so a poll arriving during the first reads is not lost.
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let started = false;
  const whenReady =
    (fn) =>
    async (...args) => {
      await ready;
      return fn(...args);
    };

  /** Apply a configuration: read every station, publish, (re)start the timer. */
  async function apply(config) {
    poller.stop();
    hub.setConfig(config);
    if (hub.isConfigured()) {
      logger.info(
        `Following ${hub.stations.length} station(s), each read every ` +
          `${refreshMinutes(config, hub.stations.length)} min`,
      );
    } else {
      logger.info('Not configured yet: waiting for the API key and a station id');
    }
    await hub.discover();
    await requestRefresh();
    poller.start();
  }

  /** "Re-pull the widget now": fire-and-forget, dropped while Gladys is away. */
  async function requestRefresh() {
    try {
      gladys.requestWidgetRefresh(WIDGET.STATION);
    } catch (err) {
      logger.debug(`Widget refresh not sent (${err.message})`);
    }
  }

  gladys.on('connected', async () => {
    try {
      if (started) {
        // A reconnection (Gladys restarted): it may have lost the last
        // states and statuses — send them again, from the cache.
        hub.lastStatus = null;
        hub.lastTransports.clear();
        gladys.forgetPublishedStates();
        for (const station of hub.createdStations()) {
          await hub.publish(station).catch(() => {});
        }
        await hub.updateStatus();
        return;
      }
      started = true;
      await apply(normalizeConfig(await gladys.getConfig()));
    } catch (err) {
      logger.error('Initialization failed', err);
      await gladys.setConnectionStatus(false, STATUS.initFailed).catch(() => {});
    } finally {
      resolveReady();
    }
  });

  gladys.onScanRequest(
    whenReady(async () => {
      logger.info('Discovery requested: publishing the stations');
      await hub.discover({ reuseFresh: true });
    }),
  );

  gladys.onPoll(
    whenReady(async (device) => {
      await poller.pollFromCore(device);
    }),
  );

  // A device just added (or updated): Gladys dropped the states it received
  // before, send everything now, from the last observation.
  const onDeviceChanged = whenReady(async (device) => {
    if (await hub.onDeviceCreated(device)) {
      await requestRefresh();
    }
  });
  gladys.onDeviceCreated(onDeviceChanged);
  gladys.onDeviceUpdated(onDeviceChanged);

  gladys.onConfigUpdated(
    whenReady(async (newConfig) => {
      logger.info('New configuration received');
      await apply(normalizeConfig(newConfig));
    }),
  );

  gladys.onAction(
    ACTION.TEST,
    whenReady(async () => {
      logger.info('Action: test the connection');
      const report = await hub.testConnection();
      await requestRefresh();
      return report;
    }),
  );

  gladys.onWidgetGet(
    WIDGET.STATION,
    whenReady(async ({ settings = {}, language } = {}) => {
      if (!hub.isConfigured()) {
        return messageContent(language, 'notConfigured');
      }
      const station = settings.station
        ? hub.stationByDevice(settings.station)
        : (hub.createdStations()[0] ?? hub.stations[0]);
      if (!station) {
        return messageContent(language, 'noStation');
      }
      const ids = stationIds(gladys, station);
      return buildStationContent({
        station,
        observation: hub.observationOf(station),
        featureId: (key) => ids.feature(key),
        createdFeatures: hub.createdFeatures(station),
        language,
        now: hub.now(),
      });
    }),
  );

  return {
    hub,
    poller,
    ready,
    async stop() {
      poller.stop();
    },
  };
}
