import React, { useState, useEffect, useCallback } from 'react';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { 
  validateKey, 
  handleCryptoError, 
  cleanEncryptedMessage,
  retryRequest 
} from '../utils/errorHandler';

// Función para evaluar la fortaleza de la clave
function getKeyStrengthIndicators(key: string) {
  return {
    length: key.length >= 8,
    upper: /[A-Z]/.test(key),
    lower: /[a-z]/.test(key),
    number: /[0-9]/.test(key),
    special: /[^A-Za-z0-9]/.test(key),
  };
}

const MessageTab: React.FC = () => {
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [onlineCode, setOnlineCode] = useState<string | null>(null); // Nuevo estado para el código online
  const { id } = useParams<{ id: string }>();
  const { showSuccess, showError, showWarning } = useNotifications();
  const indicators = getKeyStrengthIndicators(key);

  // Detectar si hay un código online en la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setOnlineCode(code);
    } else {
      setOnlineCode(null);
    }
  }, []);

  const fetchMessage = useCallback(async (messageId: string) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('id', messageId);
      
      const response = await retryRequest(async () => {
        return await axios.post('/get', formData);
      });
      
      setMessage(response.data.msg);
      setInfo(response.data.info);
      
      if (response.data.msg === 'No existe el mensaje') {
        showError('El mensaje no existe o ha expirado');
      } else {
        showSuccess('Mensaje cargado exitosamente');
      }
    } catch (error: any) {
      console.error('Error al obtener mensaje:', error);
      
      if (error.message.includes('conexión') || error.message.includes('servidor')) {
        showError(error.message);
      } else {
        showError('Error al obtener el mensaje. Verifica el enlace.');
      }
      
      setMessage('Error al obtener el mensaje');
      setInfo('');
    } finally {
      setIsLoading(false);
    }
  }, [showError, showSuccess]);

  useEffect(() => {
    // Si hay un ID en la URL, cargar el mensaje automáticamente
    if (id && id.length === 10) {
      fetchMessage(id);
    }
  }, [id, fetchMessage]);

  // Si el usuario pega un código corto manualmente, buscar en backend
  useEffect(() => {
    // Solo si el mensaje es un ID de 10 caracteres alfanuméricos
    if (/^[a-zA-Z0-9]{10}$/.test(message)) {
      fetchMessage(message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  // Autocompletar el mensaje si hay ?code= en la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setMessage(code);
    }
  }, []);

  const handleDecrypt = () => {
    try {
      // Validaciones
      validateKey(key);
      
      if (!message.trim()) {
        showError('No hay mensaje para desencriptar');
        return;
      }

      setIsDecrypting(true);

      const cleaned = cleanEncryptedMessage(message);
      
      const decrypted = CryptoJS.AES.decrypt(cleaned, key);
      const result = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!result) {
        showError('No se pudo desencriptar. Verifica la clave.');
        return;
      }
      
      setMessage(result);
      showSuccess('Mensaje desencriptado exitosamente');
    } catch (error: any) {
      console.error('Error al desencriptar:', error);
      const errorMessage = handleCryptoError(error);
      showError(errorMessage);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setKey(newKey);
    
    // Validación en tiempo real
    if (newKey.length > 0 && newKey.length < 3) {
      showWarning('La clave debe tener al menos 3 caracteres');
    }
  };

  // Handler para eliminar mensaje online
  const handleDeleteMessage = async () => {
    if (!onlineCode) return;
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append('id', onlineCode);
      await axios.post('/delete', formData);
      setMessage('');
      setInfo('');
      showSuccess('Mensaje eliminado correctamente');
    } catch (error: any) {
      showError('No se pudo eliminar el mensaje');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tab-pane fade">
      <form className="flex items-center gap-4 mb-2">
        <input
          type="password"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Clave secreta"
          value={key}
          onChange={handleKeyChange}
          required
          disabled={isLoading}
        />
        <div className="flex flex-col gap-1 text-xs text-gray-500 min-w-[120px]">
          <div className="flex items-center gap-1">
            <span className={indicators.length ? 'text-green-600' : 'text-gray-400'}>●</span> 8+ caracteres
          </div>
          <div className="flex items-center gap-1">
            <span className={indicators.upper ? 'text-green-600' : 'text-gray-400'}>●</span> Mayúscula
          </div>
          <div className="flex items-center gap-1">
            <span className={indicators.lower ? 'text-green-600' : 'text-gray-400'}>●</span> Minúscula
          </div>
          <div className="flex items-center gap-1">
            <span className={indicators.number ? 'text-green-600' : 'text-gray-400'}>●</span> Número
          </div>
          <div className="flex items-center gap-1">
            <span className={indicators.special ? 'text-green-600' : 'text-gray-400'}>●</span> Carácter especial
          </div>
        </div>
        <button
          type="button"
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleDecrypt}
          disabled={isLoading || isDecrypting}
        >
          {isLoading ? 'Cargando...' : isDecrypting ? 'Desencriptando...' : 'Desencriptar'}
        </button>
        <span 
          className="text-sm text-gray-600"
          dangerouslySetInnerHTML={{ __html: info }} 
        />
      </form>
      <div>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
          rows={20}
          placeholder="Ingresa el código online o código encriptado tradicional"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          readOnly={isLoading}
        />
        {message.length > 0 && !isLoading && (
          <small className="text-muted">
            {message.length} caracteres
          </small>
        )}
      </div>
      {onlineCode && (
        <div className="flex justify-end mt-2">
          <button
            type="button"
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm shadow"
            onClick={handleDeleteMessage}
            disabled={isLoading}
          >
            Eliminar mensaje
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageTab; 