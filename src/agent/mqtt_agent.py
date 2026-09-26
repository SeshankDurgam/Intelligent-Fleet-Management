#!/usr/bin/env python3

import time
import json
import paho.mqtt.client as mqtt
import docker

# MQTT config
device_id = 'no.sintef.sct.giot:raspberry-c444'
username = 'ditto'
password = 'ditto'

broker = 'localhost'
port = 1883
topic = 'things/' + device_id

# Docker engine config 
docker_client = docker.from_env()

def connect_mqtt():
    
    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            print("Connected to MQTT Broker!")
        else:
            print("Failed to connect, return code %d\n", rc)

    client = mqtt.Client(device_id)
    client.username_pw_set(username, password)
    client.on_connect = on_connect
    client.connect(broker, port)
    return client

def publish(client):
    
    while True:
        msg = '{"status": "' + get_trust_agent_status() + '", "version": "' + get_trust_agent_version() + '", "thingId": "' + device_id + '"}'
        result = client.publish(topic, msg)
        # result: [0, 1]
        status = result[0]
        if status == 0:
            print(f"Send heart beat message to topic `{topic}`: " + msg)
        else:
            print(f"Failed to send message to topic {topic}")
        
        # send heart beat every 60 seconds
        time.sleep(60)

def get_trust_agent_status():
    containers = docker_client.containers.list()    
    for container in docker_client.containers.list():
        if (container.name == 'trust-agent'):
            return container.status
    return "nan"

def get_trust_agent_version():
    containers = docker_client.containers.list()    
    for container in docker_client.containers.list():
        if (container.name == 'trust-agent'):
            return container.image.tags[0]
    return "nan"

def run():        

    print(get_trust_agent_status())
    print(get_trust_agent_version())

    client = connect_mqtt()
    client.loop_start()
    publish(client)


if __name__ == '__main__':
    run()
