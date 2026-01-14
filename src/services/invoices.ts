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
            SELECT Invoices.ID, Invoices.ClientID, Invoices.InvoiceDate, Invoices.DueDate, Invoices.TotalAmount, Invoices.Status, Clients.Name as ClientName
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
                Items: [] // getAll list usually doesn't need full items unless requested, main.ts handles items fetch on getOne
            }));
        } catch (e) {
            console.error("Error fetching invoices:", e);
            return [];
        }
    },

    async create(invoice: any): Promise<number> {
        // Delegate to main process via IPC for complex transaction or just use existing save-invoice?
        // Actually, main.ts implements 'save-invoice' which handles everything.
        // But our `Invoices.tsx` calls `invoiceService.create` which calls `execute`.
        // Wait, `invoiceService` in `src/services/invoices.ts` is using `execute` directly?
        // Ah, `invoiceService.create` in original code was constructing SQL manually.
        // BUT `main.ts` ALSO has a `save-invoice` handler?
        // Let's check `Invoices.tsx`. It uses `invoiceService`.
        // `invoiceService` (Lines 57-80) constructs SQL manually.
        // SO I MUST UPDATE `invoiceService` SQL construction here too, OR switch to using `ipcRenderer.invoke('save-invoice')` if that's preferred.
        // The `save-invoice` handler in `main.ts` seems comprehensive (handles items too).
        // The current `invoiceService.create` in `src` seems to assume `Items` are JSON string in `Invoices` table?
        // Let's look at `main.ts` again. `Invoices` table in `createSchema` (DB.ts) has `Items MEMO` initially?
        // In `db.ts` I see: `Items MEMO` in `CREATE TABLE Invoices`.
        // BUT `InvoiceItems` table ALSO exists.
        // It seems there's a mix or legacy design.
        // `main.ts` `save-invoice` logic: Updates `Invoices` AND `InvoiceItems`.
        // `invoiceService.ts` logic: Inserts into `Invoices` with `Items` as JSON string.
        // Use `ipcRenderer` 'save-invoice' is better if `main.ts` is the source of truth.
        // However, `invoiceService.ts` code I see earlier (Lines 57+) uses `execute` and `Items` as JSON.
        // User's DB likely has `Items` column in `Invoices`.
        // I will update `invoiceService.ts` to include `Status` column in its SQL generation to be safe and consistent with current usage.

        const itemsJson = JSON.stringify(invoice.Items).replace(/'/g, "''");
        const dateStr = new Date(invoice.InvoiceDate).toISOString().slice(0, 19).replace('T', ' ');
        // Status Update
        const status = invoice.Status || 'Unpaid';

        let sql = '';
        if (invoice.ID) {
            // Check if ID exists first if needed, but here we assume it's for Manual ID insertion logic
            // Actually `create` now handles manual ID
            sql = `
                INSERT INTO Invoices (ID, ClientID, InvoiceDate, TotalAmount, Status, Items)
                VALUES (${invoice.ID}, ${invoice.ClientID}, '${dateStr}', ${invoice.TotalAmount}, '${status}', '${itemsJson}')
            `;
        } else {
            sql = `
                INSERT INTO Invoices (ClientID, InvoiceDate, TotalAmount, Status, Items)
                VALUES (${invoice.ClientID}, '${dateStr}', ${invoice.TotalAmount}, '${status}', '${itemsJson}')
            `;
        }

        await execute(sql);

        if (invoice.ID) return invoice.ID;
        const idRes = await query<{ ID: number }[]>("SELECT TOP 1 ID FROM Invoices ORDER BY ID DESC");
        return idRes[0]?.ID || 0;
    },

    async update(invoice: Invoice): Promise<void> {
        const itemsJson = JSON.stringify(invoice.Items).replace(/'/g, "''");
        const dateStr = new Date(invoice.InvoiceDate).toISOString().slice(0, 19).replace('T', ' ');
        const status = invoice.Status || 'Unpaid';

        const sql = `
            UPDATE Invoices 
            SET ClientID=${invoice.ClientID}, 
                InvoiceDate='${dateStr}', 
                TotalAmount=${invoice.TotalAmount}, 
                Status='${status}',
                Items='${itemsJson}'
            WHERE ID=${invoice.ID}
        `;
        await execute(sql);
    },

    async delete(id: number): Promise<void> {
        await execute(`DELETE FROM Invoices WHERE ID=${id}`);
    }
};
