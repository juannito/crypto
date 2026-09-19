import React from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Link2, Lock, MailQuestion, ShieldCheck, Unlock } from 'lucide-react';
import ShareTab from './components/ShareTab';
import EncryptTab from './components/EncryptTab';
import DecryptTab from './components/DecryptTab';
import HelpTab from './components/HelpTab';
import { InboxView, RequestsTab, RespondView } from './components/RequestsTab';
import NotificationContainer from './components/NotificationContainer';
import LanguageSelector from './components/LanguageSelector';
import { NotificationsProvider, useNotifications } from './hooks/useNotifications';

const TABS = [
  { to: '/', key: 'online', icon: Link2, match: (p: string) => p === '/' },
  { to: '/encrypt', key: 'traditional', icon: Lock, match: (p: string) => p.startsWith('/encrypt') },
  { to: '/message', key: 'message', icon: Unlock, match: (p: string) => p.startsWith('/message') },
  { to: '/requests', key: 'requests', icon: MailQuestion, match: (p: string) => /^\/(requests?|inbox)/.test(p) },
  { to: '/help', key: 'help', icon: HelpCircle, match: (p: string) => p.startsWith('/help') },
];

const DESCRIPTIONS: Record<string, string> = {
  '/': 'descriptions.online',
  '/encrypt': 'descriptions.traditional',
  '/message': 'descriptions.message',
  '/requests': 'descriptions.requests',
};

function TabBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  return (
    <nav aria-label={t('tabs.label')} className="mb-5">
      <ul className="grid grid-cols-5 gap-1 rounded-xl bg-gray-100 p-1">
        {TABS.map(({ to, key, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={to}>
              <NavLink
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium leading-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:min-h-[44px] sm:flex-row sm:gap-2 sm:text-sm ${
                  active ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0 sm:h-4 sm:w-4" aria-hidden />
                <span className="max-w-full truncate">{t(`tabs.${key}`)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Description() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const key = DESCRIPTIONS[pathname];
  if (!key || (pathname === '/message' && window.location.hash)) return null;
  return <p className="mb-5 text-center text-sm leading-relaxed text-gray-600">{t(key)}</p>;
}

function Screens() {
  const location = useLocation();
  return (
    // key: cada navegación (p. ej. abrir otro enlace) vuelve a montar la vista con estado limpio
    <Routes location={location} key={location.pathname + location.hash}>
      <Route path="/" element={<ShareTab />} />
      <Route path="/encrypt" element={<EncryptTab />} />
      <Route path="/message" element={<DecryptTab />} />
      <Route path="/requests" element={<RequestsTab />} />
      <Route path="/request" element={<RespondView />} />
      <Route path="/inbox" element={<InboxView />} />
      <Route path="/help" element={<HelpTab />} />
      <Route path="*" element={<ShareTab />} />
    </Routes>
  );
}

function Notifications() {
  const { notifications, removeNotification } = useNotifications();
  return <NotificationContainer notifications={notifications} onRemoveNotification={removeNotification} />;
}

function App() {
  const { t } = useTranslation();
  return (
    <NotificationsProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <div className="mx-auto max-w-3xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 sm:pt-8">
            <header className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
              <NavLink to="/" className="flex min-w-0 items-center gap-2 text-gray-900">
                <ShieldCheck className="h-7 w-7 flex-shrink-0 text-blue-600" aria-hidden />
                <span className="truncate text-xl font-bold sm:text-2xl">{t('appName')}</span>
              </NavLink>
              <LanguageSelector />
            </header>
            <TabBar />
            <Description />
            <main>
              <Screens />
            </main>
          </div>
          <Notifications />
        </div>
      </BrowserRouter>
    </NotificationsProvider>
  );
}

export default App;
