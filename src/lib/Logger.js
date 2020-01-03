const { getBoolean } = require("./utils");

/**
 * @typedef {Object} logOpts - options for logger
 * @property {boolean} [logOpt.debug] - enable debug logging
 * @property {boolean} [logOpt.error] - enable error logging
 * @property {boolean} [logOpt.info] - enable info logging
 * @property {boolean} [logOpt.warn] - enable warn logging
 * @property {boolean} [logOpt.withTrace] - enable trace stack in errors
 */

/**
 * Simple configurable wrapper for console.log
 */
module.exports = class Logger {
  /**
   *
   * @param {logOpts} logOpt
   */
  constructor({
    debug = getBoolean(process.env.NR_LOG_DEBUG),
    error = getBoolean(process.env.NR_LOG_ERROR, true),
    info = getBoolean(process.env.NR_LOG_INFO, true),
    warn = getBoolean(process.env.NR_LOG_WARN, true),
    withTrace = getBoolean(process.env.NR_LOG_WITH_TRACE, true)
  }) {
    this.debug = debug ? console.debug : () => {};
    this.error = error ? (withTrace ? console.error : console.trace) : () => {};
    this.info = this.log = info ? console.info : () => {};
    this.warn = warn ? console.warn : () => {};

    this.debug("Logger enabled with conf: ", {
      debug,
      error,
      info,
      warn,
      withTrace
    });
  }
};
