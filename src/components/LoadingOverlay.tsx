import { Backdrop, CircularProgress } from '@mui/material';
import { createPortal } from 'react-dom';

interface LoadingOverlayProps {
    open: boolean;
}

const LoadingOverlay = ({ open }: LoadingOverlayProps) => {
    if (!open) return null;

    return createPortal(
        <Backdrop
            sx={{
                color: '#fff',
                zIndex: 9999,
                position: 'fixed'
            }}
            open={open}
        >
            <CircularProgress color="inherit" />
        </Backdrop>,
        document.body
    );
};

export default LoadingOverlay;
