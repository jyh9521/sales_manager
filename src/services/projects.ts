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
            // Ignore duplicates usually, but could log
            console.log('Project add failed (maybe duplicate):', e);
        }
    },

    async delete(id: number): Promise<void> {
        await execute(`DELETE FROM Projects WHERE ID=${id}`);
    },

    async rename(id: number, oldName: string, newName: string): Promise<void> {
        const cleanNew = newName.replace(/'/g, "''");
        const cleanOld = oldName.replace(/'/g, "''");

        // 1. Update dictionary
        await execute(`UPDATE Projects SET Name='${cleanNew}' WHERE ID=${id}`);

        // 2. Cascade update products
        await execute(`UPDATE Products SET Project='${cleanNew}' WHERE Project='${cleanOld}'`);
    }
};
