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
const logger = require("./logger");

class HTTPRouter extends Router {
  /**
   * Initialize the router
   *
   * @param {number} localport
   * @param dnsServer
   * @param isSSL
   */
  constructor(localport, dnsServer, isSSL = false) {
    super(localport, isSSL ? "HTTPS" : "HTTP");

    this.isSSL = isSSL;
    this.dnsServer = dnsServer;
    this.certsMap = {};

    this.srvHandler = this.isSSL
      ? https
          .createServer(
            {
              rejectUnauthorized: false,
              SNICallback: (domain, cb) => {
                if (cb) {
                  cb(null, this.getSecureContext(domain));
                } else {
                  // compatibility for older versions of node
                  return this.getSecureContext(domain);
                }
              }
            },
            this.onRequest.bind(this)
          )
          .listen(this.localport)
      : http
          .createServer(this.onRequest.bind(this))
          .listen(this.localport, "0.0.0.0");

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

    let context = tls.createSecureContext({
      key: fs.readFileSync(pkeyPath),
      cert: fs.readFileSync(certPath)
    }).context;

    this.certsMap[domain] = context;
    return context;
  }

  onRequest(client_req, client_res) {
    /**@type {ClientInfo} */
    const client = this.getClientBySrcPath(
      client_req.headers.host,
      client_req.url
    );

    logger.debug("request started from: ", client_req.headers.host);

    if (!client || client.isExpired()) {
      if (client && client.isExpired()) {
        logger.log("Client expired! Unregistering...");
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
          logger.error(err);
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
