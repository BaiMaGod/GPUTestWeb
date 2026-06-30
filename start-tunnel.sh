#!/bin/bash
# Tunnel launcher script

LOGFILE="/tmp/tunnel.log"
echo "Starting tunnel at $(date)" > $LOGFILE

npx localtunnel --port 5174 2>&1 | while read line; do
    echo "$line" | tee -a $LOGFILE
done
