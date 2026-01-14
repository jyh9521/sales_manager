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

    // UI Helpers
    ProductName?: string;
    ProductCode?: string;
}

export interface Invoice {
    ID: number;
    ClientID: number;
    ClientName?: string; // For display, joined from Clients table
    InvoiceDate: string;
    TotalAmount: number;
    Items: InvoiceItem[];
}

export const invoiceService = {
    async getAll(): Promise<Invoice[]> {
        // Left Join to get Client Name
        // Note: Access SQL syntax for limit/offset or standard joins is standard.
        // We order by ID DESC to show newest first.
        const sql = `
            SELECT Invoices.ID, Invoices.ClientID, Invoices.InvoiceDate, Invoices.TotalAmount, Invoices.Items, Clients.Name as ClientName
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
                TotalAmount: r.TotalAmount,
                Items: r.Items ? JSON.parse(r.Items) : []
            }));
        } catch (e) {
            console.error("Error fetching invoices:", e);
            return [];
        }
    },

    async create(invoice: Omit<Invoice, 'ID' | 'ClientName'>): Promise<number> {
        const itemsJson = JSON.stringify(invoice.Items).replace(/'/g, "''");
        // Ensure date is formatted properly for Access if needed, or pass as ISO string
        // Access often accepts YYYY-MM-DD HH:MM:SS strings
        const dateStr = new Date(invoice.InvoiceDate).toISOString().slice(0, 19).replace('T', ' ');

        const sql = `
            INSERT INTO Invoices (ClientID, InvoiceDate, TotalAmount, Items)
            VALUES (${invoice.ClientID}, '${dateStr}', ${invoice.TotalAmount}, '${itemsJson}')
        `;

        await execute(sql);

        const idRes = await query<{ ID: number }[]>("SELECT TOP 1 ID FROM Invoices ORDER BY ID DESC");
        return idRes[0]?.ID || 0;
    },

    async delete(id: number): Promise<void> {
        await execute(`DELETE FROM Invoices WHERE ID=${id}`);
    }
};
