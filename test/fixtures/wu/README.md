# API fixtures

Answers of `GET https://api.weather.com/v2/pws/observations/current?units=m&numericPrecision=decimal`,
written from the field list of The Weather Company documentation ("PWS Observations - Current
Conditions") and the shape the HACS integration `wundergroundpws` and the openHAB `weathercompany`
binding read. The development session could not reach `api.weather.com`: these are **not
captures**. `scripts/probe.mjs` checks the real shape from a machine with network access.

The station ids (`IGLADYS…`), places and times are invented.

- `current-full.json`: an Ecowitt-type station with every sensor (wind, rain, UV, solar).
- `current-minimal.json`: temperature, humidity and pressure only (no anemometer, no rain gauge,
  no UV or solar sensor: `null`), empty neighborhood, quality control not run.
- `current-winter.json`: freezing, the wind chill below the temperature, raining, no gust value.
- `error-401.json`: the body of the 401 sent for an invalid key.

A station with no record in the last 60 minutes, or an id the API does not know, gets a `204` with
no body.
