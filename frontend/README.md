# 🔐 CRYPTO Frontend - Aplicación React Moderna

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.3-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-BEERWARE-yellow)](../LICENSE)

> **Frontend moderno y seguro para la plataforma de intercambio de mensajes encriptados, desarrollado con React 19, TypeScript y Tailwind CSS.**

## 🚀 Características del Frontend

### **🔒 Seguridad de Nivel Empresarial**

- **Encriptación AES-256** implementada con CryptoJS
- **Encriptación del lado del cliente** antes de cualquier transmisión
- **Validación de fortaleza de claves** en tiempo real
- **Indicadores visuales** de seguridad y fortaleza
- **Prevención de ataques** de timing y fuerza bruta

### **🌐 Experiencia de Usuario Moderna**

- **Single Page Application (SPA)** con navegación fluida
- **Interfaz responsive** optimizada para todos los dispositivos
- **Soporte multiidioma** (Español, Inglés, Portugués)
- **Notificaciones en tiempo real** con feedback visual
- **Drag & Drop** para subida de archivos
- **Generación de códigos QR** para compartir fácilmente

### **📱 Componentes Principales**

#### **🔗 OnlineTab (Compartir)**

- **Encriptación y almacenamiento** de mensajes en el servidor
- **Generación de enlaces únicos** para compartir
- **Configuración de expiración** flexible
- **Soporte para archivos adjuntos** con encriptación individual
- **Opción de autodestrucción** al primer acceso

#### **🔐 TraditionalTab (Encriptar)**

- **Encriptación 100% local** sin almacenamiento en servidor
- **Interfaz intuitiva** para encriptar/desencriptar texto
- **Generación de códigos QR** para compartir
- **Validación de fortaleza de claves** en tiempo real

#### **📨 MessageTab (Desencriptar)**

- **Desencriptación de mensajes** con validación de claves
- **Sistema de intentos** con autodestrucción automática
- **Descarga segura** de archivos adjuntos
- **Gestión de archivos** con desencriptación automática

## 🛠️ Stack Tecnológico

### **Core Technologies**

```typescript
├── React 19 (Hooks, Context API, Suspense)
├── TypeScript 5.0 (Tipado estático completo)
├── React Router 6 (Navegación SPA)
├── CryptoJS (Encriptación AES-256)
├── Axios (Comunicación HTTP con interceptors)
└── React i18next (Internacionalización)
```

### **Styling & UI**

```css
├── Tailwind CSS 3.3 (Utility-first CSS)
├── Responsive Design (Mobile-first)
├── Dark Mode Ready (Preparado para implementación)
├── Custom Components (Modales, Notificaciones)
└── Accessibility (ARIA labels, keyboard navigation)
```

### **Development Tools**

```json
├── Vite (Build tool y dev server)
├── ESLint (Linting de código)
├── Prettier (Formateo de código)
├── TypeScript (Compilación y tipos)
└── Hot Module Replacement (HMR)
```

## 📦 Instalación y Desarrollo

### **Prerrequisitos**

```bash
Node.js 18+ (Recomendado: Node.js 20 LTS)
npm 9+ o yarn 1.22+
```

### **Instalación**

```bash
# Clonar el repositorio
git clone https://github.com/juannito/crypto.git
cd crypto/frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus configuraciones
```

### **Scripts Disponibles**

```bash
# Desarrollo con hot reload
npm start

# Construir para producción
npm run build

# Preview de producción
npm run preview

# Linting y formateo
npm run lint
npm run format

# Verificar tipos TypeScript
npm run type-check
```

### **Configuración de Desarrollo**

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:5001",
    },
  },
});
```

## 🏗️ Arquitectura del Proyecto

### **Estructura de Directorios**

```
frontend/
├── public/                 # Archivos estáticos
├── src/
│   ├── components/         # Componentes React
│   │   ├── FileDownload.tsx
│   │   ├── FileUpload.tsx
│   │   ├── HelpTab.tsx
│   │   ├── LanguageSelector.tsx
│   │   ├── MessageTab.tsx
│   │   ├── Modal.tsx
│   │   ├── Notification.tsx
│   │   ├── OnlineTab.tsx
│   │   └── TraditionalTab.tsx
│   ├── hooks/             # Custom Hooks
│   │   └── useNotifications.ts
│   ├── locales/           # Traducciones
│   │   ├── en.json
│   │   ├── es.json
│   │   └── pt.json
│   ├── utils/             # Utilidades
│   │   └── errorHandler.ts
│   ├── App.tsx            # Componente principal
│   ├── i18n.ts            # Configuración i18n
│   └── index.tsx          # Punto de entrada
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

