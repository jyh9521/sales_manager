import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Invoice, invoiceService, InvoiceItem } from '../services/invoices';
import { Client, clientService } from '../services/clients';
import { Product, productService } from '../services/products';
import { AppSettings, defaultSettings, settingsService } from '../services/settings';
import { Unit, unitService } from '../services/units';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Button, TextField, IconButton, MenuItem, Box, Typography,
    Grid, InputAdornment, Autocomplete
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
    Search as SearchIcon,
    Close as CloseIcon
} from '@mui/icons-material';

const Invoices = ({ filterClientId }: { filterClientId?: number | null }) => {
    const { t } = useTranslation();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [units, setUnits] = useState<Unit[]>([]);

    // Filters
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Create/View State
    const [isCreateMode, setIsCreateMode] = useState(false);
    const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null); // For Edit Mode
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'InvoiceDate', direction: 'desc' });

    // Form State
    const [selectedClientId, setSelectedClientId] = useState<number | null>(filterClientId || null);
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
    const [items, setItems] = useState<InvoiceItem[]>([]);

    // Product Search
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, [filterClientId]); // Reload if prop changes

    useEffect(() => {
        if (filterClientId) setSelectedClientId(filterClientId);
    }, [filterClientId]);

    const loadData = async () => {
        const [iData, cData, pData, sData, uData] = await Promise.all([
            invoiceService.getAll(),
            clientService.getAll(),
            productService.getAll(),
            settingsService.get(),
            unitService.getAll()
        ]);
        setInvoices(iData);
        setClients(cData);
        setProducts(pData);
        setSettings(sData);
        setUnits(uData);
    };

    const handleSave = async () => {
        if (!selectedClientId) {
            alert('Please select a client');
            return;
        }
        if (items.length === 0) {
            alert('Please add at least one item');
            return;
        }

        const total = items.reduce((sum, item) => sum + (item.UnitPrice * item.Quantity), 0);

        // Omit ID since database assigns it
        const newInvoice: Omit<Invoice, 'ID'> = {
            ClientID: selectedClientId,
            InvoiceDate: invoiceDate,
            Items: items,
            TotalAmount: total
        };

        await invoiceService.create(newInvoice);

        setIsCreateMode(false);
        setEditingInvoice(null);
        setItems([]);
        setSelectedClientId(filterClientId || null);
        loadData();
    };

    const handleEditInvoice = (invoice: Invoice) => {
        setEditingInvoice(invoice);
        setViewInvoice(null);
        setIsCreateMode(true);

        // Populate Form
        setSelectedClientId(invoice.ClientID);
        setInvoiceDate(new Date(invoice.InvoiceDate).toISOString().slice(0, 10));
        setItems(invoice.Items.map(i => ({
            ...i,
            // Ensure legacy data works?
            TaxRate: i.TaxRate || 10
        })));

        // Load Client's products if needed? Usually auto-loaded.
    };

    const handleDelete = async (id: number) => {
        if (confirm('Delete this invoice?')) {
            await invoiceService.delete(id);
            loadData();
        }
    };

    const addItem = (product?: Product) => {
        // Logic to copy previous date
        let defaultDate = invoiceDate;
        if (items.length > 0) {
            const last = items[items.length - 1];
            if (last.ItemDate) defaultDate = last.ItemDate;
        }

        const newItem: InvoiceItem = {
            ProductID: product?.ID || 0,
            ProductName: product?.Name || '',
            Quantity: 1,
            UnitPrice: product?.UnitPrice || 0,
            Project: product?.Project,
            ItemDate: defaultDate,
            Unit: '',
            Remarks: '',
            TaxRate: product?.TaxRate || 10
        };
        setItems([...items, newItem]);
        setSearchTerm(''); // Clear search after adding
    };

    const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    // Filters
    // Filters & Sorting
    const sortedInvoices = [...invoices].filter(inv => {
        const matchesClient = filterClientId ? inv.ClientID === filterClientId : true;
        const invMonth = new Date(inv.InvoiceDate).toISOString().slice(0, 7);
        const matchesMonth = monthFilter ? invMonth === monthFilter : true;
        return matchesClient && matchesMonth;
    }).sort((a, b) => {
        let comparison = 0;

        switch (sortConfig.key) {
            case 'InvoiceDate':
                comparison = new Date(a.InvoiceDate).getTime() - new Date(b.InvoiceDate).getTime();
                break;
            case 'ID':
                comparison = a.ID - b.ID;
                break;
            case 'ClientName':
                const clientA = clients.find(c => c.ID === a.ClientID)?.Name || '';
                const clientB = clients.find(c => c.ID === b.ClientID)?.Name || '';
                comparison = clientA.localeCompare(clientB);
                break;
            case 'TotalAmount':
                comparison = a.TotalAmount - b.TotalAmount;
                break;
            default:
                comparison = 0;
        }

        if (sortConfig.direction === 'desc') {
            comparison *= -1;
        }

        // Secondary Sort: Always sort by ID Descending if primary sort is equal (or for stability)
        // If sorting by ID, no need for secondary.
        if (comparison === 0 && sortConfig.key !== 'ID') {
            return b.ID - a.ID; // Newest ID first
        }

        return comparison;
    });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        // Default to desc for new sorts on Date or ID or Amount usually? 
        // Standard behavior: first click ASC. User can double click for DESC.
        // But for Dates, DESC is usually preferred first. Let's stick to standard toggle.
        // Wait, if I'm currently 'desc' (default date), next click should be 'asc'.
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        } else if (sortConfig.key !== key && (key === 'InvoiceDate' || key === 'ID' || key === 'TotalAmount')) {
            // For numbers/dates, users often want biggest/newest first
            direction = 'desc';
        }

        setSortConfig({ key, direction });
    };

    // Product Filter Logic
    const availableProducts = products.filter(p => {
        if (!p.IsActive) return false;
        // Filter by text search
        if (searchTerm && !p.Name.toLowerCase().includes(searchTerm.toLowerCase()) && !p.Code?.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
        }
        // Filter by Client Binding
        if (selectedClientId && p.ClientIDs && p.ClientIDs.length > 0) {
            return p.ClientIDs.includes(selectedClientId);
        }
        // If ClientIDs is empty, it's available to all? Assume yes.
        return true;
    });


    const calculateTaxSummary = () => {
        const standardItems = items.filter(i => (i.TaxRate || 10) === 10);
        const reducedItems = items.filter(i => (i.TaxRate || 10) === 8);

        const standardSubtotal = standardItems.reduce((sum, item) => sum + (item.Quantity * item.UnitPrice), 0);
        const reducedSubtotal = reducedItems.reduce((sum, item) => sum + (item.Quantity * item.UnitPrice), 0);

        const standardTax = Math.floor(standardSubtotal * 0.1);
        const reducedTax = Math.floor(reducedSubtotal * 0.08);

        return {
            standardSubtotal,
            reducedSubtotal,
            standardTax,
            reducedTax,
            totalTax: standardTax + reducedTax,
            subtotal: standardSubtotal + reducedSubtotal
        };
    };

    const calculateTotal = () => {
        const { subtotal, totalTax } = calculateTaxSummary();
        return subtotal + totalTax;
    };

    // -- Print View Component --
    const PrintView = ({ invoice }: { invoice: Invoice }) => {
        const client = clients.find(c => c.ID === invoice.ClientID);

        // Process Tax on the fly for Print View (since invoice.Items might not be in state yet if we just viewing)
        // Similar logic to calculateTaxSummary
        const standardItems = invoice.Items.filter(i => (i.TaxRate || 10) === 10);
        const reducedItems = invoice.Items.filter(i => (i.TaxRate || 10) === 8);
        const standardSubtotal = standardItems.reduce((sum, i) => sum + (i.Quantity * i.UnitPrice), 0);
        const reducedSubtotal = reducedItems.reduce((sum, i) => sum + (i.Quantity * i.UnitPrice), 0);
        const standardTax = Math.floor(standardSubtotal * 0.1);
        const reducedTax = Math.floor(reducedSubtotal * 0.08);
        const totalTax = standardTax + reducedTax;
        const subtotal = standardSubtotal + reducedSubtotal;
        const total = subtotal + totalTax;

        const dateStr = new Date(invoice.InvoiceDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        // Group items by Project
        const groupedItems = invoice.Items.reduce((acc, item) => {
            const key = item.Project || 'GENERAL_NO_PROJECT';
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {} as Record<string, InvoiceItem[]>);

        const generalItems = groupedItems['GENERAL_NO_PROJECT'] || [];
        const projects = Object.keys(groupedItems).filter(k => k !== 'GENERAL_NO_PROJECT');

        return (
            <div className="print-container bg-white text-black p-8 max-w-[210mm] mx-auto min-h-[297mm] relative text-sm">
                {/* Header Title */}
                <div className="bg-blue-600 text-white text-center py-2 text-2xl font-serif tracking-widest mb-8 print:bg-blue-600 print-color-adjust">
                    御 請 求 書
                </div>

                {/* Top Section */}
                <div className="flex justify-between items-start mb-8">
                    {/* Left: Client Info */}
                    <div className="w-[55%]">
                        <div className="text-xl border-b-2 border-black pb-2 mb-4 inline-block min-w-[300px]">
                            {client?.Name} <span className="text-sm ml-2">御中</span>
                        </div>
                        <div className="text-xs space-y-1 text-gray-700">
                            <div>{client?.Address}</div>
                        </div>

                        <div className="mt-8">
                            <p className="mb-2">下記の通り、ご請求申し上げます。</p>
                            <div className="border-2 border-blue-600 rounded flex overflow-hidden">
                                <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-center font-bold min-w-[120px] print:bg-blue-600 print-color-adjust">
                                    ご請求金額
                                </div>
                                <div className="flex-1 flex items-center justify-end px-4 text-2xl font-bold tracking-wider">
                                    ¥{total.toLocaleString()} -
                                </div>
                            </div>
                        </div>

                        {/* Bank Info */}
                        <div className="mt-4 border border-blue-600 rounded text-xs">
                            <div className="flex border-b border-blue-600">
                                <div className="bg-blue-600 text-white px-2 py-1 w-20 flex items-center justify-center print:bg-blue-600 print-color-adjust">振込先</div>
                                <div className="p-2 flex-1">
                                    {settings.BankName} {settings.BranchName} {settings.AccountType} {settings.AccountNumber}<br />
                                    {settings.AccountHolder}
                                </div>
                            </div>
                            <div className="flex">
                                <div className="bg-blue-600 text-white px-2 py-1 w-20 flex items-center justify-center print:bg-blue-600 print-color-adjust">振込期日</div>
                                <div className="p-2 flex-1">
                                    {/* Default to end of next month? Or manual? Static text for now */}
                                    翌月末
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] mt-1 text-gray-500">※ 振込手数料は貴社のご負担にてお願いいたします。</p>

                    </div>

                    {/* Right: Company Info */}
                    <div className="w-[40%] text-right">
                        <div className="space-y-1 text-xs">
                            <div className="grid grid-cols-[80px_1fr] mb-2">
                                <span className="text-gray-500">発行日</span>
                                <span>{dateStr}</span>
                            </div>
                            <div className="grid grid-cols-[80px_1fr] mb-6">
                                <span className="text-gray-500">請求番号</span>
                                <span>{String(invoice.ID).padStart(8, '0')}</span>
                            </div>
                        </div>

                        <div className="text-left pl-8 relative">
                            {/* Stamp Placeholder */}
                            <div className="absolute top-0 right-4 w-16 h-16 border border-red-300 rounded-full opacity-30 flex items-center justify-center text-red-500 text-xs rotate-[-15deg] print:border-red-300">
                                印
                            </div>

                            <h4 className="text-lg font-bold mb-1">{settings.CompanyName}</h4>
                            <div className="text-xs space-y-0.5 text-gray-700">
                                <p>{settings.ZipCode}</p>
                                <p>{settings.Address}</p>
                                <p>TEL: {settings.Phone}</p>
                                <p>登録番号: {settings.RegistrationNumber}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <table className="w-full border-collapse border border-blue-600 text-xs mb-4">
                    <thead>
                        <tr className="bg-blue-600 text-white print:bg-blue-600 print-color-adjust">
                            <th className="border border-blue-400 py-1 px-2 w-16">日付</th>
                            <th className="border border-blue-400 py-1 px-2">内容</th>
                            <th className="border border-blue-400 py-1 px-2 w-16">軽減税率</th>
                            <th className="border border-blue-400 py-1 px-2 w-12">数量</th>
                            <th className="border border-blue-400 py-1 px-2 w-12">単位</th>
                            <th className="border border-blue-400 py-1 px-2 w-20">単価</th>
                            <th className="border border-blue-400 py-1 px-2 w-24">金額</th>
                        </tr>
                    </thead>
                    <tbody>
                        {generalItems.map((item, idx) => (
                            <tr key={'gen-' + idx} className="text-center">
                                <td className="border border-blue-600 py-1">
                                    {item.ItemDate ? new Date(item.ItemDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : ''}
                                </td>
                                <td className="border border-blue-600 py-1 px-2 text-left">
                                    {item.ProductName}
                                    {item.Remarks && <span className="text-[10px] text-gray-500 ml-2">({item.Remarks})</span>}
                                </td>
                                <td className="border border-blue-600 py-1"></td>
                                <td className="border border-blue-600 py-1">{item.Quantity}</td>
                                <td className="border border-blue-600 py-1">{item.Unit || '-'}</td>
                                <td className="border border-blue-600 py-1 text-right px-2">¥{item.UnitPrice.toLocaleString()}</td>
                                <td className="border border-blue-600 py-1 text-right px-2">¥{(item.Quantity * item.UnitPrice).toLocaleString()}</td>
                            </tr>
                        ))}

                        {projects.map(project => (
                            <React.Fragment key={project}>
                                <tr className="text-center font-bold bg-blue-50/50 print:bg-transparent">
                                    <td className="border border-blue-600 py-1 print:border-x-blue-600" colSpan={7}>
                                        ----- {project} -----
                                    </td>
                                </tr>
                                {groupedItems[project].map((item, idx) => (
                                    <tr key={project + idx} className="text-center">
                                        <td className="border border-blue-600 py-1">
                                            {item.ItemDate ? new Date(item.ItemDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : ''}
                                        </td>
                                        <td className="border border-blue-600 py-1 px-2 text-left">
                                            {item.ProductName}
                                            {item.Remarks && <span className="text-[10px] text-gray-500 ml-2">({item.Remarks})</span>}
                                        </td>
                                        <td className="border border-blue-600 py-1"></td>
                                        <td className="border border-blue-600 py-1">{item.Quantity}</td>
                                        <td className="border border-blue-600 py-1">{item.Unit || '-'}</td>
                                        <td className="border border-blue-600 py-1 text-right px-2">¥{item.UnitPrice.toLocaleString()}</td>
                                        <td className="border border-blue-600 py-1 text-right px-2">¥{(item.Quantity * item.UnitPrice).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}

                        {/* Empty Rows Filler */}
                        {Array.from({ length: Math.max(0, 10 - invoice.Items.length - projects.length) }).map((_, i) => (
                            <tr key={`empty - ${i} `} className="text-center h-6">
                                <td className="border border-blue-600"></td>
                                <td className="border border-blue-600"></td>
                                <td className="border border-blue-600"></td>
                                <td className="border border-blue-600"></td>
                                <td className="border border-blue-600"></td>
                                <td className="border border-blue-600"></td>
                                <td className="border border-blue-600"></td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Summary Table at Bottom Right */}
                <div className="flex justify-end">
                    <table className="w-[300px] border-collapse border border-blue-600 text-xs text-center">
                        <thead>
                            <tr className="bg-blue-600 text-white print:bg-blue-600 print-color-adjust">
                                <th className="py-1">税率区分</th>
                                <th className="py-1">消費税</th>
                                <th className="py-1">金額（税抜）</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-blue-600 py-1">10%対象</td>
                                <td className="border border-blue-600 py-1">¥{standardTax.toLocaleString()}</td>
                                <td className="border border-blue-600 py-1">¥{standardSubtotal.toLocaleString()}</td>
                            </tr>
                            {reducedSubtotal > 0 && (
                                <tr>
                                    <td className="border border-blue-600 py-1">8%対象</td>
                                    <td className="border border-blue-600 py-1">¥{reducedTax.toLocaleString()}</td>
                                    <td className="border border-blue-600 py-1">¥{reducedSubtotal.toLocaleString()}</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className="bg-blue-600 text-white font-bold py-1 print:bg-blue-600 print-color-adjust" colSpan={2}>合計</td>
                                <td className="border border-blue-600 py-1 font-bold">¥{total.toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Remarks */}
                <div className="mt-8 border border-blue-600 rounded min-h-[100px] p-2">
                    <div className="bg-blue-600 text-white text-xs px-2 py-0.5 inline-block rounded mb-2 print:bg-blue-600 print-color-adjust">備考</div>
                </div>
            </div>
        );
    };

    // View Modal
    if (viewInvoice) {
        return (
            <div className="fixed inset-0 bg-gray-900/90 z-[100] overflow-auto flex flex-col items-center p-4">
                <div className="w-full max-w-4xl flex justify-between items-center mb-4 text-white print:hidden">
                    <h2 className="text-xl">Invoice Preview</h2>
                    <div className="flex gap-4">
                        <button onClick={() => handleEditInvoice(viewInvoice)} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded font-bold">✏️ Edit</button>
                        <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-bold">🖨️ Print</button>
                        <button onClick={() => setViewInvoice(null)} className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded">Close</button>
                    </div>
                </div>
                <div className="bg-white shadow-2xl w-full max-w-[210mm] print:shadow-none print:w-full">
                    <PrintView invoice={viewInvoice} />
                </div>
                <style>{`
@media print {
    @page { size: A4; margin: 0; }
    body * { visibility: hidden; }
    .print-container, .print-container * { visibility: visible; }
    .print-container { position: absolute; left: 0; top: 0; width: 100%; min-height: 100%; box-shadow: none !important; margin: 0 !important; }
    .print-color-adjust { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`}</style>
            </div>
        );
    }

    // Create Form
    if (isCreateMode) {
        return (
            <Box sx={{ p: 4, maxWidth: 'lg', mx: 'auto', bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1, minHeight: '80vh' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, borderBottom: 1, borderColor: 'divider', pb: 2 }}>
                    <Typography variant="h5" fontWeight="bold">
                        {editingInvoice ? `Edit Invoice #${String(editingInvoice.ID).padStart(8, '0')} ` : 'Create New Invoice'}
                    </Typography>
                    <Button onClick={() => { setIsCreateMode(false); setEditingInvoice(null); }} color="inherit">
                        Cancel
                    </Button>
                </Box>

                <Grid container spacing={4} sx={{ mb: 4 }}>
                    <Grid size={6}>
                        <TextField
                            select
                            fullWidth
                            label="Client"
                            value={selectedClientId || ''}
                            onChange={(e) => {
                                setSelectedClientId(Number(e.target.value));
                                setItems([]);
                            }}
                            variant="outlined"
                        >
                            <MenuItem value=""><em>Select Client...</em></MenuItem>
                            {clients.filter(c => c.IsActive).map(c => (
                                <MenuItem key={c.ID} value={c.ID}>{c.Name}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid size={6}>
                        <TextField
                            type="date"
                            fullWidth
                            label="Date"
                            InputLabelProps={{ shrink: true }}
                            value={invoiceDate}
                            onChange={e => setInvoiceDate(e.target.value)}
                            variant="outlined"
                        />
                    </Grid>
                </Grid>

                {/* Items Section */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>Line Items</Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: 'grey.50' }}>
                                <TableRow>
                                    <TableCell width="120">Date</TableCell>
                                    <TableCell width="250">Product</TableCell>
                                    <TableCell width="100">Unit Price</TableCell>
                                    <TableCell width="80">Qty</TableCell>
                                    <TableCell width="100">Unit</TableCell>
                                    <TableCell align="right" width="120">Total</TableCell>
                                    <TableCell>Remarks</TableCell>
                                    <TableCell width="50"></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {items.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>
                                            <TextField
                                                type="date"
                                                fullWidth
                                                variant="standard"
                                                InputProps={{ disableUnderline: true }}
                                                value={item.ItemDate}
                                                onChange={e => updateItem(idx, 'ItemDate', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                fullWidth
                                                variant="standard"
                                                placeholder="Product Name"
                                                InputProps={{ disableUnderline: true }}
                                                value={item.ProductName}
                                                onChange={e => updateItem(idx, 'ProductName', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                type="number"
                                                fullWidth
                                                variant="standard"
                                                InputProps={{ disableUnderline: true }}
                                                inputProps={{ style: { textAlign: 'right' } }}
                                                value={item.UnitPrice}
                                                onChange={e => updateItem(idx, 'UnitPrice', Number(e.target.value))}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                type="number"
                                                fullWidth
                                                variant="standard"
                                                InputProps={{ disableUnderline: true }}
                                                inputProps={{ style: { textAlign: 'center', fontWeight: 'bold' } }}
                                                value={item.Quantity}
                                                onChange={e => updateItem(idx, 'Quantity', Number(e.target.value))}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Autocomplete
                                                freeSolo
                                                options={units.map((u) => u.Name)}
                                                value={item.Unit || ''}
                                                onInputChange={(_, newValue) => updateItem(idx, 'Unit', newValue)}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        variant="standard"
                                                        placeholder="-"
                                                        InputProps={{ ...params.InputProps, disableUnderline: true }}
                                                    />
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                                            ¥{(item.Quantity * item.UnitPrice).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                fullWidth
                                                variant="standard"
                                                placeholder="Memo"
                                                InputProps={{ disableUnderline: true }}
                                                value={item.Remarks || ''}
                                                onChange={e => updateItem(idx, 'Remarks', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <IconButton size="small" color="error" onClick={() => removeItem(idx)}>
                                                <CloseIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Add Item Row with Search */}
                    <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, border: '1px dashed', borderColor: 'grey.300', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ position: 'relative', flex: 1 }}>
                            <Autocomplete
                                freeSolo
                                options={availableProducts}
                                getOptionLabel={(option) => typeof option === 'string' ? option : `${option.Name} (${option.Code})`}
                                onChange={(_, newValue) => {
                                    if (typeof newValue !== 'string' && newValue) {
                                        addItem(newValue);
                                    }
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Search product to add..."
                                        size="small"
                                        InputProps={{
                                            ...params.InputProps,
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon color="action" />
                                                </InputAdornment>
                                            ),
                                        }}
                                        disabled={!selectedClientId}
                                    />
                                )}
                                renderOption={(props, option) => (
                                    <li {...props} key={option.ID} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div>
                                            <Typography variant="body2" color="text.primary">{option.Name}</Typography>
                                            <Typography variant="caption" color="text.secondary">{option.Code}</Typography>
                                        </div>
                                        <Typography variant="body2" color="secondary" sx={{ fontFamily: 'monospace' }}>
                                            ¥{option.UnitPrice.toLocaleString()}
                                        </Typography>
                                    </li>
                                )}
                            />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                            Or <Button size="small" onClick={() => addItem()}>Add Empty Row</Button>
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 3, borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ width: 300 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: 'text.secondary' }}>
                            <Typography>Subtotal</Typography>
                            <Typography>¥{calculateTaxSummary().subtotal.toLocaleString()}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: 'text.secondary' }}>
                            <Typography>Tax (Total)</Typography>
                            <Typography>¥{calculateTaxSummary().totalTax.toLocaleString()}</Typography>
                        </Box>
                        {calculateTaxSummary().reducedSubtotal > 0 && (
                            <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mb: 1, color: 'text.disabled' }}>
                                (Standard: ¥{calculateTaxSummary().standardTax}, Reduced: ¥{calculateTaxSummary().reducedTax})
                            </Typography>
                        )}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2, borderTop: 1, borderColor: 'divider', mb: 2 }}>
                            <Typography variant="h6" fontWeight="bold">Total</Typography>
                            <Typography variant="h6" fontWeight="bold">¥{calculateTotal().toLocaleString()}</Typography>
                        </Box>
                        <Button
                            fullWidth
                            variant="contained"
                            color="primary"
                            size="large"
                            onClick={handleSave}
                            sx={{ mt: 2 }}
                        >
                            Save Invoice
                        </Button>
                    </Box>
                </Box>
            </Box>
        );
    }

    // List View
    return (
        <Box sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h4" component="h2" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                        {t('invoices', 'Invoices')}
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => {
                            setIsCreateMode(true);
                            setItems([]);
                            setEditingInvoice(null);
                        }}
                    >
                        New Invoice
                    </Button>
                    <TextField
                        type="month"
                        variant="outlined"
                        size="small"
                        value={monthFilter}
                        onChange={e => setMonthFilter(e.target.value)}
                        sx={{ bgcolor: 'background.paper' }}
                    />
                </Box>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => setIsCreateMode(true)}
                >
                    {t('new_invoice', 'New Invoice')}
                </Button>
            </Box>

            <TableContainer component={Paper} elevation={1}>
                <Table sx={{ minWidth: 650 }} aria-label="invoice table">
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                        <TableRow>
                            <TableCell onClick={() => handleSort('InvoiceDate')} sx={{ cursor: 'pointer', fontWeight: 'bold' }}>
                                Date {sortConfig.key === 'InvoiceDate' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </TableCell>
                            <TableCell onClick={() => handleSort('ID')} sx={{ cursor: 'pointer', fontWeight: 'bold' }}>
                                ID {sortConfig.key === 'ID' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </TableCell>
                            {!filterClientId && (
                                <TableCell onClick={() => handleSort('ClientName')} sx={{ cursor: 'pointer', fontWeight: 'bold' }}>
                                    Client {sortConfig.key === 'ClientName' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                </TableCell>
                            )}
                            <TableCell align="right" onClick={() => handleSort('TotalAmount')} sx={{ cursor: 'pointer', fontWeight: 'bold' }}>
                                Amount {sortConfig.key === 'TotalAmount' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedInvoices.map((invoice) => (
                            <TableRow
                                key={invoice.ID}
                                hover
                                onClick={() => setViewInvoice(invoice)}
                                sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                            >
                                <TableCell component="th" scope="row" sx={{ fontFamily: 'monospace' }}>
                                    {new Date(invoice.InvoiceDate).toLocaleDateString()}
                                </TableCell>
                                <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                    #{String(invoice.ID).padStart(8, '0')}
                                </TableCell>
                                {!filterClientId && (
                                    <TableCell sx={{ fontWeight: 500 }}>
                                        {clients.find(c => c.ID === invoice.ClientID)?.Name || 'Unknown'}
                                    </TableCell>
                                )}
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                    ¥{invoice.TotalAmount.toLocaleString()}
                                </TableCell>
                                <TableCell align="right">
                                    <Button
                                        size="small"
                                        startIcon={<VisibilityIcon />}
                                        onClick={(e) => { e.stopPropagation(); setViewInvoice(invoice); }}
                                        sx={{ mr: 1 }}
                                    >
                                        View
                                    </Button>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={(e) => { e.stopPropagation(); handleDelete(invoice.ID); }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                        {sortedInvoices.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    No invoices found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default Invoices;
