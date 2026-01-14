import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#4338ca', // Indigo-700 (matching existing Tailwind indigo-700 approx)
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
                    textTransform: 'none', // Disable uppercase for buttons
                },
            },
        },
    },
});

export default theme;
