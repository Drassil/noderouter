const {getBoolean} = require('@acore/noderouter/src/lib/utils');

module.exports = {
  /** @type {number}**/ TTL: parseInt(process.env.NR_TTL) || 5000,
  /** wait time if the ping has not been sent within TTL time
   *
   * @type {number}**/ TTL_WAIT: parseInt(process.env.NR_TTL_WAIT) || 10000,
  /** @type {number}**/ TLS_ROUTER_PORT: parseInt(process.env.NR_TLS_ROUTER_PORT) || 443,
  /** @type {number}**/ HTTP_ROUTER_PORT: parseInt(process.env.NR_HTTP_ROUTER_PORT) || 80,
  /** @type {boolean}**/ API_SSL: getBoolean(process.env.NR_API_SSL, false),
  /** @type {number}**/ API_PORT: parseInt(process.env.NR_API_PORT) || 4010,
  /** @type {string[]}**/ dnsAddresses: [process.env.NR_DNS_1 || '8.8.8.8', process.env.NR_DNS_2 || '8.8.4.4'],
  /** @type {import("/def/jsdoc").ClientInfoObj[]} */
  hosts: [],
  logger: {
    /** @type {string}**/ prefix: process.env.NR_LOG_PREFIX || 'NodeRouter',
    /** @type {boolean}**/ debug: getBoolean(process.env.NR_LOG_DEBUG, false),
    /** @type {boolean}**/ error: getBoolean(process.env.NR_LOG_ERROR, true),
    /** @type {boolean}**/ info: getBoolean(process.env.NR_LOG_INFO, true),
    /** @type {boolean}**/ warn: getBoolean(process.env.NR_LOG_WARN, true),
    /** @type {boolean}**/ withTrace: getBoolean(process.env.NR_LOG_WITH_TRACE, true),
  },
};
