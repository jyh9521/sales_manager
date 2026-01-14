import { query } from './api';

export interface User {
    ID: number;
    Username: string;
    Role: string;
}

export const authService = {
    async login(username: string, password: string): Promise<User | null> {
        // Basic sanitization
        const safeUser = username.replace(/'/g, "''");

        const sql = `SELECT * FROM Users WHERE Username = '${safeUser}'`;
        const users = await query<any[]>(sql);

        if (users && users.length > 0) {
            const user = users[0];
            // In a real app, verify hash. checking plain string for now as seeded.
            if (user.PasswordHash === password) {
                return {
                    ID: user.ID,
                    Username: user.Username,
                    Role: user.Role
                };
            }
        }
        return null;
    }
};
