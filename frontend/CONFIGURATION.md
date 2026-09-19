# Configuración del Backend

## Producción

El frontend llama a la API en el **mismo origen** (`/post`, `/get`, `/request/...`).
Flask sirve el build (`frontend/build`) y la API desde el mismo dominio, así que no hace falta CORS.

## Desarrollo

`npm start` levanta el servidor de desarrollo en `http://localhost:3000` y el proxy de CRA
(`"proxy"` en `package.json`) reenvía las llamadas a la API a `http://localhost:5001`.

```bash
# Terminal 1 - backend
python app.py            # escucha en 127.0.0.1:5001

# Terminal 2 - frontend
cd frontend && npm start
```

### Probar desde el celular

WebCrypto solo está disponible en contextos seguros (https o localhost). Por eso, desde otro
dispositivo de la red hay que usar https:

```bash
npm run start:lan        # HOST=0.0.0.0 HTTPS=true (certificado autofirmado)
```

Abre `https://<ip-de-tu-máquina>:3000` en el celular y acepta el certificado.

### Backend en otro host

Si el backend corre en otro origen, define `REACT_APP_BACKEND_URL` en `frontend/.env.local`:

```bash
REACT_APP_BACKEND_URL=http://192.168.1.50:5001
```

y permite ese origen en el backend (`app.cfg`):

```python
CORS_ORIGINS = ['http://192.168.1.50:3000']
```
