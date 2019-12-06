const http = require("http");
const https = require("https");
const { API_PORT, CONN_TYPE } = require("./def/const");

function registerHost(
  connType,
  srcHost,
  dstHost,
  dstPort,
  isLocal,
  srcPath = null,
  dstPath = null,
  httpsApi = false
) {
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
    /**@type {http} */
    const client = httpsApi ? https : http;

    var request = new client.request(
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
            console.debug("Pong");
            break;
          case 201:
            console.debug("Registered");
            break;
          case 205:
            console.debug("Reset");
            break;
          default:
            console.debug("Unknown status");
            break;
        }
      }
    );

    request.on("error", e => {
      console.debug("Cannot reach the router", e.code);
    });

    request.end(signature, () => console.debug("ping"));
  };

  sendRequest();

  setInterval(sendRequest, 5000);

  return signature;
}

function unregisterHost(signature, httpsApi = false, cb = () => {}) {
  /**@type {http} */
  const client = httpsApi ? https : http;

  var request = new client.request(
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
          console.debug("Unregistered!");
          break;
        default:
          console.debug("Unknown status");
          break;
      }

      cb(res.statusCode);
    }
  );

  request.on("error", e => {
    console.debug("Cannot reach the router", e.code);
  });

  request.end(signature, () => console.debug("Unregistering..."));
}

/**
 * Handles registration and unregistration of a service connection tunnel with the router
 * @param {CONN_TYPE} connType
 * @param {string} srcHost
 * @param {string} dstHost
 * @param {number} dstPort
 * @param {boolean} isLocal
 * @param {string} srcPath
 * @param {string} dstPath
 * @param {boolean} httpsApi
 */
function createTunnel(
  connType,
  srcHost,
  dstHost,
  dstPort,
  isLocal,
  srcPath = null,
  dstPath = null,
  httpsApi = false
) {
  const signature = registerHost(
    connType,
    srcHost,
    dstHost,
    dstPort,
    isLocal,
    srcPath,
    dstPath,
    httpsApi
  );

  /*function exitHandler(type) {
    console.log(process.listenerCount(type));
    return new Promise(resolve => {
      unregisterHost(signature, false, () => {
        console.log(process.listenerCount(type));
        resolve();
        if (process.listenerCount(type) <= 1) process.exit();
      });
    });
  }

  //do something when app is closing
  process.once("exit", exitHandler.bind(null, "exit"));
  console.log(process.listenerCount("exit"));

  //catches ctrl+c event
  process.once("SIGINT", exitHandler.bind(null, "SIGINT"));
  */

  return signature;
}

module.exports = {
  CONN_TYPE,
  createTunnel,
  registerHost,
  unregisterHost
};
