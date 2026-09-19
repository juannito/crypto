# crypto: cliente de línea de comandos

Usa Crypto Messenger desde la terminal, scripts, servidores o agentes de IA. Cifra y descifra **en tu máquina** con los mismos formatos que la web, así que el servidor sigue recibiendo solo datos cifrados. Los enlaces son intercambiables: lo que creas con el CLI se abre en el navegador y al revés.

## Instalación

Requiere Python 3.10+.

**Desde el repo clonado** (lo más simple si ya tienes el proyecto):

```bash
cd crypto
venv/bin/pip install -e cli
source venv/bin/activate        # deja disponible el comando `crypto`
```

**En cualquier otra máquina o servidor:**

```bash
pipx install "git+https://github.com/juannito/crypto.git#subdirectory=cli"
# o dentro de un entorno virtual:
pip install "git+https://github.com/juannito/crypto.git#subdirectory=cli"
```

## Configuración

| Variable | Uso |
|---|---|
| `CRYPTO_URL` | Servidor al que se conecta (o `--server URL` en cada comando) |
| `CRYPTO_INSECURE=1` | Acepta certificados autofirmados, como el de `LAN=1` (o `-k` en cada comando). **Solo en tu red**: desactiva la verificación del certificado |

Contra tu servidor en la LAN:

```bash
export CRYPTO_URL=https://192.168.1.231:5001    # la IP que muestra LAN=1
export CRYPTO_INSECURE=1
crypto share "hola"
```

Contra un servidor con certificado real, solo `CRYPTO_URL`.

Para abrir un enlace no hace falta configurar nada: el servidor se toma del propio enlace.

## Uso

```bash
# Compartir (se destruye al leerse; --keep para conservarlo)
crypto share "la clave es 1234"
echo "desde stdin" | crypto share -e 1d
crypto share "contrato" -f contrato.pdf -p        # -p pide una contraseña adicional

# Abrir un enlace (también los creados en la web)
crypto open "https://…/message#c=…&k=…"
crypto open "https://…/message#c=…&k=…" -o ./recibido   # guarda en archivos sin mostrarlos

# Cifrar sin servidor (código para mandar por donde quieras)
crypto encrypt "texto" -p > codigo.txt
crypto open codigo.txt -p

# Solicitudes: pedir un secreto a otra persona
crypto request create -l "API key de producción" --passcode
crypto request respond "https://…/request#r=…"  "sk-…"
crypto request status "https://…/inbox#r=…"
crypto request open   "https://…/inbox#r=…" -o ./recibido
```

Las comillas en los enlaces son necesarias: sin ellas la terminal corta en el `&` y se pierde la clave.

Ayuda de cada comando: `crypto --help`, `crypto share --help`, `crypto request --help`.

## Problemas comunes

| Mensaje | Solución |
|---|---|
| `Certificado no válido…` | Servidor con certificado autofirmado: `export CRYPTO_INSECURE=1` o `-k` |
| `Indica el servidor…` | Falta `export CRYPTO_URL=…` (o `--server URL`) |
| `No es un enlace de Compartir válido` | El enlace se cortó: ponlo entre comillas y completo, con la parte después de `#` |
| `No existe, expiró o el enlace está incompleto` | Ya se leyó (si era de un solo uso), expiró o fue borrado |
| `command not found: crypto` | Activa el entorno (`source venv/bin/activate`) o usa `venv/bin/crypto` |

## Contraseñas

Nunca se pasan como argumento, porque quedarían en el historial y en la lista de procesos. Hay dos formas:

- `-p` / `--passcode`: las pide por teclado.
- `--password-env VAR` / `--passcode-env VAR`: las lee de una variable de entorno (para automatización).

Si abres un mensaje de un solo uso con una contraseña incorrecta, el servidor ya lo borró, pero el contenido cifrado queda en `crypto-XXXX.recovery` (permisos 600) para reintentar: `crypto open crypto-XXXX.recovery -p`.

## Scripts y agentes de IA

- `--json` da una salida estructurada.
- Códigos de salida: `0` OK, `2` uso incorrecto, `3` no existe o expiró, `4` contraseña incorrecta.
- **Para que un agente no vea el secreto**, encadena la generación con el cifrado. El valor nunca pasa por la salida del agente, solo el enlace:

  ```bash
  openssl rand -base64 24 | crypto share --json
  ```

- Al abrir, `-o DIR` guarda el contenido en archivos y la salida solo muestra las rutas.

Si el agente escribe el mensaje él mismo, el texto sí pasa por el modelo. Para secretos reales, usa el patrón de arriba.

## Desarrollo

Pruebas, incluida la compatibilidad byte a byte con el cifrado del navegador: ver el encabezado de `tests/test_cli.py`.
