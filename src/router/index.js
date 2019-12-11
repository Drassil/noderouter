const ApiServer = require("./apiServer");

process.on("uncaughtException", function(error) {
  console.error("Uncaught Exception: "+error);
});

process.on('SIGINT', function() {
  process.exit();
});

new ApiServer({});
