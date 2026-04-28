#!/bin/sh
mkdir -p /app/audio
chown -R appuser:appgroup /app/audio
exec su-exec appuser node server.js
