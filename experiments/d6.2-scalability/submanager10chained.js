/**
 * Subfleet Manager
 * - Subscribes to MQTT topic
 * - Parses incoming Ditto-style digital twin JSON
 * - If proxiedBy -> relays message to proxy device via MQTT
 * - Else -> determines docker image & device IP -> invokes Docker Engine API on device
 *
 * Usage:
 *   MQTT_BROKER_URL=mqtt://localhost:1883
 *   SUBSCRIBE_TOPIC=devices/ditto/+/twin
 *   DOCKER_PORT=2375
 *   RELAY_TOPIC_PREFIX=devices
 *
 *   node subfleet-manager.js
 */

import mqtt from "mqtt";
import { v4 as uuidv4 } from 'uuid';
import Docker from "dockerode";
import dotenv from "dotenv";
dotenv.config();

import process from 'process';

import { logTimestamp } from "./TimestampLogger.js";


// ---------- Configuration (env / defaults) ----------
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://broker.hivemq.com:1883"; //"test.mosquitto.org:1883"
const MQTT_CLIENT_ID = process.env.MQTT_CLIENT_ID || `subfleet-${uuidv4()}`;
const SUBSCRIBE_TOPIC = process.env.SUBSCRIBE_TOPIC || "no.sintef.sct.giot.things/downstream"//"devices/ditto/+/twin"; // wildcard example
const NAMESPACE_PREFIX = process.env.NAMESPACE_PREFIX || "no.sintef.sct.giot:";
const HOST_NAME = process.env.HOST_NAME || "DEFAULT_HOST_NAME";
const DOCKER_PORT = process.env.DOCKER_PORT || 2375;
//const OPERATION_TIMEOUT = Number(process.env.OPERATION_TIMEOUT || 120000); // ms
//const ALLOW_INSECURE_DOCKER = process.env.ALLOW_INSECURE_DOCKER === "true"; // if using http (default), true
const LOG_PREFIX = "[Subfleet]";

let relay_client = null;

// ---------- Utility helpers ----------
function log(...args) {
  console.log(new Date().toISOString(), LOG_PREFIX, ...args);
}

function warn(...args) {
  console.warn(new Date().toISOString(), LOG_PREFIX, "WARN", ...args);
}

