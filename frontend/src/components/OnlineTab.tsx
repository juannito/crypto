import React, { useState } from 'react';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { useNotifications } from '../hooks/useNotifications';
import { 
  validateMessage, 
  validateKey, 
  retryRequest
} from '../utils/errorHandler';

interface OnlineTabProps {
  onSuccess: (title: string, content: string) => void;
}

const OnlineTab: React.FC<OnlineTabProps> = ({ onSuccess }) => {
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');
  const [expire, setExpire] = useState('604800');
  const [destroy, setDestroy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validaciones
      validateKey(key);
      validateMessage(message);

      setIsSubmitting(true);

      // Encriptar el mensaje
      const encrypted = CryptoJS.AES.encrypt(message, key);
      
      // Preparar datos para enviar
      const formData = new FormData();
      formData.append('msg1', encrypted.toString());
      formData.append('expire', expire);
      if (destroy) {
        formData.append('destroy', 'on');
      }

      // Enviar al servidor con reintentos
      const response = await retryRequest(async () => {
        return await axios.post('/post', formData);
      });
      
      // Extraer el ID del link generado por el backend
      const backendUrl = response.data;
      const match = backendUrl.match(/\/([A-Za-z0-9]+)$/);
      const codeId = match ? match[1] : '';
      // Construir el link del frontend
      const frontendUrl = `${window.location.origin}/message?code=${codeId}`;
      // Mostrar modal de éxito
      onSuccess('Mensaje Encriptado Guardado', `<code>${frontendUrl}</code>`);
      showSuccess('Mensaje encriptado y guardado exitosamente');
      
      // Limpiar formulario
      setKey('');
      setMessage('');
      setDestroy(false);
    } catch (error: any) {
      console.error('Error al enviar mensaje:', error);
      
      if (error.message.includes('clave')) {
        showError(error.message);
      } else if (error.message.includes('mensaje')) {
        showError(error.message);
      } else if (error.message.includes('conexión') || error.message.includes('servidor')) {
        showError(error.message);
      } else {
        showError('Error inesperado al enviar el mensaje. Intenta nuevamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setKey('');
    setMessage('');
    setExpire('604800');
    setDestroy(false);
    showInfo('Formulario limpiado');
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setKey(newKey);
    
    // Validación en tiempo real
    if (newKey.length > 0 && newKey.length < 3) {
      showWarning('La clave debe tener al menos 3 caracteres');
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    
    // Validación en tiempo real
    if (newMessage.length > 9000) {
      showWarning('El mensaje se acerca al límite de caracteres');
    }
  };

  return (
    <div className="tab-pane fade in active">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="password"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Clave secreta"
            value={key}
            onChange={handleKeyChange}
            required
          />
          <div className="flex items-center">
            <label className="mr-2 text-sm font-medium text-gray-700">Expira:</label>
            <select
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={expire}
              onChange={(e) => setExpire(e.target.value)}
            >
              <option value="2592000">1 mes</option>
              <option value="604800">1 semana</option>
              <option value="86400">1 dia</option>
            </select>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="destroy"
              checked={destroy}
              onChange={(e) => setDestroy(e.target.checked)}
              className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="destroy" className="text-sm text-gray-700">
              Destruir al leer
            </label>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Grabando...' : 'Grabar'}
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleReset}
            disabled={isSubmitting}
          >
            Borrar
          </button>
        </div>
        <div>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            rows={10}
            placeholder="Mensaje"
            value={message}
            onChange={handleMessageChange}
            required
            disabled={isSubmitting}
          />
          {message.length > 0 && (
            <small className="text-muted">
              {message.length} caracteres {message.length > 9000 ? '(cerca del límite)' : ''}
            </small>
          )}
        </div>
      </form>
    </div>
  );
};

export default OnlineTab; 