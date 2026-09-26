#!/usr/bin/env python3
"""
Post all generated twins to Eclipse Ditto using HTTP PUT.

Default settings:
  DITTO_BASE = http://localhost:8080/api/2/things/
  AUTH = ("ditto","ditto")
  FILES are read from ./generated/*.json

This script URL-encodes the thingId when building the PUT URL.
"""

import os
import glob
import json
import time
import requests
from urllib.parse import quote

GENERATED_DIR = "generated"
DITTO_BASE = os.environ.get("DITTO_BASE", "http://localhost:8080/api/2/things/")
AUTH = (os.environ.get("DITTO_USER", "ditto"), os.environ.get("DITTO_PASS", "ditto"))
DELAY = float(os.environ.get("DITTO_PUT_DELAY", "0.2"))  # seconds between requests

def post_file(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    thing_id = os.path.basename(path)
    thing_id = "no.sintef.sct.giot:" + thing_id.removesuffix(".json")
    #data.get("_thingId")
    if not thing_id:
        print(f"Skipping {path}: _thingId missing")
        return False, "no_thingId"

    url = DITTO_BASE + quote(thing_id, safe='')
    headers = {"Content-Type": "application/json"}
    try:
        r = requests.put(url, auth=AUTH, headers=headers, json=data, timeout=20)
        if r.status_code in (200, 201, 204):
            return True, r.status_code
        else:
            return False, f"{r.status_code} {r.text}"
    except Exception as e:
        return False, str(e)

def main():
    files = sorted(glob.glob(os.path.join(GENERATED_DIR, "*.json")))
    if not files:
        print("No files found in", GENERATED_DIR)
        return

    print(f"Posting {len(files)} files to {DITTO_BASE} (user={AUTH[0]})")
    results = []
    for p in files:
        print("PUT", os.path.basename(p), "->", end=" ", flush=True)
        ok, info = post_file(p)
        if ok:
            print("OK", info)
        else:
            print("FAILED", info)
        results.append((p, ok, info))
        time.sleep(DELAY)

    # summary
    successful = sum(1 for r in results if r[1])
    print(f"\nSummary: {successful}/{len(results)} succeeded.")
    for p, ok, info in results:
        if not ok:
            print("FAILED:", os.path.basename(p), "->", info)

if __name__ == "__main__":
    main()
