import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Invoice, invoiceService, InvoiceItem } from '../services/invoices';
import { Client, clientService } from '../services/clients';
import { Product, productService } from '../services/products';
import { AppSettings, defaultSettings, settingsService } from '../services/settings';
import { Unit, unitService } from '../services/units';

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
    const [focusedUnitRow, setFocusedUnitRow] = useState<number | null>(null);

    // Product Search
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, [filterClientId]); // Reload if prop changes

    useEffect(() => {
        if (filterClientId) setSelectedClientId(filterClientId);
    }, [filterClientId]);

    const loadData = async () => {
        const [iData, cData, pData, sData] = await Promise.all([
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

    const handleCreate = async () => {
        if (!selectedClientId) {
            alert('Please select a client');
            return;
        }
        if (items.length === 0) {
            alert('Please add at least one item');
            return;
        }

        const total = items.reduce((sum, item) => sum + (item.UnitPrice * item.Quantity), 0);

        await invoiceService.create({
            ID: editingInvoice?.ID, // Pass ID for update
            ClientID: selectedClientId,
            InvoiceDate: invoiceDate,
            Items: items,
            TotalAmount: total
        });

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

    const calculateSubtotal = () => items.reduce((sum, item) => sum + (item.Quantity * item.UnitPrice), 0);

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
                            <tr key={`empty-${i}`} className="text-center h-6">
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
            <div className="p-6 max-w-5xl mx-auto bg-white rounded-xl shadow border border-gray-100 min-h-[80vh]">
                <div className="flex justify-between items-center mb-8 border-b pb-4">
                    <h2 className="text-2xl font-bold">{editingInvoice ? `Edit Invoice #${String(editingInvoice.ID).padStart(8, '0')}` : 'Create New Invoice'}</h2>
                    <button onClick={() => { setIsCreateMode(false); setEditingInvoice(null); }} className="text-gray-500 hover:text-gray-700">Cancel</button>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-8">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                        <select
                            className="w-full input-field"
                            value={selectedClientId || ''}
                            onChange={e => {
                                setSelectedClientId(Number(e.target.value));
                                setItems([]); // Clear items on client change
                            }}
                        >
                            <option value="">Select Client...</option>
                            {clients.filter(c => c.IsActive).map(c => (
                                <option key={c.ID} value={c.ID}>{c.Name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input
                            type="date"
                            className="w-full input-field"
                            value={invoiceDate}
                            onChange={e => setInvoiceDate(e.target.value)}
                        />
                    </div>
                </div>

                {/* Items Section */}
                <div className="mb-8">
                    <h3 className="font-semibold text-gray-700 mb-4">Line Items</h3>
                    <table className="w-full text-left mb-4">
                        <thead className="bg-gray-50 text-gray-600 text-sm">
                            <tr>
                                <th className="p-3 pl-4 w-32">Date</th>
                                <th className="p-3 w-48">Product</th>
                                <th className="p-3 w-24">Unit Price</th>
                                <th className="p-3 w-16">Qty</th>
                                <th className="p-3 w-20">Unit</th>
                                <th className="p-3 w-24 text-right">Total</th>
                                <th className="p-3">Remarks</th>
                                <th className="p-3 w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50">
                                    <td className="p-2">
                                        <input
                                            type="date"
                                            className="w-full bg-transparent outline-none text-sm text-gray-600 focus:text-gray-900 border-b border-transparent focus:border-indigo-300 transition-colors"
                                            value={item.ItemDate}
                                            onChange={e => updateItem(idx, 'ItemDate', e.target.value)}
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input
                                            className="w-full bg-transparent outline-none border-b border-transparent focus:border-indigo-300 transition-colors font-medium text-gray-800"
                                            value={item.ProductName}
                                            onChange={e => updateItem(idx, 'ProductName', e.target.value)}
                                            placeholder="Product Name"
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            className="w-full bg-transparent outline-none text-right"
                                            value={item.UnitPrice}
                                            onChange={e => updateItem(idx, 'UnitPrice', Number(e.target.value))}
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input
                                            type="number"
                                            className="w-full bg-transparent outline-none text-center font-bold text-gray-800"
                                            value={item.Quantity}
                                            onChange={e => updateItem(idx, 'Quantity', Number(e.target.value))}
                                        />
                                    </td>
                                    <td className="p-2 relative">
                                        <input
                                            className="w-full bg-transparent outline-none border-b border-transparent focus:border-indigo-300 text-center"
                                            value={item.Unit || ''}
                                            onChange={e => updateItem(idx, 'Unit', e.target.value)}
                                            onFocus={() => setFocusedUnitRow(idx)}
                                            onBlur={() => setTimeout(() => setFocusedUnitRow(null), 200)}
                                            placeholder="-"
                                        />
                                        {/* Unit Dropdown */}
                                        {focusedUnitRow === idx && (
                                            <div className="absolute top-full left-0 w-full min-w-[100px] bg-white border border-gray-200 shadow-lg rounded z-20 max-h-40 overflow-auto">
                                                {units.map(u => (
                                                    <div
                                                        key={u.ID}
                                                        className="px-3 py-1.5 hover:bg-indigo-50 cursor-pointer text-sm text-center"
                                                        onClick={() => {
                                                            updateItem(idx, 'Unit', u.Name);
                                                            setFocusedUnitRow(null);
                                                        }}
                                                    >
                                                        {u.Name}
                                                    </div>
                                                ))}
                                                {units.length === 0 && <div className="px-3 py-2 text-xs text-gray-400 text-center">Type to add...</div>}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-2 text-right font-mono text-gray-700">
                                        ¥{(item.Quantity * item.UnitPrice).toLocaleString()}
                                    </td>
                                    <td className="p-2">
                                        <input
                                            className="w-full bg-transparent outline-none border-b border-transparent focus:border-indigo-300 text-sm text-gray-500 italic"
                                            value={item.Remarks || ''}
                                            onChange={e => updateItem(idx, 'Remarks', e.target.value)}
                                            placeholder="Memo"
                                        />
                                    </td>
                                    <td className="p-2 text-center">
                                        <button onClick={() => removeItem(idx)} className="text-red-300 hover:text-red-500 transition-colors">×</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Add Item Row with Search */}
                    <div className="bg-gray-50 p-4 rounded-lg flex gap-4 items-center border border-gray-200 border-dashed">
                        <div className="flex-1 relative">
                            <input
                                placeholder="Search product to add..."
                                className="w-full p-2 pl-8 rounded border border-gray-300 focus:border-indigo-500 outline-none"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                disabled={!selectedClientId}
                            />
                            <span className="absolute left-2.5 top-2.5 text-gray-400">🔍</span>

                            {/* Autocomplete Dropdown */}
                            {searchTerm && (
                                <div className="absolute top-full left-0 w-full bg-white shadow-lg rounded-b-lg border border-gray-200 mt-1 max-h-60 overflow-y-auto z-10">
                                    {availableProducts.map(p => (
                                        <div
                                            key={p.ID}
                                            className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center bg-white"
                                            onClick={() => addItem(p)}
                                        >
                                            <div>
                                                <div className="font-medium text-gray-800">{p.Name}</div>
                                                <div className="text-xs text-gray-400">{p.Code}</div>
                                            </div>
                                            <div className="text-emerald-600 font-mono">¥{p.UnitPrice.toLocaleString()}</div>
                                        </div>
                                    ))}
                                    {availableProducts.length === 0 && (
                                        <div className="p-3 text-gray-400 text-center text-sm">No matching products found</div>
                                    )}
                                    <div className="p-2 border-t bg-gray-50 text-center">
                                        <button onClick={() => addItem()} className="text-xs text-indigo-600 font-bold hover:underline">
                                            + Add Empty Row
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="text-sm text-gray-500">
                            Type text to search products bound to this client.
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-6 border-t">
                    <div className="w-64 space-y-3">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal</span>
                            <span>¥{calculateTaxSummary().subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Tax (Total)</span>
                            <span>¥{calculateTaxSummary().totalTax.toLocaleString()}</span>
                        </div>
                        {calculateTaxSummary().reducedSubtotal > 0 && (
                            <div className="text-xs text-right text-gray-500">
                                (Standard: ¥{calculateTaxSummary().standardTax}, Reduced: ¥{calculateTaxSummary().reducedTax})
                            </div>
                        )}
                        <div className="flex justify-between text-xl font-bold text-gray-800 pt-3 border-t">
                            <span>Total</span>
                            <span>¥{calculateTotal().toLocaleString()}</span>
                        </div>
                        <button onClick={handleCreate} className="w-full bg-black text-white py-3 rounded-lg font-bold mt-4 hover:shadow-lg transition-all">
                            Save Invoice
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // List View
    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800">{t('invoices', 'Invoices')}</h2>
                    <input
                        type="month"
                        value={monthFilter}
                        onChange={e => setMonthFilter(e.target.value)}
                        className="p-2 rounded border border-gray-300 outline-none focus:border-indigo-500"
                    />
                </div>
                <button
                    onClick={() => setIsCreateMode(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-2"
                >
                    <span>+</span> {t('new_invoice', 'New Invoice')}
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-4 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('InvoiceDate')}>
                                Date {sortConfig.key === 'InvoiceDate' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </th>
                            <th className="px-6 py-4 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('ID')}>
                                ID {sortConfig.key === 'ID' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </th>
                            {!filterClientId && (
                                <th className="px-6 py-4 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('ClientName')}>
                                    Client {sortConfig.key === 'ClientName' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                </th>
                            )}
                            <th className="px-6 py-4 font-semibold text-gray-600 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('TotalAmount')}>
                                Amount {sortConfig.key === 'TotalAmount' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                            </th>
                            <th className="px-6 py-4 font-semibold text-gray-600 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sortedInvoices.map(invoice => (
                            <tr key={invoice.ID} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setViewInvoice(invoice)}>
                                <td className="px-6 py-4 text-gray-500 font-mono text-sm">
                                    {new Date(invoice.InvoiceDate).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-gray-400 text-xs">#{String(invoice.ID).padStart(8, '0')}</td>
                                {!filterClientId && (
                                    <td className="px-6 py-4 font-medium text-gray-800">
                                        {clients.find(c => c.ID === invoice.ClientID)?.Name || 'Unknown'}
                                    </td>
                                )}
                                <td className="px-6 py-4 text-gray-800 font-bold text-right">
                                    ¥{invoice.TotalAmount.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right space-x-2" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => setViewInvoice(invoice)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">View</button>
                                    <button onClick={() => handleDelete(invoice.ID)} className="text-red-500 hover:text-red-700 font-medium text-sm">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {sortedInvoices.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-400">
                                    No invoices found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Invoices;
