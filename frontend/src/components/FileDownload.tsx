import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import CryptoJS from 'crypto-js';
import { 
  FileText, 
  FileImage, 
  FileVideo, 
  FileAudio, 
  Archive, 
  File,
  FileSpreadsheet,
  Presentation,
  FileCode,
  FileX,
  FileCheck,
  FileArchive
} from 'lucide-react';

// Función para obtener el icono según el tipo de archivo
const getFileIcon = (fileName: string, mimeType: string) => {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  
  // Imágenes
  if (mimeType.startsWith('image/')) {
    return <FileImage className="w-6 h-6 text-green-600" />;
  }
  
  // PDF y Documentos de Word
  if (extension === 'pdf' || mimeType === 'application/pdf' || ['doc', 'docx'].includes(extension) || mimeType.includes('word')) {
    return <FileText className="w-6 h-6 text-blue-600" />;
  }
  
  // Hojas de cálculo Excel
  if (['xls', 'xlsx', 'csv'].includes(extension) || mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return <FileSpreadsheet className="w-6 h-6 text-green-600" />;
  }
  
  // Presentaciones PowerPoint
  if (['ppt', 'pptx'].includes(extension) || mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
    return <Presentation className="w-6 h-6 text-orange-600" />;
  }
  
  // Archivos de código
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'json', 'xml', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs', 'swift', 'kt'].includes(extension)) {
    return <FileCode className="w-6 h-6 text-purple-600" />;
  }
  
  // Archivos de texto
  if (['txt', 'md', 'rtf'].includes(extension) || mimeType.startsWith('text/')) {
    return <FileText className="w-6 h-6 text-gray-600" />;
  }
  
  // Archivos comprimidos
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension) || mimeType.includes('compressed') || mimeType.includes('archive')) {
    return <FileArchive className="w-6 h-6 text-purple-600" />;
  }
  
  // Archivos de audio
  if (mimeType.startsWith('audio/')) {
    return <FileAudio className="w-6 h-6 text-blue-600" />;
  }
  
  // Archivos de video
  if (mimeType.startsWith('video/') || extension === 'mp4') {
    return <FileVideo className="w-6 h-6 text-red-600" />;
  }
  
  // Archivo genérico (fallback)
  return <File className="w-6 h-6 text-gray-400" />;
};

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

// Añade función para obtener el tipo MIME según la extensión
function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

const FileDownload: React.FC<FileDownloadProps> = ({ files }) => {
  const { t } = useTranslation();
  if (files.length === 0) {
    return null;
  }
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  const downloadFile = (file: FileData) => {
    try {
      const byteCharacters = atob(file.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: getMimeType(file.name) });
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
  return (
    <div className="mt-6 space-y-4">
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium text-gray-900">
            {t('fileDownload.title')} ({files.length})
          </h3>
        </div>
        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                  {isImageFile(file.name) ? (
                    <img 
                      src={`data:${getMimeType(file.name)};base64,${file.content}`} 
                      alt={file.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                  ) : (
                    getFileIcon(file.name, getMimeType(file.name))
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => downloadFile(file)}
                className="px-3 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {t('fileDownload.download')}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FileDownload; 