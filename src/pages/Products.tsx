import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Product, productService } from '../services/products';
import { Client, clientService } from '../services/clients';
import { Project, projectService } from '../services/projects';

const Products = () => {
    const { t } = useTranslation();
    const [products, setProducts] = useState<Product[]>([]);
    const [allClients, setAllClients] = useState<Client[]>([]);
    const [savedProjects, setSavedProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);

    // Filter & Sort State
    const [searchTerm, setSearchTerm] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Product, direction: 'asc' | 'desc' } | null>(null);

    const handleSort = (key: keyof Product) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Project Rename State
    const [editingProject, setEditingProject] = useState<{ id: number, name: string } | null>(null);
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);

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
        } finally {
            setLoading(false);
        }
    };

    const loadProjects = async () => {
        const pjData = await projectService.getAll();
        setSavedProjects(pjData);
    };

    // Auto-fill code logic when Project changes
    const handleProjectChange = async (projectName: string) => {
        setCurrentProduct(prev => ({ ...prev, Project: projectName }));

        // Only auto-fill if we are NOT editing an existing product (user wants manual control usually, or maybe auto-update?)
        // User said: "Next time select company... prefix appears".
        // Let's do it for New Products or when Project changes significantly.
        // If user is editing, we probably shouldn't mess with Code unless they ask.
        if (isEditing) return;

        if (projectName) {
            try {
                const nextCode = await productService.getNextCode(projectName);
                if (nextCode) {
                    // Try to split by first dash
                    const parts = nextCode.split('-');
                    if (parts.length >= 2) {
                        const num = parts.pop(); // Last part is number
                        const pref = parts.join('-'); // Rest is prefix
                        setCodePrefix(pref);
                        setCodeNumber(num || '');
                    }
                } else {
                    // New project, no history.
                    // Default prefix to Project Name? User said "let user write first time".
                    // So we leave it empty or keep what user typed?
                    // Maybe set prefix = projectName if empty?
                    if (!codePrefix) setCodePrefix(projectName);
                }
            } catch (e) {
                console.error(e);
            }
        }
    };

    const handleSave = async () => {
        if (!currentProduct.Name || currentProduct.UnitPrice === undefined) return;

        // Combine Code
        const finalCode = (codePrefix && codeNumber) ? `${codePrefix}-${codeNumber}` : (codePrefix || codeNumber || '');
        const productToSave = { ...currentProduct, Code: finalCode };

        try {
            if (isEditing && currentProduct.ID) {
                await productService.update(productToSave as Product);
            } else {
                await productService.add(productToSave as Omit<Product, 'ID'>);
            }

            // Check if Project is new and add to dictionary
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
        // Optimistic update
        setProducts(products.map(p => p.ID === product.ID ? updated : p));
    };

    const openModal = (product?: Product) => {
        if (product) {
            setCurrentProduct({ ...product });
            setIsEditing(true);
            // Split code
            if (product.Code && product.Code.includes('-')) {
                const parts = product.Code.split('-');
                const num = parts.pop();
                setCodeNumber(num || '');
                setCodePrefix(parts.join('-'));
            } else {
                setCodePrefix(product.Code || '');
                setCodeNumber('');
            }
            setCodeNumber('');
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
        <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800">{t('products', 'Products')}</h2>

                <div className="flex items-center gap-4 flex-1 justify-end w-full md:w-auto">
                    {/* Search */}
                    <div className="relative">
                        <input
                            className="pl-8 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <span className="absolute left-2 top-2.5 text-gray-400">🔍</span>
                    </div>

                    {/* Filter Toggle */}
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={e => setShowInactive(e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        Show Inactive
                    </label>

                    <button
                        onClick={() => openModal()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                        <span>+</span> {t('add_product', 'Add Product')}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            {[
                                { key: 'Code', label: 'Code', width: 'w-24' },
                                { key: 'Name', label: 'Product Info' },
                                { key: 'Project', label: 'Project' },
                                { key: 'UnitPrice', label: 'Price', align: 'right' },
                                { key: 'IsActive', label: 'Status', align: 'center' }
                            ].map(({ key, label, width, align }) => (
                                <th
                                    key={key}
                                    className={`px-6 py-4 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors select-none ${width || ''} ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
                                    onClick={() => handleSort(key as keyof Product)}
                                >
                                    <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
                                        {label}
                                        {sortConfig?.key === key && (
                                            <span className="text-indigo-600 text-xs text-nowrap">
                                                {sortConfig.direction === 'asc' ? '▲' : '▼'}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th className="px-6 py-4 font-semibold text-gray-600 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredProducts.map(product => {
                            return (
                                <tr key={product.ID} className={`transition-colors ${!product.IsActive ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50'}`}>
                                    <td className="px-6 py-4 text-gray-500 font-mono text-sm whitespace-nowrap">{product.Code || '-'}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-800">{product.Name}</div>
                                        {product.Description && <div className="text-xs text-gray-400 mt-1 truncate max-w-xs">{product.Description}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 text-sm">
                                        {product.Project ? <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100">{product.Project}</span> : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-emerald-600 font-semibold text-right whitespace-nowrap">
                                        {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(product.UnitPrice)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => toggleStatus(product)}
                                            className={`text-xs px-2 py-1 rounded-full border ${product.IsActive ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-200 text-gray-500 border-gray-300'}`}
                                        >
                                            {product.IsActive ? 'On Sale' : 'Stopped'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                        <button onClick={() => openModal(product)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>
                                        <button onClick={() => handleDelete(product.ID)} className="text-red-500 hover:text-red-700 font-medium text-sm">Delete</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredProducts.length === 0 && !loading && (
                    <div className="p-8 text-center text-gray-400">
                        {searchTerm ? 'No matching products found.' : 'No products found. Start by adding one.'}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-xl font-bold text-gray-800">
                                {isEditing ? 'Edit Product' : 'New Product'}
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">On Sale</span>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                    checked={currentProduct.IsActive}
                                    onChange={e => setCurrentProduct({ ...currentProduct, IsActive: e.target.checked })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Project Field */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                                    <span>Project / End Client</span>
                                    <button onClick={() => setIsProjectManagerOpen(true)} className="text-xs text-blue-600 hover:underline">Manage List</button>
                                </label>
                                <div className="relative">
                                    <input
                                        className="input-field pr-10"
                                        value={currentProduct.Project || ''}
                                        onChange={e => {
                                            handleProjectChange(e.target.value);
                                            setShowProjectDropdown(true);
                                        }}
                                        onFocus={() => setShowProjectDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowProjectDropdown(false), 200)}
                                        placeholder="e.g. NACK5"
                                        autoComplete="off"
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-0 top-0 h-full px-3 text-gray-400 hover:text-gray-600 text-xs"
                                        onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                                        tabIndex={-1}
                                    >
                                        ▼
                                    </button>

                                    {showProjectDropdown && (
                                        <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                                            {(() => {
                                                const input = (currentProduct.Project || '').toLowerCase();
                                                const exactMatch = savedProjects.some(p => p.Name.toLowerCase() === input);
                                                const filtered = savedProjects.filter(p => !input || p.Name.toLowerCase().includes(input));

                                                const displayList = exactMatch ? savedProjects : filtered;

                                                if (displayList.length === 0) return <li className="p-2 text-gray-400 text-xs text-center">New project</li>;

                                                return displayList.map(p => (
                                                    <li
                                                        key={p.ID}
                                                        className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm text-gray-700"
                                                        onClick={() => {
                                                            handleProjectChange(p.Name);
                                                            setShowProjectDropdown(false);
                                                        }}
                                                        onMouseDown={e => e.preventDefault()}
                                                    >
                                                        {p.Name}
                                                    </li>
                                                ));
                                            })()}
                                        </ul>
                                    )}
                                </div>
                            </div>

                            {/* Code Field (Split) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Product Code</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        className="h-10 flex-1 min-w-0 border border-gray-300 rounded-lg px-3 outline-none focus:border-indigo-500 bg-white text-gray-800 placeholder-gray-400"
                                        placeholder="Prefix (e.g. NACK5)"
                                        value={codePrefix}
                                        onChange={e => setCodePrefix(e.target.value)}
                                    />
                                    <span className="text-gray-400 font-bold">-</span>
                                    <input
                                        className="h-10 w-24 border border-gray-300 rounded-lg px-3 text-center outline-none focus:border-indigo-500 bg-white text-gray-800 placeholder-gray-400 font-mono"
                                        placeholder="001"
                                        value={codeNumber}
                                        onChange={e => setCodeNumber(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                                <input
                                    className="input-field"
                                    value={currentProduct.Name}
                                    onChange={e => setCurrentProduct({ ...currentProduct, Name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price (¥)</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={Number(currentProduct.UnitPrice).toString()}
                                    onFocus={e => e.target.select()}
                                    onChange={e => setCurrentProduct({ ...currentProduct, UnitPrice: Number(e.target.value) })}
                                />
                            </div>

                            {/* Tax Rate */}
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Consumption Tax Rate</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2 rounded border border-gray-200 hover:border-indigo-300">
                                        <input
                                            type="radio"
                                            name="taxRate"
                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                            checked={currentProduct.TaxRate !== 8} // Default or explicit 10
                                            onChange={() => setCurrentProduct({ ...currentProduct, TaxRate: 10 })}
                                        />
                                        <span className="text-gray-700">Standard (10%)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2 rounded border border-gray-200 hover:border-indigo-300">
                                        <input
                                            type="radio"
                                            name="taxRate"
                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                                            checked={currentProduct.TaxRate === 8}
                                            onChange={() => setCurrentProduct({ ...currentProduct, TaxRate: 8 })}
                                        />
                                        <span className="text-gray-700">Reduced (8%)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    className="input-field"
                                    rows={2}
                                    value={currentProduct.Description}
                                    onChange={e => setCurrentProduct({ ...currentProduct, Description: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Client Binding */}
                        <div className="mt-4 border-t pt-4">
                            <h4 className="font-semibold text-gray-700 mb-2 text-sm">Applicable Clients</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-lg border border-gray-100">
                                {allClients.map(client => (
                                    <label key={client.ID} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={currentProduct.ClientIDs?.includes(client.ID) || false}
                                            onChange={() => {
                                                const currentIds = currentProduct.ClientIDs || [];
                                                if (currentIds.includes(client.ID)) {
                                                    setCurrentProduct({ ...currentProduct, ClientIDs: currentIds.filter(id => id !== client.ID) });
                                                } else {
                                                    setCurrentProduct({ ...currentProduct, ClientIDs: [...currentIds, client.ID] });
                                                }
                                            }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700 truncate">{client.Name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
                            <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow transition-colors">Save Product</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Project Manager Modal */}
            {isProjectManagerOpen && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[60]">
                    <div className="bg-white rounded-xl shadow-xl w-96 p-6">
                        <h3 className="text-lg font-bold mb-4 text-gray-800">Manage Projects</h3>
                        <p className="text-sm text-gray-500 mb-4">Delete unused or misspelled project names from the dropdown list. This does not delete any products.</p>
                        <div className="max-h-60 overflow-y-auto border rounded divide-y">
                            {savedProjects.map(p => (
                                <div key={p.ID} className="flex justify-between items-center p-2 hover:bg-gray-50 min-h-[40px]">
                                    {editingProject?.id === p.ID ? (
                                        <div className="flex gap-2 flex-1 items-center">
                                            <input
                                                className="border rounded px-2 py-1 text-sm flex-1 outline-none border-indigo-500"
                                                value={editingProject.name}
                                                autoFocus
                                                onChange={e => setEditingProject({ ...editingProject, name: e.target.value })}
                                            />
                                            <button onClick={() => handleRenameProject(p.ID, p.Name)} className="text-green-600 hover:bg-green-50 px-2 py-1 rounded text-xs font-medium">Save</button>
                                            <button onClick={() => setEditingProject(null)} className="text-gray-500 hover:bg-gray-100 px-2 py-1 rounded text-xs">Cancel</button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-sm font-medium text-gray-700">{p.Name}</span>
                                            <div className="flex gap-1">
                                                <button onClick={() => setEditingProject({ id: p.ID, name: p.Name })} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded" title="Rename">✏️</button>
                                                <button
                                                    onClick={async () => {
                                                        if (confirm(`Delete project "${p.Name}" from list?`)) {
                                                            await projectService.delete(p.ID);
                                                            loadProjects();
                                                        }
                                                    }}
                                                    className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                                                    title="Delete"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                            {savedProjects.length === 0 && <div className="p-4 text-center text-xs text-gray-400">No saved projects.</div>}
                        </div>
                        <div className="mt-4 text-right">
                            <button onClick={() => setIsProjectManagerOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Close</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .input-field {
                    width: 100%;
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    border: 1px solid #d1d5db;
                    outline: none;
                    transition: border-color 0.2s;
                }
                .input-field:focus {
                    border-color: #6366f1;
                    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
                }
             `}</style>
        </div>
    );
};

export default Products;
