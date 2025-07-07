import React, { useState, useEffect, useCallback, useRef } from 'react';
import CryptoJS from 'crypto-js';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../hooks/useNotifications';
import { 
  validateKeyForDecrypt, 
  handleCryptoError, 
  cleanEncryptedMessage,
  retryRequest 
} from '../utils/errorHandler';
import FileDownload from './FileDownload';
import CountdownTimer from './CountdownTimer';
import ConfettiExplosion from 'react-confetti-explosion';
import Lottie from 'lottie-react';
import groovyWalkAnimation from '../assets/groovyWalk.json';

// Función para verificar si una cadena es base64 válido
function isValidBase64(str: string): boolean {
  try {
    return btoa(atob(str)) === str;
  } catch (e) {
    return false;
  }
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

interface DecryptTabProps {
  onMessageDeleted?: (deleted: boolean, status?: 'expired' | 'deleted') => void;
  onDecryptError?: (hasError: boolean) => void;
  onMessageDecrypted?: () => void;
}

const DecryptTab: React.FC<DecryptTabProps> = ({ onMessageDeleted, onDecryptError, onMessageDecrypted }) => {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<any[]>([]);
  const [info, setInfo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [onlineCode, setOnlineCode] = useState<string | null>(null);
  const [isDecrypted, setIsDecrypted] = useState(false); // Nuevo estado para controlar si el mensaje fue descifrado
  const [destroyOnRead, setDestroyOnRead] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lastDecryptFailed, setLastDecryptFailed] = useState(false);
  const [messageDeleted, setMessageDeleted] = useState(false); // Nuevo estado para mensaje eliminado
  const [expirationSeconds, setExpirationSeconds] = useState<number>(0); // Segundos hasta expiración
  const [showCountdown, setShowCountdown] = useState(false); // Mostrar countdown
  const [showDeleteConfetti, setShowDeleteConfetti] = useState(false); // Confetti for delete/expire
  const [showPassword, setShowPassword] = useState(false); // Para mostrar/ocultar contraseña
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { id } = useParams<{ id: string }>();
  const { showSuccess, showError, showWarning } = useNotifications();
  const indicators = getKeyStrengthIndicators(key);

  // Función para manejar cuando expira el mensaje
  const handleMessageExpire = () => {
    setMessageDeleted(true);
    if (onMessageDeleted) onMessageDeleted(true, 'expired');
    setMessage(t('notifications.error.messageNotFound'));
    setInfo('');
    setDestroyOnRead(false);
    setFiles([]);
    setShowCountdown(false);
    setShowDeleteConfetti(true);
    if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
    confettiTimeoutRef.current = setTimeout(() => setShowDeleteConfetti(false), 3000);
    showError(t('countdown.expired'));
  };

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
    setIsDecrypted(false); // Resetear estado de descifrado
    setFiles([]); // Limpiar archivos al cargar nuevo mensaje
    setMessageDeleted(false); // Resetear estado de eliminado
    try {
      const formData = new FormData();
      formData.append('id', messageId);
      
      const response = await retryRequest(async () => {
        return await axios.post('/get', formData);
      });
      
      setMessage(response.data.msg);
      setInfo(response.data.info);
      setDestroyOnRead(!!response.data.destroy_on_read);
      // Extraer intentos restantes del info si existe
      const match = response.data.info.match(/Intentos restantes:\s*(\d+)/);
      setAttemptsLeft(match ? parseInt(match[1], 10) : null);
      
      // Usar expiration_ts del backend si está disponible
      if (typeof response.data.expiration_ts === 'number' && response.data.expiration_ts > 0) {
        const now = Math.floor(Date.now() / 1000);
        const seconds = response.data.expiration_ts - now;
        setExpirationSeconds(seconds > 0 ? seconds : 0);
        setShowCountdown(seconds > 0);
      } else {
        setExpirationSeconds(0);
        setShowCountdown(false);
      }
      
      if (response.data.msg === 'No existe el mensaje' || response.data.msg === t('notifications.error.messageNotFound')) {
        setMessageDeleted(true);
        setOnlineCode(null);
        setMessage('');
        if (onMessageDeleted) onMessageDeleted(true, 'expired');
        showError(t('notifications.error.messageNotFound'));
        return;
      } else {
        showSuccess(t('notifications.success.messageLoaded'));
        // NO obtener archivos aquí - solo se obtendrán después del descifrado
      }
    } catch (error: any) {
      console.error('Error al obtener mensaje:', error);
      setMessageDeleted(true);
      if (error.message.includes('conexión') || error.message.includes('servidor')) {
        showError(error.message);
      } else {
        showError(t('notifications.error.fetchError'));
      }
      setMessage(t('notifications.error.fetchError'));
      setInfo('');
      setDestroyOnRead(false);
      setAttemptsLeft(null);
    } finally {
      setIsLoading(false);
    }
  }, [showError, showSuccess, t, onMessageDeleted]);

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

  // Escuchar evento personalizado para cargar código desde el modal
  useEffect(() => {
    const handleLoadCode = (event: CustomEvent) => {
      const { code } = event.detail;
      setMessage(code);
      setOnlineCode(code);
      // Cargar el mensaje automáticamente
      fetchMessage(code);
    };

    window.addEventListener('loadCode', handleLoadCode as EventListener);
    
    return () => {
      window.removeEventListener('loadCode', handleLoadCode as EventListener);
    };
  }, [fetchMessage]);

  // Cuando el mensaje se elimina o expira:
  useEffect(() => {
    if (!messageDeleted && onMessageDeleted) onMessageDeleted(false);
    // eslint-disable-next-line
  }, [messageDeleted]);

  // Notificar errores de desencriptación
  useEffect(() => {
    if (onDecryptError) {
      onDecryptError(attemptsLeft === 0 || messageDeleted);
    }
  }, [attemptsLeft, messageDeleted, onDecryptError]);

  const handleDecrypt = async () => {
    try {
      // Validaciones
      validateKeyForDecrypt(key); // Solo valida que no esté vacía
      if (!message.trim()) {
        showError(t('notifications.error.noMessageToDecrypt'));
        return;
      }
      setIsDecrypting(true);
      setIsDecrypted(false); // Resetear estado de descifrado
      setFiles([]); // Limpiar archivos antes del descifrado
      const cleaned = cleanEncryptedMessage(message);
      const decrypted = CryptoJS.AES.decrypt(cleaned, key);
      const result = decrypted.toString(CryptoJS.enc.Utf8);
      if (!result) {
        setLastDecryptFailed(true);
        // Si hay un código online, descontar intento en el backend
        if (onlineCode) {
          const formData = new FormData();
          formData.append('id', onlineCode);
          try {
            const response = await axios.post('/fail_attempt', formData);
            setAttemptsLeft(response.data.attempts_left);
            if (response.data.attempts_left === 0) {
              setMessageDeleted(true);
              showError(t('notifications.error.tooManyAttempts'));
              setMessage(t('notifications.error.messageNotFound'));
              setInfo('');
              setDestroyOnRead(false);
              setFiles([]);
              setIsDecrypting(false);
              return;
            }
          } catch (error: any) {
            if (error.response?.data?.error === 'too_many_attempts') {
              setAttemptsLeft(0);
              setMessageDeleted(true);
              showError(t('notifications.error.tooManyAttempts'));
              setMessage(t('notifications.error.messageNotFound'));
              setInfo('');
              setDestroyOnRead(false);
              setFiles([]);
              setIsDecrypting(false);
              return;
            }
          }
        }
        showError(t('notifications.error.wrongKey'));
        setIsDecrypting(false);
        return;
      }
      // Intentar parsear como JSON para ver si contiene archivos
      let filesToSet: any[] = [];
      try {
        const data = JSON.parse(result);
        if (data.message !== undefined && data.files) {
          setMessage(data.message || ''); // Permitir mensaje vacío
          // Desencriptar todos los archivos automáticamente
          filesToSet = data.files.map((file: any) => {
            try {
              const decryptedFile = CryptoJS.AES.decrypt(file.content, key);
              const decryptedBase64 = decryptedFile.toString(CryptoJS.enc.Utf8);
              return {
                ...file,
                content: decryptedBase64,
                isDecrypted: true
              };
            } catch {
              return { ...file, content: '', isDecrypted: false };
            }
          });
        } else {
          setMessage(result);
        }
      } catch (e) {
        setMessage(result);
      }
      // Si hay un código online, obtener archivos del servidor después del descifrado exitoso
      if (onlineCode) {
        try {
          const formData = new FormData();
          formData.append('id', onlineCode);
          const filesResponse = await axios.post('/get_files', formData);
          if (filesResponse.data.files && filesResponse.data.files.length > 0) {
            filesToSet = filesResponse.data.files.map((file: any) => {
              try {
                const decryptedFile = CryptoJS.AES.decrypt(file.content, key);
                const decryptedBase64 = decryptedFile.toString(CryptoJS.enc.Utf8);
                return {
                  ...file,
                  content: decryptedBase64,
                  isDecrypted: true
                };
              } catch {
                return { ...file, content: '', isDecrypted: false };
              }
            });
          }
        } catch (error) {
          // Si no hay archivos o hay error, no hacer nada
          console.log('No files found or error getting files');
        }
      }
      setFiles(filesToSet);
      setLastDecryptFailed(false);
      setIsDecrypted(true); // Marcar como descifrado exitosamente
      if (onMessageDecrypted) onMessageDecrypted();
      showSuccess(t('notifications.success.messageDecrypted'));
    } catch (error: any) {
      console.error('Error al desencriptar:', error);
      const errorMessage = handleCryptoError(error);
      showError(errorMessage);
      setIsDecrypted(false);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setKey(newKey);
    
    // Validación en tiempo real
    if (newKey.length > 0 && newKey.length < 3) {
      showWarning(t('notifications.warning.keyTooShort'));
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
      setFiles([]);
      setIsDecrypted(false);
      setMessageDeleted(true);
      if (onMessageDeleted) onMessageDeleted(true, 'deleted');
      setShowDeleteConfetti(true);
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = setTimeout(() => setShowDeleteConfetti(false), 3000);
      showSuccess(t('notifications.success.messageDeleted'));
    } catch (error: any) {
      showError(t('notifications.error.deleteError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tab-pane fade">
      <div className="space-y-4">
        
        {/* Mostrar mensaje de eliminado/expirado si corresponde */}
        {messageDeleted ? (
          <div className="flex flex-col items-center justify-center text-center min-h-[300px]">
            {/* Lottie animation */}
            <div className="w-48 h-48 mb-4">
              <Lottie animationData={groovyWalkAnimation} loop={true} />
            </div>
            {/* Confetti explosion for delete/expire */}
            {showDeleteConfetti && (
              <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
                <ConfettiExplosion
                  force={0.8}
                  duration={3000}
                  particleCount={200}
                  width={1400}
                  colors={['#FFC700', '#FF0000', '#2E3191', '#41BBC7', '#FF8800', '#8800FF', '#00FF88']}
                />
              </div>
            )}
            <span className="text-lg font-semibold text-black mb-6">
              {/* Mostrar mensaje según el motivo */}
              {message === t('notifications.error.messageNotFound') || message === ''
                ? t('notifications.error.messageNotFound')
                : t('notifications.error.messageDeleted')}
            </span>
            <button
              type="button"
              className="mt-2 px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                onClick={() => {
                    setMessage('');
                    setKey('');
                    setFiles([]);
                    setInfo('');
                    setIsDecrypted(false);
                    setMessageDeleted(false);
                    if (onMessageDeleted) onMessageDeleted(false);
                    if (onDecryptError) onDecryptError(false);
                    setAttemptsLeft(null);
                    setLastDecryptFailed(false);
                    setShowCountdown(false);
                    setExpirationSeconds(0);
                    setShowDeleteConfetti(false);
                    setDestroyOnRead(false);
                    setOnlineCode(null);
                  }}
            >
              {t('form.decrypt') + ' another message'}
            </button>
          </div>
        ) : (
          <>
            {/* Campo de mensaje solo si no se desencriptó aún */}
            {!isDecrypted && (
              <div className="relative">
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                  rows={10}
                  placeholder={t('messagePlaceholder')}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  readOnly={isLoading || messageDeleted || attemptsLeft === 0}
                />
              </div>
            )}
            
            {/* Mostrar mensaje desencriptado si está disponible */}
            {isDecrypted && message && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
                <h3 className="text-lg font-medium text-green-800 mb-2">{t('decryptedMessage')}</h3>
                <div className="text-green-700 whitespace-pre-wrap">{message}</div>
              </div>
            )}
            {/* Mostrar archivos si existen */}
            {isDecrypted && files.length > 0 && (
              <FileDownload files={files} />
            )}
            {/* Countdown Timer - mostrar debajo del mensaje y archivos */}
            {showCountdown && !messageDeleted && (
              <CountdownTimer
                seconds={expirationSeconds}
                onExpire={handleMessageExpire}
                isVisible={true}
              />
            )}
            {/* Botón delete centrado debajo del mensaje y/o archivos */}
            {onlineCode && isDecrypted && !messageDeleted && (
              <div className="flex justify-center mt-6">
                <button
                  type="button"
                  className="px-6 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleDeleteMessage}
                  disabled={isLoading}
                >
                  {t('form.deleteNow')}
                </button>
              </div>
            )}
            {/* Si NO está desencriptado, mostrar input, timer, etc */}
            {!isDecrypted && (
              <>
                {/* Countdown Timer - solo mostrar si hay expiración y NO hay archivos */}
                {/* Mensaje de destrucción si corresponde */}
                {destroyOnRead && (
                  <div className="flex items-center gap-2 text-orange-600 font-medium">
                    <span>⚠️</span>
                    <span>{t('destroyMessage')}</span>
                  </div>
                )}
                {/* Intentos restantes de descifrado solo si la clave fue incorrecta */}
                {attemptsLeft !== null && attemptsLeft > 0 && lastDecryptFailed && (
                  <div className="flex items-center gap-2 text-orange-600 font-medium mt-2">
                    <span>{t('decryptWrongKeyAndAttempts', { count: attemptsLeft })}</span>
                    {attemptsLeft === 1 && (
                      <span className="flex items-center gap-1 text-orange-600 font-medium">
                        <span>⚠️</span>
                        <span>{t('destroyOnNextFail')}</span>
                      </span>
                    )}
                  </div>
                )}
                {/* Mensaje cuando el mensaje fue eliminado por demasiados intentos */}
                {attemptsLeft === 0 && (
                  <div className="flex flex-col gap-2 text-red-600 font-medium mt-2">
                    <div className="flex items-center gap-2">
                      <span>🚫</span>
                      <span>{t('notifications.error.tooManyAttempts')}</span>
                    </div>
                    <button
                      type="button"
                      className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm"
                      onClick={() => {
                        setMessage('');
                        setKey('');
                        setFiles([]);
                        setInfo('');
                        setIsDecrypted(false);
                        setMessageDeleted(false);
                        if (onMessageDeleted) onMessageDeleted(false);
                        if (onDecryptError) onDecryptError(false);
                        setAttemptsLeft(null);
                        setLastDecryptFailed(false);
                        setShowCountdown(false);
                        setExpirationSeconds(0);
                        setShowDeleteConfetti(false);
                        setDestroyOnRead(false);
                        setOnlineCode(null);
                      }}
                    >
                      {t('form.decrypt') + ' another message'}
                    </button>
                  </div>
                )}
                {/* Solo mostrar campo de clave y botón decrypt si NO está desencriptado y NO hay archivos */}
                <div className="flex flex-col gap-4 w-full">
                  {/* Campo de clave con icono de ojo */}
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={t('form.secretKey')}
                      value={key}
                      onChange={handleKeyChange}
                      required
                      disabled={isLoading || messageDeleted || attemptsLeft === 0}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading || messageDeleted || attemptsLeft === 0}
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {/* Botón de decrypt */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={handleDecrypt}
                      disabled={isLoading || isDecrypting || messageDeleted || attemptsLeft === 0}
                    >
                      {isLoading ? t('form.loading') : isDecrypting ? t('form.decrypting') : t('form.decrypt')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DecryptTab; 