#!/bin/sh
mkdir -p /app/audio /app/data
chown -R appuser:appgroup /app/audio /app/data
exec gosu appuser node server.js
