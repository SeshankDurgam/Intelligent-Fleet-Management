#!/usr/bin/env python3
"""
Generate 100 dummy digital twins based on uploaded sample file.

- Uses sample at: /mnt/data/sample_digital_twin.json
- Output files: ./generated/no.sintef.sct.giot:sintef-rpi-001.json ... up to -100.json
- thingId: no.sintef.sct.giot:sintef-rpi-001 ... -100
- ip_address: 192.168.32.1 ... 192.168.32.100
- Introduces variance in cpu/memory/disk/temp/internet_speed/connectedDevices lastSeen
"""

import json
import os
import random
from datetime import datetime, timedelta

SAMPLE_PATH = "./sample_digital_twin.json"
OUT_DIR = "generated"
COUNT = 100
BASE_THING_PREFIX = "no.sintef.sct.giot:sintef-rpi-"
BASE_IP_PREFIX = "192.168.32."

# Create output dir
os.makedirs(OUT_DIR, exist_ok=True)

random.seed(42)  # deterministic variations; change or remove for different randomness

def load_sample(path=SAMPLE_PATH):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def iso_now_offset(minutes_offset=0):
    # produce ISO8601 time strings for lastSeen variations
    return (datetime.utcnow() - timedelta(minutes=minutes_offset)).replace(microsecond=0).isoformat() + "Z"

def vary_connected_devices(base_connected, idx):
    # copy and vary lastSeen and maybe enrolled/pairing flags
    new_list = []
    for i, cd in enumerate(base_connected):
        copy = dict(cd)
        # shift last seen by some minutes
        offset = random.randint(0, 60 + idx % 10)
        copy["lastSeen"] = iso_now_offset(offset)
        # flip enrolled/pairing occasionally
        if random.random() < 0.05:
            copy["enrolled"] = not copy.get("enrolled", True)
        if random.random() < 0.05:
            copy["paired"] = not copy.get("paired", True)
        new_list.append(copy)
    return new_list

def vary_metrics(base_metrics, idx):
    # create plausible variances: CPU, memory, disk, temp, internet_speed
    cpu = dict(base_metrics["cpu"])
    memory = dict(base_metrics["memory"])
    disk = dict(base_metrics["disk"])
    internet = dict(base_metrics["internet_speed"])
    trustAgent = dict(base_metrics.get("trustAgent", {}))
    docker = dict(base_metrics.get("docker", {}))

    # CPU usage: lower/higher random small jitter
    idle = max(0.5, min(99.9, cpu.get("usage_idle", 90) + random.uniform(-5, 5)))
    usage_user = max(0.0, min(10.0, cpu.get("usage_user", 0.1) + random.uniform(0, 2)))
    usage_system = max(0.0, min(10.0, cpu.get("usage_system", 0.3) + random.uniform(0, 1)))

    cpu["usage_idle"] = round(idle, 6)
    cpu["usage_user"] = round(usage_user, 6)
    cpu["usage_system"] = round(usage_system, 6)
    cpu["_collected_time"] = datetime.utcnow().strftime("%d/%m/%Y, %H:%M:%S")
    cpu["_received_time"] = (datetime.utcnow() + timedelta(seconds=2)).strftime("%d/%m/%Y, %H:%M:%S")

    # Memory: tweak used and used_percent
    total_mem = memory.get("total", 953802752)
    used = int(max(0, min(total_mem - 1, memory.get("used", total_mem * 0.25) + random.randint(-50_000_000, 50_000_000))))
    memory["used"] = used
    memory["used_percent"] = round(used / total_mem * 100, 6)
    memory["_collected_time"] = cpu["_collected_time"]
    memory["_received_time"] = cpu["_received_time"]

    # Disk: tweak used and used_percent
    total_disk = disk.get("total", 31069143040)
    used_disk = int(max(0, min(total_disk - 1, disk.get("used", total_disk * 0.25) + random.randint(-2_000_000_000, 2_000_000_000))))
    disk["used"] = used_disk
    disk["used_percent"] = round(used_disk / total_disk * 100, 6)
    disk["_collected_time"] = cpu["_collected_time"]
    disk["_received_time"] = cpu["_received_time"]

    # temperature
    temp_val = round(35.0 + random.uniform(-5, 10) + (idx % 7) * 0.3, 3)
    temp = {
        "sensor": "cpu_thermal",
        "temp": temp_val,
        "_collected_time": cpu["_collected_time"],
        "_received_time": cpu["_received_time"]
    }

    # internet speed: tweak download/upload/latency
    internet["download"] = round(max(0.1, internet.get("download", 30) + random.uniform(-10, 20)), 6)
    internet["upload"] = round(max(0.1, internet.get("upload", 20) + random.uniform(-10, 10)), 6)
    internet["latency"] = round(max(1.0, internet.get("latency", 20) + random.uniform(-10, 30)), 3)
    internet["_collected_time"] = cpu["_collected_time"]
    internet["_received_time"] = cpu["_received_time"]

    # trustAgent: randomize version occasionally
    if trustAgent:
        if random.random() < 0.1:
            # bump minor version occasionally
            try:
                ver = trustAgent.get("container_version", "0.1")
                major, minor = ver.split(".")
                minor = str(int(minor) + 1)
                trustAgent["container_version"] = f"{major}.{minor}"
            except Exception:
                # fallback
                trustAgent["container_version"] = trustAgent.get("container_version", "0.1")
        trustAgent["_collected_time"] = cpu["_collected_time"]
        trustAgent["_received_time"] = cpu["_received_time"]

    # docker metadata
    docker["_collected_time"] = cpu["_collected_time"]
    docker["_received_time"] = cpu["_received_time"]

    return {
        "cpu": cpu,
        "memory": memory,
        "disk": disk,
        "temp": temp,
        "internet_speed": internet,
        "trustAgent": trustAgent,
        "docker": docker
    }

