import React, { useState, useEffect, useCallback } from 'react';
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
      
      if (response.data.msg === 'No existe el mensaje') {
        setMessageDeleted(true);
        showError(t('notifications.error.messageNotFound'));
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
  }, [showError, showSuccess, t]);

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
              setMessage('');
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
              setMessage('');
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
      try {
        const data = JSON.parse(result);
        if (data.message !== undefined && data.files) {
          // Es el nuevo formato con archivos
          setMessage(data.message || ''); // Permitir mensaje vacío
          setFiles(data.files);
        } else {
          setMessage(result);
        }
      } catch (e) {
        // Si no es JSON, es un mensaje simple
        setMessage(result);
      }
      
      // Si hay un código online, obtener archivos del servidor después del descifrado exitoso
      if (onlineCode) {
        try {
          const formData = new FormData();
          formData.append('id', onlineCode);
          const filesResponse = await axios.post('/get_files', formData);
          if (filesResponse.data.files && filesResponse.data.files.length > 0) {
            setFiles(filesResponse.data.files);
          }
        } catch (error) {
          // Si no hay archivos o hay error, no hacer nada
          console.log('No files found or error getting files');
        }
      }
      
      setLastDecryptFailed(false);
      setIsDecrypted(true); // Marcar como descifrado exitosamente
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
          <div className="flex flex-col items-center justify-center text-center text-red-600 font-semibold py-8">
            <span className="text-3xl mb-2">✕</span>
            <span>{t('notifications.error.messageNotFound')}</span>
          </div>
        ) : (
          <>
            {/* Campo de mensaje primero */}
            <div className="relative">
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                rows={10}
                placeholder={t('messagePlaceholder')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                readOnly={isLoading}
              />
            </div>
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
            {/* Campo de clave y acciones */}
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
                  disabled={isLoading}
                />
              </div>
              {/* Botón de acción */}
              <div className="flex flex-wrap items-center justify-between gap-4 w-full">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleDecrypt}
                    disabled={isLoading || isDecrypting}
                  >
                    {isLoading ? t('form.loading') : isDecrypting ? t('form.decrypting') : t('form.decrypt')}
                  </button>
                  <span 
                    className="text-sm text-gray-600"
                    dangerouslySetInnerHTML={{ __html: info.replace('destroy_on_read', `<span class=\"text-orange-600 font-medium\">${t('destroyMessage')}</span>`) }} 
                  />
                </div>
                {onlineCode && (
                  <button
                    type="button"
                    className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    onClick={handleDeleteMessage}
                    disabled={isLoading}
                  >
                    {t('form.deleteMessage')}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Componente de descarga de archivos - solo mostrar si el mensaje fue descifrado */}
      {isDecrypted && files.length > 0 && <FileDownload files={files} />}
    </div>
  );
};

export default MessageTab; 