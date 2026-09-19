# crypto: cliente de línea de comandos

Usa Crypto Messenger desde la terminal, scripts, servidores o agentes de IA. Cifra y descifra **en tu máquina** con los mismos formatos que la web, así que el servidor sigue recibiendo solo datos cifrados. Los enlaces son intercambiables: lo que creas con el CLI se abre en el navegador y al revés.

## Instalación

Requiere Python 3.10+.

```bash
pipx install "git+https://github.com/juannito/crypto.git#subdirectory=cli"
# o dentro de un entorno virtual:
pip install "git+https://github.com/juannito/crypto.git#subdirectory=cli"

export CRYPTO_URL=https://crypto.tudominio.com   # tu instancia
```

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

Las comillas en los enlaces son necesarias: sin ellas la terminal interpreta el `&`.

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

Contra un servidor local con `LAN=1` (certificado autofirmado), agrega `-k`.

Pruebas, incluida la compatibilidad byte a byte con el cifrado del navegador: ver el encabezado de `tests/test_cli.py`.
