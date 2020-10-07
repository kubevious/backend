#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

docker build \
    -f Dockerfile \
    -t kubevious-backend \
    .

echo "*** RUN WITH:"
echo "    $ ./run-docker.sh"

