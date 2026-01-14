import { query, execute } from './api';

export interface Client {
    ID: number;
    Name: string;
    Address: string;
    ContactInfo: string;
    IsActive: boolean;
}

export const clientService = {
    async getAll(): Promise<Client[]> {
        const sql = "SELECT * FROM Clients ORDER BY ID DESC";
        const clients = await query<any[]>(sql);
        // 归一化 BIT/Boolean
        return clients.map(c => ({
            ...c,
            IsActive: !!c.IsActive
        }));
    },

    async add(client: Omit<Client, 'ID'>): Promise<number> {
        const name = client.Name.replace(/'/g, "''");
        const address = (client.Address || '').replace(/'/g, "''");
        const contact = (client.ContactInfo || '').replace(/'/g, "''");
        const isActive = client.IsActive ? 1 : 0;

        const sql = `INSERT INTO Clients (Name, Address, ContactInfo, IsActive) VALUES ('${name}', '${address}', '${contact}', ${isActive})`;
        await execute(sql);

        const idRes = await query<{ ID: number }[]>("SELECT TOP 1 ID FROM Clients ORDER BY ID DESC");
        return idRes[0]?.ID || 0;
    },

    async update(client: Client): Promise<void> {
        const name = client.Name.replace(/'/g, "''");
        const address = (client.Address || '').replace(/'/g, "''");
        const contact = (client.ContactInfo || '').replace(/'/g, "''");
        const isActive = client.IsActive ? 1 : 0;

        const sql = `UPDATE Clients SET Name='${name}', Address='${address}', ContactInfo='${contact}', IsActive=${isActive} WHERE ID=${client.ID}`;
        await execute(sql);
    },

    async delete(id: number): Promise<void> {
        await execute(`DELETE FROM Clients WHERE ID=${id}`);
    }
}
