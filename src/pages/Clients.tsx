import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Client, clientService } from '../services/clients';
import Invoices from './Invoices'; // Reuse Invoices component with filter prop? Or just navigate?
// Reusing Invoices component might be complex if it's not designed for props.
// Let's assume we can pass a prop `initialClientId` or `filterClientId` to Invoices.
// For now, let's keep it simple: Expand row to show a mini-list or just navigate to Invoices page with filtering.
// Navigation is better. But current router is state-based in App.tsx.
// Let's modify Clients to just Manage Clients, but maybe add a "View Invoices" button that triggers a callback?
// Actually, since everything is in one App, passing props via a state manager or Context is ideal.
// But here, let's make Invoices accept a prop `clientId`. 
// Wait, I can't easily change `currentView` from here without passing `setCurrentView` down.
// Simpler: Add a modal here that renders <Invoices clientId={selectedId} embedded />.

const Clients = () => {
    const { t } = useTranslation();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInactive, setShowInactive] = useState(false);

    // Edit Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentClient, setCurrentClient] = useState<Partial<Client>>({});

    // Invoice History Modal
    const [invoiceClientId, setInvoiceClientId] = useState<number | null>(null);

    // Filter & Sort State
    const [sortConfig, setSortConfig] = useState<{ key: keyof Client, direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: keyof Client) => {
        setSortConfig(current => ({
            key,
            direction: current && current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await clientService.getAll();
        setClients(data);
        setLoading(false);
    };

    const handleSave = async () => {
        if (!currentClient.Name) return;
        try {
            if (currentClient.ID) {
                await clientService.update(currentClient as Client);
            } else {
                await clientService.add(currentClient as Client);
            }
            setIsEditModalOpen(false);
            loadData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: number) => {
        if (confirm(t('confirm_delete', 'Are you sure?'))) {
            await clientService.delete(id);
            loadData();
        }
    };

    const openEditModal = (client?: Client) => {
        if (client) {
            setCurrentClient({ ...client });
        } else {
            setCurrentClient({ Name: '', Address: '', ContactInfo: '', IsActive: true });
        }
        setIsEditModalOpen(true);
    };

    const filteredClients = clients.filter(c => showInactive || c.IsActive).sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;

        const valA: any = a[key] || '';
        const valB: any = b[key] || '';

        // Handle string comparison for Name, Address, ContactInfo
        if (typeof valA === 'string' && typeof valB === 'string') {
            return direction === 'asc'
                ? valA.localeCompare(valB, 'ja', { numeric: true })
                : valB.localeCompare(valA, 'ja', { numeric: true });
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    // If viewing invoices, we render the Invoices component in "filtered mode" inside a full screen overlay
    if (invoiceClientId !== null) {
        return (
            <div className="fixed inset-0 bg-gray-50 z-50 overflow-auto">
                <div className="p-4 border-b bg-white sticky top-0 flex justify-between items-center shadow-sm">
                    <h2 className="text-xl font-bold text-gray-800">
                        Invoices for {clients.find(c => c.ID === invoiceClientId)?.Name}
                    </h2>
                    <button
                        onClick={() => setInvoiceClientId(null)}
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 font-medium"
                    >
                        Close & Return to Clients
                    </button>
                </div>
                <div className="max-w-7xl mx-auto p-6">
                    <Invoices filterClientId={invoiceClientId} />
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">{t('clients', 'Clients')}</h2>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={e => setShowInactive(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        Show Inactive
                    </label>
                </div>
                <button
                    onClick={() => openEditModal()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-2"
                >
                    <span>+</span> {t('add_client', 'Add Client')}
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            {[
                                { key: 'ID', label: 'ID' },
                                { key: 'Name', label: 'Name' },
                                { key: 'ContactInfo', label: 'Contact' },
                                { key: 'IsActive', label: 'Status' }
                            ].map(({ key, label }) => (
                                <th
                                    key={key}
                                    className="px-6 py-4 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors select-none"
                                    onClick={() => handleSort(key as keyof Client)}
                                >
                                    <div className="flex items-center gap-1">
                                        {label}
                                        {sortConfig?.key === key && (
                                            <span className="text-indigo-600 text-xs">
                                                {sortConfig.direction === 'asc' ? '▲' : '▼'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th className="px-6 py-4 font-semibold text-gray-600 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredClients.map(client => (
                            <tr key={client.ID} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setInvoiceClientId(client.ID)}>
                                <td className="px-6 py-4 text-gray-500 font-mono text-sm">#{client.ID}</td>
                                <td className="px-6 py-4 font-medium text-gray-800">
                                    {client.Name}
                                    <div className="text-xs text-gray-400 mt-1 max-w-xs truncate">{client.Address}</div>
                                </td>
                                <td className="px-6 py-4 text-gray-600">{client.ContactInfo}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${client.IsActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {client.IsActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => setInvoiceClientId(client.ID)} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm mr-2">Invoices</button>
                                    <button onClick={() => openEditModal(client)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4 text-gray-800">{currentClient.ID ? 'Edit Client' : 'New Client'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                                <input className="input-field" value={currentClient.Name} onChange={e => setCurrentClient({ ...currentClient, Name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                {/* Zip Helper */}
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all bg-white">
                                        <span className="pl-3 pr-1 text-gray-500 font-medium select-none text-xs">〒</span>
                                        <input
                                            className="p-1.5 outline-none w-24 text-sm text-gray-700 placeholder-gray-300"
                                            placeholder="Zip Search"
                                            maxLength={7}
                                            onChange={async e => {
                                                const val = e.target.value.replace(/[^0-9]/g, '');
                                                e.target.value = val;
                                                if (val.length === 7) {
                                                    try {
                                                        const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${val}`);
                                                        const data = await res.json();
                                                        if (data.results && data.results[0]) {
                                                            const addr = `${data.results[0].address1}${data.results[0].address2}${data.results[0].address3}`;
                                                            // Provide feedback or just fill?
                                                            // Keep existing address if user typed something? Maybe just append or replace.
                                                            // Let's replace for simplicity as it helps when starting fresh.
                                                            // But maybe format it: "〒Zip Address" ? User wanted separate field but DB has one.
                                                            // Let's just put the address text.
                                                            setCurrentClient(prev => ({ ...prev, Address: addr }));
                                                        }
                                                    } catch (err) {
                                                        // ignore
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <span className="text-xs text-gray-400">Enter 7 digits to auto-fill address</span>
                                </div>
                                <textarea className="input-field" rows={3} value={currentClient.Address} onChange={e => setCurrentClient({ ...currentClient, Address: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Contact Info)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        className="input-field text-center px-1"
                                        style={{ width: '30%' }}
                                        placeholder="03"
                                        value={currentClient.ContactInfo ? currentClient.ContactInfo.split('-')[0] : ''}
                                        onChange={e => {
                                            const parts = (currentClient.ContactInfo || '').split('-');
                                            while (parts.length < 3) parts.push('');
                                            parts[0] = e.target.value;
                                            setCurrentClient({ ...currentClient, ContactInfo: parts.join('-') });
                                        }}
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        className="input-field text-center px-1"
                                        style={{ width: '35%' }}
                                        placeholder="0000"
                                        value={currentClient.ContactInfo ? currentClient.ContactInfo.split('-')[1] || '' : ''}
                                        onChange={e => {
                                            const parts = (currentClient.ContactInfo || '').split('-');
                                            while (parts.length < 3) parts.push('');
                                            parts[1] = e.target.value;
                                            setCurrentClient({ ...currentClient, ContactInfo: parts.join('-') });
                                        }}
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        className="input-field text-center px-1"
                                        style={{ width: '35%' }}
                                        placeholder="0000"
                                        value={currentClient.ContactInfo ? currentClient.ContactInfo.split('-')[2] || '' : ''}
                                        onChange={e => {
                                            const parts = (currentClient.ContactInfo || '').split('-');
                                            while (parts.length < 3) parts.push('');
                                            parts[2] = e.target.value;
                                            setCurrentClient({ ...currentClient, ContactInfo: parts.join('-') });
                                        }}
                                    />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={currentClient.IsActive}
                                    onChange={e => setCurrentClient({ ...currentClient, IsActive: e.target.checked })}
                                    className="rounded text-indigo-600"
                                />
                                <span>Active Client</span>
                            </label>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow">Save Client</button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .input-field {
                    width: 100%;
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    border: 1px solid #d1d5db;
                    outline: none;
                }
                .input-field:focus {
                    border-color: #6366f1;
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
                }
             `}</style>
        </div>
    );
};

export default Clients;
