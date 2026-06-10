# observability

App-owned observability config for the iedora web app, as code.

The app is already OpenTelemetry-instrumented (`@iedora/observability` →
`registerIedoraOtel`). At runtime it exports OTLP to the swarm's OpenTelemetry
Collector (`OTEL_EXPORTER_OTLP_ENDPOINT`, set in the deploy — see the infra
repo). This folder owns the **dashboards** built on that telemetry.

## Why dashboards live here

Dashboards-as-code, owned by the team that owns the service — co-located with
the code they observe ("delete the app, delete its dashboards"). Platform/infra
dashboards (host, containers, swarm) live in the **infra** repo instead.

## Layout

- `dashboards/*.json` — OpenObserve dashboard definitions (the source of truth).
- `apply-dashboards.py` — idempotent apply: upserts each JSON by title into an
  OpenObserve folder. No external deps (stdlib only).

## Apply

CI applies these to OpenObserve on push to `main` (see
`.github/workflows/dashboards.yml`). To apply locally:

```bash
export O2_URL=https://observe.iedora.com O2_ORG=default
export O2_EMAIL=...           # an OpenObserve account with dashboard access
export O2_PASSWORD=...
python3 observability/apply-dashboards.py observability/dashboards Applications
```

## Required CI secret

The workflow needs an OpenObserve credential to apply dashboards. Add to the
repo's GitHub **secrets**:

- `O2_OBSERVE_PASSWORD` — password for the OpenObserve apply account.

and (repo **variables**, non-secret):

- `O2_OBSERVE_URL` (e.g. `https://observe.iedora.com`)
- `O2_OBSERVE_EMAIL` (the apply account email)

> Hardening: prefer a dedicated OpenObserve **service account** scoped to
> dashboards over the root account.

## Editing dashboards

Edit the JSON directly, or build/export from the OpenObserve UI and commit the
JSON here. Matching is by **title** — keep titles stable so applies update in
place instead of creating duplicates.
