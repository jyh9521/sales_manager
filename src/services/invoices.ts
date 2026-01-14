import { query } from './api';

export interface InvoiceItem {
    ID?: number;
    InvoiceID?: number; // 创建时可选
    ProductID: number;
    Quantity: number;
    UnitPrice: number;
    Unit?: string;
    ItemDate?: string; // 日期字符串 YYYY-MM-DD
    Remarks?: string;
    Project?: string;
    TaxRate?: number;

    // UI 辅助字段
    ProductName?: string;
    ProductCode?: string;
}

export interface Invoice {
    ID: number;
    ClientID: number;
    ClientName?: string; // 用于显示，从 Clients 表连接
    InvoiceDate: string;
    DueDate?: string;
    TotalAmount: number;
    Status: 'Unpaid' | 'Paid' | 'Sent';
    Items: InvoiceItem[];
}

export const invoiceService = {
    async getAll(): Promise<Invoice[]> {
        // 左连接获取客户名称
        // 注意：Access SQL 语法对于 limit/offset 或标准连接是标准的。
        // 我们按 ID 倒序排列以优先显示最新的。
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
                InvoiceDate: r.InvoiceDate, // Access 可能返回日期对象或字符串，在 UI 中相应处理
                DueDate: r.DueDate,
                TotalAmount: r.TotalAmount,
                Status: r.Status || 'Unpaid',
                Items: r.Items ? JSON.parse(r.Items) : [] // 如果可用，解析 JSON 项目
            }));
        } catch (e) {
            console.error("Error fetching invoices:", e);
            return [];
        }
    },

    async create(invoice: any): Promise<number> {
        // 使用包含库存逻辑的主进程处理程序
        const result = await window.ipcRenderer.invoke('save-invoice', invoice);
        if (!result.success) {
            throw new Error(result.error || 'Failed to create invoice');
        }
        return result.id;
    },

    async update(invoice: Invoice): Promise<void> {
        // 使用包含库存逻辑的主进程处理程序
        const result = await window.ipcRenderer.invoke('save-invoice', invoice);
        if (!result.success) {
            throw new Error(result.error || 'Failed to update invoice');
        }
    },

    async delete(id: number): Promise<void> {
        // 使用包含库存恢复逻辑的主进程处理程序
        const result = await window.ipcRenderer.invoke('delete-invoice', id);
        if (!result.success) {
            throw new Error(result.error || 'Failed to delete invoice');
        }
    }
};
