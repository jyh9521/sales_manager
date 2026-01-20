import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#4338ca', // Indigo-700 (大致匹配现有的 Tailwind indigo-700)
        },
        secondary: {
            main: '#3b82f6', // Blue-500
        },
        background: {
            default: '#f3f4f6', // Gray-100
        },
    },
    typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
            fontSize: '2rem',
            fontWeight: 600,
        },
        h2: {
            fontSize: '1.5rem',
            fontWeight: 600,
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none', // 禁用按钮大写
                },
            },
        },
    },
});

export default theme;
