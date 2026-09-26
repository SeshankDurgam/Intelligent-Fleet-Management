FROM --platform=linux/arm/v7 telegraf
# FROM telegraf:alpine

## Necessary installs for Alpine
# RUN apk update && apk add dpkg nano

RUN apt-get update && apt-get install -y dpkg jq 

## VOLUME /var/run/docker.sock:/var/run/docker.sock
COPY telegraf.conf /etc/telegraf/telegraf.conf
# ADD geoip /etc/telegraf/geoip
# COPY --chmod=777 geoip/geoip /etc/telegraf/geoip/geoip
# COPY --chmod=777 geoip/geoip.conf /etc/telegraf/geoip/geoip.conf
# COPY --chmod=777 geoip/GeoLite2-City.mmdb /etc/telegraf/geoip/GeoLite2-City.mmdb
COPY dpkg/dpkg.sh /etc/telegraf/dpkg.sh

## ENTRYPOINT [ "/bin/telegraf" ]
## ENTRYPOINT ["/usr/bin/telegraf"]