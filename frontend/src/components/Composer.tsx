import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Paperclip } from 'lucide-react';
import FileUpload from './FileUpload';
import { inputClass } from './ui';

export const MAX_MESSAGE_LENGTH = 10000;
export const MIN_PASSWORD_LENGTH = 8;

// Devuelve la clave i18n del error, o null si el contenido es válido
export function contentError(message: string, files: File[]): string | null {
  if (!message.trim() && files.length === 0) return 'notifications.error.noContent';
  if (message.length > MAX_MESSAGE_LENGTH) return 'notifications.error.messageTooLong';
  return null;
}

interface ComposerProps {
  message: string;
  onMessageChange: (v: string) => void;
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const Composer: React.FC<ComposerProps> = ({ message, onMessageChange, onFilesChange, disabled, placeholder }) => {
  const { t } = useTranslation();
  const [showFiles, setShowFiles] = useState(false);
  const nearLimit = message.length > MAX_MESSAGE_LENGTH * 0.9;

  return (
    <div className="space-y-3">
      <div>
        <textarea
          className={`${inputClass} min-h-[9rem] resize-y sm:min-h-[12rem]`}
          rows={6}
          placeholder={placeholder || t('form.message')}
          value={message}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={e => onMessageChange(e.target.value)}
          disabled={disabled}
          aria-label={t('form.messageLabel')}
        />
        {message.length > 0 && (
          <p className={`mt-1 text-right text-xs ${nearLimit ? 'text-amber-600' : 'text-gray-400'}`}>
            {message.length.toLocaleString()} / {MAX_MESSAGE_LENGTH.toLocaleString()}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          if (showFiles) onFilesChange([]);
          setShowFiles(v => !v);
        }}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        disabled={disabled}
        aria-expanded={showFiles}
      >
        {showFiles ? <FileText className="h-5 w-5" aria-hidden /> : <Paperclip className="h-5 w-5" aria-hidden />}
        {showFiles ? t('form.onlyMessage') : t('form.addFiles')}
      </button>

      {showFiles && <FileUpload onFilesChange={onFilesChange} disabled={disabled} />}
    </div>
  );
};

export default Composer;
