// Configuración de la aplicación
interface Config {
  backendURL: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

// Función para obtener la configuración del backend
const getBackendConfig = (): Config => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  
  // En desarrollo, usar la IP local para que funcione desde dispositivos móviles
  // En producción, usar el mismo origen por defecto
  let backendURL: string;
  
  if (isDevelopment) {
    // Usar variable de entorno si está disponible, sino usar IP por defecto
    backendURL = process.env.REACT_APP_BACKEND_URL || 'http://192.168.1.231:5001';
  } else {
    // En producción, usar el mismo origen
    backendURL = window.location.origin;
  }
  
  return {
    backendURL,
    isDevelopment,
    isProduction
  };
};

// Configuración global
export const config = getBackendConfig();

// Función para obtener la URL del backend
export const getBackendURL = (): string => {
  return config.backendURL;
};

// Función para verificar si estamos en desarrollo
export const isDevelopment = (): boolean => {
  return config.isDevelopment;
};

// Función para verificar si estamos en producción
export const isProduction = (): boolean => {
  return config.isProduction;
};

// Log de configuración para debugging
console.log('🔧 Configuración de la aplicación:', {
  backendURL: config.backendURL,
  environment: process.env.NODE_ENV,
  isDevelopment: config.isDevelopment,
  isProduction: config.isProduction
}); 