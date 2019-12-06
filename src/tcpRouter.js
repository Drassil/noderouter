require("./def/jsdoc");
const net = require("net");
const sniReader = require("./lib/sniReader");
const ClientInfo = require("./lib/ClientInfo");
const Router = require("./lib/Router");

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
          console.debug(serverSocket.remoteAddress, sniName);
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

    if (!client) return;

    var clientSocket = net.connect({
      port: client.dstPort,
      host: client.dstHost
    });

    clientSocket.on("connect", function() {
      serverSocket.pipe(clientSocket).pipe(serverSocket);
      console.debug(
        serverSocket.remoteAddress,
        sniName,
        "connected",
        client.dstHost
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
  }

  /**
   * Get first client for a registered host
   * @param {string} srcHost
   * @returns {ClientInfo} - clients information
   */
  getFirstClient(srcHost) {
    let keys = Object.keys(this.clients[srcHost]);
    return this.clients[srcHost][keys[0]];
  }
}

module.exports = TCPRouter;
