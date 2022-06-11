#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd ${MY_DIR}

export SERVER_PORT=4002
export CONTAINER_NAME=kubevious-backend
export NETWORK_NAME=kubevious
export IMAGE_NAME=kubevious-backend

export COLLECTOR_BASE_URL=http://localhost:4003
export PARSER_BASE_URL=http://localhost:4004
export GUARD_BASE_URL=http://localhost:4005

source ../dependencies.git/runtime-configuration.sh
source ../dependencies.git/worldvious/configuration.sh