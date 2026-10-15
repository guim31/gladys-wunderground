# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- **Secrets**: the Weather Underground API key is a `secret` field of the Gladys configuration. The
  integration reads it from Gladys, keeps it in memory, and sends it only to `api.weather.com`, over
  HTTPS, in the query string the API requires. It never writes it to `/data`, to the logs, nor to an
  error message (the request URL, which contains it, is never logged).
- **Storage**: nothing. The integration writes nothing under `/data`; the last observation of each
  station lives in memory only.
- **Network**: outgoing HTTPS requests to `api.weather.com` only (GET, read-only), and the
  WebSocket and host API of Gladys. No port is opened, no local network access.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)), and the Weather
Underground / The Weather Company service.
