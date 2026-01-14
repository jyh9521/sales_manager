import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
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
}

const ConfirmDialog = ({
    open,
    title,
    message,
    onConfirm,
    onCancel,
    confirmLabel,
    cancelLabel
}: ConfirmDialogProps) => {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="warning" />
                {title || t('common.confirm', 'Confirm')}
            </DialogTitle>
            <DialogContent>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>{message}</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onCancel} color="inherit">
                    {cancelLabel || t('common.cancel', 'Cancel')}
                </Button>
                <Button onClick={onConfirm} variant="contained" color="error" autoFocus>
                    {confirmLabel || t('common.delete', 'Delete')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;
