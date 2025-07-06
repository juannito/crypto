import React, { useState, useMemo, useRef } from 'react';
import CryptoJS from 'crypto-js';
import QRCode from 'react-qr-code';
import { useTranslation } from 'react-i18next';
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
function getStrengthLevel(indicators: ReturnType<typeof getKeyStrengthIndicators>, t: any) {
  const score = Object.values(indicators).filter(Boolean).length;
  if (score <= 2) return { color: 'bg-red-500', label: t('strength.insecure'), score };
  if (score <= 4) return { color: 'bg-yellow-400', label: t('strength.secure'), score };
  return { color: 'bg-green-500', label: t('strength.verySecure'), score };
}

const TraditionalTab: React.FC = () => {
  const { t } = useTranslation();
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
        showError(t('notifications.error.emptyMessage'));
        return;
      }
      const cleaned = cleanEncryptedMessage(message);
      const decrypted = CryptoJS.AES.decrypt(cleaned, key);
      const result = decrypted.toString(CryptoJS.enc.Utf8);
      if (!result) {
        showError(t('notifications.error.decryptFailed'));
        return;
      }
      setMessage(result);
      showSuccess(t('notifications.success.messageDecrypted'));
    } catch (error: any) {
      console.error('Error al desencriptar:', error);
      const errorMessage = handleCryptoError(error);
      showError(errorMessage);
    }
  };

  const handleReset = () => {
    setKey('');
    setMessage('');
    showInfo(t('notifications.info.formCleared'));
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setKey(newKey);
    if (newKey.length > 0 && newKey.length < 3) {
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
      <form className="space-y-4">
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
          
          {/* Botón de acción */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              {t('form.clear')}
            </button>
          </div>
        </div>
        {/* Mensaje encriptado resultante */}
        {encrypted && (
          <div className="relative mt-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-gray-600 font-semibold uppercase tracking-wide">{t('encryptedMessage')}</div>
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
            <pre className="whitespace-pre-wrap break-all text-gray-800 bg-white rounded p-3 text-sm border overflow-x-auto pr-14">
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

export default TraditionalTab; 