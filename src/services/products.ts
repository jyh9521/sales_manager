import { query, execute } from './api';

export interface Product {
    ID: number;
    Code?: string;
    Name: string;
    Description?: string;
    UnitPrice: number;
    ClientIDs?: number[];
    Project?: string;
    TaxRate: number; // 8 or 10
    Stock: number;
    IsActive: boolean;
}

export const productService = {
    async getAll(): Promise<Product[]> {
        const sql = "SELECT * FROM Products ORDER BY ID DESC";
        const rows = await query<any[]>(sql);
        return rows.map(r => ({
            ...r,
            Code: r.Code || '',
            Project: r.Project || '',
            ClientIDs: r.ClientIDs ? r.ClientIDs.split(',').map((id: string) => Number(id)) : [],
            TaxRate: r.TaxRate || 10,
            Stock: r.Stock || 0,
            IsActive: Number(r.IsActive) !== 0 // 修复：修复布尔值 false 被 !== 0 检查视为 true 的问题
        }));
    },

    async add(product: Omit<Product, 'ID'>): Promise<number> {
        const code = (product.Code || '').replace(/'/g, "''");
        const name = product.Name.replace(/'/g, "''");
        const desc = (product.Description || '').replace(/'/g, "''");
        const project = (product.Project || '').replace(/'/g, "''");
        const price = product.UnitPrice;
        const clientIdsStr = (product.ClientIDs || []).join(',');
        const isActive = product.IsActive ? 1 : 0;
        const taxRate = product.TaxRate || 10;
        const stock = product.Stock || 0;

        const sql = `INSERT INTO Products (Code, Name, Description, UnitPrice, ClientIDs, Project, TaxRate, Stock, IsActive) VALUES ('${code}', '${name}', '${desc}', ${price}, '${clientIdsStr}', '${project}', ${taxRate}, ${stock}, ${isActive})`;
        await execute(sql);

        const idRes = await query<{ ID: number }[]>("SELECT TOP 1 ID FROM Products ORDER BY ID DESC");
        return idRes[0]?.ID || 0;
    },

    async update(product: Product): Promise<void> {
        const code = (product.Code || '').replace(/'/g, "''");
        const name = product.Name.replace(/'/g, "''");
        const desc = (product.Description || '').replace(/'/g, "''");
        const project = (product.Project || '').replace(/'/g, "''");
        const clientIdsStr = (product.ClientIDs || []).join(',');
        const isActive = product.IsActive ? 1 : 0;
        const taxRate = product.TaxRate || 10;
        const stock = product.Stock || 0;

        const sql = `UPDATE Products SET Code='${code}', Name='${name}', Description='${desc}', UnitPrice=${product.UnitPrice}, ClientIDs='${clientIdsStr}', Project='${project}', TaxRate=${taxRate}, Stock=${stock}, IsActive=${isActive} WHERE ID=${product.ID}`;
        await execute(sql);
    },

    async delete(id: number): Promise<void> {
        await execute(`DELETE FROM Products WHERE ID=${id}`);
    },

    async getNextCode(project: string): Promise<string> {
        if (!project) return '';
        const cleanProject = project.replace(/'/g, "''");
        const rows = await query<{ Code: string }[]>(`SELECT Code FROM Products WHERE Project='${cleanProject}'`);

        let maxNum = 0;
        // 简单分隔符检测：检查 Project + '-'
        const prefix = project + '-';

        rows.forEach(r => {
            if (r.Code && r.Code.startsWith(prefix)) {
                const rest = r.Code.substring(prefix.length);
                const num = parseInt(rest, 10);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });

        return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
    }
}
