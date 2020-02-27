const dns = require("dns");

function getBoolean(value, def = false) {
  switch (value) {
    case true:
    case "true":
    case 1:
    case "1":
    case "on":
    case "yes":
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
  return new Promise(resolve =>
    dns.resolve("google.it", function(err) {
      resolve(!err || err.code != "ENOTFOUND");
    })
  );
}

function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}

function mergeDeep(target, source) {
  let output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) Object.assign(output, { [key]: source[key] });
        else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

module.exports = {
  isObject,
  mergeDeep,
  checkInternet,
  getBoolean
};
