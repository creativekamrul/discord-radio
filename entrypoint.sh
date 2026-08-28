#!/bin/sh
mkdir -p /app/audio
chown -R appuser:appgroup /app/audio
exec gosu appuser node server.js
