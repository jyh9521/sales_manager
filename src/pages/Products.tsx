import { useEffect, useState, ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Product, productService } from '../services/products';
import { Client, clientService } from '../services/clients';
import { Project, projectService } from '../services/projects';
import {
    Box, Typography, Button, TextField, Checkbox, FormControlLabel,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Dialog, DialogTitle, DialogContent, DialogActions, Chip,
    InputAdornment, IconButton, Autocomplete, RadioGroup, Radio, TablePagination,
    Grid, List, ListItem, ListItemText, ListItemSecondaryAction, Snackbar, Alert, Card, CardContent, CardActions
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    Edit as EditIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';

import ConfirmDialog from '../components/ConfirmDialog';
import LoadingOverlay from '../components/LoadingOverlay';

const Products = () => {
    const { t } = useTranslation();
    const [products, setProducts] = useState<Product[]>([]);

    const [loading, setLoading] = useState(true);
    const [allClients, setAllClients] = useState<Client[]>([]);
    const [savedProjects, setSavedProjects] = useState<Project[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);

    // Filter & Sort State
    const [searchTerm, setSearchTerm] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Product, direction: 'asc' | 'desc' } | null>(null);

    // Pagination State
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Reset page when filter changes
    useEffect(() => {
        setPage(0);
    }, [searchTerm, showInactive]);

    // Project Rename State
    const [editingProject, setEditingProject] = useState<{ id: number, name: string } | null>(null);

    // Edit State
    const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({
        Name: '', Code: '', Description: '', UnitPrice: 0, ClientIDs: [], IsActive: true, Project: '', TaxRate: 10
    });
    const [codePrefix, setCodePrefix] = useState('');
    const [codeNumber, setCodeNumber] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        if (!currentProduct.Name?.trim()) newErrors.Name = t('products_validation_name', 'Product Name is required');
        if (currentProduct.UnitPrice === undefined || currentProduct.UnitPrice < 0) newErrors.UnitPrice = t('products_validation_price', 'Valid price is required');

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Toast State
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
    }, []);

    const loadData = async () => {
        try {
            const [pData, cData, pjData] = await Promise.all([
                productService.getAll(),
                clientService.getAll(),
                projectService.getAll()
            ]);
            setProducts(pData);
            setAllClients(cData.filter(c => c.IsActive));
            setSavedProjects(pjData);
            setLoading(false);
        } catch (e) {
            console.error(e);
            setLoading(false);
        }
    };

    const loadProjects = async () => {
        const pjData = await projectService.getAll();
        setSavedProjects(pjData);
    };

    const handleSort = (key: keyof Product) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleRenameProject = async (id: number, oldName: string) => {
        if (!editingProject || !editingProject.name) return;
        try {
            await projectService.rename(id, oldName, editingProject.name);
            setEditingProject(null);
            showToast(t('products_project_renamed', 'Project renamed successfully'));
            loadData();
        } catch (e) {
            console.error(e);
            showToast(t('products_rename_failed', 'Rename failed'), 'error');
        }
    };

    const handleProjectChange = async (projectName: string) => {
        setCurrentProduct(prev => ({ ...prev, Project: projectName }));
        if (isEditing) return;

        if (projectName) {
            try {
                const nextCode = await productService.getNextCode(projectName);
                if (nextCode) {
                    const parts = nextCode.split('-');
                    if (parts.length >= 2) {
                        const num = parts.pop();
                        const pref = parts.join('-');
                        setCodePrefix(pref);
                        setCodeNumber(num || '');
                    }
                } else {
                    if (!codePrefix) setCodePrefix(projectName);
                }
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleSave = async () => {
        if (!validate()) return;

        const finalCode = (codePrefix && codeNumber) ? `${codePrefix}-${codeNumber}` : (codePrefix || codeNumber || '');
        const productToSave = { ...currentProduct, Code: finalCode };

        try {
            if (isEditing && currentProduct.ID) {
                await productService.update(productToSave as Product);
            } else {
                await productService.add(productToSave as Omit<Product, 'ID'>);
            }

            if (productToSave.Project && !savedProjects.find(p => p.Name === productToSave.Project)) {
                await projectService.add(productToSave.Project);
            }

            setIsModalOpen(false);
            showToast(t('products_saved', 'Product saved successfully'));
            loadData();
        } catch (e) {
            showToast(t('products_save_failed', 'Failed to save: ') + e, 'error');
        }
    };

    const handleDelete = (id: number) => {
        setConfirmDialog({
            open: true,
            title: t('common.delete', 'Delete Product'),
            message: t('products_delete_confirm_msg', 'Are you sure you want to delete this product?'),
            onConfirm: async () => {
                await productService.delete(id);
                setConfirmDialog(prev => ({ ...prev, open: false }));
                showToast(t('products_deleted', 'Product deleted'));
                loadData();
            }
        });
    };

    const toggleStatus = async (product: Product) => {
        const updated = { ...product, IsActive: !product.IsActive };
        await productService.update(updated);
        setProducts(products.map(p => p.ID === product.ID ? updated : p));
    };

    const openModal = (product?: Product) => {
        if (product) {
            setCurrentProduct({ ...product });
            setIsEditing(true);
            if (product.Code && product.Code.includes('-')) {
                const parts = product.Code.split('-');
                const num = parts.pop();
                setCodeNumber(num || '');
                setCodePrefix(parts.join('-'));
            } else {
                setCodePrefix(product.Code || '');
                setCodeNumber('');
            }
        } else {
            setCurrentProduct({ Name: '', Code: '', Description: '', UnitPrice: 0, ClientIDs: [], IsActive: true, Project: '', TaxRate: 10 });
            setIsEditing(false);
            setCodePrefix('');
            setCodeNumber('');
        }
        setErrors({});
        setIsModalOpen(true);
    };

    const filteredProducts = products.filter(p => {
        if (!showInactive && !p.IsActive) return false;
        if (searchTerm) {
            const low = searchTerm.toLowerCase();
            return (
                p.Name.toLowerCase().includes(low) ||
                (p.Code && p.Code.toLowerCase().includes(low)) ||
                (p.Project && p.Project.toLowerCase().includes(low))
            );
        }
        return true;
    }).sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;

        let valA: any = a[key];
        let valB: any = b[key];

        if (key === 'Code' || key === 'Project' || key === 'Name') {
            valA = valA || '';
            valB = valB || '';
            return direction === 'asc'
                ? valA.localeCompare(valB, 'ja', { numeric: true, sensitivity: 'base' })
                : valB.localeCompare(valA, 'ja', { numeric: true, sensitivity: 'base' });
        }

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const visibleProducts = filteredProducts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <Box sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, gap: 2 }}>
                <Typography variant="h4" fontWeight="bold">
                    {t('products', 'Products')}
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                        size="small"
                        placeholder={t('products_search_placeholder', 'Search products...')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ width: 250, bgcolor: 'background.paper' }}
                    />
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={showInactive}
                                onChange={e => setShowInactive(e.target.checked)}
                                color="primary"
                            />
                        }
                        label={t('products_show_inactive', 'Show Inactive')}
                    />
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => openModal()}
                    >
                        {t('add_product', 'Add Product')}
                    </Button>
                </Box>
            </Box>

            {/* Mobile View (Cards) */}
            <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                {visibleProducts.map(product => (
                    <Card key={product.ID} sx={{ mb: 2, opacity: product.IsActive ? 1 : 0.6 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="h6" component="div">
                                    {product.Name}
                                </Typography>
                                <Chip
                                    label={product.Code || '-'}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontFamily: 'monospace' }}
                                />
                            </Box>
                            <Typography color="text.secondary" variant="body2" gutterBottom>
                                {product.Description || 'No description'}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                                <Typography variant="h6" color="success.main" fontWeight="bold">
                                    {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(product.UnitPrice)}
                                </Typography>
                                {product.Project && <Chip label={product.Project} size="small" color="primary" variant="outlined" />}
                            </Box>
                        </CardContent>
                        <CardActions disableSpacing sx={{ justifyContent: 'space-between' }}>
                            <Chip
                                label={product.IsActive ? t('products_status_on_sale', 'On Sale') : t('products_status_stopped', 'Stopped')}
                                color={product.IsActive ? 'success' : 'default'}
                                size="small"
                                onClick={() => toggleStatus(product)}
                            />
                            <Box>
                                <IconButton size="small" onClick={() => openModal(product)} color="primary">
                                    <EditIcon />
                                </IconButton>
                                <IconButton size="small" onClick={() => handleDelete(product.ID)} color="error">
                                    <DeleteIcon />
                                </IconButton>
                            </Box>
                        </CardActions>
                    </Card>
                ))}
            </Box>

            {/* Desktop View (Table) */}
            <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
                <Table>
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                        <TableRow>
                            {[
                                { key: 'Code', label: 'Code', width: 100 },
                                { key: 'Name', label: t('products_name', 'Product Info') },
                                { key: 'Project', label: t('products_category', 'Project') },
                                { key: 'UnitPrice', label: t('products_price', 'Price'), align: 'right' },
                                { key: 'IsActive', label: t('products_status', 'Status'), align: 'center' }
                            ].map(({ key, label, width, align }) => (
                                <TableCell
                                    key={key}
                                    onClick={() => handleSort(key as keyof Product)}
                                    align={(align as any) || 'left'}
                                    sx={{
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        width: width
                                    }}
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSort(key as keyof Product);
                                    }}
                                >
                                    {label} {sortConfig?.key === key && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                </TableCell>
                            ))}
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{t('products_actions', 'Actions')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleProducts.map(product => (
                            <TableRow
                                key={product.ID}
                                hover
                                sx={{ opacity: product.IsActive ? 1 : 0.6 }}
                            >
                                <TableCell sx={{ fontFamily: 'monospace' }}>{product.Code || '-'}</TableCell>
                                <TableCell>
                                    <Typography variant="subtitle2">{product.Name}</Typography>
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 200 }}>
                                        {product.Description}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    {product.Project ? <Chip label={product.Project} size="small" color="primary" variant="outlined" /> : '-'}
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                                    {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(product.UnitPrice)}
                                </TableCell>
                                <TableCell align="center">
                                    <Chip
                                        label={product.IsActive ? t('products_status_on_sale', 'On Sale') : t('products_status_stopped', 'Stopped')}
                                        color={product.IsActive ? 'success' : 'default'}
                                        size="small"
                                        onClick={() => toggleStatus(product)}
                                        sx={{ cursor: 'pointer' }}
                                    />
                                </TableCell>
                                <TableCell align="right">
                                    <IconButton size="small" onClick={() => openModal(product)} color="primary">
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => handleDelete(product.ID)} color="error">
                                        <DeleteIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={filteredProducts.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
            />

            {/* Product Edit Modal */}
            <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="md" fullWidth>
                <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    <DialogTitle>{isEditing ? t('products_edit_product', 'Edit Product') : t('products_new_product', 'New Product')}</DialogTitle>
                    <DialogContent dividers>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Autocomplete
                                    freeSolo
                                    options={savedProjects.map(p => p.Name)}
                                    value={currentProduct.Project || ''}
                                    onChange={(_, newValue) => handleProjectChange(newValue || '')}
                                    onInputChange={(_, newInputValue) => handleProjectChange(newInputValue)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Project / End Client"
                                            helperText={
                                                <Typography
                                                    variant="caption"
                                                    sx={{ cursor: 'pointer', color: 'primary.main' }}
                                                    onClick={() => setIsProjectManagerOpen(true)}
                                                >
                                                    {t('products_manage_projects', 'Manage Project List')}
                                                </Typography>
                                            }
                                        />
                                    )}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                    <TextField
                                        label={t('products_code_prefix', 'Code Prefix')}
                                        value={codePrefix}
                                        onChange={e => setCodePrefix(e.target.value)}
                                        sx={{ flex: 1 }}
                                    />
                                    <Typography sx={{ mt: 2, fontWeight: 'bold' }}>-</Typography>
                                    <TextField
                                        label={t('products_code_number', 'Number')}
                                        value={codeNumber}
                                        onChange={e => setCodeNumber(e.target.value)}
                                        sx={{ width: 100 }}
                                    />
                                </Box>
                            </Grid>
                            <Grid size={12}>
                                <TextField
                                    label={t('products_name', 'Product Name')}
                                    fullWidth
                                    value={currentProduct.Name}
                                    onChange={e => setCurrentProduct({ ...currentProduct, Name: e.target.value })}
                                    error={!!errors.Name}
                                    helperText={errors.Name}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                    label={t('products_price', 'Unit Price')}
                                    type="number"
                                    fullWidth
                                    value={Number(currentProduct.UnitPrice).toString()}
                                    onChange={e => setCurrentProduct({ ...currentProduct, UnitPrice: Number(e.target.value) })}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                                    }}
                                    error={!!errors.UnitPrice}
                                    helperText={errors.UnitPrice}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, md: 6 }}>
                                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                                    <RadioGroup
                                        row
                                        value={currentProduct.TaxRate}
                                        onChange={e => setCurrentProduct({ ...currentProduct, TaxRate: Number(e.target.value) })}
                                    >
                                        <FormControlLabel value={10} control={<Radio />} label={t('products_tax_10', '10% (Standard)')} />
                                        <FormControlLabel value={8} control={<Radio />} label={t('products_tax_8', '8% (Reduced)')} />
                                    </RadioGroup>
                                </Box>
                            </Grid>
                            <Grid size={12}>
                                <TextField
                                    label={t('products_description', 'Description')}
                                    fullWidth
                                    multiline
                                    rows={2}
                                    value={currentProduct.Description}
                                    onChange={e => setCurrentProduct({ ...currentProduct, Description: e.target.value })}
                                />
                            </Grid>

                            <Grid size={12}>
                                <Typography variant="subtitle2" gutterBottom>{t('products_applicable_clients', 'Applicable Clients')}</Typography>
                                <Paper variant="outlined" sx={{ p: 2, maxHeight: 150, overflowY: 'auto' }}>
                                    <Grid container spacing={1}>
                                        {allClients.map(client => (
                                            <Grid size={{ xs: 12, md: 6 }} key={client.ID}>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={currentProduct.ClientIDs?.includes(client.ID) || false}
                                                            onChange={() => {
                                                                const currentIds = currentProduct.ClientIDs || [];
                                                                if (currentIds.includes(client.ID)) {
                                                                    setCurrentProduct({ ...currentProduct, ClientIDs: currentIds.filter(id => id !== client.ID) });
                                                                } else {
                                                                    setCurrentProduct({ ...currentProduct, ClientIDs: [...currentIds, client.ID] });
                                                                }
                                                            }}
                                                            size="small"
                                                        />
                                                    }
                                                    label={<Typography variant="body2" noWrap>{client.Name}</Typography>}
                                                />
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Paper>
                            </Grid>

                            <Grid size={12}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={currentProduct.IsActive}
                                            onChange={e => setCurrentProduct({ ...currentProduct, IsActive: e.target.checked })}
                                        />
                                    }
                                    label={t('products_active', 'Active (On Sale)')}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setIsModalOpen(false)}>{t('common.cancel', 'Cancel')}</Button>
                        <Button type="submit" variant="contained" color="primary">{t('common.save', 'Save')}</Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Project Manager Modal */}
            <Dialog open={isProjectManagerOpen} onClose={() => setIsProjectManagerOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>{t('products_manage_projects', 'Manage Projects')}</DialogTitle>
                <DialogContent dividers>
                    <List dense>
                        {savedProjects.map(p => (
                            <ListItem key={p.ID}>
                                {editingProject?.id === p.ID ? (
                                    <Box sx={{ display: 'flex', width: '100%', gap: 1 }}>
                                        <TextField
                                            size="small"
                                            fullWidth
                                            value={editingProject.name}
                                            onChange={e => setEditingProject({ ...editingProject, name: e.target.value })}
                                            autoFocus
                                        />
                                        <Button size="small" onClick={() => handleRenameProject(p.ID, p.Name)}>{t('common.save', 'Save')}</Button>
                                    </Box>
                                ) : (
                                    <>
                                        <ListItemText primary={p.Name} />
                                        <ListItemSecondaryAction>
                                            <IconButton size="small" onClick={() => setEditingProject({ id: p.ID, name: p.Name })}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => {
                                                    setConfirmDialog({
                                                        open: true,
                                                        message: t('products_delete_project_confirm', 'Delete project "{name}" from list?').replace('{name}', p.Name),
                                                        onConfirm: async () => {
                                                            await projectService.delete(p.ID);
                                                            setConfirmDialog(prev => ({ ...prev, open: false }));
                                                            loadProjects();
                                                            showToast('Project deleted');
                                                        }
                                                    });
                                                }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </>
                                )}
                            </ListItem>
                        ))}
                        {savedProjects.length === 0 && (
                            <Typography variant="body2" color="text.secondary" align="center">{t('products_no_projects', 'No projects found.')}</Typography>
                        )}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsProjectManagerOpen(false)}>{t('common.close', 'Close')}</Button>
                </DialogActions>
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

export default Products;
