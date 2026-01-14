import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Products from './pages/Products';
import Clients from './pages/Clients';
import Invoices from './pages/Invoices';
import Settings from './pages/Settings';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  AppBar, Toolbar, Typography, Grid, Card, CardContent,
  Container, CssBaseline, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Inventory2 as InventoryIcon,
  Description as InvoiceIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

const drawerWidth = 260;

function App() {
  const { t, i18n } = useTranslation();
  const [currentView, setCurrentView] = useState('dashboard');

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
        return (
          <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom component="div" sx={{ fontWeight: 'bold', color: 'text.primary', mb: 3 }}>
              {t('dashboard')}
            </Typography>
            <Grid container spacing={4}>
              {[
                { key: 'clients', color: '#10b981', route: 'clients', icon: <PeopleIcon sx={{ fontSize: 40, color: 'white' }} /> },
                { key: 'products', color: '#f59e0b', route: 'products', icon: <InventoryIcon sx={{ fontSize: 40, color: 'white' }} /> },
                { key: 'invoices', color: '#f43f5e', route: 'invoices', icon: <InvoiceIcon sx={{ fontSize: 40, color: 'white' }} /> },
              ].map((item) => (
                <Grid size={{ xs: 12, md: 4 }} key={item.key}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
                      borderRadius: 3
                    }}
                    onClick={() => setCurrentView(item.route)}
                  >
                    <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                      <Box sx={{
                        width: 72,
                        height: 72,
                        bgcolor: item.color,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                        boxShadow: 2
                      }}>
                        {item.icon}
                      </Box>
                      <Typography variant="h5" component="div" fontWeight="600" gutterBottom>
                        {t(item.key)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Manage {t(item.key)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        );
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f4f6f8' }}>
      <CssBaseline />

      {/* Sidebar Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: 'background.paper',
            borderRight: '1px solid rgba(0,0,0,0.08)',
          },
        }}
      >
        <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <Box sx={{
            width: 40,
            height: 40,
            bgcolor: 'primary.main',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            boxShadow: 2
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
      <Box component="main" sx={{ flexGrow: 1, height: '100vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Header AppBar */}
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'white', borderBottom: '1px solid rgba(0,0,0,0.08)', color: 'text.primary' }}>
          <Toolbar>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, textTransform: 'capitalize', fontWeight: 500 }}>
              {t(currentView)}
            </Typography>

            <ToggleButtonGroup
              value={i18n.language}
              exclusive
              onChange={changeLanguage}
              size="small"
              aria-label="language"
            >
              <ToggleButton value="ja">
                JA
              </ToggleButton>
              <ToggleButton value="en">
                EN
              </ToggleButton>
              <ToggleButton value="zh">
                ZH
              </ToggleButton>
            </ToggleButtonGroup>
          </Toolbar>
        </AppBar>

        <Box sx={{ flexGrow: 1, p: 0 }}>
          {renderContent()}
        </Box>
      </Box>
    </Box>
  );
}

export default App;
