#!/bin/bash
# Double-click in Finder to play.
cd "$(dirname "$0")" && node server.js --open
