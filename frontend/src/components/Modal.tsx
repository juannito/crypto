import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';

interface ModalProps {
  title: string;
  content: string;
  status: string;
  onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({ title, content, status, onClose }) => {
  const [copied, setCopied] = useState(false);

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
    // Busca la primera línea que parezca una URL
    const match = content.match(/https?:\/\/[^\s<]+/);
    return match ? match[0] : '';
  };

  const url = extractUrl();

  const handleCopyUrl = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar URL:', err);
    }
  };

  // Para el QR, si hay URL la usamos, si no, usamos el contenido completo
  const codeForQR = url || content;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header flex items-center justify-between relative">
            <h4 className={`modal-title ${getStatusColor()} pr-8`}>{title === 'Mensaje Enviado' ? 'Mensaje Encriptado Guardado' : title}</h4>
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 focus:outline-none text-2xl"
              onClick={onClose}
              aria-label="Close"
              style={{ lineHeight: 1 }}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div className="modal-body">
            {/* URL con icono de copiar */}
            {url && (
              <div className="flex items-center mb-4 text-gray-700 text-base">
                <span className="truncate max-w-xs md:max-w-md lg:max-w-lg">{url}</span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="ml-2 p-1 rounded hover:bg-gray-200 transition-colors"
                  title="Copiar URL"
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
              </div>
            )}
            {/* QR Code */}
            <div className="flex justify-center mt-6 p-4 bg-gray-50 rounded-lg">
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
                  Escanea con tu celular
                </p>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal; 