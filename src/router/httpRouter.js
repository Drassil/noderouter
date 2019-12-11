// @ts-ignore
require("../def/jsdoc");
const http = require("http");
const https = require("https");
const tls = require("tls");
const fs = require("fs");
const path = require("path");
const ClientInfo = require("../lib/ClientInfo");
const Router = require("../lib/Router");
const { HTTP_ROUTER_PORT, CONN_TYPE } = require("../def/const");

class HTTPRouter extends Router {
  /**
   * Initialize the router
   * @param {number} localport
   */
  constructor(localport, dnsServer, isSSL = false) {
    super(localport, isSSL ? "HTTPS" : "HTTP");

    this.isSSL = isSSL;
    this.dnsServer = dnsServer;

    this.srvHandler = this.isSSL
      ? https
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
          .listen(this.localport)
      : http.createServer(this.onRequest.bind(this)).listen(this.localport);

    if (this.srvHandler)
      console.log(
        this.type + " Router listening on ",
        this.srvHandler.address()
      );
  }

  onRequest(client_req, client_res) {
    /**@type {ClientInfo} */
    const client = this.getClientBySrcPath(
      client_req.headers.host,
      client_req.url
    );

    if (!client || client.isExpired()) {
      if (client && client.isExpired()) {
        console.log("Client expired! Unregistering...");
        this.unregister(client);
      }

      this.retrieveDataFromTCP(
        client_req,
        client_res,
        client_req.headers.host,
        client_req.headers.host,
        this.isSSL ? 443 : HTTP_ROUTER_PORT, // https should never happen here
        this.isSSL ? CONN_TYPE.HTTPS_HTTPS_PROXY : CONN_TYPE.HTTP_HTTP_PROXY,
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
      client.connType,
      client
    );
  }

  /**
   *
   * @param {*} client_req
   * @param {*} client_res
   * @param {*} srcHost
   * @param {*} dstHost
   * @param {*} dstPort
   * @param {*} dstPath
   * @param {number} connType
   * @param {*} client
   */
  createTunnel(
    client_req,
    client_res,
    srcHost,
    dstHost,
    dstPort,
    dstPath,
    connType,
    client = null
  ) {
    //if (srcHost === dstHost && this.localport === dstPort) return; // avoid infinite loops

    var options = {
      hostname: dstHost,
      port: dstPort,
      path: dstPath,
      method: client_req.method,
      headers: client_req.headers
    };

    let protocol = connType == CONN_TYPE.HTTPS_HTTPS_PROXY ? https : http;

    var proxy = protocol.request(options, res => {
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

  retrieveDataFromTCP(
    client_req,
    client_res,
    srcHost,
    dstHost,
    dstPort,
    dstPath,
    connType,
    client = null
  ) {
    if (srcHost === dstHost) {
      // avoid infinite loops, try with DNS
      this.dnsServer.resolve(dstHost, (err, addresses) => {
        if (err) {
          console.trace(err);
          return;
        }

        var tlsOptions = {
          host: addresses[0],
          port: dstPort,
          servername: dstHost,
          rejectUnauthorized: false
        };

        var httpOptions = {
          host: dstHost,
          port: dstPort,
          method: client_req.method,
          headers: client_req.headers,
          path: client_req.url,
          createConnection: () => tls.connect(tlsOptions)
        };

        const httpRequest = http.request(httpOptions, incomingMessage => {
          incomingMessage.pipe(client_res, {
            end: true
          });
        });
        httpRequest.end();
      });

      return;
    }
  }
}

module.exports = HTTPRouter;
