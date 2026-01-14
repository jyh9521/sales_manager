import { query, execute } from './api';

export interface Project {
    ID: number;
    Name: string;
}

export const projectService = {
    async getAll(): Promise<Project[]> {
        return await query<Project[]>("SELECT * FROM Projects ORDER BY Name ASC");
    },

    async add(name: string): Promise<void> {
        try {
            const cleanName = name.replace(/'/g, "''");
            await execute(`INSERT INTO Projects (Name) VALUES ('${cleanName}')`);
        } catch (e) {
            // 通常忽略重复项，但可以记录
            console.log('Project add failed (maybe duplicate):', e);
        }
    },

    async delete(id: number): Promise<void> {
        await execute(`DELETE FROM Projects WHERE ID=${id}`);
    },

    async rename(id: number, oldName: string, newName: string): Promise<void> {
        const cleanNew = newName.replace(/'/g, "''");
        const cleanOld = oldName.replace(/'/g, "''");

        // 1. 更新字典
        await execute(`UPDATE Projects SET Name='${cleanNew}' WHERE ID=${id}`);

        // 2. 级联更新产品
        await execute(`UPDATE Products SET Project='${cleanNew}' WHERE Project='${cleanOld}'`);
    }
};
