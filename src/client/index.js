try {
  // @ts-ignore
  require('dotenv').config();
} catch (ex) {
  console.log('No .env loaded');
}
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {promisify} = require('util');
const {API_PORT, CONN_TYPE, TTL} = require('../def/const');
const Logger = require('../lib/Logger');

/**
 * @typedef {Object} NRClientOptions
 * @property {string} [routerHost] - hostname or ip of router,
 * default: retrieved hostname by "os" package
 * @property {boolean} [httpsApi] - connect to router via https
 * @property {boolean} [enable] - a simple switch to enable/disable
 * the router configuration
 * @property {import("../lib/Logger").logOpts} logOpts - Logger options
 */

const readFileAsync = promisify(fs.readFile);

class ClientMgr {
  static async readJson(path) {
    const data = await readFileAsync(require.resolve(path));
    return JSON.parse(data.toString());
  }

  /**
   * Handles the registration of hosts using a json file
   *
   * @param {string} filePath - path of the host file
   * @returns {Promise<string[]>} - a Promise that will return
   * the signature array
   */
  static async registerHostsWithFile(filePath = process.env.NR_HOSTS_FILE) {
    const extname = path.extname(filePath);

    const data =
      extname === '.json' ?
        (await this.readJson(filePath)).noderouter :
        require(filePath).noderouter;
    console.debug('Reading hosts from file: ' + filePath);
    if (data && data.hosts) {
      return await ClientMgr.registerHosts(data.hosts, data.options);
    } else {
      console.error(filePath + ' is not a valid host file!');
    }
  }

  /**
   * Handles registration of multiple service connection tunnels with
   *  the noderouter service
   *
   * @param {import('src/def/jsdoc').ClientInfoObj[]} hosts -
   * Clients information
   * @param {NRClientOptions} options - Router options
   * @returns {Promise<string[]>} - Array of host signatures
   */
  static async registerHosts(hosts, options) {
    const signatures = [];
    for (const k in hosts) {
      if (!Object.prototype.hasOwnProperty.call(hosts, k)) continue;
      const host = hosts[k];
      const sign = await ClientMgr.registerHost(host, options);
      signatures.push(sign);
    }

    return signatures;
  }

  /**
   * Handles registration of a single service connection tunnel
   * with the noderouter service
   *
   * @param {import('src/def/jsdoc').ClientInfoObj} client - client info
   * @param {NRClientOptions} options - Router options
   * @param {Function} callback - Callback function
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
        dstPath = null,
        timeToLive = TTL,
      },
      {
        enable = true,
        routerHost = os.hostname(),
        httpsApi = false,
        logOpts = {},
      },
      callback = (res) => {},
  ) {
    if (enable === false) {
      return;
    }

    if (!logOpts.prefix) {
      logOpts.prefix = 'NodeRouter [client]:';
    }

    const logger = new Logger(logOpts);

    const signature = JSON.stringify({
      connType,
      srcHost,
      dstHost,
      dstPort,
      srcPath,
      dstPath,
      isLocal,
      timeToLive,
    });

    return new Promise((resolve, reject) => {
      const sendRequest = () => {
        const client = httpsApi ? https : http;

        const hostname = routerHost;

        const request = client.request(
            {
              hostname,
              port: API_PORT,
              path: '/register',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(signature),
              },
            },
            (res) => {
              switch (res.statusCode) {
                case 200:
                  logger.debug('Pong', signature);
                  break;
                case 201:
                  logger.log('Registered');
                  break;
                case 205:
                  logger.log('Reset');
                  break;
                default:
                  logger.log('Unknown status');
                  break;
              }

              resolve(signature);

              callback(res);
            },
        );

        request.on('error', (e) => {
          logger.error('Cannot reach the router', e);
          setTimeout(sendRequest, TTL); // retry after a default TTL cycle
          reject(e);
        });

        request.end(signature, () =>
          logger.debug('ping', `timeToLive: ${timeToLive}`, signature),
        );
      };

      sendRequest();

      setInterval(sendRequest, timeToLive);
    }).catch(() => {
      return signature;
    });
  }

  /**
   * Handles deregistration of a single service connection tunnel
   * with the noderouter service
   *
   * @param {string} signature - Client signature
   * @param {NRClientOptions} options - Router options
   * @param {Function} cb - Callback function
   */
  static unregisterHost(
      signature,
      {routerHost = os.hostname(), httpsApi = false, logOpts = {}},
      cb = (statusCode) => {},
  ) {
    const client = httpsApi ? https : http;

    const logger = new Logger(logOpts);

    const hostname = routerHost;

    const request = client.request(
        {
          hostname,
          port: API_PORT,
          path: '/unregister',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(signature),
          },
        },
        (res) => {
          switch (res.statusCode) {
            case 200:
              logger.log('Unregistered!');
              break;
            default:
              logger.log('Unknown status');
              break;
          }

          cb(res.statusCode);
        },
    );

    request.on('error', (e) => {
      logger.error('Cannot reach the noderouter', e);
    });

    request.end(signature, () => logger.log('Unregistering...'));
  }

  static unregisterHosts(signatures, options, cb = () => {}) {
    signatures.map((s) => ClientMgr.unregisterHost(s, options, cb));
  }
}

module.exports = {
  CONN_TYPE,
  ClientMgr,
  registerHostsWithFile: ClientMgr.registerHostsWithFile,
  registerHost: ClientMgr.registerHost,
  registerHosts: ClientMgr.registerHosts,
  unregisterHost: ClientMgr.unregisterHost,
  unregisterHosts: ClientMgr.unregisterHosts,
};
