#!/usr/bin/env node

const ApiServer = require('./apiServer');
const path = require('path');
const cli = require('@acore/noderouter/src/lib/CLI');
const {mergeDeep} = require('@acore/noderouter/src/lib/utils');

/**
 *
 */
function showHelp() {
  console.log('Usage: noderouter [OPTIONS]');
  console.log('Options:');
  console.log('  -h, --help : show help information');
  console.log('  -c, --conf : load configuration file');
  console.log('  --apiPort  : set the listening port for noderouter API');
  console.log('  --httpPort : set the listening port for the http proxy');
  console.log('  --tslPort  : set the listening port for the TSL proxy');
  console.log('  --apiSSL   : specify if the API is behind SSL');
  process.exit();
}

const argv = cli(process.argv.slice(2), {
  string: ['conf', 'apiPort', 'tslPort', 'httpPort'],
  boolean: ['h', 'apiSSL'],
  alias: {h: 'help', conf: 'c'},
  default: [],
  unknown: showHelp,
});

if (argv.help) showHelp();

process.on('uncaughtException', function(error) {
  console.error('Uncaught Exception: ', error);
});

process.on('SIGINT', function() {
  process.exit();
});

let conf = require('@acore/noderouter/src/conf');
const extraConf = argv.conf || process.env.NR_CONF_FILE;
if (extraConf) {
  const selConf = require(path.join(process.cwd(), extraConf));
  conf = mergeDeep(selConf, conf);
}

// start API server
const api = new ApiServer();

api.init({
  apiPort: argv.apiPort || conf.API_PORT,
  httpRouterPort: argv.httpPort || conf.HTTP_ROUTER_PORT,
  tlsRouterPort: argv.tslPort || conf.TLS_ROUTER_PORT,
  ssl: argv.apiSSL || conf.API_SSL,
  dnsAddresses: conf.dnsAddresses,
  loggerConf: conf.logger,
  hosts: conf.hosts,
});
