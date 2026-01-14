import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppSettings, defaultSettings, settingsService } from '../services/settings';

const Settings = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [status, setStatus] = useState('');
    const [backupStatus, setBackupStatus] = useState('');

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
            setStatus('Settings saved successfully!');
            setTimeout(() => setStatus(''), 3000);
        } catch (e) {
            setStatus('Error saving settings: ' + e);
        }
    };

    const handleChange = (field: keyof AppSettings, value: string) => {
        setSettings({ ...settings, [field]: value });
    };

    const handleBackupSave = async () => {
        setBackupStatus('Saving backup...');
        try {
            const result = await window.ipcRenderer.invoke('save-backup');
            if (result.success) {
                setBackupStatus('Backup saved successfully!');
            } else if (result.canceled) {
                setBackupStatus('');
            } else {
                setBackupStatus('Backup failed: ' + result.error);
            }
        } catch (e) {
            setBackupStatus('Error: ' + e);
        }
    };

    const handleRestore = async () => {
        if (!confirm('CAUTION: This will overwrite your current data with the backup file.\n\nThe application will create a safety copy of current data before restoring.\n\nContinue?')) return;

        setBackupStatus('Restoring...');
        try {
            const result = await window.ipcRenderer.invoke('restore-backup');
            if (result.success) {
                alert('Restore successful! The application will now reload.');
                window.location.reload();
            } else if (result.canceled) {
                setBackupStatus('');
            } else {
                setBackupStatus('Restore failed: ' + result.error);
            }
        } catch (e) {
            setBackupStatus('Error: ' + e);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">{t('settings', 'Settings')}</h2>

            {/* Company Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-6 border-b pb-2">My Company Info (Shown on Invoices)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                        <input className="input-field" value={settings.CompanyName} onChange={e => handleChange('CompanyName', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all bg-white relative">
                                <span className="pl-3 pr-1 text-gray-500 font-medium select-none">〒</span>
                                <input
                                    className="p-2 outline-none w-24 text-gray-700 placeholder-gray-300"
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
                            <span className="text-xs text-gray-400 hidden md:inline">Auto-fill available</span>
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                        <input className="input-field" value={settings.Address} onChange={e => handleChange('Address', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Registration No. (T-Number)</label>
                        <input className="input-field" value={settings.RegistrationNumber} onChange={e => handleChange('RegistrationNumber', e.target.value)} />
                    </div>
                </div>

                <h4 className="text-md font-semibold text-gray-700 mt-6 mb-4">Bank Account Info</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                        <input className="input-field" value={settings.BankName} onChange={e => handleChange('BankName', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name</label>
                        <input className="input-field" value={settings.BranchName} onChange={e => handleChange('BranchName', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                        <select className="input-field" value={settings.AccountType} onChange={e => handleChange('AccountType', e.target.value)}>
                            <option value="普通">普通 (Futsuu)</option>
                            <option value="当座">当座 (Touza)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                        <input className="input-field" value={settings.AccountNumber} onChange={e => handleChange('AccountNumber', e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder (Kana)</label>
                        <input className="input-field" value={settings.AccountHolder} onChange={e => handleChange('AccountHolder', e.target.value)} />
                    </div>
                </div>

                <div className="mt-6 flex justify-end items-center gap-4">
                    {status && <span className="text-emerald-600 text-sm font-medium">{status}</span>}
                    <button onClick={handleSave} className="btn-primary">Save Settings</button>
                </div>
            </div>

            {/* Data Management */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Data Management</h3>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <h4 className="font-bold text-gray-800">Backup Database</h4>
                            <p className="text-sm text-gray-500">Save a copy of your data (e.g. database-backup-YYYYMMDD.bak).</p>
                        </div>
                        <button onClick={handleBackupSave} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition-colors shadow">
                            Export Backup
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                            <h4 className="font-bold text-gray-800">Restore Database</h4>
                            <p className="text-sm text-gray-500">Restore data from a backup file (current data will be overwritten).</p>
                        </div>
                        <button onClick={handleRestore} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 transition-colors shadow-sm">
                            Import Backup
                        </button>
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
                .btn-primary {
                    background-color: #4f46e5;
                    color: white;
                    padding: 0.5rem 1.5rem;
                    border-radius: 0.5rem;
                    font-weight: 500;
                    transition: background-color 0.2s;
                }
                .btn-primary:hover {
                    background-color: #4338ca;
                }
                .btn-primary:disabled {
                    background-color: #9ca3af;
                    cursor: not-allowed;
                }
             `}</style>
        </div>
    );
};

export default Settings;
