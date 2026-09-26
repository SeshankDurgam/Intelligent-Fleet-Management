// server/backend.js

import {
  DittoNodeClient,
  NodeWebSocketBasicAuth,
  NodeHttpBasicAuth,
  DefaultSearchOptions,
  Features,
  Thing,
  connectionLostError,
} from "sintef-ditto-javascript-client-node";

import { logger as winston_logger } from "./logger.js";

import WebSocket from "ws";
import mqtt from "mqtt";
import fs from "fs";
import express from "express";
import { DOMParser } from "xmldom";
import { XMLParser, XMLBuilder, XMLValidator } from "fast-xml-parser";

import schedule from "node-schedule";
import _ from "lodash";

import deployment_template from "../resources/deployment_template.json" assert { type: "json" };
import software_template from "../resources/software_template.json" assert { type: "json" };

import { logTimestamp } from "./TimestampLogger.js";

import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 4000;
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://test.mosquitto.org:1883";
const DITTO_SERVER = process.env.DITTO_SERVER || "localhost:8080";

const app = express();

const parser = new XMLParser();

const logger = winston_logger.child({ source: "backend.js" });

//MQTT connection config
const clientId = "ditto-fleet-backend";

const downstream_mqtt_topic = "no.sintef.sct.giot.things/downstream";
const upstream_mqtt_topic = "no.sintef.sct.giot.things/upstream";
const request_mqtt_topic = "no.sintef.sct.giot.things/request";
const monitoring_agent_mqtt_topic = "ditto-monitoring-agent/+/+";
const mspl_topic = "no.sintef.sct.giot.things/mspl-update";
const namespace = "no.sintef.sct.giot";

logger.info("[MQTT] " + MQTT_BROKER);

const mqtt_client = mqtt.connect(MQTT_BROKER, {
  clientId,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
});

mqtt_client.on("connect", () => {
  logger.info("[MQTT] Connected to MQTT broker!");
  mqtt_client.subscribe(
    [
      upstream_mqtt_topic,
      request_mqtt_topic,
      monitoring_agent_mqtt_topic,
      mspl_topic,
    ],
    () => {
      logger.info(
        `[MQTT] Subscribed to topics: '${upstream_mqtt_topic}', '${request_mqtt_topic}', '${monitoring_agent_mqtt_topic}', '${mspl_topic}'`
      );
    }
  );
});

