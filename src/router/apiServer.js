const http = require('http');
const https = require('https');
const dns = require('dns');
const TCPRouter = require('./tcpRouter');
const HTTPRouter = require('./httpRouter');
const ClientInfo = require('@acore/noderouter/src/lib/ClientInfo');
const Logger = require('@acore/noderouter/src/lib/Logger');
const {EventManager, Events} = require('@acore/noderouter/src/lib/EventManager');
const {
  CONN_TYPE,
} = require('@acore/noderouter/src/def/const');

/**
 * Class to create a router service
 */
class ApiServer {
  /**
   * Create Router service
   *
   * @param {Object} options - Options
   * @param {number} [options.apiPort] - Listening port for API service
   * @param {boolean} [options.ssl] - Run API service on SSL connection
   * @param {number} [options.tlsRouterPort] - Exposed port to tunnel TLS
   * connections
   * @param {number} [options.httpRouterPort] - Exposed port to tunnel HTTP connections
   * @param {string[]} [options.dnsAddresses] - List of DNS addresses
   * @param {Object} [options.loggerConf] - Logger configurations
   * @param {import('/def/jsdoc').ClientInfoObj[]} [options.hosts] - Preloaded hosts
   */
  async init({
    apiPort,
    ssl,
    tlsRouterPort,
    httpRouterPort,
    dnsAddresses,
    loggerConf,
    hosts,
  }) {
    const server = ssl ? https : http;
    this.dnsServer = dns;

    const logger = this.logger = new Logger(loggerConf);

    // we can set custom DNS here (otherwise it will use OS addresses)
    if (dnsAddresses) this.dnsServer.setServers(dnsAddresses);

    this.evtMgr = new EventManager(Events);
    this.httpRouter = new HTTPRouter(
        httpRouterPort,
        this.dnsServer,
        this.evtMgr,
        logger,
    );
    this.httpsRouter = new HTTPRouter(0, this.dnsServer, this.evtMgr, logger, true);
    this.tcpRouter = new TCPRouter(
        tlsRouterPort,
        this.httpsRouter,
        this.dnsServer,
        this.evtMgr,
        logger,
    );

    await this.httpRouter.listen();
    await this.httpsRouter.listen();
    await this.tcpRouter.listen();

    hosts.forEach((v) => {
      this.clientRegister(JSON.stringify(v), v);
    });

    const serverHandler = server
        .createServer((req, res) => {
          if (req.method !== 'POST') return;

          res.writeHead(200, {'Content-Type': 'application/json'});

          switch (req.url) {
            case '/register':
              this.register(req, res);
              break;
            case '/deregister':
              this.deregister(req, res);
              break;
            default:
              logger.error('No API on ' + req.url);
              res.end('No API on ' + req.url);
              break;
          }
        })
        .listen(apiPort, () => {
          logger.info('API server listening on ', serverHandler.address());
        });
  }

  register(req, res) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString(); // convert Buffer to string
    });

    req.on('end', () => {
      /** @type {import('src/def/jsdoc').ClientInfoObj} */
      const info = JSON.parse(body);

      // if (info.isLocal && process.env.DOCKER_CONTAINER)
      //  info.dstHost = os.hostname();
      /* info.dstHost =
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;*/

      const array = info.dstHost.split(':');
      info.dstHost = array[array.length - 1];

      const statusCode = this.clientRegister(body, info);

      res.writeHead(statusCode);

      res.end();
    });
  }

  deregister(req, res) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString(); // convert Buffer to string
    });

    req.on('end', () => {
      /** @type {import('src/def/jsdoc').ClientInfoObj} */
      const info = JSON.parse(body);

      const statusCode = this.clientRegister(body, info, false);

      res.writeHead(statusCode);

      res.end();
    });
  }

  /**
   *
   * @param {string} signature - the unique signature for the client
   * @param {import('/def/jsdoc').ClientInfoObj} info - client information
   * @param {boolean} set - true -> register client, false -> deregister
   * @returns {number} - status code
   */
  clientRegister(signature, info, set = true) {
    const logger = this.logger;

    const type = set ? 'Register' : 'Deregister';
    let tcpMethod = set ? this.tcpRouter.register : this.tcpRouter.deregister;
    let httpMethod = set ? this.httpRouter.register : this.httpRouter.deregister;
    let httpsMethod = set ? this.httpsRouter.register : this.httpsRouter.deregister;


    tcpMethod = tcpMethod.bind(this.tcpRouter);
    httpMethod = httpMethod.bind(this.httpRouter);
    httpsMethod = httpsMethod.bind(this.httpsRouter);

    let statusCode;
    switch (info.connType) {
      case CONN_TYPE.TLS_TUNNEL: {
        const client = new ClientInfo({
          ...info,
          signature,
        });


        statusCode = tcpMethod(client);
        break;
      }
      case CONN_TYPE.HTTP_HTTP_PROXY: {
        const client = new ClientInfo({
          ...info,
          signature,
        });

        statusCode = httpMethod(client);
        break;
      }
      case CONN_TYPE.HTTPS_HTTPS_PROXY:
      case CONN_TYPE.HTTPS_HTTP_PROXY: {
        const clientTcp = new ClientInfo({
          ...info,
          dstPort: this.httpsRouter.getRouterPort(),
          dstHost: this.httpsRouter.getRouterHost(),
          signature,
        });

        const clientHttps = new ClientInfo({
          ...info,
          signature,
        });

        tcpMethod(clientTcp);
        statusCode = httpsMethod(clientHttps);
        break;
      }
      default:
        logger.warn(`${type}: Invalid connection type:`, info.connType);
        statusCode = 403;
    }
    return statusCode;
  }
}

module.exports = ApiServer;
