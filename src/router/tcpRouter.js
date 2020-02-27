// @ts-ignore
require("../def/jsdoc");
const net = require("net");
const sniReader = require("../lib/sniReader");
const Router = require("../lib/Router");
const { TLS_ROUTER_PORT } = require("../def/const");
const logger = require("./logger");

class TCPRouter extends Router {
  /**
   * Initialize the router
   *
   * @param {number} localport
   * @param {import("./httpRouter")} httpsRouter
   * @instance
   * @param {import("dns").Resolver} dnsServer
   */
  constructor(localport, httpsRouter, dnsServer, evtMgr) {
    super(localport, "TCP", evtMgr);

    this.httpsRouter = httpsRouter;
    this.dnsServer = dnsServer;

    var server = net.createServer(serverSocket => {
      sniReader(serverSocket, (err, sniName) => {
        if (err) {
          //logger.error(err);
          serverSocket.end();
        } else if (sniName) {
          serverSocket.on("error", function(err) {
            logger.error("Socket error: " + err);
            serverSocket.end();
          });
          this.initSession(serverSocket, sniName);
        } else {
          logger.warn(serverSocket.remoteAddress, "(none)");
          serverSocket.end();
        }
      });
    });

    this.srvHandler = server.listen(this.localport, "0.0.0.0");
    if (this.srvHandler)
      logger.info("TCP Router listening on ", this.localport, "0.0.0.0");
  }

  initSession(serverSocket, sniName) {
    // if there's an HTTPS Proxy registered
    // on requested host, then process
    // it first.
    let httpsClients = this.httpsRouter.getClients(sniName);
    if (httpsClients && Object.keys(httpsClients).length) {
      logger.debug({
        sniName,
        hostname: this.httpsRouter.getRouterHost(),
        port: this.httpsRouter.getRouterPort()
      });

      logger.log("Trying to ask to internal HTTPS proxy");

      var clientSocket = net.connect({
        port: this.httpsRouter.getRouterPort(),
        host: this.httpsRouter.getRouterHost()
      });

      clientSocket.on("connect", () => {
        serverSocket.pipe(clientSocket).pipe(serverSocket);
      });

      return true;
    }

    const client = this.getFirstClient(sniName);

    logger.debug(client);

    if (!client) {
      this.dnsServer.resolve(sniName, (err, addresses) => {
        if (!err) {
          logger.debug("Resolving by remote DNS");
          this.createTunnel(
            serverSocket,
            sniName,
            addresses[0],
            TLS_ROUTER_PORT
          );
        } else {
          logger.error(err);
        }
      });

      return false;
    }

    if (client.isExpired()) {
      logger.info("Client expired! Unregistering...");
      this.unregister(client);
      this.createTunnel(serverSocket, sniName, sniName, TLS_ROUTER_PORT); // trying with external connection
      return false;
    }

    this.createTunnel(
      serverSocket,
      sniName,
      client.dstHost,
      client.dstPort,
      client
    );
    return true;
  }

  createTunnel(serverSocket, sniName, dstHost, dstPort, client = null) {
    if (sniName === dstHost && this.localport === dstPort) {
      logger.log("TCP Router: resolving with DNS");
      // avoid infinite loops, try with DNS
      this.dnsServer.resolve(dstHost, (err, addresses) => {
        if (err) {
          logger.error(err);
          return;
        }

        this.createTunnel(serverSocket, sniName, addresses[0], dstPort, client);
      });

      return;
    }

    var clientSocket = net.connect({
      port: dstPort,
      host: dstHost
    });

    clientSocket.on("connect", () => {
      serverSocket.pipe(clientSocket).pipe(serverSocket);
      logger.debug(
        serverSocket.remoteAddress,
        sniName,
        " TLS connected",
        dstHost,
        dstPort
      );
    });
    clientSocket.on("error", err => {
      if (client) this.unregister(client);
      logger.error(sniName, "Client socket reported", err);
      serverSocket.end();
    });
    serverSocket.on("error", function(err) {
      logger.error(
        serverSocket.remoteAddress,
        "Server socket reported",
        err.code
      );
      clientSocket.end();
    });

    return clientSocket;
  }

  /**
   * Get first client for a registered host
   *
   * @param {string} srcHost
   * @returns {import("../lib/ClientInfo")} - clients information
   */
  getFirstClient(srcHost) {
    if (!this.clients[srcHost]) return null;

    let keys = Object.keys(this.clients[srcHost]);
    return this.clients[srcHost][keys[0]];
  }
}

module.exports = TCPRouter;
