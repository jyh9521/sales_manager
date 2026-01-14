import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Products from './pages/Products';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';

function App() {
  const { t, i18n } = useTranslation();
  const [currentView, setCurrentView] = useState('dashboard');

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'products':
        return <Products />;
      case 'clients':
        return <Clients />;
      case 'invoices':
        return <Invoices />;
      case 'settings':
        return <Settings />;
      case 'dashboard':
      default:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">{t('dashboard', 'Dashboard')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { key: 'clients', color: 'bg-emerald-500', route: 'clients' },
                { key: 'products', color: 'bg-amber-500', route: 'products' },
                { key: 'invoices', color: 'bg-rose-500', route: 'invoices' },
              ].map((item) => (
                <div
                  key={item.key}
                  onClick={() => setCurrentView(item.route)}
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group"
                >
                  <div className={`w-12 h-12 ${item.color} rounded-full mb-4 flex items-center justify-center text-white font-bold opacity-90`}>
                    {item.key[0].toUpperCase()}
                  </div>
                  <h2 className="text-xl font-semibold text-gray-800 group-hover:text-blue-600">
                    {t(item.key)}
                  </h2>
                  <p className="text-gray-500 mt-2 text-sm">Manage {t(item.key)}</p>
                </div>
              ))}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col z-10 sticky top-0 h-screen">
        <div className="p-6 border-b border-gray-100 flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">SalesManager</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'dashboard', icon: '🏠' },
            { id: 'clients', icon: '👥' },
            { id: 'products', icon: '📦' },
            { id: 'invoices', icon: '📄' },
            { id: 'settings', icon: '⚙️' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 ${currentView === item.id
                ? 'bg-indigo-50 text-indigo-600 font-semibold shadow-sm'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="capitalize">{t(item.id)}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100 bg-gray-50 text-xs text-center text-gray-400">
          Internal Version v1.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50/50">
        <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-20 border-b border-gray-200 px-8 py-4 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-500 capitalize">{t(currentView)}</h2>
          <div className="flex gap-2">
            {['ja', 'en', 'zh'].map((lang) => (
              <button
                key={lang}
                onClick={() => changeLanguage(lang)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${i18n.language === lang
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
