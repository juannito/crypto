from flask import Flask, render_template, request, redirect, jsonify, url_for, send_from_directory
from flask_cors import CORS
from redis import Redis
import string
import random
import os
import time
import json
import base64

app = Flask(__name__, static_folder='frontend/build/static', static_url_path='/static')
app.config.from_pyfile('app.cfg')

# Configuraciones para optimizar el manejo de múltiples archivos
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB límite total
app.config['MAX_CONTENT_PATH'] = None  # Sin límite de ruta
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0  # No cache para archivos

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
    destroy_on_read = False
    client_ip = request.remote_addr or 'unknown'
    rate_key = f"rate:{id}:{client_ip}"
    max_attempts = 5

    # Obtener intentos actuales sin incrementar
    attempts = int(r.get(rate_key) or 0)
    attempts_left = max_attempts - attempts

    m = r.get(id)
    if m == None:
        m = "No existe el mensaje. Fue destruido o expiró."
    else:
        # Si m es bytes, decodificar a str
        if isinstance(m, bytes):
            m = m.decode('utf-8')
        secs = r.ttl(id)
        info = f"&nbsp; Expira en {secs//86400} d&iacute;a/s"
        
        # Verificar si es el nuevo formato con archivos
        try:
            if m.find('destroy') == 0:
                destroy = 1
                m = m.replace('destroy','')
                r.delete(id)
                destroy_on_read = True
            
            # Intentar parsear como JSON para el nuevo formato
            data = json.loads(m)
            if isinstance(data, dict) and 'message' in data:
                # Es el nuevo formato con archivos
                m = data['message']
            else:
                # Es el formato antiguo, mantener como está
                pass
        except (json.JSONDecodeError, TypeError):
            # Es el formato antiguo, mantener como está
            pass
        # Ya no agregar info de intentos restantes aquí

    return jsonify({'info':info,'msg':m, 'destroy_on_read': destroy_on_read, 'attempts_left': attempts_left})

@app.route('/get_files', methods=['POST'])
def get_files():
    id = request.form.get('id')
    if not id:
        return jsonify({'error': 'Falta el parámetro id'}), 400
    
    m = r.get(id)
    if m == None:
        return jsonify({'error': 'No existe el mensaje'}), 404
    
    # Si m es bytes, decodificar a str
    if isinstance(m, bytes):
        m = m.decode('utf-8')
    
    try:
        # Verificar si es el nuevo formato con archivos
        if m.find('destroy') == 0:
            m = m.replace('destroy','')
        
        data = json.loads(m)
        if isinstance(data, dict) and 'files' in data:
            files = data['files']
            return jsonify({'files': files})
        else:
            return jsonify({'files': []})
    except (json.JSONDecodeError, TypeError):
        return jsonify({'files': []})

#
# Manejamos /post via un formulario
# Guarda el mensaje encriptado en el servidor redis
#
@app.route('/post', methods=['POST'])
def post():
    msg1 = request.form.get('msg1', '')
    expire = request.form['expire']
    rand = randstr()
    
    # Manejar archivos si existen
    files_data = []
    if 'files' in request.files:
        uploaded_files = request.files.getlist('files')
        print(f"Procesando {len(uploaded_files)} archivos...")  # Debug info
        
        # Verificar si los archivos están encriptados (JSON blob)
        if len(uploaded_files) == 1 and uploaded_files[0].filename == 'blob':
            # Archivos encriptados desde el frontend
            try:
                file_content = uploaded_files[0].read()
                files_json = json.loads(file_content.decode('utf-8'))
                files_data = files_json  # Usar directamente el JSON encriptado
                print(f"Archivos encriptados recibidos: {len(files_json)} archivos")
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                print(f"Error procesando archivos encriptados: {e}")
                files_data = []
        else:
            # Archivos normales (no encriptados)
            for i, file in enumerate(uploaded_files):
                if file and file.filename:
                    print(f"Procesando archivo {i+1}/{len(uploaded_files)}: {file.filename}")  # Debug info
                    # Leer el archivo y convertirlo a base64
                    file_content = file.read()
                    file_data = {
                        'name': file.filename,
                        'content': base64.b64encode(file_content).decode('utf-8'),
                        'size': len(file_content)
                    }
                    files_data.append(file_data)
                    print(f"Archivo {file.filename} procesado: {len(file_content)} bytes")  # Debug info
    
    print(f"Total de archivos procesados: {len(files_data)}")  # Debug info
    
    # Crear el objeto de datos
    data = {
        'message': msg1,
        'files': files_data
    }
    
    # Convertir a JSON string
    data_json = json.dumps(data)
    
    if 'destroy' in request.form:
        data_json = 'destroy' + data_json

    p = r.pipeline()
    p.set(rand, data_json)
    p.expire(rand, expire)
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

@app.route('/fail_attempt', methods=['POST'])
def fail_attempt():
    id = request.form.get('id')
    if not id:
        return jsonify({'error': 'Falta el parámetro id'}), 400
    client_ip = request.remote_addr or 'unknown'
    rate_key = f"rate:{id}:{client_ip}"
    max_attempts = 5
    # Inicializar intentos si no existen
    if not r.exists(rate_key):
        r.set(rate_key, 0)
        r.expire(rate_key, 3600)
    # Incrementar contador de intentos
    attempts = r.incr(rate_key)
    attempts_left = max_attempts - attempts
    if attempts > max_attempts:
        r.delete(id)
        r.delete(rate_key)
        return jsonify({'error': 'too_many_attempts', 'attempts_left': 0}), 403
    return jsonify({'success': True, 'attempts_left': attempts_left})

if __name__ == '__main__':
    app.run(debug = True, port=5001)

