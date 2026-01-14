import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Products from './pages/Products';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, ToggleButton, ToggleButtonGroup, CssBaseline
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Inventory2 as InventoryIcon,
  Description as InvoiceIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { settingsService, defaultSettings } from './services/settings';
const drawerWidth = 260;

function App() {
  const { t, i18n } = useTranslation();
  const [currentView, setCurrentView] = useState('dashboard');
  const [primaryColor, setPrimaryColor] = useState(defaultSettings.PrimaryColor || '#1976d2');

  useEffect(() => {
    const loadTheme = async () => {
      const s = await settingsService.get();
      if (s.PrimaryColor) setPrimaryColor(s.PrimaryColor);
    };
    loadTheme();
  }, [currentView]); // Re-check when view changes (simple way to catch updates if Settings saved)



  // Update theme when primaryColor changes
  const activeTheme = createTheme({
    palette: {
      primary: { main: primaryColor }
    }
  });

  const changeLanguage = (_event: React.MouseEvent<HTMLElement>, newLang: string) => {
    if (newLang) {
      i18n.changeLanguage(newLang);
    }
  };

  const menuItems = [
    { id: 'dashboard', icon: <DashboardIcon />, label: t('dashboard') },
    { id: 'clients', icon: <PeopleIcon />, label: t('clients') },
    { id: 'products', icon: <InventoryIcon />, label: t('products') },
    { id: 'invoices', icon: <InvoiceIcon />, label: t('invoices') },
    { id: 'settings', icon: <SettingsIcon />, label: t('settings') }
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'products': return <Products />;
      case 'clients': return <Clients />;
      case 'invoices': return <Invoices />;
      case 'settings': return <Settings />;
      case 'dashboard':
      default:
        return <Dashboard />;
    }
  };

  return (
    <ThemeProvider theme={activeTheme}>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              {t(currentView === 'dashboard' ? 'dashboard' : currentView === 'clients' ? 'clients' : currentView === 'products' ? 'products' : currentView === 'invoices' ? 'invoices' : 'settings')}
            </Typography>
            <ToggleButtonGroup
              value={i18n.language}
              exclusive
              onChange={changeLanguage}
              aria-label="language"
              size="small"
              sx={{ bgcolor: 'background.paper', borderRadius: 1 }}
            >
              <ToggleButton value="en">EN</ToggleButton>
              <ToggleButton value="zh">中</ToggleButton>
              <ToggleButton value="ja">日</ToggleButton>
            </ToggleButtonGroup>
          </Toolbar>
        </AppBar>
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
          }}
        >
          <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
            <Box sx={{
              color: 'white',
              fontWeight: 'bold',
              // boxShadow: 2 // Removed as requested
            }}>S</Box>
            <Typography variant="h6" noWrap component="div" fontWeight="bold">
              SalesManager
            </Typography>
          </Box>

          <List sx={{ pt: 2, px: 2 }}>
            {menuItems.map((item) => (
              <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
                <ListItemButton
                  selected={currentView === item.id}
                  onClick={() => setCurrentView(item.id)}
                  sx={{
                    borderRadius: 2,
                    '&.Mui-selected': {
                      bgcolor: 'primary.light',
                      color: 'primary.dark', // This might need contrast text fix if theme primary.light is dark
                      '&:hover': { bgcolor: 'primary.light' },
                      '& .MuiListItemIcon-root': { color: 'primary.dark' },
                    },
                    '& .MuiListItemIcon-root': { color: 'text.secondary', minWidth: 40 },
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: currentView === item.id ? 600 : 400 }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="caption" align="center" sx={{ p: 2, color: 'text.secondary', display: 'block' }}>
            Internal Version v1.0
          </Typography>
        </Drawer>

        {/* Main Layout */}
        <Box component="main" sx={{ flexGrow: 1, height: '100vh', overflow: 'auto', display: 'flex', flexDirection: 'column', pt: 8 }}>
          <Box sx={{ flexGrow: 1, p: 0 }}>
            {renderContent()}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
