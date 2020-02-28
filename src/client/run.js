const {ClientMgr} = require('./index');
const fs = require('fs');
const path = require('path');

const arg = process.argv[2];

const file = arg ? arg : process.env.NR_HOSTS_FILE;

if (!file || !fs.existsSync(file)) {
  console.error('No existing host file specified: ' + file);
  process.exit(1);
}

ClientMgr.registerHostsWithFile(path.resolve(file));
