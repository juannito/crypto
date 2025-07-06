import React, { useState, useRef } from 'react';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../hooks/useNotifications';
import { 
  validateMessage, 
  validateKey, 
  retryRequest
} from '../utils/errorHandler';

interface OnlineTabProps {
  onSuccess: (title: string, content: string) => void;
}

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
function getStrengthLevel(indicators: ReturnType<typeof getKeyStrengthIndicators>, t: any) {
  const score = Object.values(indicators).filter(Boolean).length;
  if (score <= 2) return { color: 'bg-red-500', label: t('strength.insecure'), score };
  if (score <= 4) return { color: 'bg-yellow-400', label: t('strength.secure'), score };
  return { color: 'bg-green-500', label: t('strength.verySecure'), score };
}

const OnlineTab: React.FC<OnlineTabProps> = ({ onSuccess }) => {
  const { t } = useTranslation();
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
      onSuccess(t('modal.messageSaved'), `<code>${frontendUrl}</code>`);
      showSuccess(t('notifications.success.messageSaved'));
      
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
        showError(t('notifications.error.unexpectedError'));
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
    showInfo(t('notifications.info.formCleared'));
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setKey(newKey);
    
    // Validación en tiempo real
    if (newKey.length > 0 && newKey.length < 3) {
      showWarning(t('notifications.warning.keyTooShort'));
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    
    // Validación en tiempo real
    if (newMessage.length > 9000) {
      showWarning(t('notifications.warning.messageLimit'));
    }
  };

  const indicators = getKeyStrengthIndicators(key);
  const strength = getStrengthLevel(indicators, t);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  return (
    <div className="tab-pane fade in active">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Campo de mensaje primero */}
        <div className="relative">
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            rows={10}
            placeholder={t('form.message')}
            value={message}
            onChange={handleMessageChange}
            required
            disabled={isSubmitting}
          />
          {message.length > 0 && (
            <small className="text-muted">
              {message.length} {t('characters')} {message.length > 9000 ? t('nearLimit') : ''}
            </small>
          )}
        </div>
        
        {/* Campo de clave, barra de fortaleza y acciones */}
        <div className="flex flex-col gap-4 w-full">
          {/* Campo de clave */}
          <div className="flex flex-wrap items-center gap-4 w-full">
            <input
              type="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('form.secretKey')}
              value={key}
              onChange={handleKeyChange}
              required
            />
          </div>
          
          {/* Barra de fortaleza */}
          <div className="flex items-center gap-2 w-full">
            <div className="h-2 rounded bg-gray-200 relative w-36 sm:w-36 w-full">
              <div className={`h-2 rounded transition-all duration-300 ${strength.color}`} style={{ width: `${(strength.score/5)*100}%` }} />
            </div>
            <span className={`text-xs font-semibold ${strength.color.replace('bg-', 'text-')}`}>{strength.label}</span>
            <div className="relative">
              <button
                type="button"
                className="ml-1 text-gray-400 hover:text-blue-600 focus:outline-none"
                onClick={() => setShowTooltip((v) => !v)}
                tabIndex={0}
                aria-label={t('strength.tooltip')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16v-4m0-4h.01" />
                </svg>
              </button>
              {/* Tooltip pegado al icono */}
              {showTooltip && (
                <div ref={tooltipRef} className="absolute left-1/2 top-full mt-2 -translate-x-1/2 w-56 bg-white border border-gray-300 rounded shadow-lg p-3 text-xs text-gray-700 z-50">
                  <div className="mb-1 font-semibold text-gray-800">{t('strength.title')}</div>
                  <ul className="space-y-1">
                    <li className="flex items-center gap-1">
                      <span className={indicators.length ? 'text-green-600' : 'text-gray-400'}>●</span> {t('strength.requirements.length')}
                    </li>
                    <li className="flex items-center gap-1">
                      <span className={indicators.upper ? 'text-green-600' : 'text-gray-400'}>●</span> {t('strength.requirements.uppercase')}
                    </li>
                    <li className="flex items-center gap-1">
                      <span className={indicators.lower ? 'text-green-600' : 'text-gray-400'}>●</span> {t('strength.requirements.lowercase')}
                    </li>
                    <li className="flex items-center gap-1">
                      <span className={indicators.number ? 'text-green-600' : 'text-gray-400'}>●</span> {t('strength.requirements.number')}
                    </li>
                    <li className="flex items-center gap-1">
                      <span className={indicators.special ? 'text-green-600' : 'text-gray-400'}>●</span> {t('strength.requirements.special')}
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
          
          {/* Opciones y botones de acción */}
          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center">
                <label className="mr-2 text-sm font-medium text-gray-700">{t('form.expires')}</label>
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={expire}
                  onChange={(e) => setExpire(e.target.value)}
                >
                  <option value="2592000">{t('expiration.1month')}</option>
                  <option value="604800">{t('expiration.1week')}</option>
                  <option value="86400">{t('expiration.1day')}</option>
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
                  {t('form.destroyOnRead')}
                </label>
              </div>
            </div>
            <div className="flex gap-4 w-full">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? t('form.saving') : t('form.save')}
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleReset}
                disabled={isSubmitting}
              >
                {t('form.clear')}
              </button>
            </div>
                      </div>
          </div>
          
          {/* Nota importante */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  <strong>{t('importantNote.title')}</strong> {t('importantNote.text')}
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  };

export default OnlineTab; 