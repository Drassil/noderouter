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
    debug = false,
    error = true,
    info = true,
    warn = true,
    withTrace = true,
  }) {
    this.debug = function(...args) {
      debug && console.debug.apply(null, [prefix, ...args]);
    };
    this.error = function(...args) {
      error &&
        (withTrace ? console.trace : console.error).apply(null, [
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
