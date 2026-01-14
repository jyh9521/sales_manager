import { query, execute } from './api';

export interface InvoiceItem {
    ID?: number;
    InvoiceID?: number; // Optional on creation
    ProductID: number;
    Quantity: number;
    UnitPrice: number;
    Unit?: string;
    ItemDate?: string; // Date string YYYY-MM-DD
    Remarks?: string;
    Project?: string;
    TaxRate?: number;

    // UI Helpers
    ProductName?: string;
    ProductCode?: string;
}

export interface Invoice {
    ID: number;
    ClientID: number;
    ClientName?: string; // For display, joined from Clients table
    InvoiceDate: string;
    DueDate?: string;
    TotalAmount: number;
    Status: 'Unpaid' | 'Paid' | 'Sent';
    Items: InvoiceItem[];
}

export const invoiceService = {
    async getAll(): Promise<Invoice[]> {
        // Left Join to get Client Name
        // Note: Access SQL syntax for limit/offset or standard joins is standard.
        // We order by ID DESC to show newest first.
        const sql = `
            SELECT Invoices.ID, Invoices.ClientID, Invoices.InvoiceDate, Invoices.DueDate, Invoices.TotalAmount, Invoices.Status, Invoices.Items, Clients.Name as ClientName
            FROM Invoices
            LEFT JOIN Clients ON Invoices.ClientID = Clients.ID
            ORDER BY Invoices.ID DESC
        `;

        try {
            const rows = await query<any[]>(sql);
            return rows.map(r => ({
                ID: r.ID,
                ClientID: r.ClientID,
                ClientName: r.ClientName || 'Unknown Client',
                InvoiceDate: r.InvoiceDate, // Access might return date object or string, handle accordingly in UI
                DueDate: r.DueDate,
                TotalAmount: r.TotalAmount,
                Status: r.Status || 'Unpaid',
                Items: r.Items ? JSON.parse(r.Items) : [] // Parse JSON items if available
            }));
        } catch (e) {
            console.error("Error fetching invoices:", e);
            return [];
        }
    },

    async create(invoice: any): Promise<number> {
        // Use main process handler which includes Inventory Logic
        const result = await window.ipcRenderer.invoke('save-invoice', invoice);
        if (!result.success) {
            throw new Error(result.error || 'Failed to create invoice');
        }
        return result.id;
    },

    async update(invoice: Invoice): Promise<void> {
        // Use main process handler which includes Inventory Logic
        const result = await window.ipcRenderer.invoke('save-invoice', invoice);
        if (!result.success) {
            throw new Error(result.error || 'Failed to update invoice');
        }
    },

    async delete(id: number): Promise<void> {
        // Use main process handler which includes Inventory restoration logic
        const result = await window.ipcRenderer.invoke('delete-invoice', id);
        if (!result.success) {
            throw new Error(result.error || 'Failed to delete invoice');
        }
    }
};
