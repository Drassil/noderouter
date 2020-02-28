const dns = require('dns');

/**
 * @param {*} value - value where to extract the boolean form
 * @param {boolean} def - default boolean value
 * @returns {boolean} - the extracted boolean value
 */
function getBoolean(value, def = false) {
  switch (value) {
    case true:
    case 'true':
    case 1:
    case '1':
    case 'on':
    case 'yes':
      return true;
    default:
      return def;
  }
}

/**
 *
 * @returns {Promise<boolean>} - Result of the check
 */
async function checkInternet() {
  return new Promise((resolve) =>
    dns.resolve('google.it', function(err) {
      resolve(!err || err.code != 'ENOTFOUND');
    }),
  );
}

/**
 * @param {*} item - Variable to check
 * @returns {boolean} - result
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * @param {Object} target - target object
 * @param {Object} source - source object
 * @returns {Object} - merged object
 */
function mergeDeep(target, source) {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) Object.assign(output, {[key]: source[key]});
        else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, {[key]: source[key]});
      }
    });
  }
  return output;
}

module.exports = {
  isObject,
  mergeDeep,
  checkInternet,
  getBoolean,
};
