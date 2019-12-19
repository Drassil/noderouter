FROM node:12-slim

WORKDIR /usr/src/service
COPY . .

ENV NR_HOSTS_FILE=src/conf/hosts.json

CMD [ "npm","run","start:client"]

