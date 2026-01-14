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
            IsActive: Number(r.IsActive) !== 0 // Fix: Handle boolean false getting treated as true by !== 0 check
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

        const sql = `INSERT INTO Products (Code, Name, Description, UnitPrice, ClientIDs, Project, TaxRate, IsActive) VALUES ('${code}', '${name}', '${desc}', ${price}, '${clientIdsStr}', '${project}', ${taxRate}, ${isActive})`;
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

        const sql = `UPDATE Products SET Code='${code}', Name='${name}', Description='${desc}', UnitPrice=${product.UnitPrice}, ClientIDs='${clientIdsStr}', Project='${project}', TaxRate=${taxRate}, IsActive=${isActive} WHERE ID=${product.ID}`;
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
        // Simple separator detection: Check for Project + '-'
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
