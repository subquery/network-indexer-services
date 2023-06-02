FROM node:16 AS BUILD_IMAGE

# install node-prune
RUN curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | bash -s -- -b /usr/local/bin

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn --network-timeout 600000 --frozen-lockfile

COPY . .

RUN yarn build

# remove development dependencies
RUN npm prune --production

FROM node:16-alpine

RUN apk add --no-cache curl docker-cli docker-compose grep

WORKDIR /usr/src/app

# copy from build image
COPY --from=BUILD_IMAGE /usr/src/app/dist ./dist
COPY --from=BUILD_IMAGE /usr/src/app/node_modules ./node_modules
COPY --from=BUILD_IMAGE /usr/src/app/package.json package.json


ENTRYPOINT [ "node", "dist/main.js" ]
