import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ShareTab from './components/ShareTab';
import EncryptTab from './components/EncryptTab';
import DecryptTab from './components/DecryptTab';
import HelpTab from './components/HelpTab';
import Modal from './components/Modal';
import NotificationContainer from './components/NotificationContainer';
import LanguageSelector from './components/LanguageSelector';
import { useNotifications } from './hooks/useNotifications';
import Lottie from 'lottie-react';
import groovyWalkAnimation from './assets/groovyWalk.json';
import ConfettiExplosion from 'react-confetti-explosion';

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('online');
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({ title: '', content: '', status: '' });
  const { notifications, removeNotification } = useNotifications();
  const [decryptMessageDeleted, setDecryptMessageDeleted] = useState(false);
  const [decryptMessageStatus, setDecryptMessageStatus] = useState<'expired' | 'deleted' | null>(null); // nuevo estado
  const [showDeleteConfetti, setShowDeleteConfetti] = useState(false); // Confetti for delete/expire
  const [decryptMessageError, setDecryptMessageError] = useState(false); // Para manejar errores de desencriptación
  const [messageDecrypted, setMessageDecrypted] = useState(false);
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detectar parámetros de URL y cambiar pestaña automáticamente
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setActiveTab('message');
    }
  }, []);

  // Cleanup del timeout de confetti cuando el componente se desmonte
  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
    };
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const showSuccessModal = (title: string, content: string) => {
    setModalData({ title, content, status: 'success' });
    setShowModal(true);
  };

  const handlePreview = (code: string) => {
    setActiveTab('message');
    const newUrl = new URL(window.location.origin + '/message');
    newUrl.searchParams.set('code', code);
    window.history.pushState({}, '', newUrl.toString());
    window.dispatchEvent(new CustomEvent('loadCode', { detail: { code } }));
  };

  // Nuevo callback para distinguir motivo
  const handleMessageDeleted = (deleted: boolean, status?: 'expired' | 'deleted') => {
    setDecryptMessageDeleted(deleted);
    if (deleted && status) {
      setDecryptMessageStatus(status);
      // Mostrar confetti cuando se elimina o expira el mensaje
      setShowDeleteConfetti(true);
      if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
      confettiTimeoutRef.current = setTimeout(() => setShowDeleteConfetti(false), 3000);
    }
    if (!deleted) {
      setDecryptMessageStatus(null);
      setShowDeleteConfetti(false);
    }
  };

  // Callback para manejar errores de desencriptación
  const handleDecryptError = (hasError: boolean) => {
    setDecryptMessageError(hasError);
  };

  return (
    <Router>
      <div className="App min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col">
          <div className="container mx-auto max-w-4xl px-4 mt-8">
            {/* Header con selector de idioma */}
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Crypto Messenger</h1>
              <LanguageSelector />
            </div>
            <div className="page-header mb-6">
              <ul className="nav nav-pills flex space-x-1 bg-gray-100 p-1 rounded-lg">
                <li className={`flex-1 ${activeTab === 'online' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                  <a 
                    onClick={() => handleTabChange('online')} 
                    href="#online"
                    className="block px-4 py-2 text-center rounded cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    {t('tabs.online')}
                  </a>
                </li>
                <li className={`flex-1 ${activeTab === 'traditional' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                  <a 
                    onClick={() => handleTabChange('traditional')} 
                    href="#traditional"
                    className="block px-4 py-2 text-center rounded cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    {t('tabs.traditional')}
                  </a>
                </li>
                <li className={`flex-1 ${activeTab === 'message' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                  <a 
                    onClick={() => handleTabChange('message')} 
                    href="#message"
                    className="block px-4 py-2 text-center rounded cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    {t('tabs.message')}
                  </a>
                </li>
                <li className={`flex-1 ${activeTab === 'help' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}>
                  <a 
                    onClick={() => handleTabChange('help')} 
                    href="#help"
                    className="block px-4 py-2 text-center rounded cursor-pointer hover:bg-blue-600 transition-colors"
                  >
                    {t('tabs.help')}
                  </a>
                </li>
              </ul>
            </div>
            <div className="mb-6 text-center text-sm text-gray-600 min-h-6">
              {activeTab === 'online' && (
                <span dangerouslySetInnerHTML={{ __html: t('descriptions.online') }} />
              )}
              {activeTab === 'traditional' && (
                <span>{t('descriptions.traditional')}</span>
              )}
              {activeTab === 'message' && !decryptMessageDeleted && !decryptMessageError && !messageDecrypted && (
                <span>{t('descriptions.message')}</span>
              )}
            </div>
            <div className="tab-content">
              {activeTab === 'online' && <ShareTab onSuccess={showSuccessModal} />}
              {activeTab === 'traditional' && <EncryptTab />}
              {activeTab === 'message' && !decryptMessageDeleted && (
                <DecryptTab 
                  onMessageDeleted={(deleted, status) => handleMessageDeleted(deleted, status)}
                  onDecryptError={handleDecryptError}
                  onMessageDecrypted={() => setMessageDecrypted(true)}
                />
              )}
              {activeTab === 'message' && decryptMessageDeleted && (
                <div className="flex flex-col items-center justify-center text-center min-h-[300px]">
                  {/* Confetti explosion for delete/expire */}
                  {showDeleteConfetti && (
                    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
                      <ConfettiExplosion
                        force={0.8}
                        duration={3000}
                        particleCount={200}
                        width={1400}
                        colors={['#FFC700', '#FF0000', '#2E3191', '#41BBC7', '#FF8800', '#8800FF', '#00FF88']}
                      />
                    </div>
                  )}
                  <div className="w-48 h-48 mb-4">
                    <Lottie animationData={groovyWalkAnimation} loop={true} />
                  </div>
                  <span className="text-lg font-semibold text-black mb-6">
                    {decryptMessageStatus === 'expired'
                      ? t('notifications.error.messageNotFound')
                      : t('notifications.error.messageDeleted')}
                  </span>
                  <button
                    type="button"
                    className="mt-2 px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={() => {
                      // Limpiar parámetros de la URL
                      const url = new URL(window.location.href);
                      url.searchParams.delete('code');
                      window.history.replaceState({}, '', url.toString());
                      handleMessageDeleted(false);
                    }}
                  >
                    {t('form.decrypt') + ' another message'}
                  </button>
                </div>
              )}
              {activeTab === 'help' && <HelpTab />}
            </div>
          </div>
        </div>
        {/* Removido el footer de baicom por pedido del usuario */}

        {showModal && (
          <Modal
            title={modalData.title}
            content={modalData.content}
            status={modalData.status}
            onClose={() => setShowModal(false)}
            onPreview={handlePreview}
          />
        )}

        <NotificationContainer
          notifications={notifications}
          onRemoveNotification={removeNotification}
        />
      </div>
    </Router>
  );
}

export default App;
