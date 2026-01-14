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
    Grid, InputAdornment, Autocomplete, Dialog, Checkbox
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
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingOverlay from '../components/LoadingOverlay';

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

    // Create/View State
    const [isCreateMode, setIsCreateMode] = useState(false);
    const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null); // For Edit Mode
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'InvoiceDate', direction: 'desc' });

    // Form State
    const [selectedClientId, setSelectedClientId] = useState<number | null>(filterClientId || null);
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());

    // Product Search
    const [searchTerm, setSearchTerm] = useState('');

    // UI Feedback
    const [toast, setToast] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'info' | 'warning' }>({
        open: false, message: '', severity: 'info'
    });
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean, title?: string, message: string, onConfirm: () => void }>({
        open: false, message: '', onConfirm: () => { }
    });

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

    const handleSave = async () => {
        if (!selectedClientId) {
            showToast('Please select a client', 'error');
            return;
        }
        if (items.length === 0) {
            showToast('Please add at least one item', 'error');
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
        showToast('Invoice created successfully');

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

    const handleDelete = (id: number) => {
        setConfirmDialog({
            open: true,
            title: t('delete_invoice', 'Delete Invoice'),
            message: t('confirm_delete_msg', 'Are you sure you want to delete this invoice?'),
            onConfirm: async () => {
                await invoiceService.delete(id);
                setConfirmDialog(prev => ({ ...prev, open: false }));
                showToast('Invoice deleted');
                loadData();
            }
        });
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

    // CSV Export
    const handleExportCSV = (invoice: Invoice) => {
        const headers = ['Date', 'Product', 'Quantity', 'Unit', 'UnitPrice', 'Total', 'Remarks'];
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
                    <thead className="print:table-header-group">
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
                                    <td className="border border-blue-600 py-1"></td>
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
                                    <td className="border border-blue-600 py-1"></td>
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
                        <h2 className="text-xl font-bold">{t('invoices_preview', 'Invoice Preview')}</h2>
                        <div className="flex gap-2">
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                onClick={() => handleExportCSV(viewInvoice)}
                            >
                                {t('invoices_csv', 'CSV')}
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<PrintIcon />}
                                onClick={() => window.print()}
                            >
                                {t('invoices_print', 'Print')}
                            </Button>
                            <Button
                                variant="contained"
                                color="secondary"
                                startIcon={<EditIcon />}
                                onClick={() => handleEditInvoice(viewInvoice)}
                            >
                                {t('common.edit', 'Edit')}
                            </Button>
                            <Button
                                variant="outlined"
                                color="inherit"
                                onClick={() => setViewInvoice(null)}
                            >
                                {t('common.close', 'Close')}
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
                        {editingInvoice ? `${t('invoices_edit_title', 'Edit Invoice #')}${String(editingInvoice.ID).padStart(8, '0')} ` : t('invoices_create_title', 'Create New Invoice')}
                    </Typography>
                    <Button
                        onClick={() => { setIsCreateMode(false); setEditingInvoice(null); }}
                        variant="outlined"
                        color="secondary"
                    >
                        {t('common.cancel', 'Cancel')}
                    </Button>
                </Box>

                <Grid container spacing={4} sx={{ mb: 4 }}>
                    <Grid size={6}>
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
                            <MenuItem value=""><em>{t('invoices_select_client', 'Select Client...')}</em></MenuItem>
                            {clients.filter(c => c.IsActive).map(c => (
                                <MenuItem key={c.ID} value={c.ID}>{c.Name}</MenuItem>
                            ))}
                        </TextField>
                    </Grid>
                    <Grid size={6}>
                        <TextField
                            type="date"
                            fullWidth
                            label={t('invoices_date', 'Date')}
                            InputLabelProps={{ shrink: true }}
                            value={invoiceDate}
                            onChange={e => setInvoiceDate(e.target.value)}
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
                                    <TableCell width="250">{t('invoices_product', 'Product')}</TableCell>
                                    <TableCell width="100">{t('invoices_unit_price', 'Unit Price')}</TableCell>
                                    <TableCell width="80">{t('invoices_qty', 'Qty')}</TableCell>
                                    <TableCell width="100">{t('invoices_unit', 'Unit')}</TableCell>
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
                                disabled={!selectedClientId}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                            <Button size="small" onClick={() => addItem()}>{t('invoices_add_empty_row', 'Or Add Empty Row')}</Button>
                        </Box>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 3, borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ width: 300, bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                        <Grid container justifyContent="space-between" sx={{ mb: 1 }}>
                            <Typography>{t('invoices_subtotal', 'Subtotal')}</Typography>
                            <Typography>¥{calculateTaxSummary().subtotal.toLocaleString()}</Typography>
                        </Grid>
                        <Grid container justifyContent="space-between" sx={{ mb: 1 }}>
                            <Typography>{t('invoices_tax_total', 'Tax (Total)')}</Typography>
                            <Typography>¥{calculateTaxSummary().totalTax.toLocaleString()}</Typography>
                        </Grid>
                        <Box sx={{ my: 1, borderTop: 1, borderColor: 'divider' }} />
                        <Grid container justifyContent="space-between">
                            <Typography variant="h6" fontWeight="bold">{t('invoices_total', 'Total')}</Typography>
                            <Typography variant="h6" fontWeight="bold">¥{calculateTotal().toLocaleString()}</Typography>
                        </Grid>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    <Button
                        variant="contained"
                        size="large"
                        onClick={handleSave}
                        sx={{ minWidth: 200 }}
                    >
                        {t('invoices_save', 'Save Invoice')}
                    </Button>
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
                    {selectedInvoiceIds.size > 0 && (
                        <Button
                            variant="outlined"
                            startIcon={<PrintIcon />}
                            onClick={handleMergeAndPrint}
                        >
                            {t('invoices_merge_print', 'Merge & Print')} ({selectedInvoiceIds.size})
                        </Button>
                    )}
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
                                selected={selectedInvoiceIds.has(invoice.ID)}
                            >
                                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                        checked={selectedInvoiceIds.has(invoice.ID)}
                                        onChange={(e) => {
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
