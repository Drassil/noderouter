const net = require('net');
const sniReader = require('@acore/noderouter/src/lib/sniReader');
const Router = require('@acore/noderouter/src/lib/Router');
const {CONN_TYPE} = require('@acore/noderouter/src/def/const');
const {Events} = require('@acore/noderouter/src/lib/EventManager');
const {promisify} = require('util');

class TCPRouter extends Router {
  /**
   * Initialize the router
   *
   * @param {number} localport - port to open for this router
   * @param {import("./httpRouter")} httpsRouter - https router instance
   * @instance
   * @param {import("dns")} dnsServer - dns server instance
   * @param {Object} evtMgr - event manager instance
   * @param {import('/lib/Logger')} logger - Logger instance
   */
  constructor(localport, httpsRouter, dnsServer, evtMgr, logger) {
    super(localport, 'TCP', evtMgr, logger);

    this.httpsRouter = httpsRouter;
    this.dnsServer = dnsServer;

    this.server = net.createServer((serverSocket) => {
      sniReader(serverSocket, (err, sniName) => {
        if (err) {
          // logger.error(err);
          serverSocket.end();
        } else if (sniName) {
          serverSocket.on('error', function(err) {
            logger.warn('Socket error: ' + err);
            serverSocket.end();
          });
          this.initSession(serverSocket, sniName);
        } else {
          logger.warn(serverSocket.remoteAddress, '(none)');
          serverSocket.end();
        }
      });
    });

    this.evtMgr.on(
        Events.OnHTTPNoClientFound,
        /**
         * @param {import("./httpRouter")} httpsSrv - http router instance
         * @param {*} clientReq - client request
         * @param {*} clientRes - client response
         */
        (httpsSrv, clientReq, clientRes) => {
          if (!httpsSrv.isSSL) {
            return;
          }

          /**
           * @param {import("/lib/ClientInfo")} value - array value
           * @returns {boolean} - condition
           */
          const filter = (value) => {
            return value.connType === CONN_TYPE.TLS_TUNNEL;
          };

          const client = this.getFirstClient(clientReq.headers.host, filter);

          if (!client) {
            logger.debug(`Tring to resolve ${clientReq.headers.host} with DNS`);

            // TODO: support for IPV6
            const options = {
              // Setting family as 4 i.e. IPv4
              family: 4,
              hints: this.dnsServer.ADDRCONFIG | this.dnsServer.V4MAPPED,
            };

            this.dnsServer.lookup(clientReq.headers.host, options, (err, address) => {
              if (!err) {
                logger.debug(`${httpsSrv.type} Router: Resolving by remote DNS`);
                httpsSrv.createTunnel(
                    clientReq,
                    clientRes,
                    clientReq.headers.host,
                    address,
                httpsSrv.isSSL ? 443 : 80,
                clientReq.url,
                httpsSrv.isSSL ?
                  CONN_TYPE.HTTPS_HTTPS_PROXY :
                  CONN_TYPE.HTTP_HTTP_PROXY,
                );
              } else {
                logger.error(err);
              }
            });

            return;
          }

          if (
            httpsSrv.getRouterHost() == client.dstHost &&
          httpsSrv.getRouterPort() == client.dstPort
          ) {
            logger.error(
                'Endless loop blocked',
                httpsSrv.getRouterHost(),
                httpsSrv.getRouterPort(),
                client.dstHost,
                client.dstPort,
            );
            return;
          }

          httpsSrv.createTunnel(
              clientReq,
              clientRes,
              client.srcHost,
              client.dstHost,
              client.dstPort,
              client.dstPath,
              CONN_TYPE.HTTPS_HTTPS_PROXY,
          );
        },
    );
  }

  async listen() {
    this.srvHandler = await promisify((cb) => this.server.listen(this.localport, '0.0.0.0', () => cb(null, this.server)))();
    if (this.srvHandler) {
      this.logger.info('TCP Router listening on ', this.localport, '0.0.0.0');
    }
  }

