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
import FileUpload from './FileUpload';

interface ShareTabProps {
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

const ShareTab: React.FC<ShareTabProps> = ({ onSuccess }) => {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [expire, setExpire] = useState('604800');
  const [destroy, setDestroy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [encryptFiles, setEncryptFiles] = useState(true); // Nuevo toggle para encriptar archivos
  const [isEncrypting, setIsEncrypting] = useState(false); // Para mostrar loading
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();
  
  // Estado para mostrar/ocultar clave
  const [showKey, setShowKey] = useState(false);
  
  // Estado para mostrar/ocultar área de archivos
  const [showFileUpload, setShowFileUpload] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validaciones
      validateKey(key);
      validateMessage(message);

      // Verificar que al menos haya un mensaje o archivos
      if ((!message || !message.trim()) && files.length === 0) {
        showError(t('notifications.error.noContent'));
        return;
      }

      setIsSubmitting(true);
      setIsEncrypting(true);

      // Encriptar mensaje
      const messageToEncrypt = message.trim() || '';
      const encrypted = CryptoJS.AES.encrypt(messageToEncrypt, key);
      
      // Preparar datos para enviar
      const formData = new FormData();
      formData.append('msg1', encrypted.toString());
      formData.append('expire', expire);
      if (destroy) {
        formData.append('destroy', 'on');
      }
      
      // Archivos
      if (files.length > 0) {
        if (encryptFiles) {
          // Serializar y encriptar archivos
          const fileObjs = await Promise.all(files.map(async (file) => {
            const content = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(btoa(reader.result as string));
              reader.onerror = reject;
              reader.readAsBinaryString(file);
            });
            // Encriptar el contenido base64
            const encryptedContent = CryptoJS.AES.encrypt(content, key).toString();
            return { name: file.name, size: file.size, content: encryptedContent };
          }));
          formData.append('files', new Blob([JSON.stringify(fileObjs)], { type: 'application/json' }));
        } else {
          files.forEach((file) => {
            formData.append('files', file);
          });
        }
      }
      setIsEncrypting(false);

      // Enviar al servidor con reintentos
      console.log('🔍 DEBUG: Enviando petición a:', axios.defaults.baseURL + '/post');
      const response = await retryRequest(async () => {
        return await axios.post('/post', formData);
      });
      console.log('🔍 DEBUG: Respuesta recibida:', response.data);
      
      // Extraer el ID del link generado por el backend
      const backendUrl = response.data;
      const match = backendUrl.match(/\/([A-Za-z0-9]+)$/);
      const codeId = match ? match[1] : '';
      // Construir el link del frontend
      const frontendUrl = `${window.location.origin}/message?code=${codeId}`;
      // Mostrar modal de éxito
      console.log('🔍 DEBUG: Mostrando modal:', { title: t('modal.messageSaved'), content: frontendUrl });
      showSuccess('🔍 DEBUG: Mostrando modal...');
      
      onSuccess(t('modal.messageSaved'), `<code>${frontendUrl}</code>`);
      showSuccess(t('notifications.success.messageSaved'));
      
      // Limpiar formulario
      setKey('');
      setMessage('');
      setFiles([]);
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
    setFiles([]);
    setExpire('604800');
    setDestroy(false);
    showInfo(t('notifications.info.formCleared'));
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setKey(newKey);
    
    // Validación en tiempo real
    if (newKey.length > 0 && newKey.length < 8) {
      showWarning(t('notifications.warning.keyTooShort'));
    }
  };

  // Verificar si el formulario es válido para habilitar el botón
  const isFormValid = key.length >= 8 && ((message && message.trim()) || files.length > 0);

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
            disabled={isSubmitting}
          />
          {message.length > 0 && (
            <small className="text-muted">
              {message.length} {t('characters')} {message.length > 9000 ? t('nearLimit') : ''}
            </small>
          )}
        </div>
        
        {/* Botón para alternar entre mensaje y archivos */}
        <button
          type="button"
          onClick={() => {
            if (showFileUpload) {
              // Si está mostrando archivos, limpiar y ocultar
              setFiles([]);
              setShowFileUpload(false);
            } else {
              // Si no está mostrando archivos, mostrar área de archivos
              setShowFileUpload(true);
            }
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors border border-gray-200 hover:border-blue-300 rounded-lg font-medium"
          disabled={isSubmitting}
        >
          {showFileUpload ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('form.onlyMessage')}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {t('form.addFiles')}
            </>
          )}
        </button>
        
        {/* Componente de subida de archivos - solo mostrar si está activado */}
        {showFileUpload && (
          <div className="transition-all duration-300 ease-in-out">
            <FileUpload 
              onFilesChange={setFiles}
              disabled={isSubmitting}
            />
          </div>
        )}
        
        {/* Campo de clave, barra de fortaleza y acciones */}
        <div className="flex flex-col gap-4 w-full">
          {/* Campo de clave y toggle de encriptar archivos */}
          <div className="flex flex-wrap items-center gap-4 w-full">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('form.secretKey')}
                value={key}
                onChange={handleKeyChange}
                required
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showKey ? "Ocultar clave" : "Mostrar clave"}
              >
                {showKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Toggle para encriptar archivos - mostrar cuando se activa la subida de archivos */}
            {showFileUpload && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="encryptFiles"
                  checked={encryptFiles}
                  onChange={e => setEncryptFiles(e.target.checked)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={isSubmitting}
                />
                <label htmlFor="encryptFiles" className="text-sm text-gray-700 whitespace-nowrap">
                  {t('form.encryptFiles')}
                </label>
              </div>
            )}
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
                disabled={isSubmitting || !isFormValid}
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
          

          {/* Loading mientras encripta */}
          {isEncrypting && (
            <div className="flex items-center gap-2 text-blue-600 mt-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              <span>{t('form.encryptingFiles')}</span>
            </div>
          )}
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
                  <strong>Important:</strong> When saving, the browser first encrypts the data locally and then sends it to the server to generate the exchange link. You can choose to destroy the message when read.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  };

export default ShareTab; 