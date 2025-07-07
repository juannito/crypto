import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  title: string;
  content: string;
  status: string;
  onClose: () => void;
  onPreview?: (code: string) => void;
}

const Modal: React.FC<ModalProps> = ({ title, content, status, onClose, onPreview }) => {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

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

  // Extraer la URL del contenido (asume que viene como string tipo URL)
  const extractUrl = () => {
    // Busca la URL completa, pero excluye las etiquetas HTML
    const match = content.match(/https?:\/\/[^<\s]+/);
    return match ? match[0] : '';
  };

  // Extraer solo el código de la URL
  const extractCode = () => {
    const url = extractUrl();
    const codeMatch = url.match(/code=([A-Za-z0-9]+)/);
    return codeMatch ? codeMatch[1] : '';
  };

  const url = extractUrl();
  const code = extractCode();

  // Helper to get the correct base URL (IP or localhost)
  const getBaseUrl = () => {
    const { protocol, hostname, port } = window.location;
    // Si es localhost, pero la IP está en window.location, usar la IP
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
    }
    // Si es localhost, pero hay una IP en la URL original (por ejemplo, accedido desde 192.168.x.x)
    // No se puede detectar la IP real del servidor desde el cliente, así que usamos el hostname
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  };

  // Cuando se copia el link, reemplazar el host por el correcto
  const getCorrectUrl = () => {
    if (!url) return '';
    try {
      const u = new URL(url);
      const base = getBaseUrl();
      return `${base}${u.pathname}${u.search}${u.hash}`;
    } catch {
      return url;
    }
  };

  const handleCopyUrl = async () => {
    const copyUrl = getCorrectUrl();
    if (!copyUrl) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(copyUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = copyUrl;
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
      // Fallback adicional
      try {
        const textArea = document.createElement('textarea');
        textArea.value = copyUrl;
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

  // Para el QR, si hay URL la usamos, si no, usamos el contenido completo
  const codeForQR = url || content;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header flex items-center justify-center relative">
            <h4 className={`modal-title ${getStatusColor()}`}>{title === 'Mensaje Enviado' ? t('modal.messageSaved') : title}</h4>
          </div>
          <div className="modal-body">
            {/* QR Code primero */}
            <div className="flex justify-center mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex flex-col items-center">
                <div className="bg-white p-2 rounded border">
                  <QRCode
                    value={codeForQR}
                    size={120}
                    level="M"
                    fgColor="#000000"
                    bgColor="#FFFFFF"
                    title={t('response.qrCode')}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {t('response.scanWithPhone')}
                </p>
              </div>
            </div>
            
            {/* Botón de copiar abajo */}
            {code && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className={`flex items-center gap-2 px-4 py-2 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                    copied 
                      ? 'bg-green-500 hover:bg-green-600 focus:ring-green-500' 
                      : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500'
                  }`}
                  title={t('response.copyUrl')}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t('response.copied')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {t('response.copyLinkCode')}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          <div className="modal-footer flex justify-center gap-3">
            {code && onPreview && (
              <button
                type="button"
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                onClick={() => {
                  onPreview(code);
                  setTimeout(onClose, 50); // Delay para mobile
                }}
              >
                {t('modal.preview')}
              </button>
            )}
            <button
              type="button"
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              onClick={onClose}
            >
              {t('modal.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal; 