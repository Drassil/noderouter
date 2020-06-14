#!/usr/bin/env node

const ApiServer = require('./apiServer');
const fs = require('fs');
const path = require('path');

process.on('uncaughtException', function(error) {
  console.error('Uncaught Exception: ', error);
});

process.on('SIGINT', function() {
  process.exit();
});

// start API server
new ApiServer({});

// if filename specified, then run client too
const arg = process.argv[2];

const file = arg ? arg : process.env.NR_HOSTS_FILE;

if (file && fs.existsSync(file)) {
  const {ClientMgr} = require('../client/index');

  ClientMgr.registerHostsWithFile(path.resolve(file));
}
