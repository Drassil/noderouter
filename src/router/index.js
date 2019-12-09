const ApiServer = require("./apiServer");

process.on("uncaughtException", function(error) {
  console.error(error);
});

process.on('SIGINT', function() {
  process.exit();
});

new ApiServer({});