def generate():
    sample = load_sample(SAMPLE_PATH)

    # Preserve base lists we will vary
    base_connected = sample["features"]["cyber"]["properties"].get("connectedDevices", [])
    base_metrics = {
        "cpu": sample["features"]["cyber"]["properties"].get("cpu", {}),
        "memory": sample["features"]["cyber"]["properties"].get("memory", {}),
        "disk": sample["features"]["cyber"]["properties"].get("disk", {}),
        "internet_speed": sample["features"]["cyber"]["properties"].get("internet_speed", {}),
        "trustAgent": sample["features"]["cyber"]["properties"].get("trustAgent", {}),
        "docker": sample["features"]["cyber"]["properties"].get("docker", {})
    }

    for i in range(1, COUNT + 1):
        idx_str = str(i).zfill(3)  # 001, 002, ...
        thing_id = f"{BASE_THING_PREFIX}{idx_str}"
        ip = f"{BASE_IP_PREFIX}{i}"

        twin = dict(sample)  # shallow copy
        # deep-ish copies for nested sections
        #twin["_thingId"] = thing_id
        # attributes: update ip fields
        twin["attributes"] = dict(sample["attributes"])
        # update both ipAddress and ip_address (sample had both)
        twin["attributes"]["ipAddress"] = ip
        #twin["attributes"]["ip_address"] = ip

        # proxiedBy/proxyFor remain empty usually; keep same as sample unless we want to create some proxies
        # Introduce proxy for every 20th device to test proxy behavior
        if i % 20 == 0:
            twin["attributes"]["proxiedBy"] = {
                "thingId": f"{BASE_THING_PREFIX}{str(i-1).zfill(3)}",  # proxied by previous
                "ipAddress": f"{BASE_IP_PREFIX}{i-1}"
            }
        else:
            twin["attributes"]["proxiedBy"] = {"thingId": "", "ipAddress": ""}

        # features: deep copy
        twin["features"] = json.loads(json.dumps(sample["features"]))  # simple deep copy via serialization

        # vary connected devices and metrics
        twin["features"]["cyber"]["properties"]["connectedDevices"] = vary_connected_devices(base_connected, i)
        varied = vary_metrics(base_metrics, i)

        # merge varied metrics into properties
        twin["features"]["cyber"]["properties"]["cpu"] = varied["cpu"]
        twin["features"]["cyber"]["properties"]["memory"] = varied["memory"]
        twin["features"]["cyber"]["properties"]["disk"] = varied["disk"]
        twin["features"]["cyber"]["properties"]["internet_speed"] = varied["internet_speed"]
        twin["features"]["cyber"]["properties"]["trustAgent"] = varied["trustAgent"]
        twin["features"]["cyber"]["properties"]["docker"] = varied["docker"]

        # physical temp
        twin["features"]["physical"]["properties"]["temp"] = varied["temp"]

        # also set the internet ip address to match
        twin["features"]["cyber"]["properties"]["internet_speed"]["ip_address"] = ip

        # write file
        filename = f"{thing_id}.json".removeprefix("no.sintef.sct.giot:")
        outpath = os.path.join(OUT_DIR, filename)
        with open(outpath, "w", encoding="utf-8") as f:
            json.dump(twin, f, indent=2, ensure_ascii=False)

        print(f"Generated {outpath}")

    print(f"Done. {COUNT} twins written to {OUT_DIR}/")

if __name__ == "__main__":
    generate()
