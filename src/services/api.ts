interface DBResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export async function query<T = any>(sql: string): Promise<T> {
    const response: DBResult<T> = await window.ipcRenderer.invoke('db-query', sql);
    if (!response.success) {
        throw new Error(response.error);
    }
    return response.data as T;
}

export async function execute(sql: string): Promise<any> {
    const response: DBResult<any> = await window.ipcRenderer.invoke('db-execute', sql);
    if (!response.success) {
        throw new Error(response.error);
    }
    return response.data;
}
