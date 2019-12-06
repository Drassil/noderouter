require("./def/jsdoc");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const ClientInfo = require("./lib/ClientInfo");
const Router = require("./lib/Router");

class HTTPRouter extends Router {
  /**
   * Initialize the router
   * @param {number} localport
   */
  constructor(localport, isSSL = false) {
    super(localport, isSSL ? "HTTPS" : "HTTP");

    this.isSSL = isSSL;

    let server = this.isSSL ? https : http;

    this.srvHandler = server
      .createServer(
        {
          key: fs.readFileSync(
            path.join(__dirname, "conf", "dist", "server.pkey")
          ),
          cert: fs.readFileSync(
            path.join(__dirname, "conf", "dist", "server.crt")
          )
        },
        this.onRequest.bind(this)
      )
      .listen(this.localport);

    if (this.srvHandler)
      console.log(
        this.type + " Router listening on " + this.srvHandler.address().port
      );
  }

  onRequest(client_req, client_res) {
    /**@type {ClientInfo} */
    const client = this.getClientBySrcPath(
      client_req.headers.host,
      client_req.url
    );

    if (!client) return;

    let dstPath = client.getDestPathByUrl(client_req.url);

    var options = {
      hostname: client.dstHost,
      port: client.dstPort,
      path: dstPath,
      method: client_req.method,
      headers: client_req.headers
    };

    var proxy = http.request(options, function(res) {
      console.debug(
        client.srcHost,
        "connected",
        client.dstHost,
        client.dstPort,
        dstPath
      );

      client_res.writeHead(res.statusCode, res.headers);
      res.pipe(client_res, {
        end: true
      });
    });

    client_req.pipe(proxy, {
      end: true
    });
  }
}

module.exports = HTTPRouter;
