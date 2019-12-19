const { ClientMgr } = require("./index");
const fs = require("fs");
const path = require("path");

var arg = process.argv[2];

var file = arg ? arg : process.env.NR_HOSTS_FILE;

if (!file || !fs.existsSync(file)) {
  console.error("No existing host file specified: "+file)
  process.exit(1)
}

ClientMgr.registerHostsWithFile(path.resolve(file));
