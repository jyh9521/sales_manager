import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Estimate, estimateService } from '../services/estimates';
import { InvoiceItem, invoiceService } from '../services/invoices';
import { Client, clientService } from '../services/clients';
import { Product, productService } from '../services/products';
import { AppSettings, defaultSettings, settingsService } from '../services/settings';
import {
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Button, TextField, IconButton, MenuItem, Box, Typography,
    Grid, Autocomplete, Dialog, TablePagination,
    Chip, Checkbox
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
    Search as SearchIcon,
    Print as PrintIcon,
    Edit as EditIcon,
    Transform as TransformIcon
} from '@mui/icons-material';
import { Snackbar, Alert, Backdrop, CircularProgress } from '@mui/material';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingOverlay from '../components/LoadingOverlay';
import PageTransition from '../components/PageTransition';
import { motion } from 'framer-motion';
import { containerVariants, itemVariants } from '../utils/animations';

const Estimates = () => {
    const { t } = useTranslation();
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);

    // 筛选
    const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));
    const [statusFilter, setStatusFilter] = useState<string>('All');

    // 状态
    const [isCreateMode, setIsCreateMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [viewEstimate, setViewEstimate] = useState<Estimate | null>(null);
    const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
    const [manualId, setManualId] = useState<string>('');
    const [manualStatus, setManualStatus] = useState<'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Converted'>('Draft');
    const [selectedEstimateIds, setSelectedEstimateIds] = useState<Set<number>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    // 表单状态
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [estimateDate, setEstimateDate] = useState(new Date().toISOString().slice(0, 10));
    const [validUntil, setValidUntil] = useState<string>('');
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [remarks, setRemarks] = useState('');

    // 分页
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            const newSelecteds = new Set(selectedEstimateIds);
            visibleEstimates.forEach(n => newSelecteds.add(n.ID));
            setSelectedEstimateIds(newSelecteds);
        } else {
            const newSelecteds = new Set(selectedEstimateIds);
            visibleEstimates.forEach(n => newSelecteds.delete(n.ID));
            setSelectedEstimateIds(newSelecteds);
        }
    };

    const handleSelect = (id: number) => {
        const newSelecteds = new Set(selectedEstimateIds);
        if (newSelecteds.has(id)) {
            newSelecteds.delete(id);
        } else {
            newSelecteds.add(id);
        }
        setSelectedEstimateIds(newSelecteds);
    };

    const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const [searchTerm, setSearchTerm] = useState('');

    const [isConverting, setIsConverting] = useState(false);

    const [toast, setToast] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'info' | 'warning' }>({
        open: false, message: '', severity: 'info'
    });
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean,
        title?: string,
        message: string,
        onConfirm: () => void,
        onCancel?: () => void,
        confirmLabel?: string,
        cancelLabel?: string,
        confirmColor?: 'error' | 'primary'
    }>({
        open: false, message: '', onConfirm: () => { }
    });

    const showToast = (message: string, severity: 'success' | 'error' = 'success') => {
        setToast({ open: true, message, severity });
    };
    const handleCloseToast = () => setToast({ ...toast, open: false });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        const [eData, cData, pData, sData] = await Promise.all([
            estimateService.getAll(),
            clientService.getAll(),
            productService.getAll(),
            settingsService.get()
        ]);
        setEstimates(eData);
        setClients(cData);
        setProducts(pData);
        setSettings(sData);
        setLoading(false);
    };

    const toLocalYMD = (val: Date | string) => {
        if (!val) return '';
        const d = new Date(val);
        return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    };

    const handleCreateNew = () => {
        setIsCreateMode(true);
        setEditingEstimate(null);
        setItems([]);
        const nextId = estimates.length > 0 ? Math.max(...estimates.map(i => i.ID)) + 1 : 1;
        setManualId(String(nextId));
        setManualStatus('Draft');
        setEstimateDate(toLocalYMD(new Date()));

        const today = new Date();
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setValidUntil(toLocalYMD(lastDayOfMonth));
        setRemarks('');
        setSelectedClientId(null);
    };

    const handleSave = async (action: 'create' | 'update') => {
        if (!selectedClientId) { showToast(t('validation_select_client'), 'error'); return; }
        if (items.length === 0) { showToast(t('validation_add_item'), 'error'); return; }

        const total = items.reduce((sum, item) => sum + (item.UnitPrice * item.Quantity), 0);
        const idToUse = Number(manualId);

        if (action === 'create' && estimates.some(i => i.ID === idToUse)) {
            showToast(t('validation_id_exists', { id: idToUse }), 'error');
            return;
        }

        const newEstimate: any = {
            ID: idToUse,
            ClientID: selectedClientId,
            EstimateDate: estimateDate,
            ValidUntil: validUntil,
            Items: items,
            TotalAmount: total,
            Status: manualStatus,
            Remarks: remarks
        };

        try {
            setIsSaving(true);
            await estimateService.save(newEstimate);
            showToast(action === 'update' ? t('estimates_updated') : t('estimates_created'));
            setIsCreateMode(false);
            setEditingEstimate(null);
            await loadData();
        } catch (e: any) {
            showToast(e.message || t('common.error'), 'error');
            console.error('Save Estimate Error:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (estimate: Estimate) => {
        setEditingEstimate(estimate);
        setManualId(String(estimate.ID));
        setManualStatus(estimate.Status);
        setViewEstimate(null);
        setIsCreateMode(true);

        setSelectedClientId(estimate.ClientID);
        setEstimateDate(toLocalYMD(estimate.EstimateDate));
        setValidUntil(estimate.ValidUntil ? toLocalYMD(estimate.ValidUntil) : '');
        setItems((estimate.Items as any) || []);
        setRemarks(estimate.Remarks || '');
    };

    const handleBulkDelete = () => {
        setConfirmDialog({
            open: true,
            title: t('common.bulk_delete_confirm_title', 'Bulk Delete'),
            message: t('common.bulk_delete_confirm_msg', 'Are you sure you want to delete the selected items?'),
            onConfirm: async () => {
                setIsDeleting(true);
                try {
                    const ids = Array.from(selectedEstimateIds);
                    for (const id of ids) {
                        await estimateService.delete(id);
                    }
                    setSelectedEstimateIds(new Set());
                    setConfirmDialog(p => ({ ...p, open: false }));
                    showToast(t('estimates_bulk_deleted', 'Selected estimates deleted'));
                    loadData();
                } catch (e) {
                    console.error(e);
                    showToast(t('common.error'), 'error');
                } finally {
                    setIsDeleting(false);
                }
            },
            confirmColor: 'error'
        });
    };

    const handleDelete = (id: number) => {
        setConfirmDialog({
            open: true,
            title: t('common.delete', 'Delete'),
            message: t('common.confirm_delete', 'Are you sure?'),
            onConfirm: async () => {
                await estimateService.delete(id);
                setConfirmDialog(p => ({ ...p, open: false }));
                showToast(t('estimates_deleted', 'Estimate deleted'));
                loadData();
            }
        });
    };

    const handleConvert = (estimate: Estimate) => {
        setConfirmDialog({
            open: true,
            title: t('estimates_convert_confirm_title', 'Convert to Invoice'),
            message: t('estimates_convert_confirm_msg', 'Create a new invoice from this estimate?'),
            confirmLabel: t('estimates_convert', 'Convert'),
            cancelLabel: t('common.cancel', 'Cancel'),
            confirmColor: 'primary',
            onConfirm: async () => {
                setConfirmDialog(p => ({ ...p, open: false })); // Close confirm dialog
                setIsConverting(true); // Start loading

                try {
                    const today = new Date();
                    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    const formattedDueDate = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

                    const invoiceData = {
                        ClientID: estimate.ClientID,
                        InvoiceDate: new Date().toISOString().slice(0, 10),
                        DueDate: formattedDueDate,
                        Items: estimate.Items,
                        TotalAmount: estimate.TotalAmount,
                        Status: 'Unpaid'
                    };

                    // @ts-ignore
                    const invId = await invoiceService.create(invoiceData);

                    // 给数据库同步留一点时间
                    await new Promise(r => setTimeout(r, 800));

                    setIsConverting(false); // Stop loading

                    if (invId) {
                        // 关键：强制关闭预览/编辑模式，回到列表页，这样 ConfirmDialog 才能渲染
                        setViewEstimate(null);
                        setIsCreateMode(false);

                        await estimateService.save({ ...estimate, Status: 'Converted' });
                        showToast(t('estimates_converted_success', { id: invId }));
                        await loadData();

                        // 询问用户是否要删除原始估价单
                        setConfirmDialog({
                            open: true,
                            title: t('delete_estimate_prompt_title', 'Delete Original Estimate?'),
                            message: t('delete_estimate_prompt_msg', 'The invoice has been created. Do you want to delete the original estimate?'),
                            confirmLabel: t('delete_estimate_prompt_delete', 'Delete Estimate'),
                            cancelLabel: t('delete_estimate_prompt_keep', 'Keep Estimate'),
                            confirmColor: 'error',
                            onConfirm: async () => {
                                await estimateService.delete(estimate.ID);
                                showToast(t('estimates_deleted'), 'success');
                                setConfirmDialog(p => ({ ...p, open: false }));
                                window.dispatchEvent(new CustomEvent('navigate-to', { detail: 'invoices' }));
                            },
                            onCancel: () => {
                                setConfirmDialog(p => ({ ...p, open: false }));
                                window.dispatchEvent(new CustomEvent('navigate-to', { detail: 'invoices' }));
                            }
                        });
                    } else {
                        throw new Error("Creation failed: No ID returned");
                    }
                } catch (e: any) {
                    setIsConverting(false);
                    console.error(e);
                    showToast(`${t('estimates_conversion_failed')}: ${e.message || e}`, 'error');
                    // 出错时，不进行导航
                }
            }
        });
    };

    const addItem = (product?: Product) => {
        const newItem: InvoiceItem = {
            ProductID: product?.ID || 0,
            ProductName: product?.Name || '',
            Quantity: 1,
            UnitPrice: product?.UnitPrice || 0,
            Project: product?.Project,
            ItemDate: estimateDate,
            Unit: '',
            Remarks: '',
            TaxRate: product?.TaxRate || 10
        };
        setItems([...items, newItem]);
        setSearchTerm('');
    };

    const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const filteredEstimates = estimates.filter(est => {
        const estMonth = new Date(est.EstimateDate).toISOString().slice(0, 7);
        const matchesMonth = monthFilter ? estMonth === monthFilter : true;
        const matchesStatus = statusFilter === 'All' ? true : est.Status === statusFilter;
        return matchesMonth && matchesStatus;
    }).sort((a, b) => b.ID - a.ID);

    const visibleEstimates = filteredEstimates.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const PrintView = ({ estimate }: { estimate: Estimate }) => {
        const client = clients.find(c => c.ID === estimate.ClientID);
        const items = (estimate.Items as any) || [];
        const total = estimate.TotalAmount;

        return (
            <div className="print-container bg-white text-black p-8 max-w-[210mm] mx-auto min-h-[297mm] relative text-sm">
                <div className="bg-green-700 text-white text-center py-2 text-2xl font-bold tracking-[1em] mb-8 print:bg-green-700 print-color-adjust">
                    {t('estimates_title', '見積書')}
                </div>
                <div className="flex justify-between items-start mb-8">
                    <div className="w-[55%]">
                        <div className="text-xl border-b-2 border-black pb-2 mb-4 inline-block min-w-[300px]">
                            {client?.Name} <span className="text-sm ml-2">御中</span>
                        </div>
                        <div className="mt-4">
                            <p className="mb-2">下記の通りお見積り申し上げます。</p>
                            <div className="border-2 border-green-700 rounded flex overflow-hidden">
                                <div className="bg-green-700 text-white px-4 py-2 flex items-center justify-center font-bold min-w-[120px] print:bg-green-700 print-color-adjust">見積金額</div>
                                <div className="flex-1 flex items-center justify-end px-4 text-2xl font-bold tracking-wider">¥{total.toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="mt-4 text-sm">
                            <p><strong>{t('estimates_valid_until', '有効期限')}:</strong> {estimate.ValidUntil ? new Date(estimate.ValidUntil).toLocaleDateString() : '-'}</p>
                        </div>
                    </div>
                    <div className="w-[40%] text-right">
                        <div className="space-y-1 text-xs">
                            <div className="grid grid-cols-[80px_1fr] mb-2">
                                <span className="text-gray-500">発行日</span>
                                <span>{new Date(estimate.EstimateDate).toLocaleDateString()}</span>
                            </div>
                            <div className="grid grid-cols-[80px_1fr] mb-6">
                                <span className="text-gray-500">見積番号</span>
                                <span>{String(estimate.ID).padStart(8, '0')}</span>
                            </div>
                        </div>
                        <div className="text-left pl-8 relative">
                            <div className="absolute top-0 right-4 w-16 h-16 border border-red-300 rounded-full opacity-30 flex items-center justify-center text-red-500 text-xs rotate-[-15deg] print:border-red-300">印</div>
                            <h4 className="text-lg font-bold mb-1">{settings.CompanyName}</h4>
                            <div className="text-xs space-y-0.5 text-gray-700">
                                <p>{settings.ZipCode}</p>
                                <p>{settings.Address}</p>
                                <p>TEL: {settings.Phone}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <table className="w-full border-collapse border border-green-700 text-xs mb-4">
                    <thead>
                        <tr className="bg-green-700 text-white print:bg-green-700 print-color-adjust">
                            <th className="border border-green-500 py-1 px-2">内訳</th>
                            <th className="border border-green-500 py-1 px-2 w-12">数量</th>
                            <th className="border border-green-500 py-1 px-2 w-12">単位</th>
                            <th className="border border-green-500 py-1 px-2 w-20">単価</th>
                            <th className="border border-green-500 py-1 px-2 w-24">金額</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item: any, idx: number) => (
                            <tr key={idx}>
                                <td className="border border-green-700 py-1 px-2">{item.ProductName} {item.Remarks ? `(${item.Remarks})` : ''}</td>
                                <td className="border border-green-700 py-1 text-center">{item.Quantity}</td>
                                <td className="border border-green-700 py-1 text-center">{item.Unit}</td>
                                <td className="border border-green-700 py-1 text-right px-2">¥{item.UnitPrice.toLocaleString()}</td>
                                <td className="border border-green-700 py-1 text-right px-2">¥{(item.Quantity * item.UnitPrice).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="mt-8 border border-green-700 rounded min-h-[100px] p-2">
                    <div className="bg-green-700 text-white text-xs px-2 py-0.5 inline-block rounded mb-2 print:bg-green-700 print-color-adjust">備考</div>
                    <p className="text-xs">{estimate.Remarks}</p>
                </div>
            </div>
        );
    };

    return (
        <PageTransition>
            <Box sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, alignItems: 'center' }}>
                    <Typography variant="h4" fontWeight="bold">{t('estimates_title', 'Estimates')}</Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <TextField
                            size="small"
                            type="month"
                            label={t('estimates_filter_month')}
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            sx={{ width: 150 }}
                        />
                        <TextField
                            select
                            size="small"
                            label={t('estimates_filter_status')}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            sx={{ width: 120 }}
                        >
                            <MenuItem value="All">{t('common.all')}</MenuItem>
                            <MenuItem value="Draft">{t('estimates_status_draft')}</MenuItem>
                            <MenuItem value="Sent">{t('estimates_status_sent')}</MenuItem>
                            <MenuItem value="Accepted">{t('estimates_status_accepted')}</MenuItem>
                            <MenuItem value="Rejected">{t('estimates_status_rejected')}</MenuItem>
                            <MenuItem value="Converted">{t('estimates_status_converted')}</MenuItem>
                        </TextField>
                        {selectedEstimateIds.size > 0 && (
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
                                disabled={isDeleting}
                                onClick={handleBulkDelete}
                            >
                                {t('common.delete')} ({selectedEstimateIds.size})
                            </Button>
                        )}
                        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateNew}>{t('estimates_create_title', 'Create New')}</Button>
                    </Box>
                </Box>

                <TableContainer component={Paper}>
                    <Table>
                        <TableHead sx={{ bgcolor: 'grey.100' }}>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        indeterminate={visibleEstimates.length > 0 && Array.from(visibleEstimates).some(p => selectedEstimateIds.has(p.ID)) && !visibleEstimates.every(p => selectedEstimateIds.has(p.ID))}
                                        checked={visibleEstimates.length > 0 && visibleEstimates.every(p => selectedEstimateIds.has(p.ID))}
                                        onChange={handleSelectAll}
                                        color="primary"
                                    />
                                </TableCell>
                                <TableCell>{t('estimates_id')}</TableCell>
                                <TableCell>{t('estimates_date')}</TableCell>
                                <TableCell>{t('estimates_client')}</TableCell>
                                <TableCell align="right">{t('estimates_amount')}</TableCell>
                                <TableCell align="center">{t('estimates_status')}</TableCell>
                                <TableCell align="right">{t('estimates_actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody component={motion.tbody} variants={containerVariants} initial="hidden" animate="visible">
                            {visibleEstimates.map(est => {
                                const isSelected = selectedEstimateIds.has(est.ID);
                                return (
                                    <TableRow key={est.ID} component={motion.tr} variants={itemVariants} hover selected={isSelected}>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={isSelected}
                                                onChange={() => handleSelect(est.ID)}
                                                color="primary"
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 'medium' }}>#{est.ID}</TableCell>
                                        <TableCell>{new Date(est.EstimateDate).toLocaleDateString()}</TableCell>
                                        <TableCell>{est.ClientName || '-'}</TableCell>
                                        <TableCell align="right">¥{est.TotalAmount.toLocaleString()}</TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={t(`estimates_status_${est.Status.toLowerCase()}`, est.Status)}
                                                color={est.Status === 'Converted' ? 'success' : est.Status === 'Sent' ? 'primary' : 'default'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" onClick={() => setViewEstimate(est)}><VisibilityIcon /></IconButton>
                                            <IconButton size="small" onClick={() => handleEdit(est)}><EditIcon /></IconButton>
                                            <IconButton size="small" color="error" onClick={() => handleDelete(est.ID)}><DeleteIcon /></IconButton>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25]}
                        component="div"
                        count={filteredEstimates.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        labelRowsPerPage={t('common.rows_per_page')}
                    />
                </TableContainer>

                {/* Create/Edit Dialog */}
                <Dialog
                    fullScreen
                    open={isCreateMode}
                    onClose={() => setIsCreateMode(false)}
                    PaperProps={{ sx: { bgcolor: 'background.paper' } }}
                >
                    {/* Sticky Header for Create/Edit */}
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        p: 2,
                        px: 4,
                        bgcolor: 'background.paper',
                        borderBottom: 1,
                        borderColor: 'divider',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                        <Typography variant="h6" fontWeight="bold" color="primary">
                            {editingEstimate ? `${t('estimates_title')} #${manualId}` : t('estimates_create_title')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button variant="outlined" color="inherit" onClick={() => setIsCreateMode(false)}>{t('common.cancel')}</Button>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => handleSave(editingEstimate ? 'update' : 'create')}
                                disabled={isSaving}
                                startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : null}
                            >
                                {t('estimates_save_btn')}
                            </Button>
                        </Box>
                    </Box>

                    <Box sx={{ p: 4, maxWidth: 'lg', mx: 'auto', width: '100%', mb: 8 }}>
                        <Paper sx={{ p: 4, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>

                            <Grid container spacing={3} sx={{ mb: 4 }}>
                                <Grid size={{ xs: 12, md: 4 }}>
                                    <Autocomplete
                                        options={clients.filter(c => c.IsActive)}
                                        getOptionLabel={c => c.Name}
                                        value={clients.find(c => c.ID === selectedClientId) || null}
                                        onChange={(_, val) => setSelectedClientId(val?.ID || null)}
                                        renderInput={(params) => <TextField {...params} label={t('estimates_client')} required variant="outlined" fullWidth />}
                                    />
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                    <TextField
                                        type="date"
                                        label={t('estimates_date')}
                                        value={estimateDate}
                                        onChange={e => setEstimateDate(e.target.value)}
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 6, md: 3 }}>
                                    <TextField
                                        type="date"
                                        label={t('estimates_valid_until')}
                                        value={validUntil}
                                        onChange={e => setValidUntil(e.target.value)}
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 2 }}>
                                    <TextField
                                        select
                                        label={t('estimates_status')}
                                        value={manualStatus}
                                        onChange={e => setManualStatus(e.target.value as any)}
                                        fullWidth
                                    >
                                        {['Draft', 'Sent', 'Accepted', 'Rejected', 'Converted'].map(s => (
                                            <MenuItem key={s} value={s}>{t(`estimates_status_${s.toLowerCase()}`, s)}</MenuItem>
                                        ))}
                                    </TextField>
                                </Grid>
                            </Grid>

                            <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: 1 }}>
                                <Table size="small">
                                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                                        <TableRow>
                                            <TableCell>{t('estimates_item_product')}</TableCell>
                                            <TableCell width={100}>{t('estimates_item_qty')}</TableCell>
                                            <TableCell width={140}>{t('estimates_item_price')}</TableCell>
                                            <TableCell width={140} align="right">{t('estimates_item_total')}</TableCell>
                                            <TableCell width={50}></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {items.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                                    {t('common.no_items_added')}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            items.map((item, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell sx={{ minWidth: 200 }}>
                                                        <TextField
                                                            value={item.ProductName}
                                                            onChange={e => updateItem(idx, 'ProductName', e.target.value)}
                                                            fullWidth size="small"
                                                            variant="standard"
                                                            sx={{ mb: 0.5 }}
                                                        />
                                                        <TextField
                                                            value={item.Remarks || ''}
                                                            onChange={e => updateItem(idx, 'Remarks', e.target.value)}
                                                            fullWidth size="small"
                                                            variant="standard"
                                                            placeholder={t('estimates_item_remarks_placeholder')}
                                                            sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', color: 'text.secondary' } }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            type="number"
                                                            value={item.Quantity}
                                                            onChange={e => updateItem(idx, 'Quantity', Number(e.target.value))}
                                                            fullWidth size="small"
                                                            variant="standard"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            type="number"
                                                            value={item.UnitPrice}
                                                            onChange={e => updateItem(idx, 'UnitPrice', Number(e.target.value))}
                                                            fullWidth size="small"
                                                            variant="standard"
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

                            <Box sx={{ mb: 4, display: 'flex', gap: 2, alignItems: 'center' }}>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Autocomplete
                                        freeSolo
                                        value={null}
                                        options={products.filter(p => p.Name.toLowerCase().includes(searchTerm.toLowerCase()))}
                                        inputValue={searchTerm}
                                        getOptionLabel={(option) => typeof option === 'string' ? option : `${option.Name} (${option.Code || '-'})`}
                                        onInputChange={(_, val) => setSearchTerm(val)}
                                        onChange={(_, val) => {
                                            if (typeof val !== 'string' && val) {
                                                addItem(val);
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
                                                label={t('products_search_placeholder', 'Search Product')}
                                                fullWidth
                                                placeholder={t('common.search_hint')}
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
                                        IsActive: true
                                    } as any)}
                                    sx={{ whiteSpace: 'nowrap', height: 40 }}
                                >
                                    {t('common.add_line', 'Add Line')}
                                </Button>
                            </Box>

                            <Grid container spacing={4}>
                                <Grid size={{ xs: 12, md: 7 }}>
                                    <TextField
                                        label={t('estimates_remarks')}
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
                                            ¥{items.reduce((sum, item) => sum + (item.UnitPrice * item.Quantity), 0).toLocaleString()}
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Paper>
                    </Box>
                </Dialog>

                {/* Preview Dialog */}
                <Dialog fullScreen open={Boolean(viewEstimate)} onClose={() => setViewEstimate(null)}>
                    {viewEstimate && (
                        <div className="flex flex-col items-center p-4 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-y-auto w-full">
                            <div className="w-full max-w-4xl flex justify-between items-center mb-6 print:hidden sticky top-0 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm z-10 py-3 px-6 rounded-b-xl border-x border-b border-gray-200 dark:border-gray-700 shadow-lg transition-all duration-300">
                                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('estimates_preview', 'Preview')}</h2>
                                <div className="flex gap-2">
                                    <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>{t('common.print')}</Button>
                                    <Button variant="contained" color="secondary" startIcon={<EditIcon />} onClick={() => handleEdit(viewEstimate)}>{t('common.edit')}</Button>
                                    <Button variant="contained" color="primary" startIcon={<TransformIcon />} onClick={() => handleConvert(viewEstimate)}>{t('estimates_convert', 'Convert')}</Button>
                                    <Button variant="outlined" onClick={() => setViewEstimate(null)}>{t('common.close')}</Button>
                                </div>
                            </div>
                            <div className="bg-white shadow-2xl w-full max-w-[210mm] print:shadow-none mb-8">
                                <PrintView estimate={viewEstimate} />
                            </div>
                            <style>{`@media print { .print-container { position: absolute; left: 0; top: 0; width: 100%; margin: 0; } }`}</style>
                        </div>
                    )}
                </Dialog>

                <ConfirmDialog
                    open={confirmDialog.open}
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
                    confirmLabel={confirmDialog.confirmLabel}
                    cancelLabel={confirmDialog.cancelLabel}
                    confirmColor={confirmDialog.confirmColor}
                    loading={isDeleting}
                />

                <Snackbar open={toast.open} autoHideDuration={3000} onClose={handleCloseToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                    <Alert onClose={handleCloseToast} severity={toast.severity} variant="filled" sx={{ width: '100%' }}>{toast.message}</Alert>
                </Snackbar>

                <LoadingOverlay open={loading} />

                <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 101 }} open={isConverting}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, bgcolor: 'background.paper', p: 4, borderRadius: 2, color: 'text.primary' }}>
                        <CircularProgress color="primary" size={60} />
                        <Typography variant="h6">{t('converting', 'Converting...')}</Typography>
                    </Box>
                </Backdrop>
            </Box>
        </PageTransition>
    );
};

export default Estimates;
