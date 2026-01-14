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
    Chip
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

const Estimates = () => {
    const { t } = useTranslation();
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);

    // Filters
    const [monthFilter] = useState(new Date().toISOString().slice(0, 7));
    const [statusFilter] = useState<string>('All');

    // State
    const [isCreateMode, setIsCreateMode] = useState(false);
    const [viewEstimate, setViewEstimate] = useState<Estimate | null>(null);
    const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
    const [manualId, setManualId] = useState<string>('');
    const [manualStatus, setManualStatus] = useState<'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Converted'>('Draft');

    // Form State
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [estimateDate, setEstimateDate] = useState(new Date().toISOString().slice(0, 10));
    const [validUntil, setValidUntil] = useState<string>('');
    const [items, setItems] = useState<InvoiceItem[]>([]);
    const [remarks, setRemarks] = useState('');

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
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

        if (action === 'create') delete newEstimate.ID;

        await estimateService.save(newEstimate);
        showToast(action === 'update' ? t('estimates_updated') : t('estimates_created'));

        setIsCreateMode(false);
        setEditingEstimate(null);
        loadData();
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

                    // @ts-ignore - Create returns ID (number)
                    const invId = await invoiceService.create(invoiceData);

                    // Artificial delay for better UX (so spinner doesn't flash too fast)
                    await new Promise(r => setTimeout(r, 800));

                    setIsConverting(false); // Stop loading

                    if (invId) {
                        await estimateService.save({ ...estimate, Status: 'Converted' });
                        showToast(t('estimates_converted_success', { id: invId }));

                        // Ask if user wants to delete the original estimate
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
                    // On error, do not navigate
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

    const renderContent = () => {
        if (viewEstimate) {
            return (
                <Dialog fullScreen open={true} onClose={() => setViewEstimate(null)}>
                    <div className="flex flex-col items-center p-4 min-h-screen bg-gray-100 dark:bg-gray-900">
                        <div className="w-full max-w-4xl flex justify-between items-center mb-4 print:hidden sticky top-0 bg-gray-100 z-10 py-2">
                            <h2 className="text-xl font-bold">{t('estimates_preview', 'Preview')}</h2>
                            <div className="flex gap-2">
                                <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>{t('common.print')}</Button>
                                <Button variant="contained" color="secondary" startIcon={<EditIcon />} onClick={() => handleEdit(viewEstimate)}>{t('common.edit')}</Button>
                                <Button variant="contained" color="primary" startIcon={<TransformIcon />} onClick={() => handleConvert(viewEstimate)}>{t('estimates_convert', 'Convert')}</Button>
                                <Button variant="outlined" onClick={() => setViewEstimate(null)}>{t('common.close')}</Button>
                            </div>
                        </div>
                        <div className="bg-white shadow-2xl w-full max-w-[210mm] print:shadow-none">
                            <PrintView estimate={viewEstimate} />
                        </div>
                        <style>{`@media print { .print-container { position: absolute; left: 0; top: 0; width: 100%; margin: 0; } }`}</style>
                    </div>
                </Dialog>
            );
        }

        if (isCreateMode) {
            return (
                <Box sx={{ p: 4, maxWidth: 'lg', mx: 'auto', bgcolor: 'background.paper', borderRadius: 2, minHeight: '80vh' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
                        <Typography variant="h5">{editingEstimate ? `${t('estimates_title')} #${manualId}` : t('estimates_create_title')}</Typography>
                        <Button onClick={() => setIsCreateMode(false)} variant="outlined">{t('common.cancel')}</Button>
                    </Box>
                    <Grid container spacing={2} sx={{ mb: 4 }}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Autocomplete
                                options={clients.filter(c => c.IsActive)}
                                getOptionLabel={c => c.Name}
                                value={clients.find(c => c.ID === selectedClientId) || null}
                                onChange={(_, val) => setSelectedClientId(val?.ID || null)}
                                renderInput={(params) => <TextField {...params} label={t('estimates_client')} required />}
                            />
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                            <TextField type="date" label={t('estimates_date')} value={estimateDate} onChange={e => setEstimateDate(e.target.value)} fullWidth />
                        </Grid>
                        <Grid size={{ xs: 6, md: 3 }}>
                            <TextField type="date" label={t('estimates_valid_until')} value={validUntil} onChange={e => setValidUntil(e.target.value)} fullWidth />
                        </Grid>
                        <Grid size={{ xs: 12, md: 2 }}>
                            <TextField select label={t('estimates_status')} value={manualStatus} onChange={e => setManualStatus(e.target.value as any)} fullWidth>
                                {['Draft', 'Sent', 'Accepted', 'Rejected', 'Converted'].map(s => <MenuItem key={s} value={s}>{t(`estimates_status_${s.toLowerCase()}`, s)}</MenuItem>)}
                            </TextField>
                        </Grid>
                    </Grid>

                    <Box sx={{ mb: 2 }}>
                        <Autocomplete
                            freeSolo
                            options={products.filter(p => p.Name.toLowerCase().includes(searchTerm.toLowerCase()))}
                            getOptionLabel={(option) => typeof option === 'string' ? option : `${option.Name} (${option.Code || '-'})`}
                            renderInput={(params) => (
                                <TextField {...params} label={t('products_search_placeholder', 'Search Product')} fullWidth InputProps={{ ...params.InputProps, startAdornment: <SearchIcon color="action" /> }} />
                            )}
                            onInputChange={(_, val) => setSearchTerm(val)}
                            onChange={(_, val) => typeof val !== 'string' && val && addItem(val)}
                        />
                    </Box>

                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('estimates_item_product')}</TableCell>
                                    <TableCell width={100}>{t('estimates_item_qty')}</TableCell>
                                    <TableCell width={150}>{t('estimates_item_price')}</TableCell>
                                    <TableCell width={120}>{t('estimates_item_total')}</TableCell>
                                    <TableCell width={50}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {items.map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>
                                            <TextField value={item.ProductName} onChange={e => updateItem(idx, 'ProductName', e.target.value)} fullWidth size="small" placeholder={t('estimates_item_name_placeholder')} />
                                            <TextField value={item.Remarks || ''} onChange={e => updateItem(idx, 'Remarks', e.target.value)} fullWidth size="small" placeholder={t('estimates_item_remarks_placeholder')} sx={{ mt: 0.5 }} />
                                        </TableCell>
                                        <TableCell>
                                            <TextField type="number" value={item.Quantity} onChange={e => updateItem(idx, 'Quantity', Number(e.target.value))} fullWidth size="small" />
                                        </TableCell>
                                        <TableCell>
                                            <TextField type="number" value={item.UnitPrice} onChange={e => updateItem(idx, 'UnitPrice', Number(e.target.value))} fullWidth size="small" />
                                        </TableCell>
                                        <TableCell>¥{(item.Quantity * item.UnitPrice).toLocaleString()}</TableCell>
                                        <TableCell>
                                            <IconButton size="small" color="error" onClick={() => removeItem(idx)}><DeleteIcon /></IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <TextField label={t('estimates_remarks')} multiline rows={3} fullWidth value={remarks} onChange={e => setRemarks(e.target.value)} sx={{ mb: 4 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <Button variant="contained" size="large" onClick={() => handleSave(editingEstimate ? 'update' : 'create')}>{t('estimates_save_btn')}</Button>
                    </Box>
                </Box>
            );
        }

        return (
            <Box sx={{ p: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
                    <Typography variant="h4" fontWeight="bold">{t('estimates_title', 'Estimates')}</Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateNew}>{t('estimates_create_title', 'Create New')}</Button>
                </Box>

                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>{t('estimates_id')}</TableCell>
                                <TableCell>{t('estimates_date')}</TableCell>
                                <TableCell>{t('estimates_client')}</TableCell>
                                <TableCell align="right">{t('estimates_amount')}</TableCell>
                                <TableCell align="center">{t('estimates_status')}</TableCell>
                                <TableCell align="right">{t('estimates_actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {visibleEstimates.map(est => (
                                <TableRow key={est.ID} hover>
                                    <TableCell>{est.ID}</TableCell>
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
                            ))}
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
            </Box>
        );
    };

    return (
        <>
            {renderContent()}
            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
                confirmLabel={confirmDialog.confirmLabel}
                cancelLabel={confirmDialog.cancelLabel}
                confirmColor={confirmDialog.confirmColor}
            />
            <Snackbar open={toast.open} autoHideDuration={3000} onClose={handleCloseToast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={handleCloseToast} severity={toast.severity}>{toast.message}</Alert>
            </Snackbar>
            <LoadingOverlay open={loading} />
            {/* Loading Overlay */}
            <Backdrop
                sx={{ color: '#fff', zIndex: 9999 }} // Highest priority
                open={isConverting}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <CircularProgress color="inherit" size={60} />
                    <Typography variant="h6">{t('converting', 'Converting...')}</Typography>
                </Box>
            </Backdrop>
        </>
    );
};

export default Estimates;
