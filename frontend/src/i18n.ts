import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Importar archivos de traducción
import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';
import ptTranslations from './locales/pt.json';

const resources = {
  en: {
    translation: enTranslations
  },
  es: {
    translation: esTranslations
  },
  pt: {
    translation: ptTranslations
  }
};

const SUPPORTED = ['en', 'es', 'pt'];

// Idioma guardado, o el del navegador si está soportado
function initialLanguage(): string {
  try {
    const saved = localStorage.getItem('lang');
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch {
    // almacenamiento no disponible
  }
  const browser = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return SUPPORTED.includes(browser) ? browser : 'en';
}

i18n.on('languageChanged', lng => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem('lang', lng);
  } catch {
    // almacenamiento no disponible
  }
});

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React ya escapa por defecto
    }
  });

export default i18n; 