mqtt_client.on("message", (topic, payload) => {
  //logger.debug("[MQTT] Received via " + topic + ": " + payload.toString());
  if (topic === upstream_mqtt_topic) {
    //logger.debug("topic ok")
    //FIXME: this is not how the digital twin is supposed to be updated!
    updateTwinProperties(JSON.parse(payload));
    //TODO: receive the device twin json and send it to Ditto. Make sure that this does not trigger an event to interfer with the change made via GUI.
  }
  if (topic === request_mqtt_topic) {
    //TODO: send all twins at once
    //FIXME: this is not needed anymore?
    getAllDeviceTwins();
  }
  if (topic === mspl_topic) {
    //TODO: parse the MSPL message
    //let mspl = parser.parse(payload.toString());
    //logger.debug(payload.toString());

    const parser = new DOMParser();
    let mspl = parser.parseFromString(payload.toString(), "text/xml");
    logger.debug(mspl.toString());

    let rules = mspl.getElementsByTagName("configuration-rule");
    Array.from(rules).forEach((rule) => {
      //logger.debug('RULE' + rule.toString())
      let actions = rule.getElementsByTagName("configuration-action");
      Array.from(actions).forEach((action) => {
        let type = action.getElementsByTagName("software-protection-type")[0];
        //logger.debug("TYPE" + type.textContent)
        if (type.textContent == "UPDATE") {
          //logger.debug("UPDATE" + action.toString())
          let imageName =
            rule.getElementsByTagName("software-name")[0].textContent;
          let imageVersion = rule.getElementsByTagName(
            "software-fixed-version"
          )[0].textContent;
          let softwareId = imageName.split("/")[1] + "_v" + imageVersion;

          //logger.info(softwareId,imageName,imageVersion)
          //createSoftware(softwareId,imageName,imageVersion)

          let deploymentId = rule.getElementsByTagName("name")[0].textContent;
          let targets = rule.getElementsByTagName("software-version");
          let rql =
            "and(eq(features/cyber/properties/trustAgent/container_image,'" +
            imageName +
            "'),eq(features/cyber/properties/trustAgent/container_version,'" +
            targets[0].textContent +
            "'))";
          //TODO: handle if there is more than one target version

          //logger.debug("RQL: " + rql)

          createDeployment(deploymentId, softwareId, rql);
        }
      });
    });
  }
  if (topic.includes("ditto-monitoring-agent")) {
    logger.debug("[MQTT] Message via topic: " + topic);
    const obj = JSON.parse(payload.toString());
    updateTwinAttribute(obj.tags.host, "ip_address", obj.tags.ip_address);
    updateTwinAttribute(obj.tags.host, "system_name", obj.tags.system_name);
    updateTwinAttribute(
      obj.tags.host,
      "system_version",
      obj.tags.system_version
    );
    updateTwinAttribute(
      obj.tags.host,
      "system_description",
      obj.tags.system_description
    );
    let collected_time = new Date(obj.timestamp * 1000).toLocaleString();
    let received_time = new Date().toLocaleString();
    if (
      topic.endsWith("docker_container_status") ||
      topic.endsWith("procstat_lookup")
    ) {
      //logger.warn("Received from monitoring agent: ");
      //logger.warn(JSON.parse(payload.toString()))
      //const obj = JSON.parse(payload.toString());
      let ta = {};
      if (obj.tags.container_image) {
        logger.debug("Docker-based trust agent found!");
        ta = {
          container_image: obj.tags.container_image,
          container_status: obj.tags.container_status,
          container_version: obj.tags.container_version,
          _collected_time: collected_time,
          _received_time: received_time,
        };
      } /* else if (obj.fields.running === 1) {
        logger.debug("SSH-based trust agent found!");
        ta = {
          process_name: "trust-agent.sh",
          process_status: "running",
          _collected_time: collected_time,
          _received_time: received_time,
        };
      } */
      //logger.warn("Resulting trust agent" + JSON.stringify(ta))
      updateTwinProperty(obj.tags.host, "cyber", "trustAgent", ta);
      //} else if (topic.endsWith("procstat_lookup")) {
      //logger.debug(
      //  "[Monitoring agent] Received procstat_lookup stats: " +
      //    payload.toString()
      //);

      //updateTwinProperty(obj.tags.host, "cyber", "trustAgent", ta);
    } else if (topic.endsWith("docker")) {
      //logger.debug("[Monitoring agent] Received Docker stats: " + payload.toString())
      let docker = {
        engine_host: obj.tags.engine_host,
        server_version: obj.tags.server_version,
        _collected_time: collected_time,
        _received_time: received_time,
      };
      updateTwinProperty(obj.tags.host, "cyber", "docker", docker);
    } else if (topic.endsWith("mem")) {
      //logger.debug("[Monitoring agent] Received memory stats: " + payload.toString());
      let mem = {
        active: obj.fields.usage_guest,
        available: obj.fields.usage_guest_nice,
        available_percent: obj.fields.usage_idle,
        buffered: obj.fields.usage_iowait,
        cached: obj.fields.usage_irq,
        commit_limit: obj.fields.usage_nice,
        committed_as: obj.fields.usage_softirq,
        dirty: obj.fields.usage_steal,
        free: obj.fields.usage_system,
        high_free: obj.fields.high_free,
        high_total: obj.fields.high_total,
        huge_page_size: obj.fields.huge_page_size,
        huge_pages_free: obj.fields.huge_pages_free,
        huge_pages_total: obj.fields.huge_pages_total,
        inactive: obj.fields.inactive,
        low_free: obj.fields.low_free,
        low_total: obj.fields.low_total,
        mapped: obj.fields.mapped,
        page_tables: obj.fields.page_tables,
        shared: obj.fields.shared,
        slab: obj.fields.slab,
        sreclaimable: obj.fields.sreclaimable,
        sunreclaim: obj.fields.sunreclaim,
        swap_cached: obj.fields.swap_cached,
        swap_free: obj.fields.swap_free,
        swap_total: obj.fields.swap_total,
        total: obj.fields.total,
        used: obj.fields.used,
        used_percent: obj.fields.used_percent,
        vmalloc_chunk: obj.fields.vmalloc_chunk,
        vmalloc_total: obj.fields.vmalloc_total,
        vmalloc_used: obj.fields.vmalloc_used,
        write_back: obj.fields.write_back,
        write_back_tmp: obj.fields.write_back_tmp,
        _collected_time: collected_time,
        _received_time: received_time,
      };
      updateTwinProperty(obj.tags.host, "cyber", "memory", mem);
    } else if (topic.endsWith("cpu")) {
      //logger.debug("[Monitroing agent] Received CPU stats: " + payload.toString());
      let cpu = {
        usage_guest: obj.fields.usage_guest,
        usage_guest_nice: obj.fields.usage_guest_nice,
        usage_idle: obj.fields.usage_idle,
        usage_iowait: obj.fields.usage_iowait,
        usage_irq: obj.fields.usage_irq,
        usage_nice: obj.fields.usage_nice,
        usage_softirq: obj.fields.usage_softirq,
        usage_steal: obj.fields.usage_steal,
        usage_system: obj.fields.usage_system,
        usage_user: obj.fields.usage_user,
        _collected_time: collected_time,
        _received_time: received_time,
      };
      updateTwinProperty(obj.tags.host, "cyber", "cpu", cpu);
    } else if (topic.endsWith("disk")) {
      //logger.debug("[Monitoring agent] Received disk stats: " + payload.toString());
      let disk = {
        free: obj.fields.free,
        inodes_free: obj.fields.inodes_free,
        inodes_total: obj.fields.inodes_total,
        inodes_used: obj.fields.inodes_used,
        total: obj.fields.total,
        used: obj.fields.used,
        used_percent: obj.fields.used_percent,
        _collected_time: collected_time,
        _received_time: received_time,
      };
      updateTwinProperty(obj.tags.host, "cyber", "disk", disk);
    } else if (topic.endsWith("temp")) {
      //logger.debug("[Monitoring agent] Received temperature stats: " + payload.toString());
      let temp = {
        sensor: obj.tags.sensor,
        temp: obj.fields.temp,
        _collected_time: collected_time,
        _received_time: received_time,
      };
      updateTwinProperty(obj.tags.host, "physical", "temp", temp);
    } else if (topic.endsWith("internet_speed")) {
      //logger.debug("[Monitoring agent] Received internet_speed stats: " + payload.toString());
      let speed = {
        ip_address: obj.tags.ip_address,
        download: obj.fields.download,
        jitter: obj.fields.jitter,
        latency: obj.fields.latency,
        location: obj.fields.location,
        upload: obj.fields.upload,
        _collected_time: collected_time,
        _received_time: received_time,
      };
      updateTwinProperty(obj.tags.host, "cyber", "internet_speed", speed);
    } else if (topic.endsWith("exec")) {
      //logger.debug("[Monitoring agent] Received exec (packages) stats: " + payload.toString());
      let packages = {
        packages: JSON.parse(obj.fields.packages),
        _collected_time: collected_time,
        _received_time: received_time,
      };
      updateTwinProperty(obj.tags.host, "cyber", "packages", packages);
    }
  }
});

