# Weather Underground for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that brings the
**personal weather stations published on [Weather Underground](https://www.wunderground.com)** into
Gladys — yours, and any public station nearby — through the official API The Weather Company gives to
station owners ("PWS Observations - Current Conditions"). Read-only.

> **Developed without the hardware: feedback welcome.** The integration was built without a weather
> station and without an API key: it is tested against answers written from the API documentation, not
> against the live API. Please report what works and what does not in the
> [issues](https://github.com/guim31/gladys-wunderground/issues).

## Features

- **One device per station** (10 at most), whatever its brand (Ecowitt, Davis, Ambient Weather,
  WeeWX…), with metric features: temperature, feels-like temperature, dew point, humidity, sea-level
  pressure, wind speed, gusts and direction, rain rate and rain of the day, UV index, light (from the
  solar radiation), and the **age of the last observation**. A feature is only created when the
  station has the sensor.
- **A silent station is flagged**: after 30 minutes without a new observation its values are no
  longer refreshed (an old temperature would look current), the age keeps growing — a scene can watch
  it — and its transport badge turns orange.
- **Weather station widget**: live tiles (temperature, humidity, wind, rain, pressure), the
  temperature of the last 24 hours, and the details of the last observation with its age.
- **Test the connection** button: reads every station and reports how each one answered.
- **Quota-aware**: each station is read once per period (5 minutes by default), slowed down when the
  stations would exceed the 1,500 calls a day of the key; the widget, a device just added and the
  core's polls are served from the last observation, never from a new call.
- Quiet logs, the API key never written anywhere but in the request to `api.weather.com`.
- Feature names, messages, widget and documentation in English, French, German and Spanish.

## Requirements

- Gladys **5.1.0** or later.
- A free Weather Underground **API key**, given to members whose station uploads to Weather
  Underground: [wunderground.com → Member settings → API Keys](https://www.wunderground.com/member/api-keys).
- The **station ids** to follow (`IPARIS123`, `KCASANFR1234`…), from the station pages.
- Internet access from Gladys to `api.weather.com`.

## Installation

1. In Gladys, open **Integrations** → **Install from GitHub** and enter the address of this repository:
   `https://github.com/guim31/gladys-wunderground` (or install **Weather Underground** from the
   catalog once it is listed).
2. In **Configuration**, paste the API key, enter the station ids separated by commas, pick the
   refresh interval and the language of the feature names. Save, then click **Test the connection**.
3. Open the **Discovery** tab and add the stations.

The user guide is in [`docs/en.md`](docs/en.md) (also in [French](docs/fr.md), [German](docs/de.md)
and [Spanish](docs/es.md)); Gladys links it from the Configuration screen.

## How it works

- `GET https://api.weather.com/v2/pws/observations/current?stationId=…&units=m&numericPrecision=decimal`
  returns the newest observation of the last 60 minutes, `204` when there is none (offline station or
  unknown id: the API does not tell them apart), `401` for a refused key, `429` past the quota.
- The container polls by itself (`src/poller.js`): Gladys 5.2.x does not reliably poll external
  devices (GladysAssistant/Gladys#3198). The devices still declare `should_poll` with a one-minute
  frequency, and the core's `onPoll` is answered from the cache inside the period.
- States go through `publishChangedStates` (only changes, a 6-hour heartbeat); a silent station only
  gets its observation age. Everything is re-sent from the cache when a device is added and after a
  reconnection.
- No forecast: Gladys' weather services already provide one, and the value here is the measurement of
  a station next door. `scripts/probe.mjs` checks whether a PWS key is allowed on the 5-day forecast.

## Limitations

- Metric units only.
- Light is the solar radiation × 126.7 (the factor Ecowitt stations use to upload their lux reading as
  W/m²): exact for them, an approximation for a pyranometer. Gladys has no W/m² unit; the widget shows
  the W/m² value too.
- 10 stations per key; the refresh slows down beyond 4.
- No scene trigger nor scene action: every value is a device feature the standard scene cards handle.
- The free API belongs to The Weather Company, which may change or end it at any time.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests use the fake Gladys of the SDK (`@gladysassistant/integration-sdk/testing`) and a fake
`api.weather.com` (`test/helpers/world.js`) serving the fixtures of `test/fixtures/wu/`. With network
access, `node scripts/probe.mjs` checks that a fake key is refused, and
`WU_API_KEY=… node scripts/probe.mjs IPARIS123` prints the real shape of an observation (never the
key). See [`CLAUDE.md`](CLAUDE.md) for the project rules.

Releases go through **Actions → Release** (version bump, changelog, tag, multi-arch image, GitHub
Release). A hand-pushed `vX.Y.Z` tag also builds the image and the Release, but does not touch the
files: bump `version` in `package.json` and in `gladys-assistant-integration.json` (with the
`docker_image` tag) and commit before tagging.

## Credits

- [The Weather Company](https://www.weather.com) for the PWS API and its documentation, and the
  [Weather Underground](https://www.wunderground.com) community of station owners.
- [Home-Assistant-wundergroundpws](https://github.com/cytech/Home-Assistant-wundergroundpws) by cytech
  (HACS integration): how the API answers (204 for a station without recent data, 401 for a refused
  key), the 5-minute pace, the sensor list. Its repository carries no license file: it was read to
  understand the API, no code was copied.
- The openHAB [Weather Company binding](https://github.com/openhab/openhab-addons/tree/main/bundles/org.openhab.binding.weathercompany)
  (EPL-2.0): the documented meaning of each field of an observation. No code was copied.
- The architecture, polling timer and conformity tests follow
  [gladys-wled](https://github.com/guim31/gladys-wled),
  [gladys-pihole](https://github.com/guim31/gladys-pihole) and
  [gladys-subsonic](https://github.com/guim31/gladys-subsonic).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by Weather Underground, The Weather Company
or IBM. "Weather Underground" and "The Weather Company" are trademarks of their owners.

## License

Apache-2.0
