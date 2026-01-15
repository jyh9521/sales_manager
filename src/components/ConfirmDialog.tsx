import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, CircularProgress } from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
    open: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmColor?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
    loading?: boolean;
}

const ConfirmDialog = ({
    open,
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel,
    cancelLabel,
    confirmColor = 'error',
    loading = false
}: ConfirmDialogProps) => {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onClose={loading ? undefined : onCancel} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="warning" />
                {title || t('common.confirm', 'Confirm')}
            </DialogTitle>
            <DialogContent>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>{message}</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel} color="inherit" disabled={loading}>
                    {cancelLabel || t('common.cancel', 'Cancel')}
                </Button>
                <Button onClick={onConfirm} variant="contained" color={confirmColor} autoFocus disabled={loading} startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}>
                    {loading ? (confirmLabel || t('common.delete', 'Delete')) : (confirmLabel || t('common.delete', 'Delete'))}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;
