# 🔐 CRYPTO - Plataforma de Intercambio Seguro de Mensajes

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1-green?logo=flask)](https://flask.palletsprojects.com/)
[![Redis](https://img.shields.io/badge/Redis-6.2-red?logo=redis)](https://redis.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.3-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-BEERWARE-yellow)](LICENSE)

> **Una plataforma moderna y segura para el intercambio de mensajes encriptados, desarrollada con las mejores prácticas de seguridad y tecnologías actuales.**

## 🚀 Características Principales

### 🔒 **Seguridad de Nivel Empresarial**

- **Encriptación AES-256-GCM autenticada** con WebCrypto, nativa del navegador
- **Encriptación del lado del cliente** antes de cualquier transmisión
- **Conocimiento cero:** la clave viaja en el fragmento `#` del enlace, que los navegadores nunca envían al servidor
- **Metadatos cifrados:** nombres, tipos y tamaños de archivos van dentro del contenido cifrado
- **Rate limiting inteligente** por IP para prevenir abusos y ataques de fuerza bruta
- **Autodestrucción atómica** al leer y después de múltiples intentos fallidos
- **Sin almacenamiento de texto plano** en el servidor: rechaza cualquier contenido que no esté cifrado

### 🌐 **Tres Modalidades de Uso**

#### **🔗 Modalidad Online (Compartir)**

- **Encripta y almacena** mensajes de forma segura en el servidor
- **Genera enlaces únicos** con identificador de 131 bits y clave de 256 bits
- **Contraseña adicional opcional** como segundo factor (PBKDF2-SHA256, 600.000 iteraciones)
- **Configuración flexible de expiración** (1 día, 1 semana, 1 mes)
- **Opción de autodestrucción** al primer acceso, con confirmación antes de abrir
- **Soporte para archivos adjuntos** con encriptación individual
- **Interfaz moderna y responsive** optimizada para móviles

#### **📨 Modalidad Solicitar (Requests)**

- **Pide un secreto a otra persona**: genera un enlace para que te envíe un mensaje o archivos
- **Cifrado de clave pública** (ECDH P-256 + HKDF + AES-256-GCM) en el navegador de quien responde
- **La clave pública viaja en el enlace**: el servidor no puede sustituirla
- **Enlace de buzón privado** con QR para guardarlo en el celular y **código opcional** que lo protege
- **Mis solicitudes**: panel con el estado de cada pedido (pendiente / respondida)
- **Una sola respuesta** por solicitud, borrada del servidor al retirarla

#### **🔐 Modalidad Tradicional (Encriptar)**

- **Encriptación 100% local** sin almacenamiento en servidor
- **PBKDF2-SHA256 con 600.000 iteraciones** para derivar la clave desde la contraseña
- **Interfaz intuitiva** para encriptar/desencriptar texto
- **Generación de códigos QR** para compartir fácilmente
- **Ideal para** intercambios directos sin persistencia
- **Validación de fortaleza de claves** en tiempo real
- **Icono de ojo** para mostrar/ocultar contraseñas durante la entrada

### 📱 **Experiencia de Usuario Moderna**

- **Single Page Application (SPA)** con navegación fluida
- **Interfaz responsive** optimizada para todos los dispositivos
- **Soporte multiidioma** (Español, Inglés, Portugués)
- **Notificaciones en tiempo real** con feedback visual
- **Indicadores de fortaleza de contraseñas** interactivos
- **Drag & Drop** para subida de archivos
- **Flujo de desencriptación optimizado** con ocultación automática de elementos innecesarios
- **Icono de ojo** para mostrar/ocultar contraseñas
- **Mensaje desencriptado destacado** en contenedor visual
- **Gestión de archivos mejorada** con preview de imágenes

## 🛠️ Stack Tecnológico

### **Frontend (React + TypeScript)**

```typescript
├── React 19 (Hooks, Context API)
├── TypeScript 5.0 (Tipado estático)
├── React Router (Navegación SPA)
├── WebCrypto (AES-256-GCM, PBKDF2, HKDF, ECDH P-256)
├── Fetch API (Comunicación HTTP)
├── Tailwind CSS (Estilos modernos)
└── React i18next (Internacionalización)
```

### **Backend (Python + Flask)**

```python
├── Flask 3.1 (Framework web)
├── Redis 6.2 (Almacenamiento en memoria)
├── Flask-CORS (Cross-origin requests)
├── Rate Limiting (Protección contra ataques)
├── Scripts Lua atómicos (lectura + destrucción en una operación)
└── WSGI (Despliegue en producción)
```

### **Características de Seguridad**

- ✅ **Encriptación AES-256-GCM** del lado del cliente, con cabecera autenticada
- ✅ **Tokens de acceso** derivados de la clave: el ID solo no alcanza para leer, borrar ni quemar un mensaje
- ✅ **Rate limiting** por IP en todos los endpoints y 5 intentos máximo por mensaje
- ✅ **Autodestrucción** después de intentos fallidos
- ✅ **Validación de entrada** estricta (expiraciones permitidas, formato de sobre cifrado, tamaños)
- ✅ **Headers de seguridad** HTTP: CSP estricta sin scripts inline, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy
- ✅ **Logging de eventos** de seguridad en `security.log`, sin registrar identificadores completos
- ✅ **Protección de memoria**: límite de tamaño por mensaje y tope configurable de uso de Redis

## 📦 Instalación y Configuración

### **Prerrequisitos**

```bash
# Versiones mínimas requeridas
Python 3.11+
Node.js 18+
Redis 6.2+
```

### **1. Clonar el Repositorio**

```bash
git clone https://github.com/juannito/crypto.git
cd crypto
```

### **2. Configurar Backend**

```bash
# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar Redis
cp app.cfg-sample app.cfg
# Editar app.cfg con tus parámetros de Redis

# Ejecutar aplicación (solo en esta máquina: http://localhost:5001)
python app.py

# Accesible desde tu red (celular, otra PC): https + muestra la IP en la terminal
LAN=1 python app.py
```

Con `LAN=1` el servidor escucha en todas las interfaces, genera un certificado autofirmado en `.devcert/` y muestra las direcciones:

```
  Crypto Messenger
  Local:      https://localhost:5001
  En tu red:  https://192.168.1.231:5001
```

El https es obligatorio fuera de localhost: el navegador solo habilita el cifrado (WebCrypto) en contextos seguros. La primera vez hay que aceptar el aviso del certificado. Flask sirve el build, así que antes hay que ejecutar `npm run build` en `frontend/`. Otras variables: `PORT`, `HOST` y `HTTPS=0`.

### **3. Configurar Frontend**

```bash
cd frontend

# Instalar dependencias
npm install

# Desarrollo (con hot reload; el proxy reenvía la API a localhost:5001)
npm start

# Desarrollo accesible desde el celular (WebCrypto exige https fuera de localhost)
npm run start:lan

# Construir para producción
npm run build
```

### **4. Acceder a la Aplicación**

- **Desarrollo**: http://localhost:3000
- **Backend**: http://localhost:5001

## 🔧 Configuración de Producción

### **Variables de Entorno**

Ver `app.cfg-sample`. Además de `REDIS_HOST` y `REDIS_PASSWORD`:

| Variable | Uso |
|---|---|
| `MAX_REDIS_MEMORY_BYTES` | Rechaza mensajes nuevos si Redis supera ese uso de memoria |
| `TRUSTED_PROXIES` | Proxies de confianza delante de la app, para leer la IP real |
| `FORCE_HSTS` | Envía HSTS cuando el TLS termina en Apache/nginx |
| `SECURITY_LOG` | Ruta del registro de eventos de seguridad |
| `CORS_ORIGINS` | Orígenes extra permitidos (por defecto, solo el mismo origen) |

En Redis conviene fijar `maxmemory` y `maxmemory-policy volatile-ttl`.

### **Despliegue con Docker**

```dockerfile
# Dockerfile (ejemplo)
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5001
CMD ["python", "app.py"]
```

## 📚 API Documentation

### **Endpoints Principales**

Todos reciben `multipart/form-data`. El servidor nunca recibe claves: solo sobres cifrados y tokens de acceso derivados en el navegador (HKDF). Solo se guarda el SHA-256 de cada token.

| Endpoint | Campos | Respuesta |
|---|---|---|
| `POST /post` | `payload` (sobre cifrado), `expire`, `destroy`, `token` | `201 {id, expires_at}` |
| `POST /meta` | `id`, `token` | `{destroy, protected, expires_at}` |
| `POST /get` | `id`, `token` | sobre cifrado (binario); si es de un solo uso, se borra en la misma operación |
| `POST /fail_attempt` | `id`, `token` | `{attempts_left}`; `403` al quinto intento, que borra el mensaje |
| `POST /delete` | `id`, `token` | `{success}` |
| `POST /request/create` | `expire`, `owner_token`, `respond_token` | `201 {id, expires_at}` |
| `POST /request/info` | `id`, `token` (respuesta) | `{status}` |
| `POST /request/respond` | `id`, `token` (respuesta), `payload` (caja sellada) | `201`; `409` si ya fue respondida |
| `POST /request/status` | `id`, `token` (dueño) | `{status: pending\|answered}` |
| `POST /request/open` | `id`, `token` (dueño) | caja sellada (binario), borrada al retirarla |
| `POST /request/delete` | `id`, `token` (dueño) | `{success}` |

Un token incorrecto responde igual que un mensaje inexistente (`404`). Los enlaces del formato anterior (ID de 10 caracteres) siguen siendo legibles hasta que expiren.

### **Respuestas de Error**

```json
{ "error": "too_many_attempts", "attempts_left": 0 }
{ "error": "rate_limited" }
{ "error": "invalid_request", "reason": "expire" }
```

## 🚀 Características Avanzadas

### **Gestión de Archivos**

- **Soporte para múltiples archivos** (hasta 10 archivos, 10 MB cada uno, 20 MB en total)
- **Encriptación conjunta** de mensaje, archivos y sus nombres en un único sobre autenticado
- **Descarga segura** con desencriptación automática y sin interpretar el contenido en el navegador
- **Preview solo de imágenes de mapa de bits** (nunca SVG ni HTML)

### **Seguridad Adicional**

- **Validación de fortaleza de claves** en tiempo real
- **Indicadores visuales** de seguridad
- **Prevención de ataques** de timing (comparación de tokens en tiempo constante)
- **Logging detallado** de eventos de seguridad
- **Compatibilidad de lectura** con mensajes y códigos del formato CryptoJS anterior

### **Experiencia de Usuario**

- **Interfaz intuitiva** con feedback visual
- **Soporte para códigos QR** para compartir enlaces y guardar el buzón en el celular
- **Diseño mobile-first** con objetivos táctiles de 44 px y hojas inferiores en mobile
- **Notificaciones toast** para acciones importantes
- **Modo oscuro** (preparado para futuras implementaciones)
- **Flujo de desencriptación optimizado** que oculta elementos innecesarios
- **Icono de ojo** para mostrar/ocultar contraseñas durante la entrada
- **Mensaje desencriptado destacado** en contenedor verde
- **Archivos listados después del mensaje** en orden lógico
- **Botón de eliminación centrado** debajo de la lista de archivos
- **Preview automático de imágenes** después del desencriptado

## 🤝 Contribuir

### **Estructura del Proyecto**

```
crypto/
├── app.py                 # Servidor Flask
├── requirements.txt       # Dependencias Python
├── frontend/             # Aplicación React
│   ├── src/
│   │   ├── components/   # Componentes React
│   │   ├── crypto/       # WebCrypto: sobres, cajas selladas, formato anterior
│   │   ├── lib/          # API, enlaces, almacenamiento local
│   │   └── locales/      # Traducciones
│   └── package.json
└── README.md
```

### **Guidelines de Contribución**

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia **BEERWARE**. Si encuentras este software útil, puedes comprar una cerveza al autor en algún momento. Ver [LICENSE](LICENSE) para más detalles.

## 🙏 Créditos y Agradecimientos

### **Proyecto Original**

Este proyecto es una **modernización completa** del trabajo original de [Baicom](https://github.com/baicom/crypto), que desarrolló la aplicación original en jQuery y Flask.

### **Principales Mejoras Implementadas**

- ✅ **Migración completa a React 19** con TypeScript
- ✅ **Arquitectura SPA moderna** con React Router
- ✅ **Interfaz responsive** con Tailwind CSS
- ✅ **Sistema de seguridad mejorado** con rate limiting
- ✅ **Soporte multiidioma** completo
- ✅ **Gestión de archivos** avanzada
- ✅ **Código más mantenible** y escalable
- ✅ **Flujo de desencriptación optimizado** con UX mejorada
- ✅ **Icono de ojo** para mostrar/ocultar contraseñas
- ✅ **Mensaje desencriptado destacado** en contenedor visual
- ✅ **Gestión inteligente de archivos** con preview de imágenes

### **Enlaces Útiles**

- **Proyecto Original**: https://github.com/baicom/crypto
- **Documentación React**: https://reactjs.org/
- **Documentación Flask**: https://flask.palletsprojects.com/
- **Documentación Redis**: https://redis.io/

---

**⭐ Si este proyecto te resulta útil, considera darle una estrella en GitHub!**

**🔒 La seguridad es nuestra prioridad. Reporta cualquier vulnerabilidad encontrada.**
