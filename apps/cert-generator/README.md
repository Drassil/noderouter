# cert-generator

## HOW TO GENERATE A CERTIFICATE

1. copy and rename (not rename directly) the openssl.cnf.dist in openssl.cnf
2. edit configuration inside the openssl.cnf file on your needs
3. run 

```
./genkey.sh filename
```

filename must not contain the extension (ex: .cert/.key), it will automatically added

4. put the generated file in /src/conf/ folder to be used with the router
5. eventually install the certificate in your host