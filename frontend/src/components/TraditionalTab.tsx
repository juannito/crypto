import React, { useState, useMemo } from 'react';
import CryptoJS from 'crypto-js';
import QRCode from 'react-qr-code';
import { useNotifications } from '../hooks/useNotifications';
import { 
  validateMessage, 
  validateKey, 
  handleCryptoError, 
  formatEncryptedMessage,
  cleanEncryptedMessage 
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

const TraditionalTab: React.FC = () => {
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const { showSuccess, showError, showWarning, showInfo } = useNotifications();

  // Encriptación en tiempo real
  const encrypted = useMemo(() => {
    try {
      validateKey(key);
      validateMessage(message);
      const enc = CryptoJS.AES.encrypt(message, key);
      return formatEncryptedMessage(enc.toString());
    } catch {
      return '';
    }
  }, [key, message]);

  const handleDecrypt = () => {
    try {
      validateKey(key);
      if (!message.trim()) {
        showError('El mensaje encriptado no puede estar vacío');
        return;
      }
      const cleaned = cleanEncryptedMessage(message);
      const decrypted = CryptoJS.AES.decrypt(cleaned, key);
      const result = decrypted.toString(CryptoJS.enc.Utf8);
      if (!result) {
        showError('No se pudo desencriptar. Verifica la clave y el mensaje encriptado.');
        return;
      }
      setMessage(result);
      showSuccess('Mensaje desencriptado exitosamente');
    } catch (error: any) {
      console.error('Error al desencriptar:', error);
      const errorMessage = handleCryptoError(error);
      showError(errorMessage);
    }
  };

  const handleReset = () => {
    setKey('');
    setMessage('');
    showInfo('Formulario limpiado');
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setKey(newKey);
    if (newKey.length > 0 && newKey.length < 3) {
      showWarning('La clave debe tener al menos 3 caracteres');
    }
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newMessage = e.target.value;
    setMessage(newMessage);
    if (newMessage.length > 9000) {
      showWarning('El mensaje se acerca al límite de caracteres');
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

  return (
    <div className="tab-pane fade">
      <form className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="password"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Clave secreta"
            value={key}
            onChange={handleKeyChange}
            required
          />
        </div>
        <div className="flex flex-row flex-wrap gap-4 text-xs text-gray-500 mb-2">
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
        <div className="relative">
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            rows={10}
            placeholder="Mensaje"
            value={message}
            onChange={handleMessageChange}
          />
          {message.length > 0 && (
            <small className="text-muted">
              {message.length} caracteres {message.length > 9000 ? '(cerca del límite)' : ''}
            </small>
          )}
          {/* Código encriptado en tiempo real */}
          {encrypted && (
            <div className="relative mt-2">
              <div className="mb-2 text-xs text-gray-600 font-semibold uppercase tracking-wide">MENSAJE ENCRIPTADO:</div>
              <pre className="whitespace-pre-wrap break-all text-gray-800 bg-white rounded p-3 text-sm border overflow-x-auto pr-14">
                {encrypted}
              </pre>
              <div className="absolute top-2 right-2 flex gap-2 z-10">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-gray-200 transition-colors"
                  title="Copiar código"
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
                  title="Mostrar QR"
                >
                  <svg className={`w-5 h-5 ${encrypted.length >= 1800 ? 'text-red-600' : 'text-gray-500 hover:text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect width="18" height="18" x="3" y="3" rx="2" strokeWidth="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01" />
                  </svg>
                </button>
              </div>
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
        </div>
      </form>
    </div>
  );
};

export default TraditionalTab; 