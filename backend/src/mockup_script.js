// server/index.js

import {
  DittoNodeClient,
  NodeWebSocketBasicAuth,
  Thing
} from "sintef-ditto-javascript-client-node";
import WebSocket from "ws";
import mqtt from "mqtt";

import express from "express";

import fs from 'fs';

const PORT = process.env.PORT || 3001;

const app = express();

//MQTT connection config
//const mqtt_host = "localhost";
//const mqtt_port = "1883";
const clientId = "ditto-fleet-mockup";

const connectUrl = process.env.MQTT_BROKER || "mqtt://test.mosquitto.org:1883";
//const downstream_mqtt_topic = "no.sintef.sct.giot.things/downstream";
const upstream_mqtt_topic = "no.sintef.sct.giot.things/upstream";
const request_mqtt_topic = "no.sintef.sct.giot.things/request";

const mqtt_client = mqtt.connect(connectUrl, {
  clientId,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
});

mqtt_client.on("connect", () => {
  console.log("Connected to MQTT broker!");
  const data = fs.readFileSync('../src/resources/upstream_sample.json');
  const twin = JSON.parse(data);
  console.log("TWIN", JSON.stringify(twin))
  mqtt_client.publish(upstream_mqtt_topic, JSON.stringify(twin));
  //mqtt_client.subscribe([upstream_mqtt_topic], () => {
  //  console.log(`Subscribe to topic '${upstream_mqtt_topic}'`);
  //});
});

//mqtt_client.on("message", (topic, payload) => {
//  console.log("Received MQTT message:", topic, payload.toString());
//  updateDeviceTwin(payload.toString());
  //TODO: receive the device twin json and send it to Ditto. Make sure that this does not trigger an event to interfer with the change made via GUI.
//});

/* async function sendDeviceTwin(thingId) {
  const thing = await ditto_client.getThingsHandle().getThing(thingId);
  console.info(JSON.stringify(thing));
  //TODO: send an MQTT message to Hui
  mqtt_client.publish(
    downstream_mqtt_topic,
    JSON.stringify(thing),
    { qos: 0, retain: false },
    (error) => {
      if (error) {
        console.error(error);
      }
    }
  );
}

async function updateDeviceTwin(twin) {
  const thing = Thing.fromObject(twin);  
  await ditto_client.getThingsHandle().putThing(thing);
  //console.info(JSON.stringify(thing));
  //TODO: send an MQTT message to Hui
  //mqtt_client.publish(
  //  downstream_mqtt_topic,
  //  JSON.stringify(thing),
  //  { qos: 0, retain: false },
  //  (error) => {
  //    if (error) {
  //      console.error(error);
  //    }
  //  }
  //);
} */



//app.listen(PORT, () => {
//  console.log(`Server listening on ${PORT}`);
//});
