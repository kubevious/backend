#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

./build.sh
RESULT=$?
if [ $RESULT -ne 0 ]; then
  echo "Build failed"
  exit 1;
fi

export NODE_ENV=production
# export DEBUG=express:*
#  --max_old_space_size=2048
export MYSQL_HOST=localhost
export MYSQL_PORT=4033
export MYSQL_USER=root
export MYSQL_PASS=
export MYSQL_DB=kubevious

node .