const IPC = (window as any).ipcRenderer;

export interface Unit {
    ID: number;
    Name: string;
}

export const unitService = {
    getAll: async (): Promise<Unit[]> => {
        return await IPC.invoke('units-getAll');
    },
    add: async (name: string) => {
        if (!name) return;
        return await IPC.invoke('units-add', name);
    },
    delete: async (id: number) => {
        return await IPC.invoke('units-delete', id);
    },
    rename: async (id: number, newName: string) => {
        return await IPC.invoke('units-rename', id, newName);
    }
};
