import React from 'react';
import { File, FileArchive, FileAudio, FileCode, FileImage, FileSpreadsheet, FileText, FileVideo, Presentation } from 'lucide-react';

const EXT = {
  doc: ['pdf', 'doc', 'docx', 'odt', 'rtf'],
  sheet: ['xls', 'xlsx', 'csv', 'ods'],
  slides: ['ppt', 'pptx', 'odp', 'key'],
  code: ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'json', 'xml', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'sh', 'yml', 'yaml', 'env', 'pem', 'key'],
  text: ['txt', 'md', 'log'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic', 'svg'],
};

export const extension = (name: string) => (name.includes('.') ? name.toLowerCase().split('.').pop() || '' : '');

export function FileIcon({ name, type = '' }: { name: string; type?: string }) {
  const ext = extension(name);
  const cls = 'h-6 w-6';
  if (type.startsWith('image/') || EXT.image.includes(ext)) return <FileImage className={`${cls} text-green-600`} />;
  if (EXT.doc.includes(ext)) return <FileText className={`${cls} text-blue-600`} />;
  if (EXT.sheet.includes(ext)) return <FileSpreadsheet className={`${cls} text-green-600`} />;
  if (EXT.slides.includes(ext)) return <Presentation className={`${cls} text-orange-600`} />;
  if (EXT.code.includes(ext)) return <FileCode className={`${cls} text-purple-600`} />;
  if (EXT.archive.includes(ext)) return <FileArchive className={`${cls} text-purple-600`} />;
  if (type.startsWith('audio/') || EXT.audio.includes(ext)) return <FileAudio className={`${cls} text-blue-600`} />;
  if (type.startsWith('video/') || EXT.video.includes(ext)) return <FileVideo className={`${cls} text-red-600`} />;
  if (type.startsWith('text/') || EXT.text.includes(ext)) return <FileText className={`${cls} text-gray-600`} />;
  return <File className={`${cls} text-gray-400`} />;
}

// Solo formatos de mapa de bits se previsualizan (nunca SVG ni HTML)
const PREVIEW_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
};

export const previewType = (name: string): string | null => PREVIEW_TYPES[extension(name)] || null;
