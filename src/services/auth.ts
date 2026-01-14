import { query } from './api';

export interface User {
    ID: number;
    Username: string;
    Role: string;
}

export const authService = {
    async login(username: string, password: string): Promise<User | null> {
        // 基本清理
        const safeUser = username.replace(/'/g, "''");

        const sql = `SELECT * FROM Users WHERE Username = '${safeUser}'`;
        const users = await query<any[]>(sql);

        if (users && users.length > 0) {
            const user = users[0];
            // 在真实应用中，验证哈希。目前检查纯字符串，因为是种子数据。
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
