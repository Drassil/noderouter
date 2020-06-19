FROM node:12-slim

WORKDIR /usr/src/service
COPY . .

ENV DOCKER_CONTAINER=1

RUN npm run postinstall

CMD [ "npm","run","start:router"]

EXPOSE 80 443 60001
