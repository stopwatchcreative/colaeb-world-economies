#!/usr/bin/env bash
# Minified builds served to the site: web/wer.min.js, web/wer.min.css
set -euo pipefail
cd "$(dirname "$0")"
npx --yes esbuild@0.24 wer.js --minify --target=es2017 --legal-comments=inline --outfile=wer.min.js
npx --yes esbuild@0.24 wer.css --minify --outfile=wer.min.css
