#!/bin/sh
set -ex

ipfs_bootstrap=$(ipfs bootstrap list)

if echo "$ipfs_bootstrap" | grep -q "subquery.network"; then
  echo "There are already one or more subquery.network bootstrap nodes, skipping..."
else
  ipfs bootstrap add /dns4/ipfs-swarm.subquery.network/tcp/19988/p2p/12D3KooWHEEjciF2JmDukCkWW93tQ7eJYs16PWqEo81GrXz82DUL
  ipfs bootstrap add /dns4/ipfs-swarm-a-lh.subquery.network/tcp/19988/p2p/12D3KooWForH2nsSRN5cynPhoona6re1nw2EcimQJxHnicd1yqUV
  ipfs bootstrap add /dns4/ipfs-swarm-b-lh.subquery.network/tcp/19988/p2p/12D3KooWPhsrviSKFTKawpW3bRAdLZ89jhXdYuszAys4YwL3RMn3
fi
