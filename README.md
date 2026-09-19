# 🔐 Crypto Messenger

Intercambio de mensajes y archivos cifrados de extremo a extremo, sin que el servidor pueda leerlos.

## Por qué

Nació para que cualquiera, sin saber de criptografía (gpg y similares), pueda pasar una contraseña o un archivo sensible sin mandarlo en texto plano por mail o chat. Todo se cifra en el navegador: el servidor solo guarda datos que no puede descifrar.

## Modalidades

| | Qué hace | Pasa por el servidor |
|---|---|---|
| **Compartir** | Cifra un mensaje y archivos y genera un enlace. Puede expirar (30 s a 1 mes), destruirse al leerse y pedir una contraseña adicional. | Sí, cifrado |
| **Encriptar** | Cifra con una contraseña y te da un código para mandar por donde quieras. | No |
| **Solicitar** | Genera un enlace para que **otra persona te envíe** un secreto. Ella lo cifra con tu clave pública y solo tu enlace de buzón lo abre. El buzón se puede guardar en el celular con un QR y proteger con un código. | Sí, cifrado |

La pestaña **Descifrar** abre enlaces y códigos de las tres, incluidos los del formato anterior (CryptoJS).

## Cómo protege los datos

- **La clave nunca llega al servidor.** Va en la parte del enlace después de `#`, que los navegadores no envían.
- **Cifrado autenticado con WebCrypto:** AES-256-GCM. Con contraseña, PBKDF2-SHA256 de 600.000 iteraciones. En Solicitar, ECDH P-256 + HKDF.
- **Sin metadatos a la vista:** nombres, tipos y tamaños de archivos van dentro del contenido cifrado.
- **El ID solo no sirve:** leer, borrar o quemar un mensaje exige un token derivado de la clave.
- **De un solo uso de verdad:** la lectura y el borrado ocurren en una única operación atómica en Redis.
- **Servidor endurecido:** rechaza contenido sin cifrar, limita peticiones por IP y el tamaño (20 MB), borra tras 5 intentos fallidos, envía CSP estricta, HSTS y otras cabeceras, y registra los eventos en `security.log` sin IDs completos.

## Uso

Requisitos: Python 3.11+, Node.js 18+ y Redis 6.2+.

```bash
git clone https://github.com/juannito/crypto.git && cd crypto

# Backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp app.cfg-sample app.cfg        # datos de Redis

# Frontend (Flask sirve el build)
cd frontend && npm install && npm run build && cd ..

python app.py                    # http://localhost:5001
LAN=1 python app.py              # accesible desde tu red, muestra la IP
```

`LAN=1` levanta https con un certificado autofirmado (`.devcert/`), porque fuera de localhost el navegador solo permite el cifrado en contextos seguros. La primera vez hay que aceptar el aviso del certificado.

Para desarrollar con recarga en caliente: `npm start` (o `npm run start:lan` para probar desde el celular), con el backend corriendo en el puerto 5001. Más detalles en [frontend/CONFIGURATION.md](frontend/CONFIGURATION.md).

Pruebas: `CRYPTO_SETTINGS=tests/test.cfg python tests/test_api.py` para el backend (contra Redis; el formato de `test.cfg` está al inicio del archivo) y `npm test` para el frontend.

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

## API

Todo es `POST` con `multipart/form-data`. El servidor recibe solo datos cifrados y tokens, y de cada token guarda únicamente su SHA-256.

| Endpoint | Para qué |
|---|---|
| `/post` | Guardar un mensaje (`payload`, `expire`, `destroy`, `token`) |
| `/meta` | Consultar si es de un solo uso o pide contraseña, y cuándo expira |
| `/get` | Descargar el mensaje cifrado (lo borra si es de un solo uso) |
| `/fail_attempt` | Registrar un intento fallido (al quinto se borra) |
| `/delete` | Borrar un mensaje |
| `/request/create` · `/request/delete` | Crear o borrar una solicitud |
| `/request/info` · `/request/respond` | Vista de quien responde (una sola respuesta) |
| `/request/status` · `/request/open` | Vista del dueño (la respuesta se borra al abrirla) |

Un token incorrecto responde igual que un mensaje inexistente (`404`).

## Estructura

```
app.py                  Servidor Flask (API, cabeceras, rate limiting)
tests/test_api.py       Pruebas de la API
frontend/src/
  crypto/               WebCrypto: sobres, cajas selladas, formato anterior
  lib/                  API, enlaces, almacenamiento local
  components/           Pestañas y UI
  locales/              Español, inglés y portugués
```

## Créditos y licencia

Modernización del proyecto original de [Baicom](https://github.com/baicom/crypto), hecho en jQuery y Flask. Licencia [BEERWARE](LICENSE).