### **Componentes Principales**

#### **OnlineTab**

```typescript
interface OnlineTabProps {
  onSuccess: (title: string, content: string) => void;
}
```

- **Propósito**: Encriptar y compartir mensajes online
- **Características**: Validación de claves, subida de archivos, configuración de expiración

#### **TraditionalTab**

```typescript
const TraditionalTab: React.FC = () => {
  // Encriptación local sin servidor
};
```

- **Propósito**: Encriptación local sin almacenamiento
- **Características**: Generación de QR, validación de fortaleza

#### **MessageTab**

```typescript
const MessageTab: React.FC = () => {
  // Desencriptación de mensajes
};
```

- **Propósito**: Desencriptar mensajes y archivos
- **Características**: Sistema de intentos, descarga de archivos

## 🔧 Configuración Avanzada

### **Variables de Entorno**

```bash
# .env.local
VITE_API_URL=http://localhost:5001
VITE_APP_NAME=CRYPTO
VITE_APP_VERSION=2.0.0
```

### **Configuración de Tailwind**

```javascript
// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
        },
      },
    },
  },
  plugins: [],
};
```

### **Configuración de TypeScript**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "strict": true,
    "jsx": "react-jsx"
  }
}
```

## 🌍 Internacionalización

### **Soporte Multiidioma**

```typescript
// i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: { translation: enTranslations },
  es: { translation: esTranslations },
  pt: { translation: ptTranslations },
};
```

### **Idiomas Soportados**

- 🇺🇸 **English** - Completo
- 🇪🇸 **Español** - Completo
- 🇧🇷 **Português** - Completo

### **Uso en Componentes**

```typescript
import { useTranslation } from "react-i18next";

const MyComponent = () => {
  const { t } = useTranslation();

  return <div>{t("form.message")}</div>;
};
```

## 🔒 Seguridad Implementada

### **Encriptación del Cliente**

```typescript
import CryptoJS from "crypto-js";

const encryptMessage = (message: string, key: string): string => {
  return CryptoJS.AES.encrypt(message, key).toString();
};

const decryptMessage = (encryptedMessage: string, key: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};
```

### **Validación de Entrada**

```typescript
export const validateKey = (key: string): void => {
  if (!key || !key.trim()) {
    throw new Error("La clave secreta no puede estar vacía");
  }

  if (key.length < 8) {
    throw new Error("La clave debe tener al menos 8 caracteres");
  }
};
```

### **Manejo de Errores**

```typescript
export const handleCryptoError = (error: any): string => {
  if (error.message.includes("Malformed UTF-8 data")) {
    return "El mensaje encriptado está corrupto o la clave es incorrecta";
  }
  return "Error al procesar la encriptación";
};
```

## 🚀 Despliegue

### **Build de Producción**

```bash
# Construir aplicación
npm run build

# Los archivos se generan en dist/
# Servir con cualquier servidor web estático
```

### **Configuración de Servidor**

```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/crypto/frontend/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5001;
    }
}
```

### **Docker**

```dockerfile
# Dockerfile
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 🤝 Contribuir

### **Guidelines de Desarrollo**

1. **Fork** el proyecto
2. **Crea una rama** para tu feature (`git checkout -b feature/AmazingFeature`)
3. **Sigue las convenciones** de código (ESLint + Prettier)
4. **Añade tests** si es necesario
5. **Commit** tus cambios (`git commit -m 'Add some AmazingFeature'`)
6. **Push** a la rama (`git push origin feature/AmazingFeature`)
7. **Abre un Pull Request**

### **Convenciones de Código**

```typescript
// Nombres de componentes en PascalCase
const MyComponent: React.FC<MyComponentProps> = ({ prop1, prop2 }) => {
  // Hooks al inicio
  const [state, setState] = useState();
  const { t } = useTranslation();

  // Handlers con prefijo handle
  const handleClick = () => {
    // Lógica del handler
  };

  // JSX al final
  return <div onClick={handleClick}>{t("key")}</div>;
};
```

## 📚 Recursos Adicionales

### **Documentación**

- [React Documentation](https://reactjs.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [CryptoJS Documentation](https://cryptojs.gitbook.io/docs/)

### **Herramientas de Desarrollo**

- [React Developer Tools](https://chrome.google.com/webstore/detail/react-developer-tools)
- [TypeScript Playground](https://www.typescriptlang.org/play)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

---

**⭐ Si este proyecto te resulta útil, considera darle una estrella en GitHub!**

**🔒 La seguridad es nuestra prioridad. Reporta cualquier vulnerabilidad encontrada.**
