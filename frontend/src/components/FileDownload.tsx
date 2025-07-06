import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import CryptoJS from 'crypto-js';

interface FileData {
  name: string;
  content: string; // base64 or encrypted
  size: number;
}

interface DecryptedFileData extends FileData {
  decryptedContent?: string;
  isDecrypting?: boolean;
  isDecrypted?: boolean;
  previewUrl?: string;
}

interface FileDownloadProps {
  files: FileData[];
  decryptionKey?: string; // Clave para desencriptar archivos
}

// Función para verificar si una cadena es base64 válido
function isValidBase64(str: string): boolean {
  try {
    return btoa(atob(str)) === str;
  } catch (e) {
    return false;
  }
}

// Función para detectar si es una imagen
function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return imageExtensions.includes(ext);
}

const FileDownload: React.FC<FileDownloadProps> = ({ files, decryptionKey }) => {
  const { t } = useTranslation();
  const [decryptedFiles, setDecryptedFiles] = useState<DecryptedFileData[]>(
    files.map(file => ({ ...file, isDecrypted: false, isDecrypting: false }))
  );

  // Actualizar estado cuando cambian los archivos
  useEffect(() => {
    setDecryptedFiles(
      files.map(file => ({ ...file, isDecrypted: false, isDecrypting: false }))
    );
  }, [files]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const decryptFile = async (fileIndex: number) => {
    const file = decryptedFiles[fileIndex];
    
    // Si ya está desencriptado, no hacer nada
    if (file.isDecrypted) return;
    
    // Si no es base64 válido y tenemos clave, desencriptar
    if (!isValidBase64(file.content) && decryptionKey) {
      setDecryptedFiles(prev => 
        prev.map((f, i) => 
          i === fileIndex ? { ...f, isDecrypting: true } : f
        )
      );

      try {
        const decrypted = CryptoJS.AES.decrypt(file.content, decryptionKey);
        const decryptedBase64 = decrypted.toString(CryptoJS.enc.Utf8);
        
        // Crear preview URL si es imagen
        let previewUrl = undefined;
        if (isImageFile(file.name)) {
          try {
            const byteCharacters = atob(decryptedBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/*' });
            previewUrl = URL.createObjectURL(blob);
          } catch (error) {
            console.error('Error creating preview:', error);
          }
        }

        setDecryptedFiles(prev => 
          prev.map((f, i) => 
            i === fileIndex ? { 
              ...f, 
              decryptedContent: decryptedBase64,
              isDecrypted: true,
              isDecrypting: false,
              previewUrl
            } : f
          )
        );
      } catch (error) {
        console.error('Error decrypting file:', error);
        setDecryptedFiles(prev => 
          prev.map((f, i) => 
            i === fileIndex ? { ...f, isDecrypting: false } : f
          )
        );
        alert(t('fileDownload.errors.decryptionFailed'));
      }
    } else {
      // Archivo no encriptado, marcar como desencriptado
      setDecryptedFiles(prev => 
        prev.map((f, i) => 
          i === fileIndex ? { 
            ...f, 
            decryptedContent: f.content,
            isDecrypted: true,
            previewUrl: isImageFile(f.name) ? `data:image/*;base64,${f.content}` : undefined
          } : f
        )
      );
    }
  };

  const downloadFile = (fileIndex: number) => {
    const file = decryptedFiles[fileIndex];
    
    // Si no está desencriptado, desencriptar primero
    if (!file.isDecrypted) {
      decryptFile(fileIndex);
      return;
    }

    try {
      const contentToUse = file.decryptedContent || file.content;
      
      // Convertir base64 a blob
      const byteCharacters = atob(contentToUse);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray]);

      // Crear URL y descargar
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert(t('fileDownload.errors.downloadFailed'));
    }
  };

  // Función para desencriptar todos los archivos
  const decryptAllFiles = async () => {
    for (let i = 0; i < decryptedFiles.length; i++) {
      if (!decryptedFiles[i].isDecrypted && !decryptedFiles[i].isDecrypting) {
        await decryptFile(i);
        // Pequeña pausa entre archivos para mejor UX
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  };

  // Verificar si todos los archivos están desencriptados
  const allFilesDecrypted = decryptedFiles.every(file => file.isDecrypted);
  const anyFileDecrypting = decryptedFiles.some(file => file.isDecrypting);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-900">
            {t('fileDownload.title')} ({files.length})
          </h3>
          {/* Botón para desencriptar todos */}
          {!allFilesDecrypted && (
            <button
              type="button"
              onClick={decryptAllFiles}
              disabled={anyFileDecrypting}
              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {anyFileDecrypting ? t('fileDownload.decrypting') : t('fileDownload.decryptAll')}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {decryptedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                  {file.previewUrl && isImageFile(file.name) ? (
                    <img 
                      src={file.previewUrl} 
                      alt={file.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                  ) : (
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                  {file.isDecrypting && (
                    <p className="text-xs text-blue-600">Desencriptando...</p>
                  )}
                  {file.isDecrypted && (
                    <p className="text-xs text-green-600">✓ Listo para descargar</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => downloadFile(index)}
                disabled={!file.isDecrypted || file.isDecrypting}
                className={`px-3 py-1 text-sm rounded focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  file.isDecrypted 
                    ? 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {file.isDecrypting ? t('fileDownload.decrypting') : t('fileDownload.download')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FileDownload; 