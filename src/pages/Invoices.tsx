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
    Grid, Autocomplete, Dialog, Checkbox, Switch, TablePagination, CircularProgress
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
    Search as SearchIcon,
    Print as PrintIcon,
    Edit as EditIcon,
    Settings as SettingsIcon,
    ArrowDropDown as ArrowDropDownIcon
} from '@mui/icons-material';
import { ButtonGroup, Menu } from '@mui/material';
import { Snackbar, Alert } from '@mui/material';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingOverlay from '../components/LoadingOverlay';
import PageTransition from '../components/PageTransition';
import { motion } from 'framer-motion';
import { containerVariants, itemVariants } from '../utils/animations';

const Invoices = ({ filterClientId }: { filterClientId?: number | null }) => {
    const { t } = useTranslation();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);

    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveMenuAnchorEl, setSaveMenuAnchorEl] = useState<null | HTMLElement>(null);

    // 筛选
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [statusFilter, setStatusFilter] = useState<'All' | 'Unpaid' | 'Paid' | 'Sent'>('All');

    // 创建/查看状态
    const [isCreateMode, setIsCreateMode] = useState(false);
    const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null); // 用于编辑模式
    const [manualId, setManualId] = useState<string>('');
    const [manualStatus, setManualStatus] = useState<'Unpaid' | 'Paid' | 'Sent'>('Unpaid');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'InvoiceDate', direction: 'desc' });

    // 表单状态
    const [selectedClientId, setSelectedClientId] = useState<number | null>(filterClientId || null);
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState<string>('');
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());
    const [remarks, setRemarks] = useState('');

    // 分页
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // 产品搜索
    const [searchTerm, setSearchTerm] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // UI 反馈
    const [toast, setToast] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'info' | 'warning' }>({
        open: false, message: '', severity: 'info'
    });
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean, title?: string, message: string, onConfirm: () => void }>({
        open: false, message: '', onConfirm: () => { }
    });

    // 单位管理
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
    }, [filterClientId]); // 如果属性改变则重新加载

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

    // 日期助手，避免时区偏移
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

        setInvoiceDate(toLocalYMD(new Date()));

        // 截止日期：下个月底 (近似逻辑或精确？)
        const today = new Date();
        const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
        setDueDate(toLocalYMD(nextMonthEnd));

        setRemarks('');
        if (filterClientId) setSelectedClientId(filterClientId);
    };

    // 快捷键
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isCreateMode) return;

            // Ctrl+S 保存
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                // 确定是创建还是更新
                handleSave(editingInvoice ? 'update' : 'create');
            }

            // Esc 关闭 (仅当没有其他对话框打开时)
            if (e.key === 'Escape' && !confirmDialog.open && !isUnitManagerOpen) {
                // 关闭前确认是否有更改？
                // 目前，仅遵循现有的“取消”行为，不进行确认
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
        console.log('=== FRONTEND: handleSave called ===', { action, manualId, selectedClientId });
        if (!selectedClientId) {
            showToast(t('validation.client_required', 'Please select a client'), 'error');
            return;
        }
        if (items.length === 0) {
            showToast(t('invoices_error_no_items', 'Please add at least one item'), 'error');
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
            Status: manualStatus,
            Remarks: remarks
        };

        console.log('Prepared invoice object:', newInvoice);
        // 自动保存新单位
        for (const item of items) {
            if (item.Unit && !units.find(u => u.Name === item.Unit)) {
                try {
                    await unitService.add(item.Unit);
                } catch (e) {
                    console.error('Failed to save unit:', item.Unit, e);
                }
            }
        }
        // 后台刷新单位
        unitService.getAll().then(setUnits);

        setIsSaving(true);

        try {
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
        } catch (error: any) {
            console.error('Save error:', error);
            showToast(error.message || 'Save failed', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditInvoice = (invoice: Invoice) => {
        setEditingInvoice(invoice);
        setManualId(String(invoice.ID));
        setManualStatus(invoice.Status || 'Unpaid');
        setViewInvoice(null);
        setIsCreateMode(true);

        // 填充表单
        setSelectedClientId(invoice.ClientID);
        setInvoiceDate(toLocalYMD(invoice.InvoiceDate));
        setDueDate(invoice.DueDate ? toLocalYMD(invoice.DueDate) : '');
        setRemarks(invoice.Remarks || '');
        setItems(invoice.Items.map(i => ({
            ...i,
            TaxRate: i.TaxRate || 10
        })));
    };

    const handleBulkDelete = async () => {
        setIsDeleting(true);
        try {
            // SelectedIds 是一个 Set
            const ids = Array.from(selectedInvoiceIds);
            for (const id of ids) {
                await invoiceService.delete(id);
            }
            showToast(t('invoices_bulk_deleted', 'Selected invoices deleted'));
            setSelectedInvoiceIds(new Set());
            setConfirmDialog({ ...confirmDialog, open: false });
            loadData();
        } catch (e) {
            console.error(e);
            showToast(t('common.error', 'Error'), 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDelete = (id: number) => {
        setConfirmDialog({
            open: true,
            title: t('common.delete', 'Delete Invoice'),
            message: t('common.confirm_delete', 'Are you sure you want to delete this invoice?'),
            onConfirm: async () => {
                setIsDeleting(true);
                try {
                    await invoiceService.delete(id);
                    setConfirmDialog(prev => ({ ...prev, open: false }));
                    showToast(t('invoices_deleted', 'Invoice deleted'));
                    loadData();
                } catch (e) {
                    console.error(e);
                    showToast(t('common.error'), 'error');
                } finally {
                    setIsDeleting(false);
                }
            }
        });
    };

    const addItem = (product?: Product) => {
        // 复制上一个日期和单位的逻辑
        let defaultDate = invoiceDate;
        let defaultUnit = '';
        if (items.length > 0) {
            const last = items[items.length - 1];
            if (last.ItemDate) defaultDate = last.ItemDate;
            if (last.Unit) {
                defaultUnit = last.Unit;
                // 如果是新的，自动保存上一行的单位
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
        setSearchTerm(''); // 添加后清除搜索
    };

    const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    // 筛选器
    // 筛选与排序
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

        // 二级排序：如果主排序相等（或为了稳定性），总是按 ID 降序排序
        // 如果按 ID 排序，则不需要二级排序。
        if (comparison === 0 && sortConfig.key !== 'ID') {
            return b.ID - a.ID; // 最新 ID 优先
        }

        return comparison;
    });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        // 当对日期、ID 或金额进行新排序时，通常默认为降序？
        // 标准行为：第一次点击 ASC。用户可以双击进行 DESC。
        // 但对于日期，通常首选 DESC。让我们坚持标准切换。
        // 等等，如果我当前是 'desc'（默认日期），下次点击应该是 'asc'。
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        } else if (sortConfig.key !== key && (key === 'InvoiceDate' || key === 'ID' || key === 'TotalAmount')) {
            // 对于数字/日期，用户通常希望最大的/最新的在前面
            direction = 'desc';
        }

        setSortConfig({ key, direction });
    };

    // 产品筛选逻辑
    const availableProducts = products.filter(p => {
        if (!p.IsActive) return false;
        // 按文本搜索筛选
        if (searchTerm && !p.Name.toLowerCase().includes(searchTerm.toLowerCase()) && !p.Code?.toLowerCase().includes(searchTerm.toLowerCase())) {
            return false;
        }
        // 按客户绑定筛选
        if (selectedClientId && p.ClientIDs && p.ClientIDs.length > 0) {
            return p.ClientIDs.includes(selectedClientId);
        }
        // 如果 ClientIDs 为空，则对所有人可用？假设是的。
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

    // CSV 导出
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

        // 添加 BOM 以保证 Excel 兼容性
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

        // 基于最近的发票合并（用于客户信息等）
        // 理想情况下，它们应该来自同一个客户。
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
            ID: 0, // 合并的指示器？还是仅在视觉上处理
            Items: allItems,
            TotalAmount: total,
            // 也许合并日期？或者只使用基准日期
        };

        setViewInvoice(mergedInvoice);
    };

    // -- 打印视图组件 --
    const PrintView = ({ invoice }: { invoice: Invoice }) => {
        const client = clients.find(c => c.ID === invoice.ClientID);

        // 为打印视图即时处理税费（因为如果只是查看，invoice.Items 可能尚未处于状态中）
        // 类似于 calculateTaxSummary 的逻辑
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

        // 按项目分组
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
                {/* 标题 */}
                <div className="bg-blue-600 text-white text-center py-2 text-2xl font-bold tracking-[1em] mb-8 print:bg-blue-600 print-color-adjust">
                    御請求書
                </div>

                {/* 顶部区域 */}
                <div className="flex justify-between items-start mb-8">
                    {/* 左侧：客户信息 */}
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

                        {/* 银行信息 */}
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

                    {/* 右侧：公司信息 */}
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
                            {/* 印章占位符 */}
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

                {/* 表格 */}
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
                    {/* 通用项目主体 */}
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

                    {/* 项目主体 */}
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
                            {/* 项目页脚分隔符 */}
                            <tr className="text-center font-bold bg-blue-50/50 print:bg-transparent">
                                <td className="border border-blue-600 py-1 print:border-x-blue-600" colSpan={7}>
                                    ----- {project} -----
                                </td>
                            </tr>
                        </tbody>
                    ))}

                    {/* 空填充主体 */}
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

                {/* 右下角汇总表 */}
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

                {/* 备注 */}
                <div className="mt-8 border border-blue-600 rounded min-h-[100px] p-2">
                    <div className="bg-blue-600 text-white text-xs px-2 py-0.5 inline-block rounded mb-2 print:bg-blue-600 print-color-adjust">備考</div>
                </div>
            </div>
        );
    };



    // 列表视图
    return (
        <PageTransition>
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
                        )
                        }
                        <TextField
                            type="month"
                            variant="outlined"
                            size="small"
                            value={monthFilter}
                            onChange={e => setMonthFilter(e.target.value)}
                            sx={{ width: 140, bgcolor: 'background.paper' }}
                            placeholder={t('common.all', 'All')}
                        />
                        {
                            selectedInvoiceIds.size > 0 && (
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
                            )
                        }
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
                        <TableBody component={motion.tbody} variants={containerVariants} initial="hidden" animate="visible">
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
                                            component={motion.tr}
                                            variants={itemVariants}
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

                                                            // 乐观更新
                                                            setInvoices(prev => prev.map(inv => inv.ID === invoice.ID ? { ...inv, Status: newStatus as 'Unpaid' | 'Paid' | 'Sent' } : inv));

                                                            try {
                                                                const updated = { ...invoice, Status: newStatus as 'Unpaid' | 'Paid' | 'Sent' };
                                                                await invoiceService.update(updated);
                                                                // 不重新获取以防止跳动
                                                            } catch (err) {
                                                                // 出错时恢复
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
                                    ))
                            )}
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
                        PaperProps={{ sx: { bgcolor: 'background.paper' } }}
                    >
                        {/* Sticky Header */}
                        <Box sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 1100,
                            bgcolor: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(8px)',
                            borderBottom: 1,
                            borderColor: 'divider',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            px: 4,
                            py: 1.5,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                        }} className="print:hidden">
                            <Typography variant="h6" fontWeight="bold" color="primary.main">
                                {t('invoices_preview_title', 'Invoice Preview')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5 }}>
                                <Button
                                    onClick={() => handleExportCSV(viewInvoice)}
                                    variant="outlined"
                                    color="primary"
                                    sx={{ borderRadius: 2 }}
                                >
                                    {t('invoices_btn_csv', 'CSV')}
                                </Button>
                                <Button
                                    onClick={() => window.print()}
                                    startIcon={<PrintIcon />}
                                    variant="contained"
                                    color="primary"
                                    sx={{ borderRadius: 2 }}
                                >
                                    {t('invoices_btn_print', 'Print')}
                                </Button>
                                <Button
                                    onClick={() => handleEditInvoice(viewInvoice)}
                                    variant="contained"
                                    color="secondary"
                                    startIcon={<EditIcon />}
                                    sx={{ borderRadius: 2 }}
                                >
                                    {t('invoices_btn_edit', 'Edit')}
                                </Button>
                                <Button
                                    onClick={() => setViewInvoice(null)}
                                    variant="contained"
                                    color="inherit"
                                    sx={{
                                        borderRadius: 2,
                                        bgcolor: 'grey.700',
                                        color: 'white',
                                        '&:hover': { bgcolor: 'grey.900' }
                                    }}
                                >
                                    {t('invoices_btn_close', 'Close')}
                                </Button>
                            </Box>
                        </Box>

                        <Box sx={{
                            p: { xs: 2, md: 6 },
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            minHeight: 'calc(100vh - 64px)'
                        }}>
                            <Paper elevation={4} sx={{
                                width: '210mm',
                                minHeight: '297mm',
                                bgcolor: 'white',
                                p: 0,
                                overflow: 'hidden',
                                borderRadius: 1
                            }} className="print:shadow-none print:m-0 print:w-full print:p-0">
                                <PrintView invoice={viewInvoice} />
                            </Paper>
                        </Box>

                        <style>{`
                            @media print {
                                @page { size: A4; margin: 0; }
                                body * { visibility: hidden; }
                                .print-container, .print-container * { visibility: visible; }
                                .print-container { position: absolute; left: 0; top: 0; width: 100%; min-height: 100%; box-shadow: none !important; margin: 0 !important; }
                                .print-color-adjust { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                thead { display: table-row-group; }
                                .print\\:break-inside-avoid {
                                    break-inside: avoid;
                                    page-break-inside: avoid;
                                }
                            }
                        `}</style>
                    </Dialog>
                )}

                {/* Create/Edit Invoice Dialog */}
                {isCreateMode && (
                    <Dialog
                        fullScreen
                        open={true}
                        onClose={() => { setIsCreateMode(false); setEditingInvoice(null); }}
                        PaperProps={{ sx: { bgcolor: 'background.paper' } }}
                    >
                        {/* Sticky Header */}
                        <Box sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 10,
                            bgcolor: 'background.paper',
                            borderBottom: 1,
                            borderColor: 'divider',
                            p: 2,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                            <Typography variant="h5" fontWeight="bold" color="primary">
                                {editingInvoice ? `${t('common.invoices_edit', 'Edit Invoice')} #${String(editingInvoice.ID).padStart(8, '0')} ` : t('invoices_create_title', 'Create New Invoice')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Button
                                    onClick={() => { setIsCreateMode(false); setEditingInvoice(null); }}
                                    variant="outlined"
                                    color="inherit"
                                >
                                    {t('common.cancel')}
                                </Button>
                                <ButtonGroup variant="contained" ref={(node) => { if (node) {/* ref logic if needed */ } }} aria-label="split button">
                                    <Button
                                        disabled={isSaving}
                                        onClick={() => handleSave(editingInvoice ? 'update' : 'create')}
                                        startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : null}
                                        sx={{ px: 3, fontWeight: 'bold' }}
                                    >
                                        {t('common.save')}
                                    </Button>
                                    <Button
                                        size="small"
                                        aria-controls={Boolean(saveMenuAnchorEl) ? 'split-button-menu' : undefined}
                                        aria-expanded={Boolean(saveMenuAnchorEl) ? 'true' : undefined}
                                        aria-label="select merge strategy"
                                        aria-haspopup="menu"
                                        disabled={isSaving}
                                        onClick={(event) => setSaveMenuAnchorEl(event.currentTarget)}
                                    >
                                        <ArrowDropDownIcon />
                                    </Button>
                                </ButtonGroup>
                                <Menu
                                    id="split-button-menu"
                                    anchorEl={saveMenuAnchorEl}
                                    open={Boolean(saveMenuAnchorEl)}
                                    onClose={() => setSaveMenuAnchorEl(null)}
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                                >
                                    <MenuItem
                                        onClick={() => {
                                            handleSave(editingInvoice ? 'update' : 'create');
                                            setSaveMenuAnchorEl(null);
                                        }}
                                    >
                                        {t('common.save', 'Save')} ({editingInvoice ? t('common.overwrite', 'Overwrite') : t('common.create_new', 'New')})
                                    </MenuItem>
                                    {editingInvoice && (
                                        <MenuItem
                                            onClick={() => {
                                                handleSave('create');
                                                setSaveMenuAnchorEl(null);
                                            }}
                                        >
                                            {t('common.save_as_new', 'Save as New')}
                                        </MenuItem>
                                    )}
                                </Menu>
                            </Box>
                        </Box>

                        <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 'lg', mx: 'auto', width: '100%', overflowY: 'auto' }}>
                            <Paper sx={{ p: 4, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                                <Grid container spacing={3} sx={{ mb: 4 }}>
                                    {editingInvoice && (
                                        <Grid size={{ xs: 12, md: 2 }}>
                                            <TextField
                                                select
                                                fullWidth
                                                label={t('invoices_status')}
                                                value={manualStatus}
                                                onChange={(e) => setManualStatus(e.target.value as any)}
                                            >
                                                <MenuItem value="Unpaid">{t('status_unpaid')}</MenuItem>
                                                <MenuItem value="Sent">{t('status_sent')}</MenuItem>
                                                <MenuItem value="Paid">{t('status_paid')}</MenuItem>
                                            </TextField>
                                        </Grid>
                                    )}
                                    <Grid size={{ xs: 6, md: editingInvoice ? 2 : 3 }}>
                                        <TextField
                                            label={t('invoices_manual_id')}
                                            value={manualId}
                                            onChange={(e) => setManualId(e.target.value)}
                                            fullWidth
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: editingInvoice ? 4 : 5 }}>
                                        <Autocomplete
                                            options={clients.filter(c => c.IsActive)}
                                            getOptionLabel={(option) => option.Name}
                                            value={clients.find(c => c.ID === selectedClientId) || null}
                                            onChange={(_, val) => {
                                                setSelectedClientId(val?.ID || null);
                                                setItems([]);
                                            }}
                                            renderInput={(params) => <TextField {...params} label={t('invoices_client')} required fullWidth />}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 6, md: 2 }}>
                                        <TextField
                                            type="date"
                                            fullWidth
                                            label={t('invoices_date')}
                                            InputLabelProps={{ shrink: true }}
                                            value={invoiceDate}
                                            onChange={(e) => setInvoiceDate(e.target.value)}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 6, md: 2 }}>
                                        <TextField
                                            type="date"
                                            fullWidth
                                            label={t('invoices_due_date')}
                                            InputLabelProps={{ shrink: true }}
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                        />
                                    </Grid>
                                </Grid>


                                <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: 1 }}>
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: 'grey.50' }}>
                                            <TableRow>
                                                <TableCell width={120}>{t('invoices_date')}</TableCell>
                                                <TableCell>{t('products_name')}</TableCell>
                                                <TableCell width={80}>{t('invoices_quantity')}</TableCell>
                                                <TableCell width={80}>{t('invoices_unit')}</TableCell>
                                                <TableCell width={120}>{t('invoices_unit_price')}</TableCell>
                                                <TableCell width={120} align="right">{t('invoices_total')}</TableCell>
                                                <TableCell width={50}></TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {items.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                                        {t('common.no_items_added')}
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                items.map((item, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell>
                                                            <TextField
                                                                type="date"
                                                                value={item.ItemDate}
                                                                onChange={e => updateItem(idx, 'ItemDate', e.target.value)}
                                                                fullWidth size="small" variant="standard"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <TextField
                                                                value={item.ProductName}
                                                                onChange={e => updateItem(idx, 'ProductName', e.target.value)}
                                                                fullWidth size="small" variant="standard" sx={{ mb: 0.5 }}
                                                            />
                                                            <TextField
                                                                value={item.Remarks || ''}
                                                                onChange={e => updateItem(idx, 'Remarks', e.target.value)}
                                                                fullWidth size="small" variant="standard"
                                                                placeholder={t('common.remarks_hint')}
                                                                sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', color: 'text.secondary' } }}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <TextField
                                                                type="number"
                                                                value={item.Quantity}
                                                                onChange={e => updateItem(idx, 'Quantity', Number(e.target.value))}
                                                                fullWidth size="small" variant="standard"
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                <Autocomplete
                                                                    freeSolo
                                                                    options={units.map(u => u.Name)}
                                                                    value={item.Unit || ''}
                                                                    onInputChange={(_, val) => updateItem(idx, 'Unit', val)}
                                                                    renderInput={(params) => (
                                                                        <TextField
                                                                            {...params}
                                                                            fullWidth
                                                                            size="small"
                                                                            variant="standard"
                                                                        />
                                                                    )}
                                                                    fullWidth
                                                                />
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => setIsUnitManagerOpen(true)}
                                                                    sx={{ ml: 0.5, p: 0.5 }}
                                                                    title={t('unit_manage', 'Manage Units')}
                                                                >
                                                                    <SettingsIcon fontSize="small" sx={{ fontSize: '1rem' }} />
                                                                </IconButton>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell>
                                                            <TextField
                                                                type="number"
                                                                value={item.UnitPrice}
                                                                onChange={e => updateItem(idx, 'UnitPrice', Number(e.target.value))}
                                                                fullWidth size="small" variant="standard"
                                                                InputProps={{ startAdornment: <Typography variant="caption" sx={{ mr: 0.5 }}>¥</Typography> }}
                                                            />
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Typography variant="body2" fontWeight="medium">
                                                                ¥{(item.Quantity * item.UnitPrice).toLocaleString()}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <IconButton size="small" color="error" onClick={() => removeItem(idx)}><DeleteIcon fontSize="inherit" /></IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>

                                {/* Item Search & Add Line */}
                                <Box sx={{ mb: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Autocomplete
                                            freeSolo
                                            value={null}
                                            options={availableProducts}
                                            inputValue={searchTerm}
                                            getOptionLabel={(option) => typeof option === 'string' ? option : `${option.Name} (${option.Code || '-'})`}
                                            onInputChange={(_, newInputValue, reason) => {
                                                if (reason !== 'reset') {
                                                    setSearchTerm(newInputValue);
                                                }
                                            }}
                                            onChange={(_, newValue) => {
                                                if (typeof newValue !== 'string' && newValue) {
                                                    addItem(newValue);
                                                    setSearchTerm('');
                                                }
                                            }}
                                            renderOption={(props, option) => (
                                                <li {...props} key={option.ID} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px' }}>
                                                    <div>
                                                        <Typography variant="body2" color="text.primary">{option.Name}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {option.Code} | {t('common.stock_display', { stock: option.Stock })}
                                                        </Typography>
                                                    </div>
                                                    <Typography variant="body2" color="secondary" sx={{ fontFamily: 'monospace' }}>
                                                        ¥{option.UnitPrice.toLocaleString()}
                                                    </Typography>
                                                </li>
                                            )}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label={t('products_search_placeholder')}
                                                    fullWidth
                                                    placeholder={t('common.search_hint')}
                                                    disabled={!selectedClientId}
                                                    size="small"
                                                    InputProps={{ ...params.InputProps, startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} /> }}
                                                />
                                            )}
                                        />
                                    </Box>
                                    <Button
                                        variant="outlined"
                                        startIcon={<AddIcon />}
                                        onClick={() => addItem({
                                            ID: 0,
                                            Name: '',
                                            Code: '',
                                            UnitPrice: 0,
                                            Stock: 0,
                                            IsActive: true,
                                            Project: '',
                                            TaxRate: 10
                                        })}
                                        sx={{ whiteSpace: 'nowrap', height: 40 }}
                                    >
                                        {t('invoices_add_line', 'Add Line')}
                                    </Button>
                                </Box>

                                <Grid container spacing={4}>
                                    <Grid size={{ xs: 12, md: 7 }}>
                                        <Typography variant="subtitle2" gutterBottom color="text.secondary">{t('invoices_remarks')}</Typography>
                                        <TextField
                                            multiline
                                            rows={4}
                                            fullWidth
                                            value={remarks}
                                            onChange={e => setRemarks(e.target.value)}
                                            placeholder={t('common.remarks_hint')}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 5 }}>
                                        <Box sx={{
                                            p: 3,
                                            bgcolor: 'background.paper',
                                            borderRadius: 2,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                            textAlign: 'right'
                                        }}>
                                            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1 }}>{t('common.total', 'Total')}</Typography>
                                            <Typography variant="h3" fontWeight="bold" color="primary">
                                                ¥{calculateTotal().toLocaleString()}
                                            </Typography>
                                            <Box sx={{ mt: 1, color: 'text.secondary', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                <Typography variant="caption">
                                                    {t('invoices_subtotal', 'Subtotal')}: ¥{calculateTaxSummary().subtotal.toLocaleString()}
                                                </Typography>
                                                <Typography variant="caption">
                                                    {t('invoices_tax_total', 'Tax')}: ¥{calculateTaxSummary().totalTax.toLocaleString()}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Box>
                    </Dialog >
                )}



                {/* Unit Manager Dialog */}
                <Dialog open={isUnitManagerOpen} onClose={() => setIsUnitManagerOpen(false)} maxWidth="xs" fullWidth>
                    <Box sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>{t('unit_manage', 'Manage Units')}</Typography>
                        <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                            {units.length === 0 ? <Typography variant="body2" color="text.secondary">{t('units_no_saved', 'No saved units.')}</Typography> : (
                                units.map(u => (
                                    <Box key={u.ID} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1, borderBottom: '1px solid #eee' }}>
                                        <Typography>{u.Name}</Typography>
                                        <IconButton size="small" color="error" onClick={() => {
                                            setConfirmDialog({
                                                open: true,
                                                title: t('common.delete', 'Delete Unit'),
                                                message: t('common.delete_confirm', { item: u.Name }),
                                                onConfirm: async () => {
                                                    setIsDeleting(true);
                                                    try {
                                                        await unitService.delete(u.ID);
                                                        const updated = await unitService.getAll();
                                                        setUnits(updated);
                                                        setConfirmDialog(p => ({ ...p, open: false }));
                                                    } finally {
                                                        setIsDeleting(false);
                                                    }
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
                    loading={isDeleting}
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
        </PageTransition >
    );
};

export default Invoices;
