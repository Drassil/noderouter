#!/usr/bin/env node

const ApiServer = require('./apiServer');
const fs = require('fs');
const path = require('path');
const cli = require('../lib/CLI');

/**
 *
 */
function showHelp() {
  console.log('Usage: noderouter [OPTIONS]');
  console.log('Options:');
  console.log('  -h, --help : show help information');
  console.log('  -f, --hosts    : run the client with an host.json file, if not specified no hosts will be registered now');
  console.log('  --apiPort  : set the listening port for noderouter API');
  console.log('  --httpPort : set the listening port for the http proxy');
  console.log('  --tslPort  : set the listening port for the TSL proxy');
  console.log('  --apiSSL   : specify if the API is behind SSL');
  process.exit();
}

const argv = cli(process.argv.slice(2), {
  string: ['hosts', 'apiPort', 'tslPort', 'httpPort'],
  boolean: ['h', 'apiSSL'],
  alias: {h: 'help', hosts: 'f'},
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

// start API server
new ApiServer({
  apiPort: argv.apiPort,
  httpRouterPort: argv.httpPort,
  tlsRouterPort: argv.tslPort,
  ssl: argv.apiSSL,
});

// if filename specified, then run client too
const file = argv.hosts || process.env.NR_HOSTS_FILE;

if (file && fs.existsSync(file)) {
  const {ClientMgr} = require('../client/index');

  ClientMgr.registerHostsWithFile(path.resolve(file));
}
