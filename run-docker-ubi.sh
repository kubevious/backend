#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

source configuration.sh

docker run \
    -it \
    --rm \
    --name "${CONTAINER_NAME}" \
    -h ${CONTAINER_NAME} \
    --network ${NETWORK_NAME} \
    -p 4050:4000 \
    -v ${MY_DIR}/docker/Caddyfile:/etc/caddy/Caddyfile \
    -e KUBEVIOUS_VERSION=1.2.3 \
    ${IMAGE_NAME_UBI}