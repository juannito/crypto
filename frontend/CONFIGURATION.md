# Configuración del Backend

## Configuración Actual

El frontend está configurado para conectarse al backend de la siguiente manera:

### Desarrollo

- **URL del Backend**: `http://192.168.1.231:5001`
- **Archivo de configuración**: `src/config.ts`

### Producción

- **URL del Backend**: Mismo origen que el frontend (`window.location.origin`)
- **Configuración**: Automática basada en el entorno

## Cómo cambiar la configuración

### Opción 1: Modificar directamente el archivo de configuración

Edita el archivo `src/config.ts` y cambia la línea:

```typescript
const localIP = "192.168.1.231"; // Cambia esta IP por la tuya
```

### Opción 2: Usar variables de entorno (Recomendado)

1. Crea un archivo `.env` en la carpeta `frontend/`:

```bash
# Configuración del backend
REACT_APP_BACKEND_URL=http://tu-ip-local:5001
```

2. Modifica `src/config.ts` para usar la variable de entorno:

```typescript
const getBackendConfig = (): Config => {
  const isDevelopment = process.env.NODE_ENV === "development";
  const isProduction = process.env.NODE_ENV === "production";

  let backendURL: string;

  if (isDevelopment) {
    // Usar variable de entorno si está disponible, sino usar IP por defecto
    backendURL =
      process.env.REACT_APP_BACKEND_URL || "http://192.168.1.231:5001";
  } else {
    backendURL = window.location.origin;
  }

  return {
    backendURL,
    isDevelopment,
    isProduction,
  };
};
```

## Verificación de la configuración

Para verificar que la configuración es correcta:

1. Abre la consola del navegador
2. Busca el log: `🔧 Configuración de la aplicación:`
3. Verifica que `backendURL` apunte a la IP correcta

## Troubleshooting

### Problema: No se conecta desde el celular

1. Verifica que la IP en `config.ts` sea la IP local de tu computadora
2. Asegúrate de que el backend esté corriendo en `0.0.0.0:5001`
3. Verifica que no haya firewall bloqueando el puerto 5001

### Problema: CORS errors

1. El backend debe permitir peticiones desde el frontend
2. Verifica la configuración de CORS en el backend

### Problema: Timeout en las peticiones

1. Verifica que el backend esté respondiendo
2. Aumenta el timeout en `errorHandler.ts` si es necesario
