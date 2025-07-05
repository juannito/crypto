# CRYPTO Frontend - React Application

Frontend de la aplicación CRYPTO desarrollado con React y TypeScript.

## Descripción

Esta es la interfaz de usuario moderna para la aplicación de intercambio seguro de mensajes. Migrada desde jQuery a React para una mejor experiencia de desarrollo y mantenimiento.

## Características

- **React 19** con TypeScript
- **Componentes modulares** para cada funcionalidad
- **Encriptación del lado del cliente** con CryptoJS
- **Interfaz responsive** con estilos Bootstrap-like
- **Single Page Application** con navegación por pestañas
- **Manejo de estado** con React Hooks

## Componentes Principales

- `OnlineTab` - Envío de mensajes encriptados al servidor
- `TraditionalTab` - Encriptación/desencriptación local
- `MessageTab` - Lectura de mensajes recibidos por URL
- `HelpTab` - Información de ayuda del sistema
- `Modal` - Ventana modal para mostrar enlaces generados

## Scripts Disponibles

### `npm start`

Ejecuta la aplicación en modo desarrollo.\
Abre [http://localhost:3000](http://localhost:3000) para verla en el navegador.

La página se recargará automáticamente si haces cambios.\
También verás errores de lint en la consola.

### `npm test`

Lanza el test runner en modo interactivo.\
Ver la sección sobre [ejecutar tests](https://facebook.github.io/create-react-app/docs/running-tests) para más información.

### `npm run build`

Construye la aplicación para producción en la carpeta `build`.\
Empaqueta React en modo producción y optimiza el build para mejor rendimiento.

El build está minificado y los nombres de archivos incluyen hashes.\
¡Tu aplicación está lista para ser desplegada!

### `npm run eject`

**Nota: esta es una operación unidireccional. Una vez que `eject`, ¡no puedes volver atrás!**

Si no estás satisfecho con las herramientas de build y las opciones de configuración, puedes hacer `eject` en cualquier momento. Este comando removerá la dependencia de build única del proyecto.

En su lugar, copiará todos los archivos de configuración y las dependencias transitivas (webpack, Babel, ESLint, etc.) directamente en tu proyecto para que tengas control total sobre ellos. Todos los comandos excepto `eject` seguirán funcionando, pero apuntarán a los scripts copiados para que puedas ajustarlos. En este punto estás por tu cuenta.

No tienes que usar `eject` nunca. El conjunto de características curado es adecuado para despliegues pequeños y medianos, y no deberías sentirte obligado a usar esta característica. Sin embargo, entendemos que esta herramienta no sería útil si no pudieras personalizarla cuando estés listo para ello.

## Dependencias Principales

- `react` - Biblioteca principal de React
- `react-dom` - Renderizado de React para el DOM
- `react-router-dom` - Enrutamiento para SPA
- `axios` - Cliente HTTP para peticiones al backend
- `crypto-js` - Biblioteca de encriptación
- `typescript` - Tipado estático para JavaScript

## Desarrollo

Para contribuir al desarrollo:

1. Asegúrate de tener Node.js 18+ instalado
2. Instala las dependencias: `npm install`
3. Ejecuta en modo desarrollo: `npm start`
4. El backend debe estar ejecutándose en `http://localhost:5000`

## Construcción para Producción

```bash
npm run build
```

Los archivos construidos se generan en la carpeta `build/` y son servidos automáticamente por el backend Flask.

## Más Información

Para aprender más sobre React, consulta la [documentación de React](https://reactjs.org/).

Para información sobre la aplicación completa, consulta el [README principal](../README.md).
