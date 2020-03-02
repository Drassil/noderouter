#!/bin/bash

SCRIPTPATH="$( cd "$(dirname "$0")" ; pwd -P )"

ARG1=${1:-cert}

openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout "$ARG1.pkey" -out "$ARG1.crt" -config openssl.cnf