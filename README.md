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

- **Encriptación AES-256** implementada con CryptoJS
- **Encriptación del lado del cliente** antes de cualquier transmisión
- **Rate limiting inteligente** para prevenir ataques de fuerza bruta
- **Autodestrucción automática** después de múltiples intentos fallidos
- **Sin almacenamiento de texto plano** en el servidor

### 🌐 **Dos Modalidades de Uso**

#### **🔗 Modalidad Online (Compartir)**

- **Encripta y almacena** mensajes de forma segura en el servidor
- **Genera enlaces únicos** de 10 caracteres para compartir
- **Configuración flexible de expiración** (1 día, 1 semana, 1 mes)
- **Opción de autodestrucción** al primer acceso
- **Soporte para archivos adjuntos** con encriptación individual
- **Interfaz moderna y responsive** optimizada para móviles

#### **🔐 Modalidad Tradicional (Encriptar)**

- **Encriptación 100% local** sin almacenamiento en servidor
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
├── CryptoJS (Encriptación AES-256)
├── Axios (Comunicación HTTP)
├── Tailwind CSS (Estilos modernos)
└── React i18next (Internacionalización)
```

### **Backend (Python + Flask)**

```python
├── Flask 3.1 (Framework web)
├── Redis 6.2 (Almacenamiento en memoria)
├── Flask-CORS (Cross-origin requests)
├── Rate Limiting (Protección contra ataques)
└── WSGI (Despliegue en producción)
```

### **Características de Seguridad**

- ✅ **Encriptación AES-256** del lado del cliente
- ✅ **Rate limiting** por IP (5 intentos máximo)
- ✅ **Autodestrucción** después de intentos fallidos
- ✅ **Validación de entrada** y sanitización
- ✅ **Headers de seguridad** HTTP
- ✅ **Logging de eventos** de seguridad

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

# Ejecutar aplicación
python app.py
```

### **3. Configurar Frontend**

```bash
cd frontend

# Instalar dependencias
npm install

# Desarrollo (con hot reload)
npm start

# Construir para producción
npm run build
```

### **4. Acceder a la Aplicación**

- **Desarrollo**: http://localhost:3000
- **Backend**: http://localhost:5001

## 🔧 Configuración de Producción

### **Variables de Entorno**

```bash
# app.cfg
REDIS_HOST=localhost
REDIS_PASSWORD=your_redis_password
SECRET_KEY=your_secret_key
```

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

#### **POST `/post`** - Crear Mensaje Encriptado

```bash
curl -X POST http://localhost:5001/post \
  -F "msg1=MENSAJE_ENCRIPTADO" \
  -F "expire=86400" \
  -F "destroy=1"
```

#### **POST `/get`** - Obtener Mensaje

```bash
curl -X POST http://localhost:5001/get \
  -F "id=CODIGO_ONLINE"
```

#### **POST `/delete`** - Eliminar Mensaje

```bash
curl -X POST http://localhost:5001/delete \
  -F "id=CODIGO_ONLINE"
```

### **Respuestas de Error**

```json
{
  "error": "too_many_attempts",
  "attempts_left": 0
}
```

## 🚀 Características Avanzadas

### **Gestión de Archivos**

- **Soporte para múltiples archivos** (hasta 20 archivos)
- **Encriptación individual** de cada archivo
- **Límite de tamaño** configurable (5MB por archivo)
- **Descarga segura** con desencriptación automática

### **Seguridad Adicional**

- **Validación de fortaleza de claves** en tiempo real
- **Indicadores visuales** de seguridad
- **Prevención de ataques** de timing
- **Logging detallado** de eventos de seguridad

### **Experiencia de Usuario**

- **Interfaz intuitiva** con feedback visual
- **Soporte para códigos QR** para compartir fácilmente
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
│   │   ├── locales/      # Traducciones
│   │   └── utils/        # Utilidades
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
