#!/bin/sh

# Usage:
# - cargo build
# - comment all the `proxy` section in the file `deploy/docker-compose-testnet.yml`
# - modify `secret-key` in the `coordinator` section in the file `deploy/docker-compose-testnet.yml`, the same with `secret-key` below
# - docker-compose -f deploy/docker-compose-testnet.yml up
# - cargo build
# - ./debug_test_proxy.sh


sudo ./target/debug/subql-indexer-proxy \
  --port=80 \
  --auth \
  --network=testnet \
  --jwt-secret=<a random str> \
  --secret-key=<a random str> \
  --coordinator-endpoint=http://localhost:8000 \
  --network-endpoint=https://sepolia.base.org \
  --token-duration=24 \
  --redis-endpoint=redis://localhost:6379 \
  --metrics-token=thisismyAuthtoken
