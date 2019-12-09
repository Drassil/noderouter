FROM node:12-slim

WORKDIR /usr/src/service
COPY . .

CMD [ "npm","run","start:client"]

