#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

source configuration.sh

#  --no-cache --progress=plain 
docker build \
    -t ${IMAGE_NAME_UBI} \
    -m 4000m \
    --progress=plain \
    -f Dockerfile.ubi \
    .

echo "*** RUN WITH:"
echo "    $ ./run-docker-ubi.sh"
