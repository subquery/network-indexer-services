FROM node:16-alpine AS BUILD_IMAGE

RUN apk update && apk add --no-cache yarn curl bash tini git docker-cli docker-compose grep make python3 g++

# install node-prune
RUN curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | bash -s -- -b /usr/local/bin

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn --frozen-lockfile

COPY . .

RUN yarn build

# remove development dependencies
RUN npm prune --production

FROM node:16-alpine

WORKDIR /usr/src/app

# copy from build image
COPY --from=BUILD_IMAGE /usr/src/app/dist ./dist
COPY --from=BUILD_IMAGE /usr/src/app/node_modules ./node_modules


CMD [ "node", "dist/main.js" ]
