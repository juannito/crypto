# 🔐 Crypto Messenger

Intercambio de mensajes y archivos cifrados de extremo a extremo, sin que el servidor pueda leerlos.

## Por qué

Nació para que cualquiera, sin saber de criptografía (gpg y similares), pueda pasar una contraseña o un archivo sensible sin mandarlo en texto plano por mail o chat. Todo se cifra en el navegador: el servidor solo guarda datos que no puede descifrar.

## Modalidades

| | Qué hace | Pasa por el servidor |
|---|---|---|
| **Compartir** | Cifra un mensaje y archivos y genera un enlace. Puede expirar (30 s a 1 mes), destruirse al leerse, pedir una contraseña adicional y avisarte cuando lo lean. | Sí, cifrado |
| **Encriptar** | Cifra con una contraseña y te da un código para mandar por donde quieras. Si el código no entra en un QR, puedes convertirlo en un enlace que sí entra. | No (el enlace para el QR sí, cifrado) |
| **Solicitar** | Genera un enlace para que **otra persona te envíe** un secreto. Ella lo cifra con tu clave pública y solo tu enlace de buzón lo abre. El buzón se puede guardar en el celular con un QR y proteger con un código. | Sí, cifrado |

La pestaña **Descifrar** abre enlaces y códigos de las tres, incluidos los del formato anterior (CryptoJS).

Arriba a la derecha hay dos accesos con un contador rojo de novedades, que también se ve en el título de la pestaña del navegador:

- **Mis solicitudes:** estado de cada pedido. Avisa cuando alguien responde.
- **Recibos:** si ya abrieron los mensajes que compartiste, y cuándo. El servidor guarda solo el estado y la fecha, nunca quién ni desde dónde. El destinatario ve un aviso de que el remitente sabrá cuándo lo abrió.

Ambas listas viven solo en tu navegador (`localStorage`), sin enlaces ni claves.

También hay un **cliente de línea de comandos** para scripts, servidores y agentes de IA, que cifra en tu máquina y crea enlaces que se abren en la web: ver [cli/README.md](cli/README.md).

## Cómo protege los datos

- **La clave nunca llega al servidor.** Va en la parte del enlace después de `#`, que los navegadores no envían.
- **Cifrado autenticado con WebCrypto:** AES-256-GCM. Con contraseña, PBKDF2-SHA256 de 600.000 iteraciones. En Solicitar, ECDH P-256 + HKDF.
- **Sin metadatos a la vista:** nombres, tipos y tamaños de archivos van dentro del contenido cifrado.
- **El ID solo no sirve:** leer, borrar o quemar un mensaje exige un token derivado de la clave.
- **De un solo uso de verdad:** la lectura y el borrado ocurren en una única operación atómica en Redis.
- **Recibos sin datos personales:** solo estado y fecha, protegidos con su propio token. La vista previa de quien lo creó no cuenta como lectura.
- **Servidor endurecido:** rechaza contenido sin cifrar, limita peticiones por IP y el tamaño (20 MB), borra tras 5 intentos fallidos, envía CSP estricta, HSTS y otras cabeceras, y registra los eventos en `security.log` sin IDs completos.

## Uso

Requisitos: Python 3.11+, Node.js 18+ y Redis 6.2+.

### Instalar (una vez)

```bash
git clone https://github.com/juannito/crypto.git && cd crypto

python -m venv venv
venv/bin/pip install -r requirements.txt
npm --prefix frontend install

cp app.cfg-sample app.cfg
```

En `app.cfg` van los datos de Redis. Para un Redis local sin contraseña (`brew install redis && brew services start redis`):

```python
REDIS_HOST = 'localhost'
REDIS_PASSWORD = None
```

### Levantar

Todos los comandos se ejecutan desde la raíz del proyecto (`crypto/`):

```bash
npm --prefix frontend run build      # build del frontend (Flask lo sirve); repetir si cambia el frontend

venv/bin/python app.py               # solo en esta máquina: http://localhost:5001
LAN=1 venv/bin/python app.py         # accesible desde tu red (celular, otra PC)
```

Con `LAN=1` la terminal muestra la dirección para entrar desde otros equipos:

```
  Crypto Messenger
  Local:      https://localhost:5001
  En tu red:  https://192.168.1.231:5001
```

Usa https con un certificado autofirmado (`.devcert/`), porque fuera de localhost el navegador solo habilita el cifrado en contextos seguros. La primera vez, cada dispositivo muestra un aviso del certificado que hay que aceptar. Otras variables: `PORT=5002` para cambiar el puerto y `HTTPS=0` para usar http.

### Problemas comunes

| Síntoma | Solución |
|---|---|
| **Not Found** al abrir la página, o el aviso "falta el build del frontend" | `npm --prefix frontend run build` (no hace falta reiniciar el servidor) |
| **Address already in use** | Ya hay algo en el puerto 5001: `kill $(lsof -t -iTCP:5001 -sTCP:LISTEN)` o usa `PORT=5002` |
| Error de conexión a **Redis** | Revisa que Redis esté corriendo (`redis-cli ping` → `PONG`) y los datos de `app.cfg` |
| Desde otro equipo **no cifra** o da error de seguridad | Entra por la dirección **https** que muestra `LAN=1` y acepta el certificado |
| El celular **no llega** a la IP | Mismo Wi-Fi que la Mac; si macOS lo pregunta, permite conexiones entrantes a Python |

