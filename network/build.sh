#!/usr/bin/env bash
# Minified builds served to colaeb.com/network: network/cn.min.js, network/cn.min.css
set -euo pipefail
cd "$(dirname "$0")"
npx --yes esbuild@0.24 cn.js --minify --target=es2017 --legal-comments=inline --outfile=cn.min.js
npx --yes esbuild@0.24 cn.css --minify --outfile=cn.min.css
