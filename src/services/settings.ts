import { query, execute } from './api';

export interface AppSettings {
    CompanyName: string;
    ZipCode: string;
    Address: string;
    Phone: string;
    BankName: string;
    BranchName: string;
    AccountType: string;
    AccountNumber: string;
    AccountHolder: string;
    RegistrationNumber: string; // T番号
    Logo?: string; // Base64 图像
    PrimaryColor?: string; // Hex 颜色
    AutoBackup?: boolean;
    BackupPath?: string;
}

export const defaultSettings: AppSettings = {
    CompanyName: '〇〇〇〇株式会社',
    ZipCode: '〒000-0000',
    Address: '東京都千代田区...',
    Phone: '03-0000-0000',
    BankName: '〇〇銀行',
    BranchName: '〇〇支店',
    AccountType: '普通',
    AccountNumber: '1234567',
    AccountHolder: 'カ）xxxx',
    RegistrationNumber: 'T1234567890123',
    Logo: '',
    PrimaryColor: '#1976d2', // 默认蓝色
    AutoBackup: false,
    BackupPath: ''
};

export const settingsService = {
    async get(): Promise<AppSettings> {
        // Access 对 JSON 类型支持不佳，因此我们将每个字段存储为行或将一个大 JSON blob 存储在 MEMO 字段中。
        // 让我们使用 Key='MainConfig' 和 Value=JSON 字符串的一行。
        const sql = "SELECT SettingValue FROM Settings WHERE SettingKey='MainConfig'";
        try {
            const res = await query<{ SettingValue: string }[]>(sql);
            if (res && res.length > 0 && res[0].SettingValue) {
                const loaded = JSON.parse(res[0].SettingValue);
                return { ...defaultSettings, ...loaded };
            }
        } catch (e) {
            console.warn("Failed to load settings, using default", e);
        }
        return defaultSettings;
    },

    async save(settings: AppSettings): Promise<void> {
        const json = JSON.stringify(settings).replace(/'/g, "''");
        // 检查是否存在
        const check = await query("SELECT SettingKey FROM Settings WHERE SettingKey='MainConfig'");
        if (check && check.length > 0) {
            await execute(`UPDATE Settings SET SettingValue='${json}' WHERE SettingKey='MainConfig'`);
        } else {
            await execute(`INSERT INTO Settings (SettingKey, SettingValue) VALUES ('MainConfig', '${json}')`);
        }
    }
};
