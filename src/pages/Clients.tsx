import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Client, clientService } from '../services/clients';
import Invoices from './Invoices';
import {
    Box, Typography, Button, FormControlLabel, Checkbox,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Switch, Chip, TextField
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Description as InvoiceIcon
} from '@mui/icons-material';

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
            <Dialog
                fullScreen
                open={true}
                onClose={() => setInvoiceClientId(null)}
                PaperProps={{ sx: { bgcolor: 'background.default' } }}
            >
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'white' }}>
                    <Typography variant="h6" fontWeight="bold">
                        Invoices for {clients.find(c => c.ID === invoiceClientId)?.Name}
                    </Typography>
                    <Button onClick={() => setInvoiceClientId(null)} variant="outlined">
                        Close & Return to Clients
                    </Button>
                </Box>
                <Box sx={{ p: 4, maxWidth: 'lg', mx: 'auto', width: '100%' }}>
                    <Invoices filterClientId={invoiceClientId} />
                </Box>
            </Dialog>
        );
    }

    return (
        <Box sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                        {t('clients', 'Clients')}
                    </Typography>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={showInactive}
                                onChange={e => setShowInactive(e.target.checked)}
                                color="primary"
                            />
                        }
                        label="Show Inactive"
                    />
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => openEditModal()}
                >
                    {t('add_client', 'Add Client')}
                </Button>
            </Box>

            <TableContainer component={Paper} elevation={1}>
                <Table sx={{ minWidth: 650 }} aria-label="clients table">
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                        <TableRow>
                            {[
                                { key: 'ID', label: 'ID' },
                                { key: 'Name', label: 'Name' },
                                { key: 'ContactInfo', label: 'Contact' },
                                { key: 'IsActive', label: 'Status' }
                            ].map(({ key, label }) => (
                                <TableCell
                                    key={key}
                                    onClick={() => handleSort(key as keyof Client)}
                                    sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                                >
                                    {label} {sortConfig?.key === key && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                </TableCell>
                            ))}
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredClients.map((client) => (
                            <TableRow
                                key={client.ID}
                                hover
                                onClick={() => setInvoiceClientId(client.ID)}
                                sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                            >
                                <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>#{client.ID}</TableCell>
                                <TableCell>
                                    <Typography variant="subtitle2" fontWeight="bold">{client.Name}</Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 300 }}>
                                        {client.Address}
                                    </Typography>
                                </TableCell>
                                <TableCell>{client.ContactInfo}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={client.IsActive ? 'Active' : 'Inactive'}
                                        color={client.IsActive ? 'success' : 'default'}
                                        size="small"
                                        variant="outlined"
                                    />
                                </TableCell>
                                <TableCell align="right">
                                    <Button
                                        size="small"
                                        startIcon={<InvoiceIcon />}
                                        onClick={(e) => { e.stopPropagation(); setInvoiceClientId(client.ID); }}
                                        sx={{ mr: 1 }}
                                    >
                                        Invoices
                                    </Button>
                                    <Button
                                        size="small"
                                        startIcon={<EditIcon />}
                                        onClick={(e) => { e.stopPropagation(); openEditModal(client); }}
                                        color="secondary"
                                    >
                                        Edit
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredClients.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    No clients found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Edit Modal */}
            <Dialog open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {currentClient.ID ? 'Edit Client' : 'New Client'}
                </DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <TextField
                            label="Company Name"
                            fullWidth
                            value={currentClient.Name}
                            onChange={e => setCurrentClient({ ...currentClient, Name: e.target.value })}
                            variant="outlined"
                        />

                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Address</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>〒</Typography>
                                <TextField
                                    placeholder="Zip Search"
                                    size="small"
                                    inputProps={{ maxLength: 7 }}
                                    onChange={async e => {
                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                        e.target.value = val;
                                        if (val.length === 7) {
                                            try {
                                                const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${val}`);
                                                const data = await res.json();
                                                if (data.results && data.results[0]) {
                                                    const addr = `${data.results[0].address1}${data.results[0].address2}${data.results[0].address3}`;
                                                    setCurrentClient(prev => ({ ...prev, Address: addr }));
                                                }
                                            } catch (err) {
                                                // ignore
                                            }
                                        }
                                    }}
                                    sx={{ width: 120 }}
                                />
                                <Typography variant="caption" color="text.secondary">Enter 7 digits to auto-fill</Typography>
                            </Box>
                            <TextField
                                label="Full Address"
                                fullWidth
                                multiline
                                rows={2}
                                value={currentClient.Address}
                                onChange={e => setCurrentClient({ ...currentClient, Address: e.target.value })}
                            />
                        </Box>

                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Phone Number</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TextField
                                    size="small"
                                    placeholder="03"
                                    value={currentClient.ContactInfo ? currentClient.ContactInfo.split('-')[0] : ''}
                                    onChange={e => {
                                        const parts = (currentClient.ContactInfo || '').split('-');
                                        while (parts.length < 3) parts.push('');
                                        parts[0] = e.target.value;
                                        setCurrentClient({ ...currentClient, ContactInfo: parts.join('-') });
                                    }}
                                    sx={{ width: '30%' }}
                                    inputProps={{ style: { textAlign: 'center' } }}
                                />
                                <Typography>-</Typography>
                                <TextField
                                    size="small"
                                    placeholder="0000"
                                    value={currentClient.ContactInfo ? currentClient.ContactInfo.split('-')[1] || '' : ''}
                                    onChange={e => {
                                        const parts = (currentClient.ContactInfo || '').split('-');
                                        while (parts.length < 3) parts.push('');
                                        parts[1] = e.target.value;
                                        setCurrentClient({ ...currentClient, ContactInfo: parts.join('-') });
                                    }}
                                    sx={{ width: '35%' }}
                                    inputProps={{ style: { textAlign: 'center' } }}
                                />
                                <Typography>-</Typography>
                                <TextField
                                    size="small"
                                    placeholder="0000"
                                    value={currentClient.ContactInfo ? currentClient.ContactInfo.split('-')[2] || '' : ''}
                                    onChange={e => {
                                        const parts = (currentClient.ContactInfo || '').split('-');
                                        while (parts.length < 3) parts.push('');
                                        parts[2] = e.target.value;
                                        setCurrentClient({ ...currentClient, ContactInfo: parts.join('-') });
                                    }}
                                    sx={{ width: '35%' }}
                                    inputProps={{ style: { textAlign: 'center' } }}
                                />
                            </Box>
                        </Box>

                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={currentClient.IsActive}
                                    onChange={e => setCurrentClient({ ...currentClient, IsActive: e.target.checked })}
                                    color="primary"
                                />
                            }
                            label="Active Client"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} variant="contained" color="primary">Save Client</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Clients;
