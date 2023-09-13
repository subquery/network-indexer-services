#!/bin/bash

pwd

SCRIPT_DIR="$(dirname "$0")"
cd $SCRIPT_DIR/../../
pwd

yarn install

# no need to run this script any more
