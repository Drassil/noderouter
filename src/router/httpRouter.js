const http = require('http');
const https = require('https');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const Router = require('@acore/noderouter/src/lib/Router');
const {CONN_TYPE} = require('@acore/noderouter/src/def/const');
const {Events} = require('@acore/noderouter/src/lib/EventManager');
const {promisify} = require('util');

class HTTPRouter extends Router {
  /**
   * Initialize the router
   *
   * @param {number} localport - Local port
   * @param {Object} dnsServer - dns server instance
   * @param {Object} evtMgr - event manager instance
   * @param {import('/lib/Logger')} logger - Logger instance
   * @param {boolean} isSSL - is https or http
   */
  constructor(localport, dnsServer, evtMgr, logger, isSSL = false) {
    super(localport, isSSL ? 'HTTPS' : 'HTTP', evtMgr, logger);

    this.isSSL = isSSL;
    this.dnsServer = dnsServer;
    this.certsMap = {};
    const path = require('path');
    const fs = require('fs');
    const pkeyPath = path.join(
        __dirname,
        '..',
        'conf',
        'dist',
        'localhost.pkey',
    );
    const certPath = path.join(
        __dirname,
        '..',
        'conf',
        'dist',
        'localhost.crt',
    );

    this.server = this.isSSL ?
      https.createServer(
          {
            rejectUnauthorized: false,
            /* SNICallback: (domain, cb) => {
          if (cb) {
            cb(null, this.getSecureContext(domain).context);
          } else {
            // compatibility for older versions of node
            return this.getSecureContext(domain).context;
          }
        },*/
            key: fs.readFileSync(pkeyPath),
            cert: fs.readFileSync(certPath),
          },
          this.onRequest.bind(this),
      ) :
      http.createServer(this.onRequest.bind(this));
  }

  async listen() {
    const logger = this.logger;
    this.srvHandler = this.isSSL ?
      await promisify((cb) => this.server.listen(this.localport, () => cb(null, this.server)))() :
      await promisify((cb) => this.server.listen(this.localport, '0.0.0.0', () => cb(null, this.server)))();
    this.srvHandler.on('error', (err) => {
      logger.error('error', err);
    });

    this.srvHandler.on('tlsClientError', (err) => {
      logger.error('tlsClientError', err);
    });

    if (this.srvHandler) {
      logger.log(
          this.type + ' Router listening on ',
        this.isSSL ? this.srvHandler.address() : this.localport + ' 0.0.0.0',
      );
    }
  }

  // function to pick out the key + certs dynamically based on the domain name
  getSecureContext(domain) {
    const logger = this.logger;
    if (this.certsMap[domain]) return this.certsMap[domain];

    const pkeyPath = path.join(__dirname, '..', 'conf', domain + '.pkey');
    const certPath = path.join(__dirname, '..', 'conf', domain + '.crt');

    logger.debug('Creating secure context for ', domain);

    const context = tls.createSecureContext({
      key: fs.readFileSync(pkeyPath),
      cert: fs.readFileSync(certPath),
    });

    this.certsMap[domain] = context;
    return context;
  }

  onRequest(clientReq, clientRes) {
    const logger = this.logger;
    logger.log('request started from: ', clientReq.headers.host);

    // disable cors
    clientRes.setHeader('Access-Control-Allow-Origin', '*');
    clientRes.setHeader('Access-Control-Request-Method', '*');
    clientRes.setHeader('Access-Control-Allow-Methods', '*');
    clientRes.setHeader('Access-Control-Allow-Headers', '*');
    if (clientReq.method === 'OPTIONS') {
      clientRes.writeHead(200);
      clientRes.end();
      return;
    }

    /** @type {import("/lib/ClientInfo")} */
    const client = this.getClientBySrcPath(
        clientReq.headers.host,
        clientReq.url,
    );

    if (!client || client.isExpired()) {
      if (client && client.isExpired()) {
        logger.log('Client expired! Deregistering...');
        this.deregister(client);
      }

      this.evtMgr.emit(Events.OnHTTPNoClientFound, this, clientReq, clientRes);

      return;
    }

    const dstPath = client.getDestPathByUrl(clientReq.url);

    this.createTunnel(
        clientReq,
        clientRes,
        client.srcHost,
        client.dstHost,
        client.dstPort,
        dstPath,
        client.connType,
    );
  }

  /**
   *
   * @param {*} clientReq - request object
   * @param {*} clientRes - response object
   * @param {*} srcHost - source host
   * @param {*} dstHost - destination host
   * @param {*} dstPort - destination port
   * @param {*} dstPath - destination type
   * @param {number} connType - connection type
   */
  createTunnel(
      clientReq,
      clientRes,
      srcHost,
      dstHost,
      dstPort,
      dstPath,
      connType,
  ) {
    const logger = this.logger;
    // if (srcHost === dstHost && this.localport === dstPort) return; // avoid infinite loops
    const options = {
      hostname: dstHost,
      port: dstPort,
      path: dstPath,
      method: clientReq.method,
      headers: clientReq.headers,
    };

    const protocol = connType == CONN_TYPE.HTTPS_HTTPS_PROXY ? https : http;

    logger.debug(
        srcHost,
        ` ${this.isSSL ? 'HTTPS' : 'HTTP'} tunneling...`,
        dstHost,
        dstPort,
        dstPath,
    );

    const proxy = protocol.request(options, (res) => {
      // if (res.statusCode != 200 && client) this.deregister(client);

      logger.debug(
          srcHost,
          ` ${this.isSSL ? 'HTTPS' : 'HTTP'} connected`,
          dstHost,
          dstPort,
          dstPath,
      );

      clientRes.writeHead(res.statusCode, res.headers);
      res.pipe(clientRes, {
        end: true,
      });
    });

    clientReq.pipe(proxy, {
      end: true,
    });
  }
}

module.exports = HTTPRouter;