//Ditto connection config
const ditto_username = process.env.DITTO_USERNAME || "ditto";
const ditto_password = process.env.DITTO_PASSWORD || "ditto";

logger.info("[DITTO SERVER] " + DITTO_SERVER);

let socket, ws_ditto_client

try {
  socket = new WebSocket(
    `http://${ditto_username}:${ditto_password}@` + DITTO_SERVER + "/ws/2"
  )
  ws_ditto_client = DittoNodeClient.newWebSocketClient()
    .withoutTls()
    .withDomain(DITTO_SERVER)
    .withAuthProvider(
      NodeWebSocketBasicAuth.newInstance(ditto_username, ditto_password)
    )
    .withBuffer(15)
    .twinChannel()
    .build();
} catch (error) {
  logger.error("WebSocket error: " + error.message);
}

const http_ditto_client = DittoNodeClient.newHttpClient()
  .withoutTls()
  .withDomain(DITTO_SERVER)
  .withAuthProvider(
    NodeHttpBasicAuth.newInstance(ditto_username, ditto_password)
  )
  //.withBuffer(15)
  //.twinChannel()
  .build();

const job = schedule.scheduleJob("*/2 * * * *", checkDesiredReportedTrustAgent);

/** Fully update the digital twin in Ditto (i.e. all its reported properties within features). */
async function updateTwinProperties(twin) {

  logTimestamp({
    workflowId: "wf001",
    step: "updateTwinProperties",
    event: "start"
  });

  let featuresHandle = http_ditto_client.getFeaturesHandle(twin.thingId);
  Object.entries(twin.features).forEach(([key, value]) => {
    logger.debug(JSON.stringify(key));
    logger.debug(JSON.stringify(value.properties));
    featuresHandle.putProperties(key, value.properties);
  });

  logTimestamp({
    workflowId: "wf001",
    step: "updateTwinProperties",
    event: "finish"
  });
}

