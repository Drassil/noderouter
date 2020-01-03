function getBoolean(value, def = false) {
  switch (value) {
    case true:
    case "true":
    case 1:
    case "1":
    case "on":
    case "yes":
      return true;
    default:
      return def;
  }
}

module.exports = {
  getBoolean
}
