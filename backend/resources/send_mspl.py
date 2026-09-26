#!/usr/bin/python

import os
import paho.mqtt.client as mqtt

client = mqtt.Client("send_mspl")
client.connect(host="broker.hivemq.com", port=1883)

script_dir = os.path.dirname(__file__) #<-- absolute dir the script is in
abs_file_path = os.path.join(script_dir, "mspl-telegraf.xml")

f = open(abs_file_path)
string = f.read()
byteArray = bytes(string,  encoding='utf-8')
client.publish("no.sintef.sct.giot.things/mspl-update", payload=byteArray, qos=0, retain=False)

print("MESSAGE SENT")