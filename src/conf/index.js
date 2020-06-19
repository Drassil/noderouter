const {mergeDeep} = require('@acore/noderouter/src/lib/utils');
const _confDef = require('./dist/routerConf.js');
const fs = require('fs');
const path = require('path');

let mConf = _confDef;

if (fs.existsSync(path.join(__dirname, './routerConf.js'))) {
  const _conf = require('./routerConf.js');
  delete _conf.default;
  delete _confDef.default;

  mConf = mergeDeep(_confDef, _conf);
}

module.exports = mConf;
