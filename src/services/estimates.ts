export interface EstimateItem {
    ProductCode: string;
    ProductName: string;
    Quantity: number;
    Unit: string;
    UnitPrice: number;
    TaxRate: number;
    Remarks?: string;
}

export interface Estimate {
    ID: number;
    ClientID: number;
    ClientName?: string;
    EstimateDate: string;
    ValidUntil?: string;
    Items: EstimateItem[];
    TotalAmount: number;
    Status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Converted';
    Remarks?: string;
}

export const estimateService = {
    async getAll(): Promise<Estimate[]> {
        const result = await window.ipcRenderer.invoke('estimates-getAll');
        return result.map((r: any) => ({
            ...r,
            Items: r.Items ? JSON.parse(r.Items) : []
        }));
    },

    async save(estimate: any): Promise<number> {
        const result = await window.ipcRenderer.invoke('save-estimate', estimate);
        if (!result.success) throw new Error('Failed to save estimate');
        return result.id;
    },

    async delete(id: number): Promise<void> {
        const result = await window.ipcRenderer.invoke('delete-estimate', id);
        if (!result.success) throw new Error('Failed to delete estimate');
    }
};
