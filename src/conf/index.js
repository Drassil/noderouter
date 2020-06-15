const {mergeDeep} = require('../lib/utils');
const _confDef = require('./dist/routerConf.js');

/** @type {_confDef} */
let mConf;
try {
  // @ts-ignore
  const _conf = require('./routerConf.js');
  delete _conf.default;
  delete _confDef.default;

  mConf = mergeDeep(_confDef, _conf);
} catch (ex) {
  mConf = _confDef;
}

module.exports = mConf;
