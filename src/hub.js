// -----------------------------------------------------------------------------
// The stations: their last observation, the reads against the API quota, the
// states published to Gladys, the connection status and the transport badges.
//
// Quota first. A PWS key allows 1,500 calls a day and 30 a minute: each
// station is read once per period (5 minutes at the fastest, slower when the
// stations would exceed the budget, see refreshMinutes), the reads of a cycle
// run one after the other, and everything else — the dashboard widget, a
// device just added in Gladys, the core's onPoll inside the period — is
// served from the last observation, never from a new call.
// -----------------------------------------------------------------------------

import { createLogger, DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { isConfigured, parseStations, refreshMinutes, MAX_STATIONS } from './config.js';
import { REPORT, STATUS, TRANSPORT, formatNumber, translate } from './i18n.js';
import { createIssueLog } from './issues.js';
import {
  buildStationDevice,
  isStale,
  stationIds,
  stationStates,
  FEATURES,
  DEVICE_TYPE,
} from './station.js';
import { ERROR_KINDS, fetchObservation } from './wu/client.js';
import { ageMinutes, parseObservation } from './wu/observation.js';

const logger = createLogger({ name: 'wunderground' });

// An unchanged value is sent again every 6 hours, so it stays recently dated
// in Gladys (the front flags a value older than 48 h).
export const HEARTBEAT_MS = 6 * 60 * 60 * 1000;
// After a 429, every read waits this long (the quota is per key).
export const RATE_LIMIT_BACKOFF_MS = 15 * 60 * 1000;
// A refused key is retried at this pace until the configuration changes.
export const AUTH_BACKOFF_MS = 60 * 60 * 1000;

const AGE_KEY = 'observation_age';

export class StationHub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now]
   */
  constructor({ gladys, fetch, now = () => Date.now() }) {
    this.gladys = gladys;
    this.fetch = fetch;
    this.now = now;
    this.issues = createIssueLog(logger);
    this.config = null;
    this.stations = [];
    this.invalid = [];
    this.ignored = [];
    /** platformId → { observation, readAt, error } */
    this.cache = new Map();
    /** platformId → read in progress */
    this.inFlight = new Map();
    /** No API call before this instant (429, refused key). */
    this.backoffUntil = 0;
    this.backoffReason = null;
    this.lastStatus = null;
    /** device external_id → JSON of the last published transport entry */
    this.lastTransports = new Map();
  }

  /** Milliseconds between two reads of a station. */
  periodMs() {
    return refreshMinutes(this.config, this.stations.length) * 60000;
  }

  /** A new configuration: forget everything about the previous one. */
  setConfig(config) {
    this.config = config;
    const { stations, invalid, ignored } = parseStations(config);
    this.stations = stations;
    this.invalid = invalid;
    this.ignored = ignored;
    this.cache.clear();
    this.backoffUntil = 0;
    this.backoffReason = null;
    this.lastTransports.clear();
    if (invalid.length > 0) {
      logger.warn(`Ignored, not a station id: ${invalid.join(', ')}`);
    }
    if (ignored.length > 0) {
      logger.warn(`Ignored, ${MAX_STATIONS} stations at most: ${ignored.join(', ')}`);
    }
  }

  isConfigured() {
    return this.config !== null && isConfigured(this.config);
  }

  stationByDevice(externalId) {
    return this.stations.find((s) => stationIds(this.gladys, s).device === externalId);
  }

  /** The stations whose device the user added to Gladys. */
  createdStations() {
    const created = new Set((this.gladys.devices ?? []).map((device) => device.external_id));
    return this.stations.filter((s) => created.has(stationIds(this.gladys, s).device));
  }

  /** The feature external ids of the device as created in Gladys, null if not created. */
  createdFeatures(station) {
    const id = stationIds(this.gladys, station).device;
    const device = (this.gladys.devices ?? []).find((d) => d.external_id === id);
    if (!device) {
      return null;
    }
    return new Set((device.features ?? []).map((f) => f.external_id));
  }

  // --- Reading the API -------------------------------------------------------

  /**
   * Read one station now (one API call), unless a read is in progress or the
   * key is backing off. Never throws: the outcome is in the cache entry.
   * @returns {Promise<{ outcome: 'ok' | 'no_data' | 'error' | 'skipped', error?: Error }>}
   */
  async read(station) {
    const running = this.inFlight.get(station.platformId);
    if (running) {
      return running;
    }
    if (this.now() < this.backoffUntil) {
      logger.debug(`${station.id}: read skipped (${this.backoffReason} back-off)`);
      return { outcome: 'skipped' };
    }
    const run = this.#read(station).finally(() => this.inFlight.delete(station.platformId));
    this.inFlight.set(station.platformId, run);
    return run;
  }

  async #read(station) {
    const entry = this.cache.get(station.platformId) ?? { observation: null, readAt: 0 };
    entry.readAt = this.now();
    this.cache.set(station.platformId, entry);
    try {
      const raw = await fetchObservation({
        apiKey: this.config.api_key,
        stationId: station.id,
        fetch: this.fetch,
      });
      entry.error = null;
      this.issues.ok('api', 'Weather Underground API answers again');
      this.issues.ok(`refused:${station.platformId}`, `${station.id}: accepted by the API again`);
      if (raw === null) {
        logger.debug(`${station.id}: no observation in the last hour (204)`);
        return { outcome: 'no_data' };
      }
      entry.observation = parseObservation(raw);
      logger.debug(
        `${station.id}: ${entry.observation.temperature} °C, observed ` +
          `${ageMinutes(entry.observation, this.now())} min ago`,
      );
      return { outcome: 'ok' };
    } catch (err) {
      entry.error = err;
      this.#onReadError(station, err);
      return { outcome: 'error', error: err };
    }
  }

  #onReadError(station, err) {
    if (err.kind === ERROR_KINDS.RATE_LIMIT) {
      this.backoffUntil = this.now() + RATE_LIMIT_BACKOFF_MS;
      this.backoffReason = 'quota';
      this.issues.fail('api', `Weather Underground: ${err.message}, pausing 15 minutes`);
    } else if (err.kind === ERROR_KINDS.AUTH) {
      this.backoffUntil = this.now() + AUTH_BACKOFF_MS;
      this.backoffReason = 'refused key';
      this.issues.fail('api', `Weather Underground: ${err.message}`);
    } else if (err.kind === ERROR_KINDS.BAD_REQUEST) {
      this.issues.fail(`refused:${station.platformId}`, `${station.id}: ${err.message}`);
    } else {
      this.issues.fail('api', `Weather Underground: ${err.message}`);
    }
  }

  // --- Publishing to Gladys --------------------------------------------------

  /**
   * Publish what is known of one station (no API call): every value while the
   * observation is fresh, only its age once the station is silent — an old
   * value re-sent by the heartbeat would look current. Then its transport.
   */
  async publish(station) {
    const createdFeatures = this.createdFeatures(station);
    if (createdFeatures === null) {
      return;
    }
    const entry = this.cache.get(station.platformId);
    const observation = entry?.observation ?? null;
    const now = this.now();
    if (observation) {
      const stale = isStale(observation, now);
      const ageId = stationIds(this.gladys, station).feature(AGE_KEY);
      const states = stationStates(this.gladys, station, observation, now, createdFeatures).filter(
        (state) => !stale || state.device_feature_external_id === ageId,
      );
      if (states.length > 0) {
        await this.gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      }
      if (stale) {
        this.issues.fail(`stale:${station.platformId}`, `${station.id}: no recent observation`);
      } else {
        this.issues.ok(`stale:${station.platformId}`, `${station.id}: observations are back`);
      }
    }
    await this.publishTransport(station);
  }

  /** The transport badge of one station, sent when it changes. */
  async publishTransport(station) {
    const externalId = stationIds(this.gladys, station).device;
    const entry = this.cache.get(station.platformId);
    if (!entry) {
      return;
    }
    let item;
    if (entry.error && entry.error.kind !== ERROR_KINDS.RATE_LIMIT) {
      item = { external_id: externalId, transport: DEVICE_TRANSPORTS.UNREACHABLE };
    } else if (!entry.observation || isStale(entry.observation, this.now())) {
      item = {
        external_id: externalId,
        transport: DEVICE_TRANSPORTS.CLOUD,
        degraded: true,
        message: TRANSPORT.stale,
      };
    } else {
      item = { external_id: externalId, transport: DEVICE_TRANSPORTS.CLOUD };
    }
    const key = JSON.stringify(item);
    if (this.lastTransports.get(externalId) === key) {
      return;
    }
    await this.gladys.publishTransports([item]);
    this.lastTransports.set(externalId, key);
  }

  /** The connection status of the Configuration screen, sent when it changes. */
  async updateStatus() {
    let status;
    if (!this.isConfigured()) {
      status = { connected: false, message: STATUS.notConfigured };
    } else if (this.backoffReason === 'refused key' && this.now() < this.backoffUntil) {
      status = { connected: false, message: STATUS.authFailed };
    } else if (this.backoffReason === 'quota' && this.now() < this.backoffUntil) {
      status = { connected: false, message: STATUS.rateLimited };
    } else {
      const entries = this.stations.map((s) => this.cache.get(s.platformId));
      const read = entries.filter((e) => e && e.readAt > 0);
      const allDown =
        read.length > 0 &&
        read.length === entries.length &&
        read.every((e) => [ERROR_KINDS.NETWORK, ERROR_KINDS.SERVER].includes(e.error?.kind));
      status = allDown
        ? { connected: false, message: STATUS.unreachable }
        : { connected: true, message: undefined };
    }
    const key = JSON.stringify(status);
    if (key === this.lastStatus) {
      return;
    }
    await this.gladys.setConnectionStatus(status.connected, status.message);
    this.lastStatus = key;
  }

  // --- The flows -------------------------------------------------------------

  /**
   * Read every station (one call each) and publish the devices. Used at start,
   * on a new configuration and by the Discovery tab's scan — the scan reuses
   * an observation younger than half a period.
   * @param {{ reuseFresh?: boolean }} [options]
   */
  async discover({ reuseFresh = false } = {}) {
    if (!this.isConfigured()) {
      await this.updateStatus();
      return;
    }
    for (const station of this.stations) {
      const entry = this.cache.get(station.platformId);
      if (reuseFresh && entry && this.now() - entry.readAt < this.periodMs() / 2) {
        continue;
      }
      await this.read(station);
    }
    await this.updateStatus();
    if (this.backoffReason === 'refused key' && this.now() < this.backoffUntil) {
      return;
    }
    const devices = this.stations.map((station) =>
      buildStationDevice(
        this.gladys,
        station,
        this.cache.get(station.platformId)?.observation ?? null,
        this.config.language,
      ),
    );
    try {
      await this.gladys.publishDiscoveredDevices(devices);
    } catch (err) {
      logger.error(`Publishing the station devices failed: ${err.message}`);
      await this.gladys.setConnectionStatus(false, STATUS.publishFailed);
      this.lastStatus = null;
      return;
    }
    for (const station of this.createdStations()) {
      await this.publish(station);
    }
  }

  /**
   * One poll of a station: read it, publish it, refresh the status.
   * Errors are logged by the issue log, never thrown.
   */
  async poll(station) {
    await this.read(station);
    await this.publish(station).catch((err) => {
      this.issues.fail('gladys', `Publishing the states failed: ${err.message}`);
    });
    await this.updateStatus().catch(() => {});
  }

  /** A device was just added (or updated) in Gladys: send what is known now. */
  async onDeviceCreated(device) {
    const station = this.stationByDevice(device.external_id);
    if (!station) {
      return false;
    }
    this.lastTransports.delete(device.external_id);
    if (!this.cache.get(station.platformId)?.observation) {
      await this.read(station);
    }
    await this.publish(station);
    return true;
  }

  /** Last observation of a station (for the widget). */
  observationOf(station) {
    return this.cache.get(station.platformId)?.observation ?? null;
  }

  /**
   * The "Test the connection" action: read every station now and say how
   * each one answered.
   * @returns {Promise<Record<string, string>>} multi-language report
   */
  async testConnection() {
    if (!this.isConfigured()) {
      return translate(REPORT, (t) => t.notConfigured);
    }
    // A user asking for a test lifts the back-off: one call per station.
    this.backoffUntil = 0;
    this.backoffReason = null;
    // In parallel, so 10 stations fit in the action's timeout (10 calls stay
    // under the 30 a minute).
    const results = await Promise.all(
      this.stations.map(async (station) => {
        const result = await this.read(station);
        await this.publish(station).catch(() => {});
        return { station, result };
      }),
    );
    await this.updateStatus().catch(() => {});
    if (results.some(({ result }) => result.error?.kind === ERROR_KINDS.AUTH)) {
      return translate(REPORT, (t) => t.authFailed);
    }
    if (results.some(({ result }) => result.error?.kind === ERROR_KINDS.RATE_LIMIT)) {
      return translate(REPORT, (t) => t.rateLimited);
    }
    const minutes = refreshMinutes(this.config, this.stations.length);
    return Object.fromEntries(
      Object.entries(REPORT).map(([lang, t]) => {
        const lines = results.map(({ station, result }) => {
          if (result.outcome === 'ok') {
            const o = this.observationOf(station);
            const temperature =
              o.temperature === null ? '?' : `${formatNumber(o.temperature, lang)} °C`;
            return t.ok(station.id, temperature, ageMinutes(o, this.now()) ?? '?');
          }
          if (result.outcome === 'no_data') {
            return t.noData(station.id);
          }
          return result.error?.kind === ERROR_KINDS.BAD_REQUEST
            ? t.refused(station.id)
            : t.failed(station.id);
        });
        if (this.invalid.length > 0) {
          lines.push(t.invalid(this.invalid.join(', ')));
        }
        if (this.ignored.length > 0) {
          lines.push(t.ignored(this.ignored.join(', '), MAX_STATIONS));
        }
        lines.push(t.pace(minutes));
        return [lang, lines.join('\n')];
      }),
    );
  }
}

export { DEVICE_TYPE, FEATURES };
