module.exports = {
  TLS_ROUTER_PORT: 443,
  HTTP_ROUTER_PORT: 80,
  API_PORT: 4010,
  CONN_TYPE: {
    /** HTTP_PROXY create an http -> service proxy with path support */
    HTTP_PROXY: 1,
    /** HTTPS_PROXY create a tls -> https -> service proxy with path support */
    HTTPS_PROXY: 2,
    /** TLS_TUNNEL create a tls -> service a TCP tunnel with TLS, SNI & SSL Passthrough support, but no proxy path possible */
    TLS_TUNNEL: 3
  }
};
