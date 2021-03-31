#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR


npm update \
    the-lodash \
    the-logger \
    the-promise \
    @kubevious/helpers \
    @kubevious/easy-data-store \
    @kubevious/helper-backend \
    @kubevious/helper-rule-engine \
    @kubevious/worldvious-client \
    @kubevious/helper-logic-processor \
    @kubevious/websocket-server