  initSession(serverSocket, sniName, skipHttpsCheck = false) {
    const logger = this.logger;
    // if there's an HTTPS Proxy registered
    // on requested host, then process
    // it first.
    const httpsClients = this.httpsRouter.getClients(sniName);
    if (!skipHttpsCheck && httpsClients && Object.keys(httpsClients).length) {
      logger.debug({
        sniName,
        hostname: this.httpsRouter.getRouterHost(),
        port: this.httpsRouter.getRouterPort(),
      });

      logger.log('Trying to ask to internal HTTPS proxy');

      const clientSocket = net.connect({
        port: this.httpsRouter.getRouterPort(),
        host: this.httpsRouter.getRouterHost(),
      });

      clientSocket.on('connect', () => {
        serverSocket.pipe(clientSocket).pipe(serverSocket);
      });

      return true;
    }

    const client = this.getFirstClient(sniName);

    if (!client) {
      logger.debug(`Find ${sniName} with DNS...`);
      // TODO: support for IPV6
      const options = {
        // Setting family as 4 i.e. IPv4
        family: 4,
        hints: this.dnsServer.ADDRCONFIG | this.dnsServer.V4MAPPED,
      };

      this.dnsServer.lookup(sniName, options, (err, address) => {
        if (!err) {
          logger.debug('Resolving by remote DNS');
          this.createTunnel(
              serverSocket,
              sniName,
              address,
              this.localport,
              null,
              'DNS Resolver',
          );
        } else {
          logger.error(err);
        }
      });

      return false;
    }

    if (client.isExpired()) {
      logger.info('Client expired! Deregistering...');
      this.deregister(client);
      // trying with external connection
      this.createTunnel(serverSocket, sniName, sniName, this.localport, null, 'Expiration');
      return false;
    }

    this.createTunnel(
        serverSocket,
        sniName,
        client.dstHost,
        client.dstPort,
        client,
        'Init session',
    );
    return true;
  }

  createTunnel(serverSocket, sniName, dstHost, dstPort, client = null, description='No description') {
    const logger = this.logger;
    // [TODO]: improve. It could generate unpredictable
    // issues if you need to redirect a local service to the same
    // port of the source
    if (!client && sniName === dstHost && this.localport === dstPort) {
      logger.log('TCP Router: resolving with DNS');
      // TODO: support for IPV6
      const options = {
        // Setting family as 4 i.e. IPv4
        family: 4,
        hints: this.dnsServer.ADDRCONFIG | this.dnsServer.V4MAPPED,
      };

      // avoid infinite loops, try with DNS
      this.dnsServer.lookup(dstHost, options, (err, address) => {
        if (err) {
          logger.error(err);
          return;
        }

        this.createTunnel(serverSocket, sniName, address, dstPort, client, 'Self-call for DNS search');
      });

      return;
    }

    const clientSocket = net.connect({
      port: dstPort,
      host: dstHost,
    });

    clientSocket.on('connect', () => {
      serverSocket.pipe(clientSocket).pipe(serverSocket);
      logger.debug(
          serverSocket.remoteAddress,
          sniName,
          ' TLS connected',
          dstHost,
          dstPort,
      );
    });
    clientSocket.on('error', (err) => {
      logger.error(sniName, 'Client socket reported:', err, 'Client info: ', client, 'Dest host:', dstHost,
          'Dest port:', dstPort, 'Description:', description);
      if (client) this.deregister(client);
      serverSocket.end();
    });
    serverSocket.on('error', function(err) {
      logger.warn(
          serverSocket.remoteAddress,
          'Server socket reported',
          err.code,
      );
      clientSocket.end();
    });

    return clientSocket;
  }

  /**
   * Get first client for a registered host
   *
   * @param {string} srcHost - source host
   * @param {any} filter - filter callback
   * @returns {import("/lib/ClientInfo")} - clients information
   */
  getFirstClient(srcHost, filter = undefined) {
    if (!this.clients[srcHost]) return null;

    const clients = filter ?
      Object.values(this.clients[srcHost]).filter(filter) :
      this.clients[srcHost];

    const keys = Object.keys(clients);
    return clients[keys[0]];
  }
}

module.exports = TCPRouter;
