const {mergeDeep} = require('@acore/noderouter/src/lib/utils');
const _confDef = require('./dist/routerConf.js');
const fs = require('fs');
const path = require('path');

let mConf = _confDef;

const confPath = path.join(__dirname, './routerConf.js');
if (fs.existsSync(confPath)) {
  const _conf = require(confPath);
  delete _conf.default;
  delete _confDef.default;

  mConf = mergeDeep(_confDef, _conf);
}

module.exports = mConf;
