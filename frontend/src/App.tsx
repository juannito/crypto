import React from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Inbox, Link2, Lock, MailCheck, MailQuestion, ShieldCheck, Unlock } from 'lucide-react';
import ShareTab from './components/ShareTab';
import EncryptTab from './components/EncryptTab';
import DecryptTab from './components/DecryptTab';
import HelpTab from './components/HelpTab';
import { InboxView, MyRequestsPage, RequestsTab, RespondView } from './components/RequestsTab';
import ReceiptsPage from './components/ReceiptsPage';
import NotificationContainer from './components/NotificationContainer';
import LanguageSelector from './components/LanguageSelector';
import { NotificationsProvider, useNotifications } from './hooks/useNotifications';
import { ActivityProvider, useActivity } from './hooks/useActivity';

const TABS = [
  { to: '/', key: 'online', icon: Link2, match: (p: string) => p === '/' },
  { to: '/encrypt', key: 'traditional', icon: Lock, match: (p: string) => p.startsWith('/encrypt') },
  { to: '/message', key: 'message', icon: Unlock, match: (p: string) => p.startsWith('/message') },
  { to: '/requests', key: 'requests', icon: MailQuestion, match: (p: string) => /^\/(requests?)$/.test(p) },
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

// Acceso del header con contador (punto rojo) de novedades
function HeaderLink({ to, icon: Icon, label, count }: { to: string; icon: typeof Inbox; label: string; count: number }) {
  const { pathname } = useLocation();
  const active = pathname === to || (to === '/my-requests' && pathname.startsWith('/inbox'));
  return (
    <NavLink
      to={to}
      aria-label={count > 0 ? `${label} (${count})` : label}
      title={label}
      className={`relative flex h-10 w-10 items-center justify-center rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-auto sm:gap-2 sm:px-3 ${
        active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span className="hidden text-sm font-medium lg:inline">{label}</span>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-gray-50">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </NavLink>
  );
}

function HeaderActions() {
  const { t } = useTranslation();
  const { pendingAnswers, unreadReceipts } = useActivity();
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      <HeaderLink to="/my-requests" icon={Inbox} label={t('header.requests')} count={pendingAnswers} />
      <HeaderLink to="/receipts" icon={MailCheck} label={t('header.receipts')} count={unreadReceipts} />
      <LanguageSelector />
    </div>
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
      <Route path="/my-requests" element={<MyRequestsPage />} />
      <Route path="/receipts" element={<ReceiptsPage />} />
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
      <ActivityProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-3xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 sm:pt-8">
              <header className="mb-4 flex items-center justify-between gap-3 sm:mb-6">
                <NavLink to="/" className="flex min-w-0 items-center gap-2 text-gray-900">
                  <ShieldCheck className="h-7 w-7 flex-shrink-0 text-blue-600" aria-hidden />
                  <span className="truncate text-xl font-bold sm:text-2xl">{t('appName')}</span>
                </NavLink>
                <HeaderActions />
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
      </ActivityProvider>
    </NotificationsProvider>
  );
}

export default App;
