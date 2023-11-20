FROM node:16-alpine AS BUILD_IMAGE

WORKDIR /usr/src/app

COPY ./apps/indexer-coordinator/ ./apps/indexer-coordinator/
COPY ./apps/indexer-admin ./apps/indexer-admin/

WORKDIR /usr/src/app/apps/indexer-coordinator

RUN if [ -z "$(ls -A /usr/src/app/apps/indexer-coordinator/dist)" ]; then yarn install && yarn build; else echo "indexer-coordinator/dist is not empty, will not build coordinator"; fi

RUN rm -rf ./dist/indexer-admin

RUN rm -rf node_modules
RUN yarn install --prod --link-duplicates

WORKDIR /usr/src/app/apps/indexer-admin

RUN if [ -z "$(ls -A /usr/src/app/apps/indexer-admin/build)" ]; then yarn install && yarn build; else echo "indexer-admin/build is not empty, will not build admin"; fi


FROM node:16-alpine

RUN apk add --no-cache curl docker-compose grep

# Find the installed docker-compose and store its path
RUN DOCKER_COMPOSE_PATH=$(find / -name docker-compose -print -quit) \
    && ln -s $DOCKER_COMPOSE_PATH /usr/local/bin/docker-compose

WORKDIR /usr/src/app

# Copy from build image
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-coordinator/package.json ./package.json
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-coordinator/dist ./dist
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-coordinator/node_modules ./node_modules
COPY --from=BUILD_IMAGE /usr/src/app/apps/indexer-admin/build ./dist/indexer-admin

ENTRYPOINT [ "node", "dist/main.js" ]