function err(...args) {
  console.error(new Date().toISOString(), LOG_PREFIX, "ERROR", ...args);
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

// Try to extract proxiedBy if present. Accepts:
function extractProxiedBy(doc) {

  //log("document", doc)

  log("target device", doc?._thingId)
  //log("proxied by device", doc?._attributes?.proxiedBy?.thingId )
  //log("current host", HOST_NAME)
  log("current device", NAMESPACE_PREFIX + HOST_NAME)

  //if (doc?._attributes?.proxiedBy?.thingId == (NAMESPACE_PREFIX + HOST_NAME)) {

  //  log("This is the target proxy, not relaying any further")
  //  return null;
  //}

  if (doc?._attributes?.proxiedBy?.thingId && doc?._attributes?.proxiedBy?.ipAddress) {
    return {
      thingId: doc._attributes.proxiedBy.thingId,
      ipAddress: doc._attributes.proxiedBy.ipAddress,
    };
  }

  // Some plausible locations for the property
  /* const candidates = [
    doc?._attributes.proxiedBy,
    doc?.metadata?.proxiedBy,
    doc?.twin?.proxiedBy,
    doc?.features?.proxiedBy,
    doc?.desired?.proxiedBy,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object" && c.deviceId && c.ipAddress) {
      return {
        deviceId: c.deviceId,
        ipAddress: c.ipAddress,
      };
    }
  } */
  return null;
}

// Try to extract device id and device ip (for direct install path)
function extractDeviceInfo(doc) {
  //log("device", doc)


  return {
    thingId: doc?._thingId,
    ipAddress: doc?._attributes?.ipAddress,
  };


  //const candidates = [
  //  doc?.deviceId && { deviceId: doc.deviceId, ip: doc.ip },
  //  doc?.identity && (doc.identity.deviceId || doc.identity.id) && { deviceId: doc.identity.deviceId || doc.identity.id, ip: doc.identity.ip || doc.identity.address },
  //  doc?.twin?.identity && { deviceId: doc.twin.identity.deviceId || doc.twin.identity.id, ip: doc.twin.identity.ip || doc.twin.identity.address },
  //  doc?.metadata && doc.metadata.deviceId && { deviceId: doc.metadata.deviceId, ip: doc.metadata.ip },
  //].filter(Boolean);
  //if (candidates.length) return candidates[0];
  return null;
}

// Try to extract container spec: image (with tag optional), name, env, config
function extractContainerSpec(doc) {
  //log("device", doc)

  if (doc?._features?.cyber?._desiredProperties?.trustAgent) {
    return doc._features.cyber._desiredProperties.trustAgent;
  }
  return null
  // Look in several plausible places in a Ditto-style twin:
  //const candidatePaths = [
  //  doc?.software,
  //  doc?.desired?.software,
  //  doc?.twin?.desired?.software,
  //  doc?.config?.software,
  //  doc?.features?.software,
  //  doc?.spec?.software,
  //  doc?.properties?.software,
  //];

  // for (const p of candidatePaths) {
  //   if (!p) continue;
  //   // Accept either full image string, or name+version, or fix-url
  //   const image = p?.image || p?.imageName || p?.imageUrl || p?.dockerImage;
  //   const name = p?.name || p?.imageName;
  //   const version = p?.version || p?.tag || p?.softwareVersion;
  //   const fixUrl = p?.fixUrl || p?.downloadUrl || p?.softwareFixUrl;

  //   if (image) {
  //     return {
  //       image: image,
  //       containerName: p.containerName || p?.name || `container-${uuidv4().slice(0, 8)}`,
  //       env: p.env || [],
  //       config: p.config || {},
  //     };
  //   }

  //   if (name && version) {
  //     return {
  //       image: `${name}:${version}`,
  //       containerName: p.containerName || name.replace(/[/:]/g, "_"),
  //       env: p.env || [],
  //       config: p.config || {},
  //     };
  //   }

  //   // Some messages use a fix-url pointing to a registry path (e.g. docker hub repo)
  //   if (fixUrl && (fixUrl.includes("docker") || fixUrl.includes("registry") || fixUrl.includes(".tar"))) {
  //     // if it's a tarball or registry reference, we'll attempt to use it as image (best effort)
  //     return {
  //       image: fixUrl,
  //       containerName: p.containerName || `container-${uuidv4().slice(0, 8)}`,
  //       env: p.env || [],
  //       config: p.config || {},
  //     };
  //   }
  //}

  // fallback: look for any "image" anywhere in document
  //const flatImage = findKeyRecursive(doc, "image");
  //if (typeof flatImage === "string") {
  //  return {
  //    image: flatImage,
  //    containerName: `container-${uuidv4().slice(0, 8)}`,
  //    env: [],
  //    config: {},
  //  };
  //}

  //return null;
}

//function findKeyRecursive(obj, key) {
//  if (!obj || typeof obj !== "object") return undefined;
//  if (key in obj) return obj[key];
//  for (const k of Object.keys(obj)) {
//    const val = obj[k];
//    if (typeof val === "object") {
//      const found = findKeyRecursive(val, key);
//      if (found !== undefined) return found;
//    }
//  }
//  return undefined;
//}

// ----------- One Docker Engine function ---------
/**
 * Deploys a container to a remote device running Docker Engine.
 * 
 * Steps:
 *  1. Connect to Docker Engine on target device.
 *  2. Check if a container with the same name exists.
 *  3. If yes, stop and remove it.
 *  4. Pull the desired image.
 *  5. Create and start a new container with the given configuration.
 * 
 * @param {string} deviceIp - IP address of the device running Docker Engine
 * @param {Object} containerInfo - Info about container to deploy
 * @param {string} containerInfo.name - Name of the container
 * @param {string} containerInfo.image - Docker image (e.g. "nginx:latest")
 * @param {Array<string>} [containerInfo.cmd] - Command/entrypoint arguments
 * @param {Array<string>} [containerInfo.env] - Environment variables ["KEY=value"]
 * @param {Object} [containerInfo.hostConfig] - Docker HostConfig options
 */
async function deployContainerToDevice(deviceIp, containerInfo) {



  logTimestamp({
    workflowId: "wf001",
    step: "deployContainerToDevice",
    event: "start"
  });

  const {
    name = "trust-agent",
    container_image,
    container_version,
    cmd = [],
    env = [],
    hostConfig = {},
  } = containerInfo;

  if (!deviceIp || !container_image || !container_version) {
    throw new Error("deviceIp, containerInfo.name, containerInfo.image, and containerInfo.version are required");
  }

  const docker = new Docker({
    host: deviceIp,
    port: 2375, // Adjust if using another port or TLS
    timeout: 120000,
  });

  console.log(`[Subfleet] Connecting to Docker Engine on ${deviceIp}`);

  // 1. Check for existing container
  const containers = await docker.listContainers({ all: true });
  const existing = containers.find(c => c.Names.includes(`/${name}`));

  if (existing) {
    console.log(`[Subfleet] Found existing container "${name}" (${existing.Id}), stopping it...`);
    try {
      const oldContainer = docker.getContainer(existing.Id);
      await oldContainer.stop({ t: 10 }).catch(() => { });
      await oldContainer.remove({ force: true });
      console.log(`[Subfleet] Old container "${name}" removed.`);
    } catch (err) {
      console.warn(`[Subfleet] Warning: could not remove container "${name}":`, err.message);
    }
  }

  // 2. Pull the image if not available
  /* console.log(`[Subfleet] Pulling image ${image}...`);
  await new Promise((resolve, reject) => {
    docker.pull(image, (err, stream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, onFinished, onProgress);
 
      function onFinished(err) {
        if (err) reject(err);
        else resolve();
      }
 
      function onProgress(event) {
        if (event.status) {
          process.stdout.write(`\rPulling ${image}: ${event.status} ${event.progress || ""}   `);
        }
      }
    });
  });
  console.log(`\n[Subfleet] Image ${image} pulled successfully.`); */

  // 3. Create new container
  console.log(`[Subfleet] Creating new container "${name}"`);
  const newContainer = await docker.createContainer({
    name,
    Image: container_image + ":" + container_version,
    Cmd: cmd.length ? cmd : undefined,
    Env: env.length ? env : undefined,
    HostConfig: hostConfig,
  });

  // 4. Start the container
  await newContainer.start();
  console.log(`[Subfleet] Container "${name}" started successfully on ${deviceIp}`);

  logTimestamp({
    workflowId: "wf001",
    step: "deployContainerToDevice",
    event: "finish"
  });



  return newContainer.id;
}

// ---------- Docker Engine API helpers ----------
function dockerBaseURLForDevice(ip) {
  // default to HTTP; if you require TLS, change accordingly
  return `http://${ip}:${DOCKER_PORT}`;
}

// async function pullImageOnDevice(deviceIp, image) {
//   const baseURL = dockerBaseURLForDevice(deviceIp);
//   log(`pullImageOnDevice: ${image} on ${deviceIp}`);
//   const client = axios.create({ baseURL, timeout: OPERATION_TIMEOUT });

//   // image might include tag already; Docker API expects ?fromImage=name&tag=tag (split)
//   let name = image;
//   let tag = "latest";
//   if (image.includes(":") && !image.includes("://")) {
//     const lastColon = image.lastIndexOf(":");
//     name = image.substring(0, lastColon);
//     tag = image.substring(lastColon + 1);
//   }

//   const url = `/images/create?fromImage=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`;
//   const resp = await client.post(url, null, { responseType: "stream" });

//   // collect stream log (optional) and return success when finished
//   return new Promise((resolve, reject) => {
//     resp.data.on("data", (chunk) => {
//       // optionally parse progress
//       // console.log(chunk.toString());
//     });
//     resp.data.on("end", () => {
//       resolve(true);
//     });
//     resp.data.on("error", (e) => reject(e));
//   });
// }

// async function createOrGetContainer(deviceIp, image, containerName, config = {}) {
//   const baseURL = dockerBaseURLForDevice(deviceIp);
//   const client = axios.create({ baseURL, timeout: OPERATION_TIMEOUT });

//   // Check existing containers by name
//   try {
//     const listResp = await client.get(`/containers/json?all=true&filters=${encodeURIComponent(JSON.stringify({ name: [containerName] }))}`);
//     const containers = listResp.data;
//     if (containers && containers.length > 0) {
//       // Return first container id
//       return containers[0].Id || containers[0].Id;
//     }
//   } catch (e) {
//     // continue to attempt create
//     // but log
//     warn("Failed to list containers on device", deviceIp, e.message || e);
//   }

//   // create container
//   const createBody = {
//     Image: image,
//     name: containerName,
//     Env: Array.isArray(config.env) ? config.env : undefined,
//     HostConfig: config.hostConfig || {},
//     Cmd: config.cmd || undefined,
//     ...((config.extra) ? config.extra : {}),
//   };

//   // remove undefined keys (Docker API strict)
//   const cleansed = JSON.parse(JSON.stringify(createBody, (k, v) => (v === undefined ? undefined : v)));

//   const createResp = await client.post("/containers/create", cleansed);
//   return createResp.data?.Id || createResp.data?.Id;
// }

// async function startContainer(deviceIp, containerId) {
//   const baseURL = dockerBaseURLForDevice(deviceIp);
//   const client = axios.create({ baseURL, timeout: OPERATION_TIMEOUT });

//   // Start
//   await client.post(`/containers/${containerId}/start`);
//   return true;
// }

// High-level operation: ensure image pulled, container created and running
// async function ensureContainerRunningOnDevice(deviceIp, containerSpec) {
//   const { container_image, containerName, env = [], config = {} } = containerSpec;
//   if (!deviceIp) throw new Error("Device IP is missing");
//   if (!container_image) throw new Error("Image not specified in container spec");

//   //log(`Ensuring image '${container_image}' is present on device ${deviceIp}`);
//   //await pullImageOnDevice(deviceIp, image).catch((e) => {
//   //  throw new Error(`Failed to pull image ${image} on ${deviceIp}: ${e.message || e}`);
//   //});

//   //log(`Creating or locating container ${containerName} on ${deviceIp}`);
//   //const containerId = await createOrGetContainer(deviceIp, image, containerName, { env, hostConfig: config.hostConfig, cmd: config.cmd }).catch((e) => {
//   //  throw new Error(`Failed to create container ${containerName} on ${deviceIp}: ${e.message || e}`);
//   //});

//   log(`Starting container ${containerName} (id=${containerId}) on ${deviceIp}`);
//   await startContainer(deviceIp, containerId).catch((e) => {
//     throw new Error(`Failed to start container ${containerId} on ${deviceIp}: ${e.message || e}`);
//   });

//   log(`Container ${containerName} up and running on ${deviceIp}`);
//   return { deviceIp, containerName, containerId };
// }

// ---------- MQTT client and main flow ----------
const client = mqtt.connect(MQTT_BROKER_URL, { clientId: MQTT_CLIENT_ID, reconnectPeriod: 5000 });

client.on("connect", () => {
  log("Connected to MQTT broker:", MQTT_BROKER_URL, "subscribing to:", SUBSCRIBE_TOPIC);
  client.subscribe(SUBSCRIBE_TOPIC, { qos: 1 }, (err, granted) => {
    if (err) {
      err("Failed to subscribe", err);
    } else {
      log("Subscribe granted:", JSON.stringify(granted));
    }
  });
});

client.on("error", (e) => {
  err("MQTT client error:", e.message || e);
});

let i = 0;
client.on("message", async (topic, payload) => {

  i++;
  // Get initial CPU usage
  const initialUsage = process.cpuUsage();

  //for (let i = 0; i < 10; i++) {
    console.log("Iteration:", i);


    logTimestamp({
      workflowId: "wf00" + i,
      step: "instantiateAdapter",
      event: "start"
    });

    log("Message received on", topic);
    const raw = payload.toString();
    const doc = safeJsonParse(raw);
    if (!doc) {
      warn("Received non-JSON payload; ignoring");
      return;
    }
    //log("Message:", doc);

    try {
      // 1) check proxiedBy
      const proxied = extractProxiedBy(doc);
      //log("proxiedBy", proxied)
      if (proxied && i<10) {
        // Relay to proxy device on convention topic
        //const proxyTopic = `${RELAY_TOPIC_PREFIX}/${proxied.thingId}/inbox`;
        log(`Relaying message to proxy ${proxied.thingId} at ${proxied.ipAddress}`);

        if (!relay_client) {
          relay_client = mqtt.connect("mqtt://" + proxied.ipAddress + ":1883", { clientId: MQTT_CLIENT_ID, reconnectPeriod: 5000 }); //TODO: replace with proxied.ipAddress
        }

        relay_client.on("connect", () => {
          log("Connected to MQTT broker:", proxied.ipAddress);
        });

        relay_client.on("error", (e) => {
          err("MQTT client error:", e.message || e);
        });

        relay_client.publish(SUBSCRIBE_TOPIC, raw, { qos: 1 }, (err) => {
          if (err) {
            warn("Failed to relay to proxy topic", SUBSCRIBE_TOPIC, err.message || err);
          } else {
            log("Relayed to proxy topic", SUBSCRIBE_TOPIC);
          }
        });
        return;
      }

      // 2) not proxied -> install container on indicated device IP
      const deviceInfo = extractDeviceInfo(doc);
      if (!deviceInfo || !deviceInfo.ipAddress) {
        warn("No proxiedBy and no device IP found in document; cannot act.");
        return;
      }

      const containerSpec = extractContainerSpec(doc);
      if (!containerSpec) {
        warn("No container specification found in the message for device", deviceInfo.thingId || deviceInfo.ipAddress);
        return;
      }

      logTimestamp({
        workflowId: "wf001",
        step: "instantiateAdapter",
        event: "finish"
      });

      log(`Will install image=${containerSpec.container_image} on device ${deviceInfo.thingId} (${deviceInfo.ipAddress})`);
      try {

        const res = await deployContainerToDevice(deviceInfo.ipAddress, containerSpec)

        //const res = await ensureContainerRunningOnDevice(deviceInfo.ipAddress, containerSpec);
        log("Installation result:", JSON.stringify(res));
        // Optionally publish success status back to a status topic
        //const statusTopic = `devices/${deviceInfo.deviceId || deviceInfo.ip}/status`;
        //const statusPayload = JSON.stringify({ timestamp: new Date().toISOString(), status: "ok", details: res });
        //client.publish(statusTopic, statusPayload, { qos: 1 }, () => { });
      } catch (e) {
        err("Error while installing container:", e.message || e);
        //const statusTopic = `devices/${deviceInfo.deviceId || deviceInfo.ip}/status`;
        //client.publish(statusTopic, JSON.stringify({ timestamp: new Date().toISOString(), status: "error", error: e.message }), { qos: 1 }, () => { });
      }

    } catch (e) {
      err("Unhandled processing error:", e.message || e);
    }
  //}
  // Get final CPU usage
  const finalUsage = process.cpuUsage(initialUsage);

  // Calculate the difference in CPU time
  const userCpuTime = finalUsage.user / 1000; // Convert microseconds to milliseconds
  const systemCpuTime = finalUsage.system / 1000; // Convert microseconds to milliseconds

  console.log(`CPU Usage Report:`);
  console.log(`User CPU time: ${userCpuTime.toFixed(2)} ms`);
  console.log(`System CPU time: ${systemCpuTime.toFixed(2)} ms`);

  // To get a percentage, you would need to also measure the elapsed time
  // and potentially consider the number of CPU cores.
  // For example:
  const elapsedTime = process.uptime() * 1000; // Convert seconds to milliseconds

  if (elapsedTime > 0) {
    const totalCpuTime = userCpuTime + systemCpuTime;
    const cpuPercentage = (totalCpuTime / elapsedTime) * 100;
    console.log(`Approximate CPU utilization: ${cpuPercentage.toFixed(2)}%`);
  } else {
    console.log("Cannot calculate CPU percentage as elapsed time is zero.");
  }
});

// Graceful shutdown
process.on("SIGINT", () => {
  log("SIGINT received, closing MQTT client.");
  client.end(true, () => {
    log("MQTT client disconnected. Exiting.");
    process.exit(0);
  });
});
