require("../def/jsdoc");
const net = require("net");
const sniReader = require("../lib/sniReader");
const ClientInfo = require("../lib/ClientInfo");
const Router = require("../lib/Router");
const { TLS_ROUTER_PORT } = require("../def/const");

class TCPRouter extends Router {
  /**
   * Initialize the router
   * @param {number} localport
   */
  constructor(localport) {
    super(localport, "TCP");

    var server = net.createServer(serverSocket => {
      sniReader(serverSocket, (err, sniName) => {
        if (err) {
          console.trace(err);
          serverSocket.end();
        } else if (sniName) {
          serverSocket.on("error", function(err) {
            if (err.code == "EPIPE") {
              console.debug(
                serverSocket.remoteAddress,
                "Client disconnected before the pipe was connected."
              );
            } else {
              console.error(err);
            }
            serverSocket.end();
          });
          this.initSession(serverSocket, sniName);
        } else {
          console.warn(serverSocket.remoteAddress, "(none)");
          serverSocket.end();
        }
      });
    });

    this.srvHandler = server.listen(this.localport);
    if (this.srvHandler)
      console.log("TCP Router listening on " + this.srvHandler.address().port);
  }

  initSession(serverSocket, sniName) {
    const client = this.getFirstClient(sniName);

    if (!client) {
      TCPRouter.createTunnel(serverSocket, sniName, sniName, TLS_ROUTER_PORT);
      return false;
    }

    if (client.isExpired()) {
      console.log("Client expired! Unregistering...");
      this.unregister(client);
      TCPRouter.createTunnel(serverSocket, sniName, sniName, TLS_ROUTER_PORT); // trying with external connection
      return false;
    }

    TCPRouter.createTunnel(
      serverSocket,
      sniName,
      client.dstHost,
      client.dstPort
    );
    return true;
  }

  static createTunnel(serverSocket, sniName, dstHost, dstPort) {
    var clientSocket = net.connect({
      port: dstPort,
      host: dstHost
    });

    clientSocket.on("connect", function() {
      serverSocket.pipe(clientSocket).pipe(serverSocket);
      console.debug(
        serverSocket.remoteAddress,
        sniName,
        "connected",
        dstHost
      );
    });
    clientSocket.on("error", err => {
      this.unregister(client);
      console.error(sniName, "Client socket reported", err.code);
      serverSocket.end();
    });
    serverSocket.on("error", function(err) {
      console.error(
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
   * @param {string} srcHost
   * @returns {ClientInfo} - clients information
   */
  getFirstClient(srcHost) {
    if (!this.clients[srcHost]) return null;

    let keys = Object.keys(this.clients[srcHost]);
    return this.clients[srcHost][keys[0]];
  }
}

module.exports = TCPRouter;
