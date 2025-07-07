import React, { useState, useRef } from 'react';
import CryptoJS from 'crypto-js';
import QRCode from 'react-qr-code';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../hooks/useNotifications';
import { 
  validateKey, 
  handleCryptoError, 
  formatEncryptedMessage,
  cleanEncryptedMessage 
} from '../utils/errorHandler';
import FileUpload from './FileUpload';

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

const EncryptTab: React.FC = () => {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();
  const [encrypted, setEncrypted] = useState('');
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [hasEncrypted, setHasEncrypted] = useState(false); // Nuevo estado para controlar si se ha encriptado
  const [showKey, setShowKey] = useState(false); // Estado para mostrar/ocultar clave
  const [showFileUpload, setShowFileUpload] = useState(false); // Estado para mostrar/ocultar área de archivos
  // Eliminar el estado y el toggle de encryptFiles
  const [expire, setExpire] = useState('0'); // Opción de expiración
  const [destroy, setDestroy] = useState(false); // Destruir al leer

  // Verificar si el formulario es válido para habilitar el botón
  const isFormValid = key.length >= 8 && ((message && message.trim()) || files.length > 0);

  // Serializar archivos a base64 y armar array {name, content, size}
  const serializeFiles = async (fileList: File[]): Promise<any[]> => {
    const promises = fileList.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            name: file.name,
            content: (reader.result as string).split(',')[1], // quitar el prefijo data:...base64,
            size: file.size
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });
    return Promise.all(promises);
  };

  // Nuevo handler para encriptar al hacer clic
  const handleEncrypt = async () => {
    if (!isFormValid) {
      showWarning(t('notifications.error.noContent'));
      return;
    }
    setIsEncrypting(true);
    try {
      let filesData: any[] = [];
      // Archivos
      if (files.length > 0) {
        // Serializar y encriptar archivos SIEMPRE
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
        filesData = fileObjs;
      }
      const data = {
        message: message.trim() || '',
        files: filesData
      };
      const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(data), key);
      setEncrypted(formatEncryptedMessage(encryptedData.toString()));
      setHasEncrypted(true); // Marcar como encriptado
      showSuccess(t('notifications.success.messageSaved'));
      
      // Scroll automático para mostrar el resultado
      setTimeout(() => {
        const encryptedTitle = document.querySelector('[data-encrypted-title]');
        if (encryptedTitle) {
          const rect = encryptedTitle.getBoundingClientRect();
          const scrollTop = window.pageYOffset + rect.top - 20; // 20px de margen arriba
          window.scrollTo({ top: scrollTop, behavior: 'smooth' });
        }
      }, 100);
    } catch (error) {
      console.error('Error al encriptar:', error);
      setEncrypted('');
      setHasEncrypted(false);
      showError(t('notifications.error.unexpectedError'));
    } finally {
      setIsEncrypting(false);
    }
  };

  // Remover el useEffect que encriptaba automáticamente
  // useEffect(() => {
  //   if (isFormValid) {
  //     try {
  //       // Crear el objeto de datos con mensaje y archivos
  //       const data = {
  //         message: message.trim() || '',
  //         files: files
  //       };
  //       
  //       // Encriptar el objeto completo
  //       const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(data), key);
  //       setEncrypted(formatEncryptedMessage(encryptedData.toString()));
  //     } catch (error) {
  //       console.error('Error al encriptar:', error);
  //       setEncrypted('');
  //     }
  //   } else {
  //     setEncrypted('');
  //   }
  // }, [message, key, files, isFormValid]);



  const handleReset = () => {
    setKey('');
    setMessage('');
    setFiles([]);
    setEncrypted(''); // Limpiar mensaje encriptado
    setHasEncrypted(false); // Resetear estado de encriptación
    // Eliminar el toggle del formulario
    setExpire('0'); // Resetear expiración
    setDestroy(false); // Resetear destruir al leer
    showInfo(t('notifications.info.formCleared'));
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setKey(newKey);
    if (newKey.length > 0 && newKey.length < 8) {
      showWarning(t('notifications.warning.keyTooShort'));
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    if (newMessage.length > 9000) {
      showWarning(t('notifications.warning.messageLimit'));
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(encrypted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  const indicators = getKeyStrengthIndicators(key);
  const strength = getStrengthLevel(indicators, t);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  return (
    <div className="tab-pane fade">
      <form className="space-y-4" onSubmit={e => e.preventDefault()}>
        {/* Campo de mensaje primero */}
        <div className="relative">
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            rows={10}
            placeholder={t('form.message')}
            value={message}
            onChange={handleMessageChange}
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
              disabled={false}
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
            
            {/* Eliminar el toggle para encriptar archivos */}
            
            {/* Opciones de expiración */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center">
                <label className="mr-2 text-sm font-medium text-gray-700">{t('form.expires')}</label>
                <select
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={expire}
                  onChange={(e) => setExpire(e.target.value)}
                >
                  <option value="0">{t('expiration.never')}</option>
                  <option value="30">{t('expiration.30seconds')}</option>
                  <option value="86400">{t('expiration.1day')}</option>
                  <option value="604800">{t('expiration.1week')}</option>
                  <option value="2592000">{t('expiration.1month')}</option>
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
          
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleEncrypt}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!isFormValid || isEncrypting}
            >
              {isEncrypting ? t('form.saving') : t('form.encrypt')}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              {t('form.clear')}
            </button>
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
                <strong>Important:</strong> When saving, the browser first encrypts the data locally and then sends it to the server to generate the exchange link. You can choose to destroy the message when read.
              </p>
            </div>
          </div>
        </div>
        
        {/* Mensaje encriptado resultante - solo mostrar si se ha encriptado */}
        {hasEncrypted && encrypted && (
          <div className="relative mt-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-600 font-semibold uppercase tracking-wide" data-encrypted-title>{t('encryptedMessage')}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-gray-200 transition-colors"
                  title={t('form.copy')}
                >
                  {copied ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-500 hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowQR(true)}
                  className="p-1 rounded hover:bg-gray-200 transition-colors"
                  title={showQR ? t('form.hideQR') : t('form.showQR')}
                >
                  <svg className={`w-5 h-5 ${encrypted.length >= 1800 ? 'text-red-600' : 'text-gray-500 hover:text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect width="18" height="18" x="3" y="3" rx="2" strokeWidth="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01" />
                  </svg>
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap break-all text-gray-800 bg-white rounded p-3 text-sm border overflow-x-auto overflow-y-auto pr-14" style={{ maxHeight: '10rem', minHeight: '2.5rem' }}>
              {encrypted}
            </pre>
            {/* Modal QR */}
            {showQR && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                <div className="bg-white rounded-lg shadow-lg p-6 relative flex flex-col items-center">
                  <button
                    type="button"
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl"
                    onClick={() => setShowQR(false)}
                    aria-label="Cerrar"
                    style={{ lineHeight: 1 }}
                  >
                    <span aria-hidden="true">&times;</span>
                  </button>
                  {encrypted.length < 1800 ? (
                    <QRCode
                      value={encrypted}
                      size={220}
                      level="M"
                      fgColor="#000000"
                      bgColor="#FFFFFF"
                      title="Código QR del mensaje encriptado"
                    />
                  ) : (
                    <div className="text-red-600 text-center max-w-xs">
                      El código es demasiado grande para generar un QR.<br/>
                      (Máximo recomendado: 1800 caracteres)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

export default EncryptTab; 