/** Update the value of a property in Ditto with a value reported from the monitoring agent. */
async function updateTwinProperty(
  thingId,
  feature,
  propertyPath,
  propertyValue
) {
  const thingsHandle = http_ditto_client.getThingsHandle();
  try {
    let thing = await thingsHandle.getThing(namespace + ":" + thingId);
    //logger.debug("Found matching device twin: " + JSON.stringify(thing));
    //logger.error(feature + " -- " + propertyPath + " -- " + propertyValue)
    await http_ditto_client
      .getFeaturesHandle(thing.thingId)
      .putProperty(feature, propertyPath, propertyValue);
  } catch (error) {
    logger.error("UpdateTwinProperty error: " + error.message);
  }
}

/** Update the value of an attribute in Ditto with a value reported from the monitoring agent. */
async function updateTwinAttribute(thingId, attribute, attributeValue) {
  const thingsHandle = http_ditto_client.getThingsHandle();
  try {
    let thing = await thingsHandle.getThing(namespace + ":" + thingId);
    //logger.debug("Found matching device twin: " + JSON.stringify(thing));
    //update the attribute only if different
    //logger.debug(JSON.stringify(thing.attributes));
    //logger.debug(JSON.stringify(thing.attributes[attribute]));
    if (attributeValue !== thing.attributes[attribute]) {
      //logger.debug("TRY");
      await thingsHandle.putAttribute(thing.thingId, attribute, attributeValue);
    }
  } catch (error) {
    logger.error("UpdateTwinAttribute error: " + error.message);
  }
}

/** Fetch a device twin from Ditto and publish it to the downstream MQTT channel.*/
async function sendDeviceTwin(thingId) {

  logTimestamp({
    workflowId: "wf001",
    step: "sendDeviceTwin",
    event: "start"
  });

  const thing = await ws_ditto_client.getThingsHandle().getThing(thingId);
  logger.debug("[Ditto] Device twin: " + JSON.stringify(thing));

  if (thing.attributes.type == "physical_device") {
    mqtt_client.publish(
      downstream_mqtt_topic,
      JSON.stringify(thing),
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          logger.error("sendDeviceTwin error: " + error.message);
        }
      }
    );
    logger.info(
      "Device twin with updated desired properties sent to the downstream channel."
    );
    logTimestamp({
      workflowId: "wf001",
      step: "sendDeviceTwin",
      event: "finish"
    });
  }
}

/** Fetch all device twins from Ditto and publish them to the downstream MQTT channel. */
async function getAllDeviceTwins() {
  //TODO: better structure the code! Use sendDeviceTwin function instead of repeating the same code!
  const searchHandle = http_ditto_client.getSearchHandle();
  var options = DefaultSearchOptions.getInstance()
    .withFilter('eq(attributes/type,"device")')
    .withSort("+thingId")
    .withLimit(0, 200);
  var devices = (await searchHandle.search(options)).items;
  logger.debug("[Ditto] All devices: ", devices);
  devices.forEach((device) => {
    //logger.info(JSON.stringify(device));
    mqtt_client.publish(
      downstream_mqtt_topic,
      JSON.stringify(device),
      { qos: 0, retain: false },
      (error) => {
        if (error) {
          logger.error("GetAllDeviceTwins error: " + error.message);
        }
      }
    );
  });
}

