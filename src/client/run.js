#!/usr/bin/env node

const {ClientMgr} = require('./index');
const fs = require('fs');
const path = require('path');
const cli = require('../lib/CLI');

const argv = cli(process.argv.slice(2));

const arg = argv._[0];

const file = arg ? arg : process.env.NR_HOSTS_FILE;

if (!file || !fs.existsSync(file)) {
  console.error('No existing host file specified: ' + file);
  process.exit(1);
}

ClientMgr.registerHostsWithFile(path.resolve(file));
