---
permalink: /
---

# Noderouter

Noderouter is an HTTP/TCP programmable proxy application that can be used as library and as a standalone software.

**Features:**

- completely written in nodejs without any external dependency to be secure and lightning fast!
- integrated service-discovery mechanism
- TCP tunneling useful for passthrough SSL connections
- integrated DNS to redirect specific traffic on internet
- supports both HTTP and HTTPS proxy
- supports path-based routing
- can run inside docker

Noderouter can be used to trasparently tunneling any kind of traffic based on TCP and HTTP[S].

A common usage of noderouter is the redirection of traffic based on url rules to different
local or remote address. In this way you can have several applications with different ports
using noderouter ports as gateway.

Noderouter integrates a DNS to eventually redirect traffic outside, it's particulary useful
when you've a microservice architecture but you need to test only some service locally
while the others will be resolved by the DNS.

Example:

<img src="https://docs.google.com/drawings/d/e/2PACX-1vTIHiqDQgWAQ33h1tA_bkVUkILSZj4156PMkDv5T1tbXKDOOZcRtD5fTUUwS0RthQpQbjolV8uwfoBw/pub?w=944&amp;h=470">

## Getting started

### Install

#### with npm

**Global installation:**

```
npm install -g @acore/noderouter
```

NOTE: You can also install Noderouter as a dependency of your project (`npm install @acore/noderouter`) and programmatically include the Router and/or the Client inside your application.

#### With git

```
git clone https://github.com/azerothcore/noderouter.git && cd noderouter
```


#### With docker

```
docker pull @acore/noderouter
```

NOTE: you can pull the image so you can use it later or directly run it

### Hosts file

There are several way to configure the noderouter.
Basically, the node router exposes an http api with the `/register` and `/unregister` actions.
These actions can be used to register a **proxy/tunnel** passing a json string to configure them and managing the **TTL** (see documentation for more info)

However, the integrated noderouter client simplifies this process for you so you only need to create a proper json file for your hosts

Host.json file example:

```
{
  "noderouter": {
    "hosts": [
      {
        "connType": 4,
        "srcHost": "www.myfirstdomain.com",
        "dstHost": "localhost",
        "dstPort": 60000,
        "timeToLive": 300000
      },
      {
        "connType": 1,
        "srcHost": "www.myseconddomain.com",
        "dstHost": "localhost",
        "dstPort": 60001,
        "srcPath": "/from/this/path",
        "dstPath": "/to/this/other/path,
        "timeToLive": 300000
      }
    ],
    "options": {
      "enable": true,
      "routerHost": "localhost",
      "httpsApi": false,
      "logOpts": {
        "debug": true
      }
    }
  }
}
```

### Run

#### With npm

if you installed with -g flag then you can run it with the following command

```
noderouter --hosts hosts.json
```

The commands above runs both the router and the client at the same time to register hosts defined inside your hosts.json.
You can avoid the **--hosts** option if you're going to implement your own client.

Run this command: `noderouter --help`

for the complete list of available options:

```
Usage: noderouter [OPTIONS]
Options:
  -h, --help : show help information
  -f, --hosts    : run the client with an host.json file, if not specified no hosts will be registered now
  --apiPort  : set the listening port for noderouter API
  --httpPort : set the listening port for the http proxy
  --tslPort  : set the listening port for the TSL proxy
  --apiSSL   : specify if the API is behind SSL
```

#### With git

If you've cloned the repo with git clone then you can "cd" inside that folder and use npm to run noderouter with several strategies.
For example:

```
npm run start:router -- --hosts hosts.json
```

The command above works in the same way of `noderouter --hosts hosts.json` command showed inside the previous pharagraph

you can run `npm run` for the entire list of npm scripts or just take a look at package.json file

NOTE: you can use `yarn run` in the same way

#### With docker

If you've downloaded the git repo then there are several `npm run` commands to run the router and the client inside a docker container using docker-composer

To run it directly with docker run you  can use the following command:

```docker run @azerothcore/noderouter``` 

However, you must open ports and set the correct environment variables. Check docker run documentation for it: `https://docs.docker.com/engine/reference/run/`

You can check the environment variable available here:

[.env.dist-client](https://github.com/azerothcore/noderouter/blob/master/.env.dist-client)

[.env.dist-router](https://github.com/azerothcore/noderouter/blob/master/.env.dist-router)

In alternative, you can configure your docker-compose with the noderouter image from the docker hub.

## Documentation

- [JSDOC documentation](jsdoc/)

- [test coverage](coverage/lcov-report)

### Host object

The hosts array that you can write inside the hosts.json or that you can pass to the API endpoints is composed
by the following properties:

```
- {number} connType            : type of connection, see "Connection types enum"
- {string} srcHost             : source host
- {string} dstHost             : destination host
- {number} dstPort             : destination port
- {string} signature           : the client signature is an unique string to identify your client in the router registry. 
If you use our integrated client this parameter is optional and the signature will be automatically generated based on host information.
- {optional string} srcPath    : source path. It supports a regex matching rule
- {optional string} dstPath    : destination path. It supports a regex matching rule
- {optional number} timeToLive : TTL for renew the registration. If you put a value > 0 your client needs to refresh the connection before that the TTL expires
```

### Connection types enum

```
  CONN_TYPE: {
    /** define an http -> service (http) proxy with path support */
    HTTP_HTTP_PROXY: 1,
    /** define a tls -> https -> service (on https) proxy with path support */
    HTTPS_HTTPS_PROXY: 2,
    /** define a tls -> https -> service (on http) proxy with path support */
    HTTPS_HTTP_PROXY: 3,
    /** define a tls -> service a TCP tunnel with TLS, SNI & SSL
     *  Passthrough support, but no proxy path possible */
    TLS_TUNNEL: 4,
  }
```

### API endpoints

The router has its own API so you can create your own client in any language you want or just reuse the noderouter internal one programmatically.

#### POST /register & /unregister

For both /register and /unregister endpoints you need to send a POST request with the information that we showed inside the `hosts file` section

For instance, to register/unregister an host you can also use curl:

```
curl --header "Content-Type: application/json" \
     --request POST \
     --data '{"hosts": [{"connType": 4, "srcHost": "www.myfirstdomain.com", "dstHost": "localhost", "dstPort": 60000, "timeToLive": 300000}}' \
     http://localhost:4010/register

curl --header "Content-Type: application/json" \
     --request POST \
     --data '{"hosts": [{"connType": 4, "srcHost": "www.myfirstdomain.com", "dstHost": "localhost", "dstPort": 60000, "timeToLive": 300000}}' \
     http://localhost:4010/unregister
```












