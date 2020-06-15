const {getBoolean} = require('../../lib/utils');

module.exports = {
  TTL: process.env.NR_TTL || 5000,
  TTL_WAIT: process.env.NR_TTL_WAIT || 10000, // wait time if the ping has not been sent within TTL time
  TLS_ROUTER_PORT: process.env.NR_TLS_ROUTER_PORT || 443,
  HTTP_ROUTER_PORT: process.env.NR_HTTP_ROUTER_PORT || 80,
  API_PORT: process.env.NR_API_PORT || 4010,
  dnsAddresses: [process.env.NR_DNS_1 || '8.8.8.8', process.env.NR_DNS_2 || '8.8.4.4'],
  logger: {
    prefix: process.env.NR_LOG_PREFIX || 'NodeRouter',
    debug: getBoolean(process.env.NR_LOG_DEBUG, false),
    error: getBoolean(process.env.NR_LOG_ERROR, true),
    info: getBoolean(process.env.NR_LOG_INFO, true),
    warn: getBoolean(process.env.NR_LOG_WARN, true),
    withTrace: getBoolean(process.env.NR_LOG_WITH_TRACE, true),
  },
};
