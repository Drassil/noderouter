const {getBoolean} = require('./utils');

/**
 * @typedef {Object} logOpts - options for logger
 * @property {string} [prefix] - prefix string to use in logs
 * @property {boolean} [debug] - enable debug logging
 * @property {boolean} [error] - enable error logging
 * @property {boolean} [info] - enable info logging
 * @property {boolean} [warn] - enable warn logging
 * @property {boolean} [withTrace] - enable trace stack in errors
 */

/**
 * Simple configurable wrapper for console.log
 */
module.exports = class Logger {
  /**
   *
   * @param {logOpts} logOpt - Logger options
   */
  constructor({
    prefix = 'Noderouter:',
    debug = getBoolean(process.env.NR_LOG_DEBUG, false),
    error = getBoolean(process.env.NR_LOG_ERROR, true),
    info = getBoolean(process.env.NR_LOG_INFO, true),
    warn = getBoolean(process.env.NR_LOG_WARN, true),
    withTrace = getBoolean(process.env.NR_LOG_WITH_TRACE, true),
  }) {
    this.debug = function(...args) {
      debug && console.debug.apply(null, [prefix, ...args]);
    };
    this.error = function(...args) {
      error &&
        (withTrace ? console.error : console.trace).apply(null, [
          prefix,
          ...args,
        ]);
    };
    this.info = this.log = function(...args) {
      info && console.log.apply(null, [prefix, ...args]);
    };
    this.warn = function(...args) {
      warn && console.warn.apply(null, [prefix, ...args]);
    };

    this.debug('Logger enabled with conf: ', {
      debug,
      error,
      info,
      warn,
      withTrace,
    });
  }
};
