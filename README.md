# CRYPTO - Intercambio de Mensajes Seguros

Una aplicación web para el intercambio seguro de mensajes encriptados, desarrollada con React y Flask.

## ¿Qué hace esta aplicación?

Esta aplicación permite intercambiar mensajes de forma segura utilizando encriptación AES. Ofrece dos modalidades principales:

### 🔗 Modalidad Online

- **Encripta y almacena** mensajes en el servidor
- **Genera enlaces únicos** para compartir mensajes
- **Configuración de expiración** (1 día, 1 semana, 1 mes)
- **Opción de autodestrucción** al leer el mensaje
- **Encriptación del lado del cliente** antes del envío

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
- **CSS personalizado** con estilos Bootstrap-like

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

Esta es una **versión modernizada** del proyecto original desarrollado por [Baicom](https://github.com/baicom/crypto). El proyecto original utilizaba jQuery y Bootstrap, mientras que esta versión ha sido migrada completamente a **React con TypeScript** para una mejor experiencia de desarrollo y mantenimiento.

### Principales Mejoras

- ✅ **Migración completa a React** (Single Page Application)
- ✅ **TypeScript** para mejor tipado y desarrollo
- ✅ **Componentes modulares** y reutilizables
- ✅ **Mejor manejo de estado** con React Hooks
- ✅ **Interfaz más moderna** y responsive
- ✅ **Código más mantenible** y escalable

### Créditos Originales

Este proyecto está basado en el trabajo original de [Baicom](https://github.com/baicom/crypto), que desarrolló la aplicación original en jQuery y Flask. Puedes encontrar el código fuente original en: https://github.com/baicom/crypto

## Licencia

Este proyecto está bajo la licencia BEERWARE, ver [LICENSE](LICENSE) para más detalles.

## Roadmap

- [ ] Mejorar manejo de errores (timeouts, conexión perdida)
- [ ] Agregar tests unitarios y de integración
- [ ] Implementar rate limiting
- [ ] Agregar más opciones de encriptación
- [ ] Mejorar la documentación de la API
- [ ] Implementar PWA (Progressive Web App)
