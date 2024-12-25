FROM node:16-alpine AS BUILD_IMAGE

WORKDIR /usr/src/app

COPY ./apps/indexer-coordinator/ ./apps/indexer-coordinator/
COPY ./apps/indexer-admin ./apps/indexer-admin/

WORKDIR /usr/src/app/apps/indexer-coordinator

RUN if [ -z "$(ls -A /usr/src/app/apps/indexer-coordinator/dist 2>/dev/null)" ]; then yarn install && yarn build; else echo "indexer-coordinator/dist is not empty, will not build coordinator"; fi && \
    rm -rf ./dist/indexer-admin node_modules && \
    yarn install --prod --link-duplicates

WORKDIR /usr/src/app/apps/indexer-admin

RUN if [ -z "$(ls -A /usr/src/app/apps/indexer-admin/build 2>/dev/null)" ]; then yarn install && yarn build; else echo "indexer-admin/build is not empty, will not build admin"; fi

# If this step fails, please use the following parameters to run yarn build.
# RUN if [ -z "$(ls -A /usr/src/app/apps/indexer-admin/build 2>/dev/null)" ]; then yarn install && NODE_OPTIONS="--max-old-space-size=4096" yarn build; else echo "indexer-admin/build is not empty, will not build admin"; fi

FROM node:16-alpine

# Find the installed docker-compose and store its path
RUN apk add --no-cache curl docker-compose grep && \
    DOCKER_COMPOSE_PATH=$(find / -name docker-compose -print -quit) && \
    ln -s $DOCKER_COMPOSE_PATH /usr/local/bin/docker-compose

WORKDIR /usr/src/app

# Copy from build image
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-coordinator/package.json ./package.json
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-coordinator/dist ./dist
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-coordinator/node_modules ./node_modules
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-admin/build ./dist/indexer-admin

ENTRYPOINT [ "node", "dist/main.js" ]
