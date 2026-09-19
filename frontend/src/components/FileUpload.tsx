import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadCloud, X } from 'lucide-react';
import { FileIcon, previewType } from './fileIcons';
import { formatBytes } from './ui';
import { useNotifications } from '../hooks/useNotifications';

export const MAX_FILES = 10;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_TOTAL_SIZE = 20 * 1024 * 1024;

interface Item {
  id: string;
  file: File;
  preview?: string;
}

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesChange, disabled = false }) => {
  const { t } = useTranslation();
  const { showError } = useNotifications();
  const [items, setItems] = useState<Item[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Libera las URLs de previsualización al desmontar
  useEffect(() => () => itemsRef.current.forEach(i => i.preview && URL.revokeObjectURL(i.preview)), []);

  const update = (next: Item[]) => {
    setItems(next);
    onFilesChange(next.map(i => i.file));
  };

  const addFiles = (list: FileList | File[]) => {
    const next = [...items];
    let total = next.reduce((n, i) => n + i.file.size, 0);
    const errors: string[] = [];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        errors.push(t('fileUpload.errors.tooMany', { maxFiles: MAX_FILES }));
        break;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: ${t('fileUpload.errors.fileTooLarge', { maxSize: formatBytes(MAX_FILE_SIZE) })}`);
        continue;
      }
      if (total + file.size > MAX_TOTAL_SIZE) {
        errors.push(t('fileUpload.errors.totalTooLarge', { maxSize: formatBytes(MAX_TOTAL_SIZE) }));
        break;
      }
      total += file.size;
      next.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${next.length}`,
        file,
        preview: previewType(file.name) ? URL.createObjectURL(file) : undefined,
      });
    }
    errors.forEach(e => showError(e));
    update(next);
  };

  const remove = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item?.preview) URL.revokeObjectURL(item.preview);
    update(items.filter(i => i.id !== id));
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const total = items.reduce((n, i) => n + i.file.size, 0);

  return (
    <div className="space-y-3">
      <button
        type="button"
        className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        onDragEnter={onDrag}
        onDragLeave={onDrag}
        onDragOver={onDrag}
        onDrop={e => {
          onDrag(e);
          setDragActive(false);
          if (!disabled && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        <UploadCloud className="h-10 w-10 text-gray-400" aria-hidden />
        <span className="text-sm text-gray-600">
          <span className="font-semibold text-blue-600">{t('fileUpload.clickToUpload')}</span>{' '}
          <span className="hidden sm:inline">{t('fileUpload.orDragDrop')}</span>
        </span>
        <span className="text-xs text-gray-500">
          {t('fileUpload.limits', { maxFiles: MAX_FILES, maxSize: formatBytes(MAX_FILE_SIZE), maxTotal: formatBytes(MAX_TOTAL_SIZE) })}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = '';
        }}
        disabled={disabled}
      />

      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <h4 className="font-medium text-gray-700">
              {t('fileUpload.selectedFiles')} ({items.length}/{MAX_FILES})
            </h4>
            <span className="text-xs text-gray-500">{formatBytes(total)}</span>
          </div>
          <ul className="space-y-2">
            {items.map(({ id, file, preview }) => (
              <li key={id} className="flex items-center gap-3 rounded-lg bg-gray-50 p-2.5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-white">
                  {preview ? <img src={preview} alt="" className="h-10 w-10 object-cover" /> : <FileIcon name={file.name} type={file.type} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  disabled={disabled}
                  aria-label={t('fileUpload.remove', { name: file.name })}
                >
                  <X className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
