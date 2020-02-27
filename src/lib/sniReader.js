"use strict";

const inherits = require("util").inherits;

module.exports = function(socket, callback) {
  var readLength;
  var readCallback;
  var readBuffer = [];

  socket.on("error", error);
  read(5, onHeader);

  function error(err) {
    socket.removeListener("readable", readable);
    finish(err);
  }

  function finish(err, sn) {
    socket.removeListener("error", error);

    for (var i = readBuffer.length - 1; i >= 0; i--) {
      socket.unshift(readBuffer[i]);
    }
    readBuffer = null;

    callback(err, sn);
  }

  function read(length, cb) {
    var chunk = socket.read(length);

    if (!chunk) {
      readLength = length;
      readCallback = cb;
      socket.once("readable", readable);
      return;
    }

    // If there is less bytes than requested means EOF.
    // That means we got a protocol error.
    if (chunk.length !== length) return error(new ProtocolError());

    readBuffer.push(chunk);
    cb(chunk);
  }

  function readable() {
    read(readLength, readCallback);
  }

  function onHeader(chunk) {
    var pos = 0;

    // enum[255] ContentType
    var type = chunk[pos];
    pos += 1;

    if (type !== 22)
      // Not TLS Handshake
      return error(new ProtocolError());

    // ProtocolVersion
    pos += 2; // version

    // uint16 TLSPlaintext.length
    var length = chunk.readUInt16BE(pos);
    pos += 2;

    // We must at least read something
    if (length === 0) return error(new ProtocolError());

    read(length, onFragment);
  }

  function onFragment(chunk) {
    var pos = 0;
    var length;
    var value;

    // enum[255] HandshakeType
    value = chunk[pos];
    pos += 1;

    if (value !== 1)
      // Not ClientHello
      return error(new ProtocolError());

    pos += 3; // Handshake.Length

    pos += 2; // ProtocolVersion
    pos += 28; // Random.random_bytes
    pos += 4; // Random.gmt_unix_time
    pos += 1 + chunk.readUInt8(pos, true); // SessionID
    pos += 2 + chunk.readUInt16BE(pos, true); // CipherSuite
    pos += 1 + chunk.readUInt8(pos, true); // CompressionMethod

    // Check lenghts above
    // Instead of having an if after each length read above, we just ignore
    // oob errors and check it here.
    if (isNaN(pos) || pos > chunk.length) return error(new ProtocolError());

    // If this is the end of the chunk, then there is no extensions
    if (chunk.length === pos) return finish();

    // Check that there is at least two bytes left
    if (chunk.length < pos + 2) return error(new ProtocolError());

    // Extension extensions<0..2^16-1>
    length = chunk.readUInt16BE(pos);
    pos += 2;

    // The rest of the handshake should be extensions
    if (length !== chunk.length - pos) return error(new ProtocolError());

    // Loop throught extensions
    while (pos < chunk.length) {
      // enum ExtensionType
      value = chunk.readInt16BE(pos);
      pos += 2;

      // uint16 Extension.extension_data.length
      length = chunk.readUInt16BE(pos);
      pos += 2;

      // Length can not be bigger than the rest of the packet
      if (length > chunk.length - pos) return error(new ProtocolError());

      if (value !== 0) {
        // some other extension
        pos += length;
        continue;
      }

      // uint16 ServerNameList.length
      length = chunk.readUInt16BE(pos);
      pos += 2;

      // Length can not be bigger than the rest of the packet
      if (length > chunk.length - pos) return error(new ProtocolError());

      // enum NameType
      value = chunk[pos];
      pos += 1;

      // uint16 HostName.length
      length = chunk.readUInt16BE(pos);
      pos += 2;

      // Length can not be bigger than the rest of the packet
      if (length > chunk.length - pos) return error(new ProtocolError()); // protocol error

      // Unknown Name Type
      if (value !== 0) {
        pos += length;
        continue;
      }

      // opaque HostName
      value = chunk.toString("utf8", pos, pos + length);
      return finish(null, value);
    }

    // SNI Not present
    finish();
  }
};

inherits(ProtocolError, Error);
module.exports.ProtocolError = ProtocolError;
function ProtocolError() {
  Error.captureStackTrace(this, ProtocolError);
  Error.call(this);
}
