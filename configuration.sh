#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd ${MY_DIR}

export SERVER_PORT=4002
export CONTAINER_NAME=kubevious-backend
export NETWORK_NAME=kubevious
export IMAGE_NAME=kubevious-backend

source ../dependencies.git/mysql/runtime-configuration.sh
source ../dependencies.git/redisearch/runtime-configuration.sh
source ../dependencies.git/worldvious/configuration.sh