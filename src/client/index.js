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

function initLogger(debug = false) {
  return process.env.NODEROUTER_CLIENT_DEBUG || debug === true
    ? console.debug
    : () => {};
}

async function readJson(path) {
  const data = await readFileAsync(
    require.resolve(__dirname + "/../../" + path)
  );
  return JSON.parse(data.toString());
}

async function registerHostsWithFile(
  filePath = process.env.NODEROUTER_CLIENT_CONFFILE
) {
  console.debug("Reading hosts from file: " + filePath);
  const data = await readJson(filePath);
  if (data && data.hosts) {
    return registerHosts(data.hosts, data.options);
  }
}

/**
 * Handles registration of multiple service connection tunnels with the noderouter service
 * @param {ClientInfoObj[]} hosts
 * @param {NRClientOptions} options
 * @returns {string[]} - Array of host signatures
 */
function registerHosts(hosts, options) {
  const signatures = hosts.map(host => registerHost(host, options));
  return signatures;
}

/**
 * Handles registration of a single service connection tunnel with the noderouter service
 * @param {ClientInfoObj} client
 * @param {NRClientOptions} options
 * @param {Function} callback
 * @returns {string} - host signature
 */
function registerHost(
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
  // enable debug logging on request only
  const log = initLogger(debug);

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

    var request = client.request(
      {
        hostname: "localhost",
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
            log("Pong");
            break;
          case 201:
            log("Registered");
            break;
          case 205:
            log("Reset");
            break;
          default:
            log("Unknown status");
            break;
        }

        callback(res);
      }
    );

    request.on("error", e => {
      console.error("Cannot reach the router", e);
    });

    request.end(signature, () => log("ping"));
  };

  sendRequest();

  setInterval(sendRequest, 5000);

  return signature;
}

function unregisterHost(
  signature,
  { httpsApi = false, debug = false },
  cb = statusCode => {}
) {
  const client = httpsApi ? https : http;

  const log = initLogger(debug);

  var request = client.request(
    {
      hostname: "localhost",
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
          log("Unregistered!");
          break;
        default:
          log("Unknown status");
          break;
      }

      cb(res.statusCode);
    }
  );

  request.on("error", e => {
    console.error("Cannot reach the noderouter", e);
  });

  request.end(signature, () => log("Unregistering..."));
}

function unregisterHosts(signatures, options, cb = () => {}) {
  signatures.map(s => unregisterHost(s, options, cb));
}

module.exports = {
  CONN_TYPE,
  registerHostsWithFile,
  registerHost,
  registerHosts,
  unregisterHost,
  unregisterHosts
};
