require("./def/jsdoc");
const http = require("http");
const ClientInfo = require("./lib/ClientInfo").default;

class HTTPRouter {
  /**
   * Initialize the router
   * @param {number} localport
   */
  constructor(localport) {
    this.clients = {};

    const srvHandler = http
      .createServer(this.onRequest.bind(this))
      .listen(localport);

    if (srvHandler) console.log("HTTP Router listening on " + localport);
  }

  onRequest(client_req, client_res) {
    console.log("serve: " + client_req.headers.host);
    /**@type {ClientInfo} */
    const client = this.clients[client_req.headers.host];

    if (!client) return;

    var options = {
      hostname: client.dstHost,
      port: client.dstPort,
      path: client_req.url,
      method: client_req.method,
      headers: client_req.headers
    };

    var proxy = http.request(options, function(res) {
      client_res.writeHead(res.statusCode, res.headers);
      res.pipe(client_res, {
        end: true
      });
    });

    client_req.pipe(proxy, {
      end: true
    });
  }

  /**
   * Register a socket on router
   * @param {ClientInfo} clientInfo
   */
  register(clientInfo) {
    this.clients[clientInfo.srcHost] = clientInfo;

    console.log(
      `Registered HTTP tunnel: ${clientInfo.srcHost} <==> ${clientInfo.dstHost}:${clientInfo.dstPort}`
    );
  }
}

module.exports = HTTPRouter;
