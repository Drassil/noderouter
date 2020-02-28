const Logger = require('../lib/Logger');
const {logger: loggerConf} = require('../conf');

module.exports = new Logger(loggerConf);
