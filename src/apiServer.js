require("./def/jsdoc");
const http = require("http");
const https = require("https");
const TCPRouter = require("./tcpRouter");
const HTTPRouter = require("./httpRouter");
const ClientInfo = require("./lib/ClientInfo");
const {
  API_PORT,
  TLS_ROUTER_PORT,
  HTTP_ROUTER_PORT,
  CONN_TYPE
} = require("./def/const");

/**
 * Class to create a router service
 */
class ApiServer {
  /**
   * Create Router service
   * @param {Object} options
   * @param {number} [options.apiPort] - Listening port for API service
   * @param {boolean} [options.ssl] - Run API service on SSL connection
   * @param {number} [options.tlsRouterPort] - Exposed port to tunnel TLS connections
   * @param {number} [options.httpRouterPort] - Exposed port to tunnel HTTP connections
   */
  constructor({
    apiPort = API_PORT,
    ssl = false,
    tlsRouterPort = TLS_ROUTER_PORT,
    httpRouterPort = HTTP_ROUTER_PORT
  }) {
    const server = ssl ? https : http;
    this.tcpRouter = new TCPRouter(tlsRouterPort);
    this.httpRouter = new HTTPRouter(httpRouterPort);
    this.httpsRouter = new HTTPRouter(0, true);

    server
      .createServer((req, res) => {
        if (req.method !== "POST") return;

        res.writeHead(200, { "Content-Type": "application/json" });

        switch (req.url) {
          case "/register":
            this.register(req, res);
            break;
          case "/unregister":
            this.unregister(req, res);
            break;
          default:
            console.log("No API on " + req.url);
            res.end("No API on " + req.url);
            break;
        }
      })
      .listen(apiPort);
  }

  register(req, res) {
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString(); // convert Buffer to string
    });

    req.on("end", () => {
      /**@type {ClientInfoObj} */
      const info = JSON.parse(body);

      if (info.isLocal && process.env.DOCKER_CONTAINER)
        info.dstHost = "host.docker.internal";

      let statusCode;
      switch (info.connType) {
        case CONN_TYPE.TLS_TUNNEL: {
          let client = new ClientInfo({
            ...info,
            signature: body
          });

          statusCode = this.tcpRouter.register(client);
          break;
        }
        case CONN_TYPE.HTTP_PROXY: {
          let client = new ClientInfo({
            ...info,
            signature: body
          });

          statusCode = this.httpsRouter.register(client);
          break;
        }
        case CONN_TYPE.HTTPS_PROXY: {
          let clientTcp = new ClientInfo({
            ...info,
            dstPort: this.httpsRouter.getRouterPort(),
            dstHost: info.srcHost,
            signature: body
          });

          let clientHttps = new ClientInfo({
            ...info,
            signature: body
          });

          this.tcpRouter.register(clientTcp);
          statusCode = this.httpsRouter.register(clientHttps);
          break;
        }
        default:
          console.log(info.connType);
          statusCode = 403;
      }

      res.writeHead(statusCode);

      res.end();
    });
  }

  unregister(req, res) {
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString(); // convert Buffer to string
    });

    req.on("end", () => {
      /**@type {ClientInfoObj} */
      const info = JSON.parse(body);

      let statusCode;
      switch (info.connType) {
        case CONN_TYPE.TLS_TUNNEL: {
          let client = new ClientInfo({
            ...info,
            signature: body
          });

          statusCode = this.tcpRouter.unregister(client);
          break;
        }
        case CONN_TYPE.HTTP_PROXY: {
          let client = new ClientInfo({
            ...info,
            signature: body
          });

          statusCode = this.httpsRouter.unregister(client);
          break;
        }
        case CONN_TYPE.HTTPS_PROXY: {
          let clientTcp = new ClientInfo({
            ...info,
            dstPort: this.httpsRouter.getRouterPort(),
            dstHost: info.srcHost,
            signature: body
          });

          let clientHttps = new ClientInfo({
            ...info,
            signature: body
          });

          this.tcpRouter.unregister(clientTcp);
          statusCode = this.httpsRouter.unregister(clientHttps);
          break;
        }
        default:
          console.log(info.connType);
          statusCode = 403;
      }

      res.writeHead(statusCode);

      res.end();
    });
  }
}

module.exports = ApiServer;
