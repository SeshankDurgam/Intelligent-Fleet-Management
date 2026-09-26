# D6.2 scalability experiments

Artifacts used for the scalability experiments reported in deliverable D6.2
(commit `ac2ef63`, November 2025). The scripts in this folder are **frozen
experiment variants** of [submanager](../../submanager/src/submanager.js) —
they are intentionally kept byte-identical to the versions that produced the
D6.2 measurements, so do not refactor them; fix bugs in
`submanager/src/submanager.js` instead.

## Submanager variants

All variants share the same core logic as the baseline
`submanager/src/submanager.js` (subscribe to MQTT downstream topic → parse
digital-twin JSON → relay to proxy device or deploy a container via the
Docker Engine API). They differ only in how many deployments each incoming
MQTT message triggers, and in which process:

| Script | Deployments per message | Notes |
|---|---|---|
| `submanager10.js` | 10, sequential in-process | `process.cpuUsage()` measured around the loop |
| `submanager100.js` | 100, sequential in-process | identical to `submanager10.js` except the loop bound |
| `submanager10chained.js` | 1 (chained) | the 10× loop is disabled; each deployment is driven by the next incoming message, so 10 messages form a chain |
| `submanager2by10.js` | 10, in a forked worker | forks itself with `--worker`; the child runs the 10× loop and reports user/system CPU time back |

Broker note: the baseline `submanager.js` defaults to
`mqtt://test.mosquitto.org:1883`, while these variants default to
`mqtt://broker.hivemq.com:1883`. Both are overridable via `MQTT_BROKER_URL`.

Timestamps for workflow tracing are appended by `TimestampLogger.js` (local
copy, same as `submanager/src/TimestampLogger.js`) to
`/app/logs/timestamps.csv` — mount a volume or override the `file` option
when running outside a container.

## Twin generation scripts

* `generate_twins.py` — generates 100 virtual Raspberry Pi twins
  (`no.sintef.sct.giot:sintef-rpi-001` … `-100`, IPs `192.168.32.1` …
  `.100`) from `sample_digital_twin.json`, with randomized CPU/memory/disk/
  temperature values. Every 20th device is marked as proxied by the previous
  one. Output goes to `generated/`.
* `post_twins.py` — HTTP PUTs every JSON in `generated/` to Eclipse Ditto.
  Configuration via env vars: `DITTO_BASE` (default
  `http://localhost:8080/api/2/things/`), `DITTO_USER`/`DITTO_PASS` (default
  `ditto`/`ditto`), `DITTO_PUT_DELAY` (seconds between requests, default 0.2).
* `generated/` — the exact 100 twin JSONs used in the D6.2 runs (kept for
  reproducibility; re-running `generate_twins.py` produces different random
  values).

Both Python scripts use paths relative to this folder — run them from here.

## Reproducing an experiment

```bash
cd experiments/d6.2-scalability
npm install                    # dockerode, mqtt, uuid, dotenv

# 1. start Ditto (from repo root: docker compose -f docker-compose-ditto.yml up -d)
# 2. seed the twins
python post_twins.py

# 3. run a variant (env vars as for submanager)
MQTT_BROKER_URL=mqtt://broker.hivemq.com:1883 node submanager10.js

# 4. trigger deployments from the fleet-manager GUI or backend and collect
#    timestamps from /app/logs/timestamps.csv (or the mounted volume)
```
