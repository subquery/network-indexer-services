#!/bin/sh
set -x

addPeers() {
  sleep $1;
  shift;

  ipfs swarm peers | grep -E "(12D3KooWHEEjciF2JmDukCkWW93tQ7eJYs16PWqEo81GrXz82DUL|12D3KooWForH2nsSRN5cynPhoona6re1nw2EcimQJxHnicd1yqUV|12D3KooWPhsrviSKFTKawpW3bRAdLZ89jhXdYuszAys4YwL3RMn3|12D3KooWCFokEyt9gtuQHTwVAzwBsdjsBqfSxq1D3X1FsAbTwaSN)"
  ipfs swarm connect /dns4/ipfs-swarm.subquery.network/tcp/19988/p2p/12D3KooWHEEjciF2JmDukCkWW93tQ7eJYs16PWqEo81GrXz82DUL
  ipfs swarm connect /dns4/ipfs-swarm-a-lh.subquery.network/tcp/19988/p2p/12D3KooWForH2nsSRN5cynPhoona6re1nw2EcimQJxHnicd1yqUV
  ipfs swarm connect /dns4/ipfs-swarm-b-lh.subquery.network/tcp/19988/p2p/12D3KooWPhsrviSKFTKawpW3bRAdLZ89jhXdYuszAys4YwL3RMn3
  ipfs swarm connect /dns4/ipfs-swarm-c-lh.subquery.network/tcp/19988/p2p/12D3KooWCFokEyt9gtuQHTwVAzwBsdjsBqfSxq1D3X1FsAbTwaSN
}

addPeers 10 &
