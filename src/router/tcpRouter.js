const net = require('net');
const sniReader = require('../lib/sniReader');
const Router = require('../lib/Router');
const {TLS_ROUTER_PORT, CONN_TYPE} = require('../def/const');
const logger = require('./logger');
const {Events} = require('../lib/EventManager');

class TCPRouter extends Router {
  /**
   * Initialize the router
   *
   * @param {number} localport - port to open for this router
   * @param {import("./httpRouter")} httpsRouter - https router instance
   * @instance
   * @param {import("dns").Resolver} dnsServer - dns server instance
   * @param {Object} evtMgr - event manager instance
   */
  constructor(localport, httpsRouter, dnsServer, evtMgr) {
    super(localport, 'TCP', evtMgr);

    this.httpsRouter = httpsRouter;
    this.dnsServer = dnsServer;

    const server = net.createServer((serverSocket) => {
      sniReader(serverSocket, (err, sniName) => {
        if (err) {
          // logger.error(err);
          serverSocket.end();
        } else if (sniName) {
          serverSocket.on('error', function(err) {
            logger.error('Socket error: ' + err);
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
        Events.OnHTTPSNoClientFound,
        /**
         * @param {import("./httpRouter")} httpsSrv - http router instance
         * @param {*} clientReq - client request
         * @param {*} clientRes - client response
         */
        (httpsSrv, clientReq, clientRes) => {
          if (!httpsSrv.isSSL) {
            return;
          }

          const client = this.getFirstClient(clientReq.headers.host);

          if (!client) {
            this.dnsServer.resolve(clientReq.headers.host, (err, addresses) => {
              if (!err) {
                logger.debug(`${httpsSrv.type} Router: Resolving by remote DNS`);
                httpsSrv.createTunnel(
                    clientReq,
                    clientRes,
                    clientReq.headers.host,
                    addresses[0],
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

          httpsSrv.createTunnel(
              clientReq,
              clientRes,
              client.srcHost,
              client.dstHost,
              client.dstPath,
              client.dstPath,
              CONN_TYPE.HTTPS_HTTPS_PROXY,
          );
        },
    );

    this.srvHandler = server.listen(this.localport, '0.0.0.0');
    if (this.srvHandler) {
      logger.info('TCP Router listening on ', this.localport, '0.0.0.0');
    }
  }

  initSession(serverSocket, sniName, skipHttpsCheck = false) {
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
      this.dnsServer.resolve(sniName, (err, addresses) => {
        if (!err) {
          logger.debug('Resolving by remote DNS');
          this.createTunnel(
              serverSocket,
              sniName,
              addresses[0],
              TLS_ROUTER_PORT,
          );
        } else {
          logger.error(err);
        }
      });

      return false;
    }

    if (client.isExpired()) {
      logger.info('Client expired! Unregistering...');
      this.unregister(client);
      // trying with external connection
      this.createTunnel(serverSocket, sniName, sniName, TLS_ROUTER_PORT);
      return false;
    }

    this.createTunnel(
        serverSocket,
        sniName,
        client.dstHost,
        client.dstPort,
        client,
    );
    return true;
  }

  createTunnel(serverSocket, sniName, dstHost, dstPort, client = null) {
    // [TODO]: improve. It could generate unpredictable
    // issues if you need to redirect a local service to the same
    // port of the source
    /* if (sniName === dstHost && this.localport === dstPort) {
      logger.log('TCP Router: resolving with DNS');
      // avoid infinite loops, try with DNS
      this.dnsServer.resolve(dstHost, (err, addresses) => {
        if (err) {
          logger.error(err);
          return;
        }

        this.createTunnel(serverSocket, sniName, addresses[0], dstPort, client);
      });

      return;
    }*/

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
      if (client) this.unregister(client);
      logger.error(sniName, 'Client socket reported', err);
      serverSocket.end();
    });
    serverSocket.on('error', function(err) {
      logger.error(
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
   * @returns {import("../lib/ClientInfo")} - clients information
   */
  getFirstClient(srcHost) {
    if (!this.clients[srcHost]) return null;

    const keys = Object.keys(this.clients[srcHost]);
    return this.clients[srcHost][keys[0]];
  }
}

module.exports = TCPRouter;
