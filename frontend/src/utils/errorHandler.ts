import axios, { AxiosError } from 'axios';

// Configurar axios para apuntar al backend
axios.defaults.baseURL = 'http://127.0.0.1:5001';

// Configurar timeout y reintentos para axios
axios.defaults.timeout = 10000; // 10 segundos

// Interceptor para manejar errores HTTP
axios.interceptors.response.use(
  response => response,
  (error: AxiosError) => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Tiempo de espera agotado. Verifica tu conexión a internet.'));
    }
    
    if (!error.response) {
      return Promise.reject(new Error('Sin conexión al servidor. Verifica tu conexión a internet.'));
    }

    const status = error.response.status;
    let message = 'Error desconocido';

    switch (status) {
      case 400:
        message = 'Datos inválidos enviados al servidor';
        break;
      case 404:
        message = 'Recurso no encontrado';
        break;
      case 500:
        message = 'Error interno del servidor';
        break;
      case 503:
        message = 'Servicio temporalmente no disponible';
        break;
      default:
        message = `Error del servidor (${status})`;
    }

    return Promise.reject(new Error(message));
  }
);

// Función para reintentos automáticos
export const retryRequest = async <T>(
  fn: () => Promise<T>, 
  retries = 3, 
  delay = 1000
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryRequest(fn, retries - 1, delay * 1.5); // Backoff exponencial
    }
    throw error;
  }
};

// Validaciones de entrada
export const validateMessage = (message: string): void => {
  // El mensaje es opcional, solo validar si no está vacío
  if (message && message.trim()) {
    if (message.length > 10000) {
      throw new Error('El mensaje es demasiado largo (máximo 10,000 caracteres)');
    }
    
    // Verificar caracteres especiales problemáticos
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(message)) {
      throw new Error('El mensaje contiene caracteres no válidos');
    }
  }
};

export const validateKey = (key: string): void => {
  if (!key || !key.trim()) {
    throw new Error('La clave secreta no puede estar vacía');
  }
  
  if (key.length < 8) {
    throw new Error('La clave debe tener al menos 8 caracteres');
  }
  
  if (key.length > 1000) {
    throw new Error('La clave es demasiado larga');
  }
};

// Función para validar clave solo en descifrado (sin validar longitud)
export const validateKeyForDecrypt = (key: string): void => {
  if (!key || !key.trim()) {
    throw new Error('La clave no puede estar vacía');
  }
};

// Función para manejar errores de encriptación
export const handleCryptoError = (error: any): string => {
  if (error.message.includes('Malformed UTF-8 data')) {
    return 'El mensaje encriptado está corrupto o la clave es incorrecta';
  }
  
  if (error.message.includes('Invalid key')) {
    return 'Clave inválida para desencriptar';
  }
  
  if (error.message.includes('Invalid ciphertext')) {
    return 'El mensaje encriptado no es válido';
  }
  
  return 'Error al procesar la encriptación. Verifica la clave y el mensaje.';
};

// Función para limpiar mensajes encriptados
export const cleanEncryptedMessage = (message: string): string => {
  // Eliminar espacios extra al inicio y final
  let cleaned = message.trim();
  
  // Eliminar saltos de línea y espacios múltiples, pero mantener el contenido
  cleaned = cleaned.replace(/\s+/g, '');
  
  return cleaned;
};

// Función para formatear mensajes encriptados
export const formatEncryptedMessage = (encrypted: string): string => {
  return encrypted
    .replace(/\s/g, '')
    .replace(/(.{64})/g, '$1\n')
    .replace(/\n$/, '');
}; 