### Desarrollo y pruebas

Con recarga en caliente: `npm --prefix frontend start` (o `run start:lan` para probar desde el celular), con el backend corriendo en el puerto 5001. Más detalles en [frontend/CONFIGURATION.md](frontend/CONFIGURATION.md).

Pruebas: `CRYPTO_SETTINGS=tests/test.cfg venv/bin/python tests/test_api.py` para el backend (contra Redis; el formato de `test.cfg` está al inicio del archivo), `npm --prefix frontend test` para el frontend, y las del CLI en `cli/tests/test_cli.py`.

### Línea de comandos (CLI)

```bash
venv/bin/pip install -e cli                          # una vez, desde el repo
source venv/bin/activate
export CRYPTO_URL=https://192.168.1.231:5001         # tu servidor
export CRYPTO_INSECURE=1                             # solo con el certificado autofirmado de LAN=1

crypto share "la clave es 1234"                      # → enlace que se abre en la web
crypto open "https://192.168.1.231:5001/message#c=…&k=…"
```

Guía completa en [cli/README.md](cli/README.md).

## Configuración

En `app.cfg` (ver `app.cfg-sample`):

| Variable | Uso |
|---|---|
| `REDIS_HOST`, `REDIS_PASSWORD` | Conexión a Redis |
| `MAX_REDIS_MEMORY_BYTES` | Rechaza mensajes nuevos si Redis supera ese uso de memoria |
| `TRUSTED_PROXIES` | Proxies delante de la app, para leer la IP real del cliente |
| `FORCE_HSTS` | HSTS cuando el TLS termina en Apache/nginx |
| `SECURITY_LOG` | Ruta del registro de seguridad |
| `CORS_ORIGINS` | Orígenes extra permitidos (por defecto, solo el mismo) |

En producción se usa Apache + mod_wsgi (ver `app.wsgi`). En Redis conviene `maxmemory` con `maxmemory-policy volatile-ttl`.

### Vercel + Upstash

`vercel.json` compila el frontend, aplica las mismas cabeceras de seguridad que la app a las páginas estáticas y programa un heartbeat diario (`/heartbeat`) para que Upstash no archive la base gratuita por inactividad.

1. Importar el repo en Vercel.
2. En el proyecto, **Storage → Upstash Redis**: una base **sin regiones de lectura** y en la misma región que las funciones (por defecto `iad1`, Washington → `us-east-1`). Con **Eviction desactivado**, para que no borre mensajes antes de que expiren. La integración define `REDIS_URL`.
3. Agregar `CRON_SECRET`: un valor aleatorio, por ejemplo `openssl rand -hex 32`.
4. Desplegar.

Diferencias con el servidor propio:
- **Tope de 4 MB por mensaje**, porque Vercel no acepta cuerpos de más de 4,5 MB.
- El registro de seguridad va a los logs de Vercel.
- Upstash persiste en disco y hace backups, así que un mensaje borrado puede quedar un tiempo en esas copias, siempre cifrado y sin la clave, que nunca llega al servidor.

## API

Todo es `POST` con `multipart/form-data`. El servidor recibe solo datos cifrados y tokens, y de cada token guarda únicamente su SHA-256.

| Endpoint | Para qué |
|---|---|
| `/post` | Guardar un mensaje (`payload`, `expire`, `destroy`, `token` y, opcional, `receipt_token`) |
| `/meta` | Consultar si es de un solo uso o pide contraseña, y cuándo expira |
| `/get` | Descargar el mensaje cifrado (lo borra si es de un solo uso) |
| `/fail_attempt` | Registrar un intento fallido (al quinto se borra) |
| `/delete` | Borrar un mensaje |
| `/request/create` · `/request/delete` | Crear o borrar una solicitud |
| `/request/info` · `/request/respond` | Vista de quien responde (una sola respuesta) |
| `/request/status` · `/request/open` | Vista del dueño (la respuesta se borra al abrirla) |
| `/activity` | JSON con hasta 50 solicitudes y recibos: el estado de todos en una sola consulta |

Un token incorrecto responde igual que un mensaje inexistente (`404`).

## Estructura

```
app.py                  Servidor Flask (API, cabeceras, rate limiting)
tests/test_api.py       Pruebas de la API
cli/                    Cliente de línea de comandos (crypto)
frontend/src/
  crypto/               WebCrypto: sobres, cajas selladas, formato anterior
  lib/                  API, enlaces, almacenamiento local
  components/           Pestañas y UI
  locales/              Español, inglés y portugués
```

## Créditos y licencia

Modernización del proyecto original de [Baicom](https://github.com/baicom/crypto), hecho en jQuery y Flask. Licencia [BEERWARE](LICENSE).
