import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import type { DecryptedFile } from '../crypto/payload';
import { FileIcon, previewType } from './fileIcons';
import { formatBytes } from './ui';

// Nombre seguro para guardar: sin rutas ni caracteres de control
// eslint-disable-next-line no-control-regex
const safeName = (name: string) => name.replace(/[\\/\x00-\x1f\x7f]/g, '_').slice(0, 200) || 'archivo';

const FileDownload: React.FC<{ files: DecryptedFile[] }> = ({ files }) => {
  const { t } = useTranslation();

  // Previsualizaciones solo de imágenes de mapa de bits, como blob con tipo fijado por nosotros
  const previews = useMemo(
    () =>
      files.map(f => {
        const type = previewType(f.name);
        return type ? URL.createObjectURL(new Blob([f.data as BlobPart], { type })) : null;
      }),
    [files]
  );
  useEffect(() => () => previews.forEach(p => p && URL.revokeObjectURL(p)), [previews]);

  if (files.length === 0) return null;

  const download = (file: DecryptedFile) => {
    // octet-stream: el navegador descarga, nunca interpreta el contenido
    const url = URL.createObjectURL(new Blob([file.data as BlobPart], { type: 'application/octet-stream' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName(file.name);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-800">
        {t('fileDownload.title')} ({files.length})
      </h3>
      <ul className="space-y-2">
        {files.map((file, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2.5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-gray-50">
              {previews[i] ? <img src={previews[i]!} alt="" className="h-10 w-10 object-cover" /> : <FileIcon name={file.name} type={file.type} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => download(file)}
              className="inline-flex min-h-[40px] flex-shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              aria-label={`${t('fileDownload.download')} ${file.name}`}
            >
              <Download className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">{t('fileDownload.download')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FileDownload;
