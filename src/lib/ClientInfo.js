require("../def/jsdoc");
var assert = require("assert");

/**
 * This class is used to ensure that data retrieved from clients
 * are valid.
 */
class ClientInfo {
  /**
   *
   * @param {ClientInfoObj} info
   */
  constructor({ isLocal, isSSL, srcHost, dstHost, dstPort }) {
    assert(typeof isLocal === "boolean");
    assert(typeof isSSL === "boolean");
    assert(srcHost && typeof srcHost === "string");
    assert(dstHost && typeof dstHost === "string");
    assert(dstPort && typeof srcHost === "number");

    this.isLocal = isLocal;
    this.isSSL = isSSL;
    this.srcHost = srcHost;
    this.dstHost = dstHost;
    this.dstPort = dstPort;
  }
}

module.exports = ClientInfo;
