# Monitoring agent for Eclipse Ditto to be deployed at devices

Docker-ised monitoring agent built on top of Telegraf

# To build a new image

`docker image build --tag rdautov/ditto-monitoring-agent:arm64 --platform linux/arm64 --build-arg VERSION=0.1 .`

# To run the trust agent (public Mosquitto broker tcp://test.mosquitto.org:1883)

`docker run --restart always --name ditto-monitoring-agent -v ./telegraf-nodpkg.conf:/etc/telegraf/telegraf.conf:ro -h=$HOSTNAME -v /var/run/docker.sock:/var/run/docker.sock:ro -v /:/hostfs:ro -e IP_ADDRESS=$(ifconfig | grep 192.168 | awk '{print $2}') -e SYSTEM_VERSION="$(lsb_release -rs)" -e SYSTEM_NAME="$(lsb_release -is)" -e SYSTEM_DESCRIPTION="$(lsb_release -ds)" -e HOST_ETC=/hostfs/etc -e HOST_PROC=/hostfs/proc -e HOST_SYS=/hostfs/sys -e HOST_VAR=/hostfs/var -e HOST_RUN=/hostfs/run -e HOST_MOUNT_PREFIX=/hostfs -e MQTT_BROKER=test.mosquitto.org:1883 --user telegraf:$(stat -c '%g' /var/run/docker.sock) rdautov/ditto-monitoring-agent:arm64`


`docker run --restart always --name ditto-monitoring-agent -v ./telegraf-nodpkg.conf:/etc/telegraf/telegraf.conf:ro -h="tellu-rpm-gateway-002" -v /var/run/docker.sock:/var/run/docker.sock:ro -v /:/hostfs:ro -e IP_ADDRESS="192.168.32.8" -e SYSTEM_VERSION="$(lsb_release -rs)" -e SYSTEM_NAME="$(lsb_release -is)" -e SYSTEM_DESCRIPTION="$(lsb_release -ds)" -e HOST_ETC=/hostfs/etc -e HOST_PROC=/hostfs/proc -e HOST_SYS=/hostfs/sys -e HOST_VAR=/hostfs/var -e HOST_RUN=/hostfs/run -e HOST_MOUNT_PREFIX=/hostfs -e MQTT_BROKER=test.mosquitto.org:1883 --user telegraf:$(stat -c '%g' /var/run/docker.sock) rdautov/ditto-monitoring-agent:arm64`

`docker stop ditto-monitoring-agent`

# To run the trust agent together with a local Mosquitto broker container 

`docker run -it -p 1883:1883 -v ./mosquitto.conf:/mosquitto/config/mosquitto.conf eclipse-mosquitto -d`


`docker-compose up -d`

# TELLU demo for the review

`docker run --restart always --name ditto-monitoring-agent -v ./telegraf-nodpkg.conf:/etc/telegraf/telegraf.conf:ro -h=tellu-rpm-gateway-001 -v /var/run/docker.sock:/var/run/docker.sock:ro -v /:/hostfs:ro -e IP_ADDRESS=$(ifconfig | grep 192.168 | awk '{print $2}') -e SYSTEM_VERSION="$(lsb_release -rs)" -e SYSTEM_NAME="$(lsb_release -is)" -e SYSTEM_DESCRIPTION="$(lsb_release -ds)" -e HOST_ETC=/hostfs/etc -e HOST_PROC=/hostfs/proc -e HOST_SYS=/hostfs/sys -e HOST_VAR=/hostfs/var -e HOST_RUN=/hostfs/run -e HOST_MOUNT_PREFIX=/hostfs -e MQTT_BROKER=broker.hivemq.com:1883 --user telegraf:$(stat -c '%g' /var/run/docker.sock) rdautov/ditto-monitoring-agent:arm64`

`docker stop ditto-monitoring-agent`

`docker rm ditto-monitoring-agent`

`docker run --restart always --name ditto-monitoring-agent -v ./telegraf-dpkg.conf:/etc/telegraf/telegraf.conf:ro -h=tellu-rpm-gateway-001 -v /var/run/docker.sock:/var/run/docker.sock:ro -v /:/hostfs:ro -e IP_ADDRESS=$(ifconfig | grep 192.168 | awk '{print $2}') -e SYSTEM_VERSION="$(lsb_release -rs)" -e SYSTEM_NAME="$(lsb_release -is)" -e SYSTEM_DESCRIPTION="$(lsb_release -ds)" -e HOST_ETC=/hostfs/etc -e HOST_PROC=/hostfs/proc -e HOST_SYS=/hostfs/sys -e HOST_VAR=/hostfs/var -e HOST_RUN=/hostfs/run -e HOST_MOUNT_PREFIX=/hostfs -e MQTT_BROKER=broker.hivemq.com:1883 --user telegraf:$(stat -c '%g' /var/run/docker.sock) rdautov/ditto-monitoring-agent:arm64`
