require("./def/jsdoc");
const net = require("net");
const sniReader = require("./lib/sniReader");
const ClientInfo = require("./lib/ClientInfo").default;

class TCPRouter {
  /**
   * Initialize the router
   * @param {number} localport
   */
  constructor(localport) {
    this.clients = {};

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

    const srvHandler = server.listen(localport);
    if (srvHandler) console.log("TCP Router listening on " + localport);
  }

  initSession(serverSocket, sniName) {
    /**@type {ClientInfo} */
    const client = this.clients[sniName];

    if (!client) return;

    var clientSocket = net.connect({
      port: client.dstPort,
      host: client.dstHost
    });

    clientSocket.on("connect", function() {
      serverSocket.pipe(clientSocket).pipe(serverSocket);
      console.info(
        serverSocket.remoteAddress,
        sniName,
        "connected",
        client.dstHost
      );
    });
    clientSocket.on("error", function(err) {
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
   * Register a socket on router
   * @param {ClientInfo} clientInfo
   */
  register(clientInfo) {
    this.clients[clientInfo.srcHost] = clientInfo;

    console.log(
      `Registered TLS tunnel: ${clientInfo.srcHost} <==> ${clientInfo.dstHost}:${clientInfo.dstPort}`
    );
  }
}

module.exports = TCPRouter;