async function checkDesiredReportedTrustAgent() {
  const searchHandle = http_ditto_client.getSearchHandle();

  var options = DefaultSearchOptions.getInstance()
    .withFilter(
      'in(attributes/type,"device","physical_device","virtual_device")'
    )
    .withSort("+thingId")
    .withLimit(0, 200);
  var devices = (await searchHandle.search(options)).items;
  devices.forEach((device) => {
    // iterate through cyber, physical, and social
    //logger.debug("DESIRED VS REPORED" + JSON.stringify(device._features));
    let desiredTrustAgent =
      device._features.cyber._desiredProperties.trustAgent;
    let reportedTrustAgent = device._features.cyber._properties.trustAgent;
    //logger.debug("desiredTrustAgent: " + JSON.stringify(desiredTrustAgent));
    //logger.debug("reportedTrustAgent: " + JSON.stringify(reportedTrustAgent));
    //logger.debug(
    //  JSON.stringify(desiredTrustAgent) === JSON.stringify(reportedTrustAgent)
    //);
    //logger.debug(desiredTrustAgent === reportedTrustAgent);

    //FIXME: check that desied propoerty is not empty! Or maybe it is ok...

    if (desiredTrustAgent) {
      delete desiredTrustAgent.ta_meta;
    }
    if (!_.isMatch(reportedTrustAgent, desiredTrustAgent)) {
      logger.warn(
        device._thingId + ": reported and desired software are not in sync!"
      );
      logger.warn(
        "Reported software: " + JSON.stringify(reportedTrustAgent, null, 2)
      );
      logger.warn(
        "Desired software: " + JSON.stringify(desiredTrustAgent, null, 2)
      );
      sendDeviceTwin(device._thingId);
    }
  });
}

/** Creates new software in Ditto after receiving and parsing an MSPL file */
async function createSoftware(softwareId, imageName, imageVersion) {
  let software = software_template;
  software.thingId = namespace + ":" + softwareId;
  software.attributes.image = imageName;
  software.attributes.version = imageVersion;

  const thingsHandle = http_ditto_client.getThingsHandle();

  let thing = Thing.fromObject(software);
  logger.debug("New software: " + JSON.stringify(software));

  await thingsHandle.putThing(thing).then((result) => {
    logger.info(
      `Finished putting software with result: ${JSON.stringify(result)}`
    );
  });
}

/** Creates a new deployment in Ditto after receiving and parsing an MSPL file */
async function createDeployment(thingId, softwareId, rql) {

  logTimestamp({
    workflowId: "wf001",
    step: "createDeployment",
    event: "start"
  });

  let deployment = deployment_template;
  deployment.thingId = namespace + ":" + thingId;
  deployment.attributes.trust_agent_id = softwareId;
  deployment.attributes.rql_expression = rql;

  let thing = Thing.fromObject(deployment);

  const thingsHandle = http_ditto_client.getThingsHandle();
  await thingsHandle
    .putThing(thing)
    .then((result) =>
      logger.info(
        `Finished putting the new deployment with the result: ${JSON.stringify(
          result
        )}`
      )
    );

  logTimestamp({
    workflowId: "wf001",
    step: "createDeployment",
    event: "finish"
  });
}

socket.onopen = function (event) {
  logger.info("[WebSocket] Connected to Ditto server via WebSocket");
  socket.send("START-SEND-EVENTS");
  logger.info(
    "[WebSocket] Initiating WebSocket communication with START-SEND-EVENTS"
  );

  const events_handle = ws_ditto_client.getEventsHandle();

  try {
    events_handle.requestEvents().then(() => {
      events_handle.subscribeToAllEvents((event) => {
        logger.debug("Message received via Ditto event handler", event.message);
        if (
          event.action === "modified" &&
          //event.path.includes("/features/cyber/desiredProperties/trustAgent")
          event.path.includes("desiredProperties")
        ) {
          const name_array = event.topic.split("/");
          logger.info("Device ID: " + name_array[0] + ":" + name_array[1]);
          logger.info(
            "Desired property changed to: " +
            JSON.stringify(event.value, null, 2)
          );
          sendDeviceTwin(name_array[0] + ":" + name_array[1]);
        }
      });
    });
  } catch (error) {
    logger.error(error.message);
  }
};

socket.onmessage = function (event) {
  logger.debug(
    `[WebSocket] Data received from Ditto via WebSocket: ${event.data}`
  );
};

socket.onclose = function (event) {
  if (event.wasClean) {
    logger.info(
      `[WebSocket] Connection closed cleanly, code=${event.code} reason=${event.reason}`
    );
  } else {
    // e.g. server process killed or network down
    // event.code is usually 1006 in this case
    logger.warn("[WebSocket] Connection died");
  }
};

socket.onerror = function (error) {
  logger.error("WebSocket Eror!" + error.message);
};

app.listen(PORT, () => {
  logger.info("Starting Fleet Manager + Eclipse Ditto backend");
  logger.info(`Server listening on ${PORT}`);
});
