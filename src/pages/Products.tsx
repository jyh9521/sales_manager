import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Product, productService } from '../services/products';
import { Client, clientService } from '../services/clients';
import { Project, projectService } from '../services/projects';
import {
    Box, Typography, Button, TextField, Checkbox, FormControlLabel,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Dialog, DialogTitle, DialogContent, DialogActions, Chip,
    InputAdornment, IconButton, Autocomplete, RadioGroup, Radio,
    Grid, List, ListItem, ListItemText, ListItemSecondaryAction
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    Edit as EditIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';

const Products = () => {
    const { t } = useTranslation();
    const [products, setProducts] = useState<Product[]>([]);
    const [allClients, setAllClients] = useState<Client[]>([]);
    const [savedProjects, setSavedProjects] = useState<Project[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);

    // Filter & Sort State
    const [searchTerm, setSearchTerm] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Product, direction: 'asc' | 'desc' } | null>(null);

    // Project Rename State
    const [editingProject, setEditingProject] = useState<{ id: number, name: string } | null>(null);

    // Edit State
    const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({
        Name: '', Code: '', Description: '', UnitPrice: 0, ClientIDs: [], IsActive: true, Project: '', TaxRate: 10
    });
    const [codePrefix, setCodePrefix] = useState('');
    const [codeNumber, setCodeNumber] = useState('');
    const [isEditing, setIsEditing] = useState(false);

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
        } catch (e) {
            console.error(e);
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
            loadData();
        } catch (e) {
            console.error(e);
            alert('Rename failed');
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
        if (!currentProduct.Name || currentProduct.UnitPrice === undefined) return;

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
            loadData();
        } catch (e) {
            alert('Failed to save: ' + e);
        }
    };

    const handleDelete = async (id: number) => {
        if (confirm(t('confirm_delete', 'Are you sure?'))) {
            await productService.delete(id);
            loadData();
        }
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

    return (
        <Box sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, gap: 2 }}>
                <Typography variant="h4" fontWeight="bold">
                    {t('products', 'Products')}
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <TextField
                        size="small"
                        placeholder="Search products..."
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
                        label="Show Inactive"
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

            <TableContainer component={Paper}>
                <Table>
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                        <TableRow>
                            {[
                                { key: 'Code', label: 'Code', width: 100 },
                                { key: 'Name', label: 'Product Info' },
                                { key: 'Project', label: 'Project' },
                                { key: 'UnitPrice', label: 'Price', align: 'right' },
                                { key: 'IsActive', label: 'Status', align: 'center' }
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
                                >
                                    {label} {sortConfig?.key === key && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                                </TableCell>
                            ))}
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredProducts.map(product => (
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
                                        label={product.IsActive ? 'On Sale' : 'Stopped'}
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

            {/* Product Edit Modal */}
            <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>{isEditing ? 'Edit Product' : 'New Product'}</DialogTitle>
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
                                                Manage Project List
                                            </Typography>
                                        }
                                    />
                                )}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                <TextField
                                    label="Code Prefix"
                                    value={codePrefix}
                                    onChange={e => setCodePrefix(e.target.value)}
                                    sx={{ flex: 1 }}
                                />
                                <Typography sx={{ mt: 2, fontWeight: 'bold' }}>-</Typography>
                                <TextField
                                    label="Number"
                                    value={codeNumber}
                                    onChange={e => setCodeNumber(e.target.value)}
                                    sx={{ width: 100 }}
                                />
                            </Box>
                        </Grid>
                        <Grid size={12}>
                            <TextField
                                label="Product Name"
                                fullWidth
                                value={currentProduct.Name}
                                onChange={e => setCurrentProduct({ ...currentProduct, Name: e.target.value })}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                                label="Unit Price"
                                type="number"
                                fullWidth
                                value={Number(currentProduct.UnitPrice).toString()}
                                onChange={e => setCurrentProduct({ ...currentProduct, UnitPrice: Number(e.target.value) })}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start">¥</InputAdornment>,
                                }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
                                <RadioGroup
                                    row
                                    value={currentProduct.TaxRate}
                                    onChange={e => setCurrentProduct({ ...currentProduct, TaxRate: Number(e.target.value) })}
                                >
                                    <FormControlLabel value={10} control={<Radio />} label="10% (Standard)" />
                                    <FormControlLabel value={8} control={<Radio />} label="8% (Reduced)" />
                                </RadioGroup>
                            </Box>
                        </Grid>
                        <Grid size={12}>
                            <TextField
                                label="Description"
                                fullWidth
                                multiline
                                rows={2}
                                value={currentProduct.Description}
                                onChange={e => setCurrentProduct({ ...currentProduct, Description: e.target.value })}
                            />
                        </Grid>

                        <Grid size={12}>
                            <Typography variant="subtitle2" gutterBottom>Applicable Clients</Typography>
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
                                label="Active (On Sale)"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} variant="contained" color="primary">Save</Button>
                </DialogActions>
            </Dialog>

            {/* Project Manager Modal */}
            <Dialog open={isProjectManagerOpen} onClose={() => setIsProjectManagerOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Manage Projects</DialogTitle>
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
                                        <Button size="small" onClick={() => handleRenameProject(p.ID, p.Name)}>Save</Button>
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
                                                onClick={async () => {
                                                    if (confirm(`Delete project "${p.Name}" from list?`)) {
                                                        await projectService.delete(p.ID);
                                                        loadProjects();
                                                    }
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
                            <Typography variant="body2" color="text.secondary" align="center">No projects found.</Typography>
                        )}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsProjectManagerOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Products;
