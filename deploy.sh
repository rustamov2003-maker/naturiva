#!/usr/bin/env bash
# Publish the built site to the VPS (nginx vhost "naturiva").
#   ./deploy.sh
# Rebuilds first, then copies the public files to /var/www/naturiva and the
# sources to /srv/naturiva-src. Other sites on the server are untouched.
set -euo pipefail
HOST="${NATURIVA_HOST:-mardeco}"
cd "$(dirname "$0")"
python build.py
PUBLIC=(index.html assistant.html books.html candles.html faq.html formulation.html
        ingredients.html skincare.html soapmaking.html start.html books knowledge assets robots.txt)
[ -f sitemap.xml ] && PUBLIC+=(sitemap.xml)
tar czf - "${PUBLIC[@]}" | ssh "$HOST" 'tar xzf - -C /var/www/naturiva && chown -R www-data:www-data /var/www/naturiva'
tar czf - content src build.py README.md tests deploy.sh | ssh "$HOST" 'tar xzf - -C /srv/naturiva-src'
echo "Deployed to http://naturiva.129.121.111.249.nip.io/"
