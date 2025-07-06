import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { useTranslation } from 'react-i18next';

interface ResponseViewProps {
  title: string;
  content: string;
  status: string;
  onClose: () => void;
}

const ResponseView: React.FC<ResponseViewProps> = ({ title, content, status, onClose }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  // Scroll automático al top cuando se monta el componente
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  };

  // Extraer la URL del contenido
  const extractUrl = () => {
    const match = content.match(/https?:\/\/[^\s<]+/);
    return match ? match[0] : '';
  };

  const url = extractUrl();

  const handleCopyUrl = async () => {
    if (!url) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar URL:', err);
      try {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Error en fallback de copia:', fallbackErr);
      }
    }
  };

  const codeForQR = url || content;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-2xl font-bold ${getStatusColor()}`}>
          {title === 'Mensaje Enviado' ? 'Mensaje Encriptado Guardado' : title}
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 text-2xl font-bold"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>



      {/* URL con botón de copiar */}
      {url && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('response.shareLink')}
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={url}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
            />
            <button
              onClick={handleCopyUrl}
              className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
              title={copied ? t('response.copied') : t('response.copyUrl')}
            >
              {copied ? (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* QR Code */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('response.qrCode')}
        </label>
        <div className="flex justify-center p-4 bg-gray-50 rounded-lg">
          <div className="flex flex-col items-center">
            <div className="bg-white p-2 rounded border">
              <QRCode
                value={codeForQR}
                size={120}
                level="M"
                fgColor="#000000"
                bgColor="#FFFFFF"
                title="Código QR del mensaje encriptado"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {t('response.scanWithPhone')}
            </p>
          </div>
        </div>
      </div>

      {/* Botón de cerrar */}
      <div className="flex justify-center">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
        >
          {t('modal.createNewMessage')}
        </button>
      </div>
    </div>
  );
};

export default ResponseView; 