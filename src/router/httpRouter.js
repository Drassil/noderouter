// @ts-ignore
require("../def/jsdoc");
const http = require("http");
const https = require("https");
const tls = require("tls");
const fs = require("fs");
const path = require("path");
const Router = require("../lib/Router");
const { CONN_TYPE } = require("../def/const");
const logger = require("./logger");

class HTTPRouter extends Router {
  /**
   * Initialize the router
   *
   * @param {number} localport
   * @param dnsServer
   * @param isSSL
   */
  constructor(localport, dnsServer, evtMgr, isSSL = false) {
    super(localport, isSSL ? "HTTPS" : "HTTP", evtMgr);

    this.isSSL = isSSL;
    this.dnsServer = dnsServer;
    this.certsMap = {};
    const path = require("path");
    const fs = require("fs");
    let pkeyPath = path.join(
      __dirname,
      "..",
      "conf",
      "api-gateway-alpw4aeiqq-ew.a.run.app.pkey"
    );
    let certPath = path.join(
      __dirname,
      "..",
      "conf",
      "api-gateway-alpw4aeiqq-ew.a.run.app.crt"
    );

    this.server = this.isSSL
      ? https.createServer(
          {
            rejectUnauthorized: false,
            /*SNICallback: (domain, cb) => {
            if (cb) {
              cb(null, this.getSecureContext(domain).context);
            } else {
              // compatibility for older versions of node
              return this.getSecureContext(domain).context;
            }
          },*/
            key: fs.readFileSync(pkeyPath),
            cert: fs.readFileSync(certPath)
          },
          this.onRequest.bind(this)
        )
      : http.createServer(this.onRequest.bind(this));

    this.srvHandler = this.isSSL
      ? this.server.listen(this.localport, err => {
          console.log(err);
        })
      : this.server.listen(this.localport, "0.0.0.0");

    this.srvHandler.on("error", err => {
      logger.error("error", err);
    });

    this.srvHandler.on("tlsClientError", err => {
      logger.error("tlsClientError", err);
    });

    if (this.srvHandler)
      logger.log(
        this.type + " Router listening on ",
        this.isSSL ? this.srvHandler.address() : this.localport + " 0.0.0.0"
      );
  }

  //function to pick out the key + certs dynamically based on the domain name
  getSecureContext(domain) {
    if (this.certsMap[domain]) return this.certsMap[domain];

    let pkeyPath = path.join(__dirname, "..", "conf", domain + ".pkey");
    let certPath = path.join(__dirname, "..", "conf", domain + ".crt");

    logger.debug("Creating secure context for ", domain);

    let context = tls.createSecureContext({
      key: fs.readFileSync(pkeyPath),
      cert: fs.readFileSync(certPath)
    });

    this.certsMap[domain] = context;
    return context;
  }

  onRequest(client_req, client_res) {
    logger.log("request started from: ", client_req.headers.host);

    //disable cors
    client_res.setHeader("Access-Control-Allow-Origin", "*");
    client_res.setHeader("Access-Control-Request-Method", "*");
    client_res.setHeader("Access-Control-Allow-Headers", "*");
    if (client_req.method === "OPTIONS") {
      client_res.writeHead(200);
      client_res.end();
      return;
    }

    /**@type {import("../lib/ClientInfo")} */
    const client = this.getClientBySrcPath(
      client_req.headers.host,
      client_req.url
    );

    if (!client || client.isExpired()) {
      if (client && client.isExpired()) {
        logger.log("Client expired! Unregistering...");
        this.unregister(client);
      }

      this.dnsServer.resolve(client_req.headers.host, (err, addresses) => {
        if (!err) {
          logger.debug(`${this.type} Router: Resolving by remote DNS`);
          this.createTunnel(
            client_req,
            client_res,
            client_req.headers.host,
            addresses[0],
            this.isSSL ? 443 : 80,
            client_req.url,
            this.isSSL ? CONN_TYPE.HTTPS_HTTPS_PROXY : CONN_TYPE.HTTP_HTTP_PROXY
          );
        } else {
          logger.error(err);
        }
      });

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
      client.connType
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
   */
  createTunnel(
    client_req,
    client_res,
    srcHost,
    dstHost,
    dstPort,
    dstPath,
    connType
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

    logger.debug(
      srcHost,
      ` ${this.isSSL ? "HTTPS" : "HTTP"} tunneling...`,
      dstHost,
      dstPort,
      dstPath
    );

    var proxy = protocol.request(options, res => {
      //if (res.statusCode != 200 && client) this.unregister(client);

      logger.debug(
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
