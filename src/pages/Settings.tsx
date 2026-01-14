import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings, defaultSettings, settingsService } from '../services/settings';
import { Snackbar, Alert, Switch, Fab, Tooltip } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ConfirmDialog from '../components/ConfirmDialog';

const Settings = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    // const [status, setStatus] = useState('');
    const [backupStatus, setBackupStatus] = useState('');

    const [toast, setToast] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'info' | 'warning' }>({
        open: false, message: '', severity: 'info'
    });
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean, title?: string, message: string, onConfirm: () => void, confirmLabel?: string, cancelLabel?: string }>({
        open: false, message: '', onConfirm: () => { }
    });

    const showToast = (message: string, severity: 'success' | 'error' = 'success') => {
        setToast({ open: true, message, severity });
    };

    const handleCloseToast = () => {
        setToast({ ...toast, open: false });
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        const s = await settingsService.get();
        setSettings(s);
    };

    const handleSave = async () => {
        try {
            await settingsService.save(settings);
            // setStatus(t('settings_save_success', 'Settings saved successfully!'));
            showToast(t('settings_save_success', 'Settings saved successfully!'), 'success');
            // Reload only if theme changed? For now, we rely on state updates or soft refresh if needed.
            // window.location.reload(); // Removed to prevent jarring UX
        } catch (e) {
            showToast(t('settings_save_error', 'Error saving settings: ') + e, 'error');
        }
    };

    const handleChange = (field: keyof AppSettings, value: string) => {
        setSettings({ ...settings, [field]: value });
    };

    const handleBackupSave = async () => {
        setBackupStatus(t('settings_backup_saving', 'Saving backup...'));
        try {
            const result = await window.ipcRenderer.invoke('save-backup');
            if (result.success) {
                setBackupStatus(t('settings_backup_success', 'Backup saved successfully!'));
            } else if (result.canceled) {
                setBackupStatus('');
            } else {
                setBackupStatus(t('settings_backup_failed', 'Backup failed: ') + result.error);
            }
        } catch (e) {
            setBackupStatus(t('common.error', 'Error') + ': ' + e);
        }
    };

    const handleRestore = async () => {
        setConfirmDialog({
            open: true,
            title: t('settings_restore_title', 'Restore Backup'),
            message: t('settings_restore_confirm_msg', 'CAUTION: This will overwrite your current data with the backup file.\n\nThe application will create a safety copy of current data before restoring.\n\nContinue?'),
            confirmLabel: t('common.restore', 'Restore'),
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                setBackupStatus(t('settings_restoring', 'Restoring...'));
                try {
                    const result = await window.ipcRenderer.invoke('restore-backup');
                    if (result.success) {
                        showToast(t('settings_restore_success', 'Restore successful! The application will now reload.'));
                        setTimeout(() => window.location.reload(), 2000);
                    } else if (result.canceled) {
                        setBackupStatus('');
                    } else {
                        setBackupStatus(t('settings_restore_failed', 'Restore failed: ') + result.error);
                    }
                } catch (e) {
                    setBackupStatus(t('common.error', 'Error') + ': ' + e);
                }
            }
        });
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8 pb-24"> {/* Added pb-24 for FAB space */}
            <h2 className="text-2xl font-bold text-gray-800">{t('settings', 'Settings')}</h2>

            {/* Company Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-6 border-b pb-2">{t('settings_company_info', 'My Company Info (Shown on Invoices)')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings_company_name', 'Company Name')}</label>
                        <input className="input-field" value={settings.CompanyName} onChange={e => handleChange('CompanyName', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings_zip_code', 'Zip Code')}</label>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all bg-white relative">

                                <input
                                    className="p-2 outline-none w-32 text-gray-700 placeholder-gray-300"
                                    value={settings.ZipCode}
                                    maxLength={7}
                                    placeholder="0000000"
                                    onChange={async e => {
                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                        handleChange('ZipCode', val);
                                        if (val.length === 7) {
                                            try {
                                                const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${val}`);
                                                const data = await res.json();
                                                if (data.results && data.results[0]) {
                                                    const addr = `${data.results[0].address1}${data.results[0].address2}${data.results[0].address3}`;
                                                    handleChange('Address', addr);
                                                }
                                            } catch (err) {
                                                console.error('Zip search failed', err);
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <span className="text-xs text-gray-400 hidden md:inline">{t('settings_zip_auto_fill', 'Auto-fill available')}</span>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings_address', 'Address')}</label>
                        <input className="input-field" value={settings.Address} onChange={e => handleChange('Address', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings_phone', 'Phone')}</label>
                        <div className="flex items-center gap-2">
                            <input
                                className="input-field text-center px-1"
                                style={{ width: '30%' }}
                                placeholder="03"
                                value={settings.Phone ? settings.Phone.split('-')[0] : ''}
                                onChange={e => {
                                    const parts = (settings.Phone || '').split('-');
                                    while (parts.length < 3) parts.push('');
                                    parts[0] = e.target.value;
                                    handleChange('Phone', parts.join('-'));
                                }}
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                className="input-field text-center px-1"
                                style={{ width: '35%' }}
                                placeholder="0000"
                                value={settings.Phone ? settings.Phone.split('-')[1] || '' : ''}
                                onChange={e => {
                                    const parts = (settings.Phone || '').split('-');
                                    while (parts.length < 3) parts.push('');
                                    parts[1] = e.target.value;
                                    handleChange('Phone', parts.join('-'));
                                }}
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                className="input-field text-center px-1"
                                style={{ width: '35%' }}
                                placeholder="0000"
                                value={settings.Phone ? settings.Phone.split('-')[2] || '' : ''}
                                onChange={e => {
                                    const parts = (settings.Phone || '').split('-');
                                    while (parts.length < 3) parts.push('');
                                    parts[2] = e.target.value;
                                    handleChange('Phone', parts.join('-'));
                                }}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings_registration_number', 'Invoice Registration No. (T-Number)')}</label>
                        <input className="input-field" value={settings.RegistrationNumber} onChange={e => handleChange('RegistrationNumber', e.target.value)} />
                    </div>
                </div>

                <h4 className="text-md font-semibold text-gray-700 mt-6 mb-4">{t('settings_branding', 'Branding & Theme')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings_logo', 'Company Logo')}</label>
                        <div className="flex items-center gap-4">
                            {settings.Logo && (
                                <img src={settings.Logo} alt="Logo" className="h-12 w-auto object-contain border rounded p-1" />
                            )}
                            <label className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-semibold hover:bg-indigo-100 transition-all cursor-pointer inline-block">
                                {t('common.select_file', 'Select File')}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                handleChange('Logo', reader.result as string);
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                />
                            </label>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{t('settings_logo_hint', 'Recommended: Transparent PNG, max 200px width.')}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings_primary_color', 'Primary Theme Color')}</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={settings.PrimaryColor || '#1976d2'}
                                onChange={e => handleChange('PrimaryColor', e.target.value)}
                                className="h-10 w-20 p-1 rounded border cursor-pointer"
                            />
                            <span className="text-sm text-gray-600 font-mono">{settings.PrimaryColor || '#1976d2'}</span>
                        </div>
                    </div>
                </div>

                <h4 className="text-md font-semibold text-gray-700 mt-6 mb-4">{t('settings_bank_info', 'Bank Account Info')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings_bank_name', 'Bank Name')}</label>
                        <input className="input-field" value={settings.BankName} onChange={e => handleChange('BankName', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings_branch_name', 'Branch Name')}</label>
                        <input className="input-field" value={settings.BranchName} onChange={e => handleChange('BranchName', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings_account_type', 'Account Type')}</label>
                        <select className="input-field" value={settings.AccountType} onChange={e => handleChange('AccountType', e.target.value)}>
                            <option value="普通">{t('settings_account_type_ordinary', '普通 (Futsuu)')}</option>
                            <option value="当座">{t('settings_account_type_checking', '当座 (Touza)')}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings_account_number', 'Account Number')}</label>
                        <input className="input-field" value={settings.AccountNumber} onChange={e => handleChange('AccountNumber', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings_account_holder', 'Account Holder (Kana)')}</label>
                        <input className="input-field" value={settings.AccountHolder} onChange={e => handleChange('AccountHolder', e.target.value)} />
                    </div>
                </div>

                {/* Removed individual save button */}
            </div>

            {/* Data Management */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-gray-700">{t('settings_data_management', 'Data Management')}</h3>
                    {/* Removed individual save button */}
                </div>

                <div className="space-y-6">
                    {/* Auto Backup Section */}
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                    {t('settings_auto_backup', 'Automatic Backup')}
                                    <span className="text-xs font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">On Close</span>
                                </h4>
                                <p className="text-sm text-gray-500 mt-1">{t('settings_auto_backup_desc', 'Automatically backup database when closing.')}</p>
                            </div>
                            <Switch
                                checked={settings.AutoBackup || false}
                                onChange={(e) => setSettings({ ...settings, AutoBackup: e.target.checked })}
                                color="primary"
                            />
                        </div>

                        {settings.AutoBackup && (
                            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                                <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">{t('settings_backup_location', 'Location')}:</span>
                                <code className="flex-1 text-xs bg-gray-100 p-1.5 rounded text-gray-700 break-all font-mono">
                                    {settings.BackupPath || 'Default (User/Data/backups)'}
                                </code>
                                <button
                                    onClick={async () => {
                                        const path = await window.ipcRenderer.invoke('select-folder');
                                        if (path) handleChange('BackupPath', path);
                                    }}
                                    className="text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded transition-colors"
                                >
                                    {t('settings_select_folder', 'Change')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Manual Operations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Export */}
                        <div className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-300 transition-colors">
                            <div>
                                <h4 className="font-semibold text-gray-800 text-sm mb-1">{t('settings_backup_db', 'Backup Database')}</h4>
                                <p className="text-xs text-gray-500 mb-3">{t('settings_backup_desc', 'Save a copy of your data.')}</p>
                            </div>
                            <button onClick={handleBackupSave} className="w-full bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 py-2 rounded-lg text-sm font-medium transition-colors">
                                {t('settings_export_backup', 'Export Backup')}
                            </button>
                        </div>

                        {/* Import */}
                        <div className="border border-gray-200 rounded-xl p-4 flex flex-col justify-between hover:border-orange-300 transition-colors">
                            <div>
                                <h4 className="font-semibold text-gray-800 text-sm mb-1">{t('settings_restore_db', 'Restore Database')}</h4>
                                <p className="text-xs text-gray-500 mb-3">{t('settings_restore_desc', 'Restore data from backup.')}</p>
                            </div>
                            <button onClick={handleRestore} className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 py-2 rounded-lg text-sm font-medium transition-colors">
                                {t('settings_import_backup', 'Import Backup')}
                            </button>
                        </div>
                    </div>
                </div>
                {backupStatus && (
                    <p className={`mt-4 text-sm font-medium ${backupStatus.includes('failed') || backupStatus.includes('Error') ? 'text-red-500' : 'text-emerald-600'}`}>
                        {backupStatus}
                    </p>
                )}
            </div>

            <style>{`
                .input-field {
                    width: 100%;
                    padding: 0.5rem 1rem;
                    border-radius: 0.5rem;
                    border: 1px solid #d1d5db;
                    outline: none;
                    transition: all 0.2s;
                }
                .input-field:focus {
                    border-color: #6366f1;
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
                }
             `}</style>
            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
                confirmLabel={confirmDialog.confirmLabel}
                cancelLabel={confirmDialog.cancelLabel}
            />
            <Snackbar
                open={toast.open}
                autoHideDuration={3000}
                onClose={handleCloseToast}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseToast} severity={toast.severity} sx={{ width: '100%' }}>
                    {toast.message}
                </Alert>
            </Snackbar>

            {/* Floating Action Button for Global Save */}
            <div className="fixed bottom-8 right-8 z-50">
                <Tooltip title={t('settings_save', 'Save Settings')} arrow placement="left">
                    <Fab
                        color="primary"
                        aria-label="save"
                        onClick={handleSave}
                        sx={{
                            width: 64,
                            height: 64,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                            '&:hover': {
                                transform: 'scale(1.05)',
                            }
                        }}
                    >
                        <SaveIcon sx={{ fontSize: 32 }} />
                    </Fab>
                </Tooltip>
            </div>
        </div>
    );
};

export default Settings;
