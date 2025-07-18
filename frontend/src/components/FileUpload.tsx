import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  if (mimeType.startsWith('video/')) {
    return <FileVideo className="w-6 h-6 text-red-600" />;
  }
  
  // Archivo genérico (fallback)
  return <File className="w-6 h-6 text-gray-400" />;
};

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

interface FileWithPreview extends File {
  preview?: string;
  id: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesChange, disabled = false }) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILES = 20; // Aumentado de 5 a 20 para pruebas de rendimiento
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return t('fileUpload.errors.fileTooLarge', { maxSize: formatFileSize(MAX_FILE_SIZE) });
    }
    return null;
  };

  const handleFiles = async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: FileWithPreview[] = [];
    const errors: string[] = [];

    // Procesar archivos y crear previews de forma asíncrona
    const processFile = async (file: File): Promise<FileWithPreview | null> => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        return null;
      }

      const fileWithPreview = file as FileWithPreview;
      fileWithPreview.id = Math.random().toString(36).substr(2, 9);
      
      // Crear preview para imágenes de forma asíncrona
      if (file.type.startsWith('image/')) {
        try {
          const preview = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          fileWithPreview.preview = preview;
        } catch (error) {
          console.error('Error reading file preview:', error);
        }
      }
      
      return fileWithPreview;
    };

    // Procesar todos los archivos en paralelo
    const processedFiles = await Promise.all(fileArray.map(processFile));
    const validProcessedFiles = processedFiles.filter(file => file !== null) as FileWithPreview[];

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }

    const updatedFiles = [...files, ...validProcessedFiles].slice(0, MAX_FILES);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFiles(e.target.files);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Área de drop */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={!disabled ? openFileDialog : undefined}
      >
        <div className="space-y-2">
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="text-sm text-gray-600">
            <span className="font-medium text-blue-600 hover:text-blue-500">
              {t('fileUpload.clickToUpload')}
            </span>
            {' '}{t('fileUpload.orDragDrop')}
          </div>
          <p className="text-xs text-gray-500">
            {t('fileUpload.maxFiles', { maxFiles: MAX_FILES })} • {t('fileUpload.maxSize', { maxSize: formatFileSize(MAX_FILE_SIZE) })}
          </p>
        </div>
      </div>

      {/* Input de archivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInput}
        disabled={disabled}
      />

      {/* Lista de archivos */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">
            {t('fileUpload.selectedFiles')} ({files.length}/{MAX_FILES})
          </h4>
          <div className="space-y-2">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {file.preview ? (
                    <img src={file.preview} alt={file.name} className="w-10 h-10 object-cover rounded" />
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                      {getFileIcon(file.name, file.type)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                  disabled={disabled}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload; 