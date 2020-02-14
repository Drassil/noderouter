const { mergeDeep } = require("../lib/utils");
const _confDef = require("./dist/conf.js");

/**@type {_confDef} */
var mConf;
try {
  // @ts-ignore
  var _conf = require("./conf.js");
  delete _conf.default;
  delete _confDef.default;

  mConf = mergeDeep(_confDef, _conf);
} catch (ex) {
  mConf = _confDef;
}

module.exports = mConf;
