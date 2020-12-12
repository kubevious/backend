#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

cd src
rm -rf node_modules/
npm install
npm install --only=dev
npm update @kubevious/helpers @kubevious/easy-data-store kubevious-kubik websocket-subscription-server @kubevious/worldvious-client the-lodash the-logger the-promise
