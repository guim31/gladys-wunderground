# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- Weather Underground personal weather stations in Gladys, through the official API The Weather
  Company gives to station owners (free key): one device per station, up to 10 stations — yours or
  any public station nearby.
- Temperature, feels-like temperature, dew point, humidity, sea-level pressure, wind speed, gusts and
  direction, rain rate and rain of the day, UV index, light from the solar radiation, and the age of
  the last observation. A feature is only created when the station has the sensor.
- Refresh every 5 to 60 minutes, slowed down automatically to stay within the 1,500 calls a day of the
  key; the reads pause 15 minutes when the quota is exceeded anyway.
- A station that stops reporting is flagged: its values are no longer refreshed, the age of its
  observation keeps growing, and its badge turns orange in the device list.
- **Weather station** dashboard widget: live temperature, humidity, wind, rain and pressure, the
  temperature of the last 24 hours, and the details of the last observation.
- **Test the connection** button: reads every station and says how each one answered.
- Feature names, messages, widget and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-wunderground/commits/main
