import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Invoice, invoiceService, InvoiceItem } from '../services/invoices';
import { Client, clientService } from '../services/clients';
import { Product, productService } from '../services/products';
import { AppSettings, defaultSettings, settingsService } from '../services/settings';
import { Unit, unitService } from '../services/units';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Button, TextField, IconButton, MenuItem, Box, Typography,
    Grid, InputAdornment, Autocomplete, Dialog, Checkbox, Switch, TablePagination
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
    Search as SearchIcon,
    Close as CloseIcon,
    Download as DownloadIcon,
    Print as PrintIcon,
    Edit as EditIcon
} from '@mui/icons-material';
import { Snackbar, Alert } from '@mui/material';
import { createFilterOptions } from '@mui/material/Autocomplete';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingOverlay from '../components/LoadingOverlay';

const filterOptions = createFilterOptions({
    stringify: (option: Product | string) => {
        if (typeof option === 'string') return option;
        return `${option.Name} ${option.Code || ''} ${option.Project || ''}`;
    },
});

const Invoices = ({ filterClientId }: { filterClientId?: number | null }) => {
    const { t } = useTranslation();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);

    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [statusFilter, setStatusFilter] = useState<'All' | 'Unpaid' | 'Paid' | 'Sent'>('All');

    // Create/View State
    const [isCreateMode, setIsCreateMode] = useState(false);
    const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null); // For Edit Mode
    const [manualId, setManualId] = useState<string>('');
    const [manualStatus, setManualStatus] = useState<'Unpaid' | 'Paid' | 'Sent'>('Unpaid');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'InvoiceDate', direction: 'desc' });

    // Form State
    const [selectedClientId, setSelectedClientId] = useState<number | null>(filterClientId || null);
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState<string>('');
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const handleChangePage = (event: unknown, newPage: number) => setPage(newPage);
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Product Search
    const [searchTerm, setSearchTerm] = useState('');

    // UI Feedback
    const [toast, setToast] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'info' | 'warning' }>({
        open: false, message: '', severity: 'info'
    });
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean, title?: string, message: string, onConfirm: () => void }>({
        open: false, message: '', onConfirm: () => { }
    });

    // Unit Management
    const [isUnitManagerOpen, setIsUnitManagerOpen] = useState(false);

    const saveUnit = async (name: string) => {
        if (!name || units.some(u => u.Name === name)) return;
        try {
            await unitService.add(name);
            const updated = await unitService.getAll();
            setUnits(updated);
        } catch (e) {
            console.error(e);
        }
    };

    const showToast = (message: string, severity: 'success' | 'error' = 'success') => {
        setToast({ open: true, message, severity });
    };

    const handleCloseToast = () => {
        setToast({ ...toast, open: false });
    };

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
        setLoading(false);
    };

    // Date Helper to avoid timezone shifts
    const toLocalYMD = (val: Date | string) => {
        const d = new Date(val);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleCreateNew = () => {
        setIsCreateMode(true);
        setEditingInvoice(null);
        setItems([]);
        const nextId = invoices.length > 0 ? Math.max(...invoices.map(i => i.ID)) + 1 : 1;
        setManualId(String(nextId));
        setManualStatus('Unpaid');

        // Use local date for default
        setInvoiceDate(toLocalYMD(new Date()));

        // Due Date: End of next month (approx logic or exact?)
        // Original: new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0) -> Last day of next month
        const today = new Date();
        const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        setDueDate(toLocalYMD(nextMonthEnd));

        if (filterClientId) setSelectedClientId(filterClientId);
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isCreateMode) return;

            // Ctrl+S to Save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                // Determine if creating or updating
                handleSave(editingInvoice ? 'update' : 'create');
            }

            // Esc to Close (only if no other dialogs are open)
            if (e.key === 'Escape' && !confirmDialog.open && !isUnitManagerOpen) {
                // Confirm before closing if there are changes?
                // For now, just follow existing "Cancel" behavior which doesn't confirm
                setIsCreateMode(false);
                setEditingInvoice(null);
                setItems([]);
                setManualId('');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCreateMode, editingInvoice, items, selectedClientId, invoiceDate, dueDate, manualId, manualStatus, confirmDialog.open, isUnitManagerOpen]);

    const handleSave = async (action: 'create' | 'update') => {
        if (!selectedClientId) {
            showToast('Please select a client', 'error');
            return;
        }
        if (items.length === 0) {
            showToast('Please add at least one item', 'error');
            return;
        }

        const total = items.reduce((sum, item) => sum + (item.UnitPrice * item.Quantity), 0);
        const idToUse = Number(manualId);

        if (action === 'create') {
            if (invoices.some(i => i.ID === idToUse)) {
                showToast(`Invoice ID #${idToUse} already exists.`, 'error');
                return;
            }
        }

        const newInvoice: any = {
            ID: idToUse,
            ClientID: selectedClientId,
            InvoiceDate: invoiceDate,
            DueDate: dueDate,
            Items: items,
            TotalAmount: total,
            Status: manualStatus
        };

        if (action === 'update') {
            await invoiceService.update(newInvoice);
            showToast(t('invoices_update_success', 'Invoice updated successfully'));
        } else {
            await invoiceService.create(newInvoice);
            showToast(t('invoices_create_success', 'Invoice created successfully'));
        }

        setIsCreateMode(false);
        setEditingInvoice(null);
        setItems([]);
        setManualId('');
        setManualStatus('Unpaid');
        loadData();
    };

    const handleEditInvoice = (invoice: Invoice) => {
        setEditingInvoice(invoice);
        setManualId(String(invoice.ID));
        setManualStatus(invoice.Status || 'Unpaid');
        setViewInvoice(null);
        setIsCreateMode(true);

        // Populate Form
        setSelectedClientId(invoice.ClientID);
        setInvoiceDate(toLocalYMD(invoice.InvoiceDate));
        setDueDate(invoice.DueDate ? toLocalYMD(invoice.DueDate) : '');
        setItems(invoice.Items.map(i => ({
            ...i,
            TaxRate: i.TaxRate || 10
        })));
    };

    const handleBulkDelete = async () => {
        try {
            // SelectedIds is a Set
            const ids = Array.from(selectedInvoiceIds);
            for (const id of ids) {
                await invoiceService.delete(id);
            }
            showToast(t('invoices_delete_success', 'Selected invoices deleted'));
            setSelectedInvoiceIds(new Set());
            setConfirmDialog({ ...confirmDialog, open: false });
            loadData();
        } catch (e) {
            console.error(e);
            showToast(t('common.error', 'Error'), 'error');
        }
    };

    const handleDelete = (id: number) => {
        setConfirmDialog({
            open: true,
            title: t('common.delete', 'Delete Invoice'),
            message: t('common.confirm_delete', 'Are you sure you want to delete this invoice?'),
            onConfirm: async () => {
                await invoiceService.delete(id);
                setConfirmDialog(prev => ({ ...prev, open: false }));
                showToast(t('invoices_deleted', 'Invoice deleted'));
                loadData();
            }
        });
    };

    const addItem = (product?: Product) => {
        // Logic to copy previous date and unit
        let defaultDate = invoiceDate;
        let defaultUnit = '';
        if (items.length > 0) {
            const last = items[items.length - 1];
            if (last.ItemDate) defaultDate = last.ItemDate;
            if (last.Unit) {
                defaultUnit = last.Unit;
                // Auto-save the unit from the previous line if it's new
                saveUnit(last.Unit);
            }
        }

        const newItem: InvoiceItem = {
            ProductID: product?.ID || 0,
            ProductName: product?.Name || '',
            Quantity: 1,
            UnitPrice: product?.UnitPrice || 0,
            Project: product?.Project,
            ItemDate: defaultDate,
            Unit: defaultUnit,
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
        const matchesStatus = statusFilter === 'All' ? true : (inv.Status || 'Unpaid') === statusFilter;
        return matchesClient && matchesMonth && matchesStatus;
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

    // CSV Export
    const handleExportCSV = (invoice: Invoice) => {
        const headers = [
            t('csv_date', 'Date'),
            t('csv_product', 'Product'),
            t('csv_quantity', 'Quantity'),
            t('csv_unit', 'Unit'),
            t('csv_unit_price', 'UnitPrice'),
            t('csv_total', 'Total'),
            t('csv_remarks', 'Remarks')
        ];
        const rows = (invoice.Items || []).map(item => [
            item.ItemDate ? new Date(item.ItemDate).toLocaleDateString() : '',
            item.ProductName,
            item.Quantity,
            item.Unit,
            item.UnitPrice,
            item.Quantity * item.UnitPrice,
            item.Remarks
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Add BOM for Excel equality
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `Invoice_${invoice.ID}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleMergeAndPrint = () => {
        if (selectedInvoiceIds.size === 0) return;

        const selectedInvoices = invoices.filter(inv => selectedInvoiceIds.has(inv.ID));
        if (selectedInvoices.length === 0) return;

        // Base the merged invoice on the most recent one (for client info, etc.)
        // Ideally they should be from the same client.
        const base = selectedInvoices[0];
        const allItems: InvoiceItem[] = [];
        let total = 0;

        selectedInvoices.forEach(inv => {
            const currentItems = inv.Items || [];
            allItems.push(...currentItems);
            total += inv.TotalAmount;
        });

        // Create a temporary Merged Invoice
        const mergedInvoice: Invoice = {
            ...base,
            ID: 0, // Indicator for merged? or just visually handled
            Items: allItems,
            TotalAmount: total,
            // Maybe concat dates? or just use base date
        };

        setViewInvoice(mergedInvoice);
    };

    // -- Print View Component --
    const PrintView = ({ invoice }: { invoice: Invoice }) => {
        const client = clients.find(c => c.ID === invoice.ClientID);

        // Process Tax on the fly for Print View (since invoice.Items might not be in state yet if we just viewing)
        // Similar logic to calculateTaxSummary
        const items = invoice.Items || [];
        const standardItems = items.filter(i => (i.TaxRate || 10) === 10);
        const reducedItems = items.filter(i => (i.TaxRate || 10) === 8);
        const standardSubtotal = standardItems.reduce((sum, i) => sum + (i.Quantity * i.UnitPrice), 0);
        const reducedSubtotal = reducedItems.reduce((sum, i) => sum + (i.Quantity * i.UnitPrice), 0);
        const standardTax = Math.floor(standardSubtotal * 0.1);
        const reducedTax = Math.floor(reducedSubtotal * 0.08);
        const totalTax = standardTax + reducedTax;
        const subtotal = standardSubtotal + reducedSubtotal;
        const total = subtotal + totalTax;

        const dateStr = new Date(invoice.InvoiceDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

        // Group items by Project
        const groupedItems = items.reduce((acc, item) => {
            const key = item.Project || 'GENERAL_NO_PROJECT';
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {} as Record<string, InvoiceItem[]>);

        const generalItems = groupedItems['GENERAL_NO_PROJECT'] || [];
        const projects = Object.keys(groupedItems).filter(k => k !== 'GENERAL_NO_PROJECT').sort((a, b) => a.localeCompare(b, 'ja'));

        return (
            <div className="print-container bg-white text-black p-8 max-w-[210mm] mx-auto min-h-[297mm] relative text-sm">
                {/* Header Title */}
                <div className="bg-blue-600 text-white text-center py-2 text-2xl font-bold tracking-[1em] mb-8 print:bg-blue-600 print-color-adjust">
                    御請求書
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
                                    ¥{total.toLocaleString()}
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
                                    {invoice.DueDate ? new Date(invoice.DueDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '翌月末'}
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
                    <thead className="print:table-header-group">
                        <tr className="bg-blue-600 text-white print:bg-blue-600 print-color-adjust">
                            <th className="border border-blue-400 py-1 px-2 w-16">日付</th>
                            <th className="border border-blue-400 py-1 px-2">内容</th>
                            <th className="border border-blue-400 py-1 px-2 w-16">税率</th>
                            <th className="border border-blue-400 py-1 px-2 w-12">数量</th>
                            <th className="border border-blue-400 py-1 px-2 w-12">単位</th>
                            <th className="border border-blue-400 py-1 px-2 w-20">単価</th>
                            <th className="border border-blue-400 py-1 px-2 w-24">金額</th>
                        </tr>
                    </thead>
                    {/* General Items Body */}
                    {generalItems.length > 0 && (
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
                                    <td className="border border-blue-600 py-1">{item.TaxRate}%</td>
                                    <td className="border border-blue-600 py-1">{item.Quantity}</td>
                                    <td className="border border-blue-600 py-1">{item.Unit || '-'}</td>
                                    <td className="border border-blue-600 py-1 text-right px-2">¥{item.UnitPrice.toLocaleString()}</td>
                                    <td className="border border-blue-600 py-1 text-right px-2">¥{(item.Quantity * item.UnitPrice).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    )}

                    {/* Project Bodies */}
                    {projects.map(project => (
                        <tbody key={project} className="print:break-inside-avoid">
                            {groupedItems[project].map((item, idx) => (
                                <tr key={project + idx} className="text-center">
                                    <td className="border border-blue-600 py-1">
                                        {item.ItemDate ? new Date(item.ItemDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : ''}
                                    </td>
                                    <td className="border border-blue-600 py-1 px-2 text-left">
                                        {item.ProductName}
                                        {item.Remarks && <span className="text-[10px] text-gray-500 ml-2">({item.Remarks})</span>}
                                    </td>
                                    <td className="border border-blue-600 py-1">{item.TaxRate}%</td>
                                    <td className="border border-blue-600 py-1">{item.Quantity}</td>
                                    <td className="border border-blue-600 py-1">{item.Unit || '-'}</td>
                                    <td className="border border-blue-600 py-1 text-right px-2">¥{item.UnitPrice.toLocaleString()}</td>
                                    <td className="border border-blue-600 py-1 text-right px-2">¥{(item.Quantity * item.UnitPrice).toLocaleString()}</td>
                                </tr>
                            ))}
                            {/* Project Footer Separator */}
                            <tr className="text-center font-bold bg-blue-50/50 print:bg-transparent">
                                <td className="border border-blue-600 py-1 print:border-x-blue-600" colSpan={7}>
                                    ----- {project} -----
                                </td>
                            </tr>
                        </tbody>
                    ))}

                    {/* Empty Filler Body */}
                    <tbody>
                        {Array.from({ length: Math.max(0, 10 - items.length - projects.length) }).map((_, i) => (
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
    // View Modal
    if (viewInvoice) {
        return (
            <Dialog
                fullScreen
                open={Boolean(viewInvoice)}
                onClose={() => setViewInvoice(null)}
            >
                <div className="flex flex-col items-center p-4 min-h-screen bg-gray-100 dark:bg-gray-900">
                    <div className="w-full max-w-4xl flex justify-between items-center mb-4 text-gray-800 dark:text-white print:hidden sticky top-0 bg-gray-100 dark:bg-gray-900 z-10 py-2">
                        <h2 className="text-xl font-bold">{t('invoices_preview_title', 'Invoice Preview')}</h2>
                        <div className="flex gap-2">
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={() => handleExportCSV(viewInvoice)}
                            >
                                {t('invoices_btn_csv', 'CSV')}
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<PrintIcon />}
                                onClick={() => window.print()}
                            >
                                {t('invoices_btn_print', 'Print')}
                            </Button>
                            <Button
                                variant="contained"
                                color="secondary"
                                startIcon={<EditIcon />}
                                onClick={() => handleEditInvoice(viewInvoice)}
                            >
                                {t('invoices_btn_edit', 'Edit')}
                            </Button>
                            <Button
                                variant="outlined"
                                color="inherit"
                                onClick={() => setViewInvoice(null)}
                            >
                                {t('invoices_btn_close', 'Close')}
                            </Button>
                        </div>
                    </div>
                    <div className="bg-white shadow-2xl w-full max-w-[210mm] print:shadow-none print:w-full print:m-0 print:absolute print:top-0 print:left-0">
                        <PrintView invoice={viewInvoice} />
                    </div>
                    <style>{`
                        @media print {
                            @page { size: A4; margin: 0; }
                            body * { visibility: hidden; }
                            .print-container, .print-container * { visibility: visible; }
                            .print-container { position: absolute; left: 0; top: 0; width: 100%; min-height: 100%; box-shadow: none !important; margin: 0 !important; }
                            .print-color-adjust { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            
                            /* Ensure Table Header only repeats if browser supports it, but user wants it only on first page? 
                               Actually, standard <thead> repeats. If user DOES NOT want repeat, we should move header to first row of body or just use CSS.
                               To FORCE NO REPEAT: display: table-row-group for thead? No.
                               The simplest way to NOT repeat is to just put it in the body or use simple rows.
                               But let's try leaving it as thead and seeing behavior, or strictly:
                            */
                            /* Prevent header repetition on new pages */
                            thead { display: table-row-group; }
                            /* Ensure the break-inside-avoid class works */
                            .print\\:break-inside-avoid {
                                break-inside: avoid;
                                page-break-inside: avoid;
                            }
                        }
                    `}</style>
                </div>
            </Dialog>
        );
    }

    // Create Form
    if (isCreateMode) {
        return (
            <Box sx={{ p: 4, maxWidth: 'lg', mx: 'auto', bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1, minHeight: '80vh' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, borderBottom: 1, borderColor: 'divider', pb: 2 }}>
                    <Typography variant="h5" fontWeight="bold">
                        {editingInvoice ? `${t('common.invoices_edit', 'Edit Invoice')} #${String(editingInvoice.ID).padStart(8, '0')} ` : t('invoices_create_title', 'Create New Invoice')}
                    </Typography>
                    <Button
                        onClick={() => { setIsCreateMode(false); setEditingInvoice(null); }}
                        variant="outlined"
                        color="secondary"
                    >
                        {t('common.cancel', 'Cancel')}
                    </Button>
                </Box>


                <Grid container spacing={2} sx={{ mb: 4 }}>
                    {/* Status Select: Show only when editing existing invoice or manual ID is present */}
                    {/* Status Select: Show ONLY when editing existing invoice (editingInvoice is set). Hide for new invoices. */}
                    {editingInvoice && (
                        <Grid size={2}>
                            <TextField
                                select
                                fullWidth
                                label={t('invoices_status', 'Status')}
                                value={manualStatus}
                                onChange={(e: any) => setManualStatus(e.target.value)}
                                variant="outlined"
                            >
                                <MenuItem value="Unpaid">{t('status_unpaid', 'Unsent')}</MenuItem>
                                <MenuItem value="Sent">{t('status_sent', 'Sent')}</MenuItem>
                                <MenuItem value="Paid">{t('status_paid', 'Paid')}</MenuItem>
                            </TextField>
                        </Grid>
                    )}
                    <Grid size={2}>
                        <TextField
                            label={t('invoices_manual_id', 'Invoice ID')}
                            value={manualId}
                            onChange={(e) => setManualId(e.target.value)}
                            fullWidth
                            variant="outlined"
                            disabled={false}
                        />
                    </Grid>
                    <Grid size={4}>
                        <TextField
                            select
                            fullWidth
                            label={t('invoices_client', 'Client')}
                            value={selectedClientId || ''}
                            onChange={(e) => {
                                setSelectedClientId(Number(e.target.value));
                                setItems([]);
                            }}
                            variant="outlined"
                        >
                            <MenuItem value=""><em>{t('invoices_select_client_placeholder', 'Select Client...')}</em></MenuItem>
                            {clients.filter(c => c.IsActive).map(c => (
                                <MenuItem key={c.ID} value={c.ID}>{c.Name}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid size={2}>
                        <TextField
                            type="date"
                            fullWidth
                            label={t('invoices_date', 'Date')}
                            InputLabelProps={{ shrink: true }}
                            value={invoiceDate}
                            onChange={(e: any) => setInvoiceDate(e.target.value)}
                            variant="outlined"
                        />
                    </Grid>
                    <Grid size={2}>
                        <TextField
                            type="date"
                            fullWidth
                            label={t('invoices_due_date', 'Due Date')}
                            InputLabelProps={{ shrink: true }}
                            value={dueDate}
                            onChange={(e: any) => setDueDate(e.target.value)}
                            variant="outlined"
                        />
                    </Grid>
                </Grid>

                {/* Items Section */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>{t('invoices_line_items', 'Line Items')}</Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: 'grey.50' }}>
                                <TableRow>
                                    <TableCell width="120">{t('invoices_date', 'Date')}</TableCell>
                                    <TableCell width="250">{t('products_name', 'Product')}</TableCell>
                                    <TableCell width="100">{t('invoices_unit_price', 'Unit Price')}</TableCell>
                                    <TableCell width="80">{t('invoices_quantity', 'Qty')}</TableCell>
                                    <TableCell width="120">
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            {t('invoices_unit', 'Unit')}
                                            <IconButton size="small" onClick={() => setIsUnitManagerOpen(true)}>
                                                <EditIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right" width="120">{t('invoices_total', 'Total')}</TableCell>
                                    <TableCell>{t('invoices_remarks', 'Remarks')}</TableCell>
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
                                                onChange={(e: any) => updateItem(idx, 'ItemDate', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Autocomplete
                                                freeSolo
                                                options={availableProducts}
                                                getOptionLabel={(option) => typeof option === 'string' ? option : `${option.Name}`}
                                                filterOptions={filterOptions}
                                                value={item.ProductName}
                                                onChange={(_, newValue) => {
                                                    if (typeof newValue !== 'string' && newValue) {
                                                        const newItems = [...items];
                                                        newItems[idx] = {
                                                            ...newItems[idx],
                                                            ProductID: newValue.ID,
                                                            ProductName: newValue.Name,
                                                            UnitPrice: newValue.UnitPrice,
                                                            TaxRate: newValue.TaxRate || 10,
                                                            Project: newValue.Project
                                                        };
                                                        setItems(newItems);
                                                    } else if (typeof newValue === 'string') {
                                                        updateItem(idx, 'ProductName', newValue);
                                                    }
                                                }}
                                                onInputChange={(_, newInputValue) => {
                                                    // Only update name on typing if it's not a selection event (handled by onChange usually, but needed for clearing/typing)
                                                    updateItem(idx, 'ProductName', newInputValue);
                                                }}
                                                renderOption={(props, option) => {
                                                    const prod = option as Product;
                                                    return (
                                                        <li {...props} key={prod.ID}>
                                                            <Box>
                                                                <Typography variant="body2">{prod.Name}</Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {prod.Project ? `${prod.Project} - ` : ''}{prod.Code} - ¥{prod.UnitPrice}
                                                                </Typography>
                                                            </Box>
                                                        </li>
                                                    );
                                                }}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        fullWidth
                                                        variant="standard"
                                                        placeholder={t('products_name', 'Product Name')}
                                                        InputProps={{ ...params.InputProps, disableUnderline: true }}
                                                    />
                                                )}
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
                                                onChange={(e: any) => updateItem(idx, 'UnitPrice', Number(e.target.value))}
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
                                                onChange={(e: any) => updateItem(idx, 'Quantity', Number(e.target.value))}
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
                                                placeholder={t('invoices_remarks', 'Memo')}
                                                InputProps={{ disableUnderline: true }}
                                                value={item.Remarks || ''}
                                                onChange={(e: any) => updateItem(idx, 'Remarks', e.target.value)}
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
                                        placeholder={t('invoices_search_product_placeholder', 'Search product to add...')}
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
                            {t('common.or', 'Or')} <Button size="small" onClick={() => addItem()}>{t('invoices_add_empty_row', 'Add Empty Row')}</Button>
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 3, borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ width: 300 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: 'text.secondary' }}>
                            <Typography>{t('invoices_subtotal', 'Subtotal')}</Typography>
                            <Typography>¥{calculateTaxSummary().subtotal.toLocaleString()}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: 'text.secondary' }}>
                            <Typography>{t('invoices_tax_total', 'Tax (Total)')}</Typography>
                            <Typography>¥{calculateTaxSummary().totalTax.toLocaleString()}</Typography>
                        </Box>
                        {calculateTaxSummary().reducedSubtotal > 0 && (
                            <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mb: 1, color: 'text.disabled' }}>
                                ({t('invoices_tax_standard', 'Standard')}: ¥{calculateTaxSummary().standardTax}, {t('invoices_tax_reduced', 'Reduced')}: ¥{calculateTaxSummary().reducedTax})
                            </Typography>
                        )}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2, borderTop: 1, borderColor: 'divider', mb: 2 }}>
                            <Typography variant="h6" fontWeight="bold">{t('invoices_total_final', 'Total')}</Typography>
                            <Typography variant="h6" fontWeight="bold">¥{calculateTotal().toLocaleString()}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
                            {editingInvoice && (
                                <Button
                                    fullWidth
                                    variant="outlined"
                                    color="primary"
                                    size="large"
                                    onClick={() => handleSave('create')} // Save as New -> Create
                                >
                                    {t('common.save_as_new', 'Save as New')}
                                </Button>
                            )}
                            <Button
                                fullWidth
                                variant="contained"
                                color="primary"
                                size="large"
                                onClick={() => handleSave(editingInvoice ? 'update' : 'create')}
                            >
                                {editingInvoice ? t('common.overwrite', 'Save (Overwrite)') : t('invoices_save', 'Save Invoice')}
                            </Button>
                        </Box>
                    </Box>
                </Box>


                {/* Shared Dialogs for Create Mode */}
                <Dialog open={isUnitManagerOpen} onClose={() => setIsUnitManagerOpen(false)} maxWidth="xs" fullWidth>
                    <Box sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>{t('unit_manage', 'Manage Units')}</Typography>
                        <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                            {units.length === 0 ? <Typography variant="body2" color="text.secondary">No saved units.</Typography> : (
                                units.map(u => (
                                    <Box key={u.ID} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderBottom: '1px solid #eee' }}>
                                        <Typography>{u.Name}</Typography>
                                        <IconButton size="small" color="error" onClick={() => {
                                            setConfirmDialog({
                                                open: true,
                                                title: t('common.delete', 'Delete Unit'),
                                                message: `Delete unit "${u.Name}"?`,
                                                onConfirm: async () => {
                                                    await unitService.delete(u.ID);
                                                    const updated = await unitService.getAll();
                                                    setUnits(updated);
                                                    setConfirmDialog(p => ({ ...p, open: false }));
                                                }
                                            });
                                        }}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                ))
                            )}
                        </Box>
                        <Box sx={{ mt: 2, textAlign: 'right' }}>
                            <Button onClick={() => setIsUnitManagerOpen(false)}>{t('common.close', 'Close')}</Button>
                        </Box>
                    </Box>
                </Dialog>

                <ConfirmDialog
                    open={confirmDialog.open}
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
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

                <LoadingOverlay open={loading} />
            </Box >
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
                    {selectedInvoiceIds.size > 0 && (
                        <Button
                            variant="outlined"
                            startIcon={<PrintIcon />}
                            onClick={handleMergeAndPrint}
                        >
                            {t('invoices_merge_print', 'Merge & Print')} ({selectedInvoiceIds.size})
                        </Button>
                    )}
                    {selectedInvoiceIds.size > 0 && (
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => {
                                setConfirmDialog({
                                    open: true,
                                    title: t('common.delete', 'Delete'),
                                    message: t('common.confirm_delete', 'Are you sure?'),
                                    onConfirm: handleBulkDelete
                                });
                            }}
                        >
                            {t('common.delete')} ({selectedInvoiceIds.size})
                        </Button>
                    )}
                    <TextField
                        select
                        label={t('invoices_status', 'Status')}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        variant="outlined"
                        size="small"
                        sx={{ width: 120, bgcolor: 'background.paper' }}
                    >
                        <MenuItem value="All">{t('common.all', 'All')}</MenuItem>
                        <MenuItem value="Unpaid">{t('status_unpaid', 'Unpaid')}</MenuItem>
                        <MenuItem value="Sent">{t('status_sent', 'Sent')}</MenuItem>
                    </TextField>
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
                    onClick={handleCreateNew}
                >
                    {t('invoices_new_invoice_btn', 'New Invoice')}
                </Button>
            </Box>

            <TableContainer component={Paper} elevation={1}>
                <Table sx={{ minWidth: 650 }} aria-label="invoice table">
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                        <TableRow>
                            <TableCell padding="checkbox">
                                <Checkbox
                                    indeterminate={selectedInvoiceIds.size > 0 && selectedInvoiceIds.size < sortedInvoices.length}
                                    checked={sortedInvoices.length > 0 && selectedInvoiceIds.size === sortedInvoices.length}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedInvoiceIds(new Set(sortedInvoices.map(i => i.ID)));
                                        } else {
                                            setSelectedInvoiceIds(new Set());
                                        }
                                    }}
                                />
                            </TableCell>
                            <TableCell onClick={() => handleSort('InvoiceDate')} sx={{ cursor: 'pointer', fontWeight: 'bold' }}>
                                {t('invoices_col_date', 'Date')} {sortConfig.key === 'InvoiceDate' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </TableCell>
                            <TableCell onClick={() => handleSort('ID')} sx={{ cursor: 'pointer', fontWeight: 'bold' }}>
                                {t('invoices_col_id', 'ID')} {sortConfig.key === 'ID' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </TableCell>
                            {!filterClientId && (
                                <TableCell onClick={() => handleSort('ClientName')} sx={{ cursor: 'pointer', fontWeight: 'bold' }}>
                                    {t('invoices_col_client', 'Client')} {sortConfig.key === 'ClientName' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                </TableCell>
                            )}
                            <TableCell align="right" onClick={() => handleSort('TotalAmount')} sx={{ cursor: 'pointer', fontWeight: 'bold' }}>
                                {t('invoices_col_amount', 'Amount')} {sortConfig.key === 'TotalAmount' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>{t('invoices_status', 'Status')}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{t('invoices_col_actions', 'Actions')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedInvoices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    {t('invoices_no_invoices', 'No invoices found.')}
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedInvoices
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((invoice) => (
                                    <TableRow
                                        key={invoice.ID}
                                        hover
                                        onClick={() => setViewInvoice(invoice)}
                                        sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                                        selected={selectedInvoiceIds.has(invoice.ID)}
                                    >
                                        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedInvoiceIds.has(invoice.ID)}
                                                onChange={(e: any) => {
                                                    const newSet = new Set(selectedInvoiceIds);
                                                    if (e.target.checked) newSet.add(invoice.ID);
                                                    else newSet.delete(invoice.ID);
                                                    setSelectedInvoiceIds(newSet);
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell component="th" scope="row" sx={{ fontFamily: 'monospace' }}>
                                            {new Date(invoice.InvoiceDate).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                            #{String(invoice.ID).padStart(8, '0')}
                                        </TableCell>
                                        {!filterClientId && (
                                            <TableCell sx={{ fontWeight: 500 }}>
                                                {((invoice.Items && invoice.Items.length > 0 && invoice.Items[0].Project) || clients.find(c => c.ID === invoice.ClientID)?.Name || 'Unknown')}
                                            </TableCell>
                                        )}
                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                            ¥{invoice.TotalAmount.toLocaleString()}
                                        </TableCell>
                                        <TableCell>

                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <Typography variant="caption" sx={{ mr: 1, color: invoice.Status === 'Sent' ? 'text.secondary' : 'error.main', fontWeight: 'bold' }}>
                                                    {invoice.Status === 'Sent' ? t('status_sent', 'Sent') : t('status_unpaid', 'Unsent')}
                                                </Typography>
                                                <Switch
                                                    size="small"
                                                    checked={invoice.Status === 'Sent'}
                                                    onChange={async (e: any) => {
                                                        const newStatus = e.target.checked ? 'Sent' : 'Unpaid';

                                                        // Optimistic update
                                                        setInvoices(prev => prev.map(inv => inv.ID === invoice.ID ? { ...inv, Status: newStatus as 'Unpaid' | 'Paid' | 'Sent' } : inv));

                                                        try {
                                                            const updated = { ...invoice, Status: newStatus as 'Unpaid' | 'Paid' | 'Sent' };
                                                            await invoiceService.update(updated);
                                                            // No re-fetch to prevent jump
                                                        } catch (err) {
                                                            // Revert on error
                                                            setInvoices(prev => prev.map(inv => inv.ID === invoice.ID ? invoice : inv));
                                                            console.error("Status update failed", err);
                                                        }
                                                    }}
                                                    color="primary"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </Box>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Button
                                                size="small"
                                                startIcon={<VisibilityIcon />}
                                                onClick={(e) => { e.stopPropagation(); setViewInvoice(invoice); }}
                                                sx={{ mr: 1 }}
                                            >
                                                {t('common.view', 'View')}
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
                                )))}

                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                rowsPerPageOptions={[10, 25, 50]}
                component="div"
                count={sortedInvoices.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage={t('rows_per_page')}
                labelDisplayedRows={({ from, to, count }) => t('page_info', { from, to, count })}
            />

            {/* Invoice Preview Modal */}
            {viewInvoice && (
                <Dialog
                    fullScreen
                    open={true}
                    onClose={() => setViewInvoice(null)}
                    PaperProps={{ sx: { bgcolor: 'background.default' } }}
                >
                    <Box sx={{ p: 2, bgcolor: 'white', borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="print:hidden">
                        <Typography variant="h6">{t('invoices_preview_title', 'Invoice Preview')}</Typography>
                        <Box>
                            <Button onClick={() => window.print()} startIcon={<PrintIcon />} sx={{ mr: 1 }} variant="contained" color="primary">
                                {t('invoices_btn_print', 'Print')}
                            </Button>
                            <Button onClick={() => setViewInvoice(null)} variant="outlined" color="secondary">
                                {t('invoices_btn_close', 'Close')}
                            </Button>
                        </Box>
                    </Box>

                    <Box sx={{ p: 8, maxWidth: '210mm', mx: 'auto', bgcolor: 'white', minHeight: '297mm', my: 2, boxShadow: 3 }} className="print:shadow-none print:m-0 print:w-full print:p-0">
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 6 }}>
                            <Typography variant="h3" fontWeight="bold" color="primary" sx={{ letterSpacing: 2 }}>{t('invoices_title', 'INVOICE')}</Typography>
                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="body1"><strong>{t('invoices_date', 'Date')}:</strong> {viewInvoice ? new Date((viewInvoice as any).InvoiceDate).toLocaleDateString() : ''}</Typography>
                                <Typography variant="body1"><strong>ID:</strong> #{viewInvoice ? String((viewInvoice as any).ID).padStart(8, '0') : ''}</Typography>
                                {/* Always render, check validity */}
                                {(viewInvoice as any)?.DueDate ? (
                                    <Typography variant="body1" color="error"><strong>{t('invoices_due_date', 'Due Date')}:</strong> {new Date((viewInvoice as any).DueDate).toLocaleDateString()}</Typography>
                                ) : null}
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 8, alignItems: 'flex-start' }}>
                            <Box sx={{ width: '50%' }}>
                                {viewInvoice && (
                                    <Typography variant="h5" fontWeight="bold" sx={{ borderBottom: 2, borderColor: 'divider', pb: 1, mb: 2, display: 'inline-block' }}>
                                        {clients.find(c => c.ID === (viewInvoice as any).ClientID)?.Name} <span style={{ fontSize: '0.6em', fontWeight: 'normal' }}>{t('common_honorific', '御中')}</span>
                                    </Typography>
                                )}
                                <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>{clients.find(c => c.ID === (viewInvoice as any)?.ClientID)?.Address}</Typography>
                            </Box>

                            <Box sx={{ width: '40%', textAlign: 'right' }}>
                                {settings.Logo && (
                                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                                        <img src={settings.Logo} alt="Logo" style={{ height: 80, objectFit: 'contain' }} />
                                    </Box>
                                )}
                                <Typography variant="h6" fontWeight="bold">{settings.CompanyName}</Typography>
                                <Typography variant="body2">{settings.Address}</Typography>
                                <Typography variant="body2">{settings.Phone}</Typography>
                                {settings.RegistrationNumber && <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>{t('settings_registration_number', 'Reg No.')}: {settings.RegistrationNumber}</Typography>}
                            </Box>
                        </Box>

                        <Box sx={{ mb: 6, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="h4" align="center" fontWeight="bold">
                                {t('invoices_total_amount', 'Total Amount')}: ¥{(viewInvoice as any)?.TotalAmount.toLocaleString()}
                            </Typography>
                        </Box>

                        <TableContainer component={Paper} elevation={0} variant="outlined" sx={{ mb: 4 }}>
                            <Table size="medium">
                                <TableHead sx={{ bgcolor: 'primary.main' }}>
                                    <TableRow>
                                        <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>{t('products_name', 'Item')}</TableCell>
                                        <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>{t('invoices_unit_price', 'Price')}</TableCell>
                                        <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>{t('invoices_quantity', 'Qty')}</TableCell>
                                        <TableCell align="right" sx={{ color: 'white', fontWeight: 'bold' }}>{t('invoices_total', 'Total')}</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(viewInvoice as any)?.Items.map((item: any, i: number) => (
                                        <TableRow key={i}>
                                            <TableCell>{item.ProductName || item.Project || '-'}</TableCell>
                                            <TableCell align="right">¥{item.UnitPrice.toLocaleString()}</TableCell>
                                            <TableCell align="right">{item.Quantity}</TableCell>
                                            <TableCell align="right">¥{(item.Quantity * item.UnitPrice).toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Box sx={{ mt: 8, p: 3, border: '1px solid', borderColor: 'grey.300', borderRadius: 2 }}>
                            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, borderBottom: 1, pb: 0.5, borderColor: 'grey.300' }}>{t('settings_bank_info', 'Bank Account Info')}</Typography>
                            <Grid container spacing={2}>
                                <Grid size={3}><Typography variant="body2" color="text.secondary">{t('settings_bank_name', 'Bank')}</Typography></Grid>
                                <Grid size={9}><Typography variant="body2" fontWeight="medium">{settings.BankName} {settings.BranchName}</Typography></Grid>
                                <Grid size={3}><Typography variant="body2" color="text.secondary">{t('settings_account_number', 'Account')}</Typography></Grid>
                                <Grid size={9}><Typography variant="body2" fontWeight="medium">{settings.AccountType} {settings.AccountNumber}</Typography></Grid>
                                <Grid size={3}><Typography variant="body2" color="text.secondary">{t('settings_account_holder', 'Holder')}</Typography></Grid>
                                <Grid size={9}><Typography variant="body2" fontWeight="medium">{settings.AccountHolder}</Typography></Grid>
                            </Grid>
                        </Box>
                    </Box>
                </Dialog>
            )}



            {/* Unit Manager Dialog */}
            <Dialog open={isUnitManagerOpen} onClose={() => setIsUnitManagerOpen(false)} maxWidth="xs" fullWidth>
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>{t('unit_manage', 'Manage Units')}</Typography>
                    <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                        {units.length === 0 ? <Typography variant="body2" color="text.secondary">No saved units.</Typography> : (
                            units.map(u => (
                                <Box key={u.ID} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderBottom: '1px solid #eee' }}>
                                    <Typography>{u.Name}</Typography>
                                    <IconButton size="small" color="error" onClick={() => {
                                        setConfirmDialog({
                                            open: true,
                                            title: t('common.delete', 'Delete Unit'),
                                            message: `Delete unit "${u.Name}"?`,
                                            onConfirm: async () => {
                                                await unitService.delete(u.ID);
                                                const updated = await unitService.getAll();
                                                setUnits(updated);
                                                setConfirmDialog(p => ({ ...p, open: false }));
                                            }
                                        });
                                    }}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            ))
                        )}
                    </Box>
                    <Box sx={{ mt: 2, textAlign: 'right' }}>
                        <Button onClick={() => setIsUnitManagerOpen(false)}>{t('common.close', 'Close')}</Button>
                    </Box>
                </Box>
            </Dialog>

            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
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

            <LoadingOverlay open={loading} />
        </Box>
    );
};

export default Invoices;
