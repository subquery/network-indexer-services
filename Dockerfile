FROM node:16-alpine AS BUILD_IMAGE

RUN apk update && apk add --no-cache curl bash tini git docker-cli docker-compose grep make python3 g++

WORKDIR /usr/src/app

COPY ./apps/indexer-coordinator/package.json ./

RUN npm install -g @microsoft/rush

RUN npm install -g pnpm

COPY . .

RUN rush update

RUN rush build

# prune by reinstall producetion dependencies.
WORKDIR /usr/src/app/apps/indexer-coordinator
RUN rm -rf node_modules
RUN pnpm config set node-linker hoisted
RUN pnpm install -P

FROM node:16-alpine

RUN apk add --no-cache curl docker-cli docker-compose grep

# Find the installed docker-compose and store its path
RUN DOCKER_COMPOSE_PATH=$(find / -name docker-compose -print -quit) \
    && ln -s $DOCKER_COMPOSE_PATH /usr/local/bin/docker-compose

WORKDIR /usr/src/app

# Copy from build image
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-coordinator/package.json ./apps/indexer-coordinator/package.json
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-coordinator/dist ./apps/indexer-coordinator/dist
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-admin/build ./apps/indexer-coordinator/dist/indexer-admin
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-coordinator/node_modules ./apps/indexer-coordinator/node_modules

ENTRYPOINT [ "node", "apps/indexer-coordinator/dist/main.js" ]
