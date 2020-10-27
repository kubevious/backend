#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

export LOG_TO_FILE=true
export NODE_ENV=development
# export DEBUG=express:*
#  --max_old_space_size=2048
export MYSQL_HOST=localhost
export MYSQL_PORT=4033
export MYSQL_USER=root
export MYSQL_PASS=
export MYSQL_DB=kubevious

export WORLDVIOUS_URL=https://api.kubevious.io/api/v1/oss
export WORLDVIOUS_ID=00000000-0000-0000-0000-000000000000
                     
export WORLDVIOUS_VERSION_CHECK_TIMEOUT=5
export WORLDVIOUS_COUNTERS_REPORT_TIMEOUT=6
export WORLDVIOUS_METRICS_REPORT_TIMEOUT=6
export WORLDVIOUS_ERROR_REPORT_TIMEOUT=7

node src/