# CRYPTO - Intercambio de Mensajes Seguros

Una aplicación web para el intercambio seguro de mensajes encriptados, desarrollada con React y Flask.

## ¿Qué hace esta aplicación?

Esta aplicación permite intercambiar mensajes de forma segura utilizando encriptación AES. Ofrece dos modalidades principales:

### 🔗 Modalidad Online

- **Encripta y almacena** mensajes en el servidor
- **Genera enlaces únicos** para compartir mensajes
- **Configuración de expiración** (1 día, 1 semana, 1 mes)
- **Opción de autodestrucción** al leer el mensaje
- **Encriptación del lado del cliente** antes de guardarlo

### 🔐 Modalidad Tradicional

- **Encriptación local** sin almacenamiento en servidor
- **Interfaz simple** para encriptar/desencriptar texto
- **Ideal para** intercambios directos sin persistencia

## Características de Seguridad

- **Encriptación AES-256** implementada con CryptoJS
- **Claves secretas** requeridas para encriptar/desencriptar
- **Sin almacenamiento en texto plano** en el servidor
- **Enlaces únicos** de 10 caracteres generados aleatoriamente
- **Expiración automática** de mensajes
- **Opción de autodestrucción** al primer acceso

## Tecnologías Utilizadas

### Frontend (React)

- **React 19** con TypeScript
- **React Router** para navegación
- **CryptoJS** para encriptación del lado del cliente
- **Axios** para comunicación con el backend
- **Tailwind CSS** para estilos modernos, responsivos y mobile-friendly
- **SPA 100%**: Navegación y experiencia fluida sin recargas

### Backend (Flask)

- **Python Flask** como servidor web
- **Redis** para almacenamiento de mensajes
- **Flask-CORS** para comunicación cross-origin
- **Generación de IDs únicos** para enlaces

## Instalación y Configuración

### Prerrequisitos

- Python 3.11+
- Node.js 18+
- Redis

### Backend

```bash
# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar Redis
cp app.cfg-sample app.cfg
# Editar app.cfg con tus parámetros de Redis

# Ejecutar aplicación
python app.py
```

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Desarrollo
npm start

# Construir para producción
npm run build
```

## Sobre este Proyecto

Esta es una **versión modernizada** del proyecto original desarrollado por [Baicom](https://github.com/baicom/crypto). El proyecto original utilizaba jQuery y Bootstrap, mientras que esta versión ha sido migrada completamente a **React con TypeScript** y **Tailwind CSS** para una mejor experiencia de desarrollo, mantenimiento y visual.

### Principales Mejoras

- ✅ **Migración completa a React** (Single Page Application, 100% SPA)
- ✅ **TypeScript** para mejor tipado y desarrollo
- ✅ **Componentes modulares** y reutilizables
- ✅ **Mejor manejo de estado** con React Hooks
- ✅ **Interfaz más moderna** y responsive (mobile-friendly) gracias a Tailwind CSS
- ✅ **Código más mantenible** y escalable

### Créditos Originales

Este proyecto está basado en el trabajo original de [Baicom](https://github.com/baicom/crypto), que desarrolló la aplicación original en jQuery y Flask. Puedes encontrar el código fuente original en: https://github.com/baicom/crypto

## Licencia

Este proyecto está bajo la licencia BEERWARE, ver [LICENSE](LICENSE) para más detalles.

## Documentación de la API

### 1. POST `/post`

Guarda un mensaje encriptado en el servidor y devuelve un enlace único.

- **Método:** POST
- **Parámetros (form-data):**

  - `msg1` (string, requerido): Mensaje encriptado (AES, generado en el frontend)
  - `expire` (int, requerido): Tiempo de expiración en segundos (ej: 86400 para 1 día)
  - `destroy` (opcional): Si está presente, el mensaje se autodestruirá al ser leído

- **Respuesta:**

  - 200 OK: URL única para acceder al mensaje

- **Ejemplo curl:**

```bash
curl -X POST -F "msg1=MENSAJE_ENCRIPTADO" -F "expire=86400" -F "destroy=1" http://localhost:5001/post
```

### 2. POST `/get`

Obtiene un mensaje guardado por su ID. Aplica rate limiting (5 intentos por IP, luego se borra el mensaje).

- **Método:** POST
- **Parámetros (form-data):**

  - `id` (string, requerido): ID del mensaje (código online)

- **Respuesta:**

  - 200 OK: `{ "info": "...", "msg": "MENSAJE_ENCRIPTADO" }`
  - 403 Forbidden: Si se superó el límite de intentos y el mensaje fue eliminado
  - 404: Si el mensaje no existe

- **Notas:**

  - El campo `info` puede incluir información de expiración y cantidad de intentos restantes.

- **Ejemplo curl:**

```bash
curl -X POST -F "id=CODIGO_ONLINE" http://localhost:5001/get
```

### 3. POST `/delete`

Elimina un mensaje guardado por su ID. Rate limit: 3 intentos por minuto por IP.

- **Método:** POST
- **Parámetros (form-data):**

  - `id` (string, requerido): ID del mensaje (código online)

- **Respuesta:**

  - 200 OK: `{ "success": true }`
  - 404: Si el mensaje no existe
  - 429: Si se supera el límite de borrados

- **Ejemplo curl:**

```bash
curl -X POST -F "id=CODIGO_ONLINE" http://localhost:5001/delete
```

---

**Nota:** Todos los endpoints devuelven respuestas en formato JSON. Se recomienda usar HTTPS en producción.
