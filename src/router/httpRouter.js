// @ts-ignore
require("../def/jsdoc");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const ClientInfo = require("../lib/ClientInfo");
const Router = require("../lib/Router");
const { HTTP_ROUTER_PORT } = require("../def/const");

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
            path.join(__dirname, "..", "conf", "dist", "server.pkey")
          ),
          cert: fs.readFileSync(
            path.join(__dirname, "..", "conf", "dist", "server.crt")
          )
        },
        this.onRequest.bind(this)
      )
      .listen(this.localport);

    if (this.srvHandler)
      console.log(
        this.type + " Router listening on " + this.srvHandler.address()
      );
  }

  onRequest(client_req, client_res) {
    /**@type {ClientInfo} */
    const client = this.getClientBySrcPath(
      client_req.headers.host,
      client_req.url
    );

    if (!client || client.isExpired()) {
      if (client.isExpired()) {
        console.log("Client expired! Unregistering...");
        this.unregister(client);
      }

      this.createTunnel(
        client_req,
        client_res,
        client_req.headers.host,
        client_req.headers.host,
        this.isSSL ? 443 : HTTP_ROUTER_PORT, // https should never happen here
        client_req.url
      );

      return;
    }

    let dstPath = client.getDestPathByUrl(client_req.url);

    this.createTunnel(
      client_req,
      client_res,
      client.srcHost,
      client.dstHost,
      client.dstPort,
      dstPath,
      client
    );
  }

  createTunnel(
    client_req,
    client_res,
    srcHost,
    dstHost,
    dstPort,
    dstPath,
    client = null
  ) {
    if (srcHost === dstHost && this.localport === dstPort)
      return; // avoid infinite loops

    var options = {
      hostname: dstHost,
      port: dstPort,
      path: dstPath,
      method: client_req.method,
      headers: client_req.headers
    };

    var proxy = http.request(options, res => {
      if (res.statusCode != 200 && client) this.unregister(client);

      console.debug(
        srcHost,
        ` ${this.isSSL ? "HTTPS" : "HTTP"} connected`,
        dstHost,
        dstPort,
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
