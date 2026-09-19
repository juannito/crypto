#!/usr/bin/python3

# Para correr en Apache con mod_wsgi (Python 3)
#
# Incluir en la config del VirtualHost (solo https):
#
#   WSGIDaemonProcess crypto python-home=/var/www/crypto.baicom.com/web/crypto/venv
#   WSGIProcessGroup crypto
#   WSGIScriptAlias / /var/www/crypto.baicom.com/web/crypto/app.wsgi
#
#   # Archivos estáticos del build de React (no la carpeta static/ antigua)
#   Alias /static /var/www/crypto.baicom.com/web/crypto/frontend/build/static
#   <Directory /var/www/crypto.baicom.com/web/crypto/frontend/build/static>
#       Require all granted
#       Header always set X-Content-Type-Options "nosniff"
#       Header always set Cache-Control "public, max-age=31536000, immutable"
#   </Directory>
#
# Las cabeceras de seguridad (CSP, HSTS, etc.) de las páginas las pone la app.
# Si el TLS termina en Apache, poner FORCE_HSTS = True en app.cfg.

import logging
import sys

PROJECT_DIR = '/var/www/crypto.baicom.com/web/crypto'

logging.basicConfig(stream=sys.stderr)
sys.path.insert(0, PROJECT_DIR)

from app import app as application  # noqa: E402
