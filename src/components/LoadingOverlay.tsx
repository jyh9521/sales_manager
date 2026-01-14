import { Backdrop, CircularProgress } from '@mui/material';

interface LoadingOverlayProps {
    open: boolean;
}

const LoadingOverlay = ({ open }: LoadingOverlayProps) => {
    return (
        <Backdrop
            sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={open}
        >
            <CircularProgress color="inherit" />
        </Backdrop>
    );
};

export default LoadingOverlay;
