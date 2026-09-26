#!/bin/sh
packages=$(dpkg-query -W -f '{"name":"${binary:Package}","version":"${Version}"},')
packages=[${packages%?}] ## remove trailing comma and add square brackets for json array
#packages={"packages"=[${packages%?}]} ## remove trailing comma
#echo -n $packages | jq -Rsa .
packages=$(echo -n $packages | jq -Rsa .)
#packages="{ \"packages\" : {$packages | jq -Rsa .}}"
packages={\"packages\":$packages} ## this is needed if we want a json object, not an array

echo $packages
