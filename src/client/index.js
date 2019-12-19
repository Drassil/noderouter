// @ts-ignore
require("../def/jsdoc");
try {
  require("dotenv").config();
} catch (ex) {}
const http = require("http");
const https = require("https");
const fs = require("fs");
const { promisify } = require("util");
const { API_PORT, CONN_TYPE } = require("../def/const");

/**
 * @typedef {Object} NRClientOptions
 * @property {boolean} httpsApi
 * @property {boolean} debug
 */

const readFileAsync = promisify(fs.readFile);

class ClientMgr {
  static initLogger(debug = false) {
    return process.env.NR_DEBUG === "true" || process.env.NR_DEBUG === "1" || debug === true
      ? console
      : { log: () => {}, error: () => {}, debug: () => {} };
  }

  static async readJson(path) {
    const data = await readFileAsync(require.resolve(path));
    return JSON.parse(data.toString());
  }

  /**
   * Handles the registration of hosts using a json file
   * @param {string} filePath
   * @returns {Promise<string[]>}
   */
  static async registerHostsWithFile(filePath = process.env.NR_HOSTS_FILE) {
    const data = await this.readJson(filePath);
    console.debug("Reading hosts from file: " + filePath);
    if (data && data.hosts) {
      return await this.registerHosts(data.hosts, data.options);
    } else {
      console.error(filePath + " is not a valid host file!");
    }
  }

  /**
   * Handles registration of multiple service connection tunnels with the noderouter service
   * @param {ClientInfoObj[]} hosts
   * @param {NRClientOptions} options
   * @returns {Promise<string[]>} - Array of host signatures
   */
  static async registerHosts(hosts, options) {
    var signatures = [];
    for (let k in hosts) {
      let host = hosts[k];
      let sign = await this.registerHost(host, options);
      signatures.push(sign);
    }

    return signatures;
  }

  /**
   * Handles registration of a single service connection tunnel with the noderouter service
   * @param {ClientInfoObj} client
   * @param {NRClientOptions} options
   * @param {function} callback
   * @returns {Promise<string>} - host signature
   */
  static async registerHost(
    {
      connType,
      srcHost,
      dstHost,
      dstPort,
      isLocal,
      srcPath = null,
      dstPath = null
    },
    { httpsApi = false, debug = false },
    callback = res => {}
  ) {
    return new Promise((resolve, reject) => {
      // enable debug logging on request only
      const logger = this.initLogger(debug);

      const signature = JSON.stringify({
        connType,
        srcHost,
        dstHost,
        dstPort,
        srcPath,
        dstPath,
        isLocal
      });

      const sendRequest = () => {
        const client = httpsApi ? https : http;

        var hostname = process.env.DOCKER_CONTAINER
          ? "noderouter.localhost"
          : "localhost";

        var request = client.request(
          {
            hostname,
            port: API_PORT,
            path: "/register",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(signature)
            }
          },
          res => {
            switch (res.statusCode) {
              case 200:
                logger.log("Pong");
                break;
              case 201:
                logger.log("Registered");
                break;
              case 205:
                logger.log("Reset");
                break;
              default:
                logger.log("Unknown status");
                break;
            }

            resolve(signature);

            callback(res);
          }
        );

        request.on("error", e => {
          logger.error("Cannot reach the router", e);
          reject(e);
        });

        request.end(signature, () => logger.log("ping"));
      };

      sendRequest();

      setInterval(sendRequest, 5000);
    });
  }

  static unregisterHost(
    signature,
    { httpsApi = false, debug = false },
    cb = statusCode => {}
  ) {
    const client = httpsApi ? https : http;

    const logger = this.initLogger(debug);

    var hostname = process.env.DOCKER_CONTAINER
      ? "noderouter.localhost"
      : "localhost";

    var request = client.request(
      {
        hostname,
        port: API_PORT,
        path: "/unregister",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(signature)
        }
      },
      res => {
        switch (res.statusCode) {
          case 200:
            logger.log("Unregistered!");
            break;
          default:
            logger.log("Unknown status");
            break;
        }

        cb(res.statusCode);
      }
    );

    request.on("error", e => {
      logger.error("Cannot reach the noderouter", e);
    });

    request.end(signature, () => logger.log("Unregistering..."));
  }

  static unregisterHosts(signatures, options, cb = () => {}) {
    signatures.map(s => this.unregisterHost(s, options, cb));
  }
}

module.exports = {
  CONN_TYPE,
  ClientMgr,
  registerHostsWithFile: ClientMgr.registerHostsWithFile,
  registerHost: ClientMgr.registerHost,
  registerHosts: ClientMgr.registerHosts,
  unregisterHost: ClientMgr.unregisterHost,
  unregisterHosts: ClientMgr.unregisterHosts
};
