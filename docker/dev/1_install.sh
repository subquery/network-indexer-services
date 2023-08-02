#!/bin/bash

pwd

SCRIPT_DIR="$(dirname "$0")"
cd $SCRIPT_DIR/../../
pwd

rush update
