from flask import Flask, render_template, request, redirect, jsonify, url_for, send_from_directory
from flask_cors import CORS
from redis import Redis
import string
import random
import os
import time

app = Flask(__name__, static_folder='frontend/build/static', static_url_path='/static')
app.config.from_pyfile('app.cfg')
CORS(app)  # Habilitar CORS para peticiones desde React
r = Redis(host=app.config['REDIS_HOST'],password=app.config['REDIS_PASSWORD'])

#
# Servir otros archivos estáticos (favicon, manifest, etc.)
#
@app.route('/favicon.ico')
@app.route('/manifest.json')
@app.route('/logo192.png')
@app.route('/logo512.png')
@app.route('/robots.txt')
def serve_assets():
    filename = request.path.lstrip('/')
    return send_from_directory('frontend/build', filename)

#
# Servir la aplicación React (SPA routing)
#
@app.route('/')
@app.route('/<path:path>')
def serve_react(path=''):
    # Para todas las rutas, servir index.html (SPA routing)
    return send_from_directory('frontend/build', 'index.html')

#
# Manejamos /get via json
# Busca el id en el servidor redis
#
@app.route('/get', methods=['POST'])
def get():
    id = request.form.get('id')
    info = ""
    client_ip = request.remote_addr or 'unknown'
    rate_key = f"rate:{id}:{client_ip}"
    max_attempts = 5

    # Incrementar contador de intentos
    attempts = r.incr(rate_key)
    if attempts == 1:
        r.expire(rate_key, 3600)  # 1 hora para evitar abuso
    if attempts > max_attempts:
        r.delete(id)
        r.delete(rate_key)
        return jsonify({'info': '', 'msg': 'El mensaje fue eliminado automáticamente por exceder el límite de intentos.'}), 403
    else:
        intentos_restantes = max_attempts - attempts

    m = r.get(id)
    if m == None:
        m = "No existe el mensaje. Fue destruido o expiró."
    else:
        # Si m es bytes, decodificar a str
        if isinstance(m, bytes):
            m = m.decode('utf-8')
        secs = r.ttl(id)
        info = f"&nbsp; Expira en {secs//86400} d&iacute;a/s"
        if m.find('destroy') == 0:
            destroy = 1
            m = m.replace('destroy','')
            r.delete(id) 
            info += ", destruir al leer"
        # Agregar info de intentos restantes si quedan menos de 5
        if intentos_restantes >= 0:
            info += f"<br><b>Intentos restantes:</b> {intentos_restantes}"

    return jsonify({'info':info,'msg':m})

#
# Manejamos /post via un formulario
# Guarda el mensaje encriptado en el servidor redis
#
@app.route('/post', methods=['POST'])
def post():
    msg1 = request.form['msg1']
    expire = request.form['expire']
    rand = randstr()

    if 'destroy' in request.form:
        msg1 = 'destroy' + msg1

    p = r.pipeline()
    p.set(rand,msg1)
    p.expire(rand,expire)
    p.execute()

    return request.url_root + rand, 200 

#
# Genera el random string (mayusculas, minusculas y digitos)
#
def randstr():
    char_set = string.ascii_uppercase + string.ascii_lowercase + string.digits
    char_len = 10

    return ''.join(random.sample(char_set*char_len,char_len))

@app.route('/delete', methods=['POST'])
def delete():
    id = request.form.get('id')
    client_ip = request.remote_addr or 'unknown'
    rate_key = f"delete:{id}:{client_ip}"
    max_deletes = 3
    # Limitar a 3 intentos de borrado por minuto por IP por id
    deletes = r.incr(rate_key)
    if deletes == 1:
        r.expire(rate_key, 60)
    if deletes > max_deletes:
        return jsonify({'success': False, 'error': 'Demasiados intentos de borrado. Intenta más tarde.'}), 429
    if not id:
        return jsonify({'success': False, 'error': 'Falta el parámetro id'}), 400
    try:
        result = r.delete(id)
        if result == 1:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'error': 'No se encontró el mensaje'}), 404
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug = True, port=5001)

