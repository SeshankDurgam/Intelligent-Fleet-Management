#!/usr/bin/python

import paho.mqtt.client as mqtt

client = mqtt.Client("ta_crash")
client.connect(host="test.mosquitto.org", port=1883)

#f = open("mspl.xml")
#string = f.read()
string = '{"fields":{"container_id":"b3c335bcad7974cd7f11349dedc3fe232592f2a398aa90ccb99aa6cef6e762c4","exitcode":0,"finished_at":1700042818463316700,"oomkilled":false,"pid":0,"restart_count":0,"started_at":1699973218715646100,"uptime_ns":69599747670600},"name":"docker_container_status","tags":{"container_image":"rdautov/trust-agent","container_name":"trust-agent","container_status":"crashed","container_version":"0.1","desktop.docker.io/wsl-distro":"Ubuntu-18.04","engine_host":"docker-desktop","host":"tellu-rpm-gateway-002","ip_address":"","metric_source":"docker","origin":"ditto-monitoring-agent","server_version":"24.0.2","source":"b3c335bcad79","system_description":"Ubuntu 18.04.6 LTS","system_name":"Ubuntu","system_version":"18.04"},"timestamp":1701431641}'
byteArray = bytes(string,  encoding='utf-8')
client.publish("ditto-monitoring-agent/tellu-rpm-gateway-002/docker_container_status", payload=byteArray, qos=0, retain=False)

print("MESSAGE SENT")