FROM node:16-alpine AS BUILD_IMAGE

WORKDIR /usr/src/app

COPY ./apps/indexer-coordinator/ ./apps/indexer-coordinator/

# prune by reinstall producetion dependencies.
WORKDIR /usr/src/app/apps/indexer-coordinator

RUN yarn install
RUN yarn run build

RUN rm -rf node_modules
RUN yarn install --prod --link-duplicates


FROM node:16-alpine

RUN apk add --no-cache curl docker-cli docker-compose grep

# Find the installed docker-compose and store its path
RUN DOCKER_COMPOSE_PATH=$(find / -name docker-compose -print -quit) \
    && ln -s $DOCKER_COMPOSE_PATH /usr/local/bin/docker-compose

WORKDIR /usr/src/app

# Copy from build image
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-coordinator/package.json ./package.json
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-coordinator/dist ./dist
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-coordinator/node_modules ./node_modules

# please build indexer-admin first
COPY ./apps/indexer-admin/build ./dist/indexer-admin

ENTRYPOINT [ "node", "dist/main.js" ]
