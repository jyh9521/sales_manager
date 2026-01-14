import { app, BrowserWindow, ipcMain } from 'electron'
import { initDB, connection } from './db'

import { fileURLToPath } from 'node:url'
import path from 'node:path'


const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  try {
    await initDB();
    console.log("Database initialized successfully");
  } catch (e) {
    console.error("Database initialization failed:", e);
  }
  createWindow();

  // Database IPC Handlers
  ipcMain.handle('db-query', async (_event, sql) => {
    console.log('SQL Query:', sql);
    try {
      const result = await connection.query(sql);
      return { success: true, data: result };
    } catch (e: any) {
      console.error('SQL Error:', e);
      return { success: false, error: e.message || String(e) };
    }
  });

  ipcMain.handle('db-execute', async (_event, sql) => {
    console.log('SQL Execute:', sql);
    try {
      const result = await connection.execute(sql);
      return { success: true, data: result };
    } catch (e: any) {
      console.error('SQL Error:', e);
      return { success: false, error: e.message || String(e) };
    }
  });

  // --- Units ---
  ipcMain.handle('units-getAll', async () => {
    try {
      return await connection.query('SELECT * FROM Units ORDER BY Name ASC');
    } catch (error) {
      console.error(error);
      return [];
    }
  });

  ipcMain.handle('units-add', async (_event, name) => {
    try {
      await connection.execute(`INSERT INTO Units (Name) VALUES ('${name}')`);
      return { success: true };
    } catch (error) {
      console.error(error);
      throw error;
    }
  });

  ipcMain.handle('units-delete', async (_event, id) => {
    try {
      await connection.execute(`DELETE FROM Units WHERE ID = ${id}`);
      return { success: true };
    } catch (error) {
      console.error(error); throw error;
    }
  });

  ipcMain.handle('units-rename', async (_event, id, newName) => {
    try {
      await connection.execute(`UPDATE Units SET Name = '${newName}' WHERE ID = ${id}`);
      return { success: true };
    } catch (error) {
      console.error(error); throw error;
    }
  });

  // --- Invoices ---
  ipcMain.handle('invoices-getAll', async () => {
    // ... (existing)
    // Ensure we fetch items too? Usually fetch list first.
    // Simplified query for list
    const sql = `
            SELECT Invoices.*, Clients.Name as ClientName
            FROM Invoices
            LEFT JOIN Clients ON Invoices.ClientID = Clients.ID
            ORDER BY Invoices.ID DESC
        `;
    return await connection.query(sql);
  });

  ipcMain.handle('invoices-getOne', async (_event, id) => {
    const invoice = await connection.query(`SELECT * FROM Invoices WHERE ID = ${id}`) as any[];
    const items = await connection.query(`
            SELECT InvoiceItems.*, Products.Name as ProductName, Products.Code as ProductCode 
            FROM InvoiceItems 
            LEFT JOIN Products ON InvoiceItems.ProductID = Products.ID 
            WHERE InvoiceID = ${id}
        `);
    return { ...invoice[0], Items: items };
  });

  ipcMain.handle('save-invoice', async (_event, invoice: any) => {
    try {
      let invoiceID = invoice.ID;

      // Format Date for Access (YYYY-MM-DD)
      // Access is picky about dates. Strings usually work if format is standard.
      const invoiceDate = new Date(invoice.InvoiceDate).toISOString().split('T')[0];
      const dueDate = invoice.DueDate ? new Date(invoice.DueDate).toISOString().split('T')[0] : null;

      if (invoiceID) {
        // Update
        await connection.execute(`
                    UPDATE Invoices 
                    SET ClientID=${invoice.ClientID}, 
                        InvoiceDate='${invoiceDate}', 
                        DueDate=${dueDate ? `'${dueDate}'` : 'NULL'}, 
                        TotalAmount=${invoice.TotalAmount},
                        Status='${invoice.Status || 'Unpaid'}',
                        ExampleField='${invoice.ExampleField || ''}'
                    WHERE ID=${invoiceID}
                `);
        // Delete old items
        await connection.execute(`DELETE FROM InvoiceItems WHERE InvoiceID = ${invoiceID}`);
      } else {
        // Insert
        await connection.query(`
                    INSERT INTO Invoices (ClientID, InvoiceDate, DueDate, TotalAmount, Status, ExampleField)
                    VALUES (${invoice.ClientID}, '${invoiceDate}', ${dueDate ? `'${dueDate}'` : 'NULL'}, ${invoice.TotalAmount}, '${invoice.Status || 'Unpaid'}', '${invoice.ExampleField || ''}')
                `);
        // Get last ID
        const res = await connection.query('SELECT @@IDENTITY AS id') as any[];
        invoiceID = res[0].id;
      }

      // Insert Items
      if (invoice.Items && invoice.Items.length > 0) {
        for (const item of invoice.Items) {
          const itemDate = item.ItemDate ? `'${new Date(item.ItemDate).toISOString().split('T')[0]}'` : 'NULL';
          const remarks = item.Remarks ? `'${item.Remarks.replace(/'/g, "''")}'` : 'NULL'; // Escape quotes
          const unit = item.Unit ? `'${item.Unit.replace(/'/g, "''")}'` : 'NULL';
          const project = item.Project ? `'${item.Project.replace(/'/g, "''")}'` : 'NULL';
          const taxRate = item.TaxRate || 10;

          await connection.execute(`
                       INSERT INTO InvoiceItems (InvoiceID, ProductID, Quantity, UnitPrice, Unit, ItemDate, Remarks, Project, TaxRate)
                       VALUES (${invoiceID}, ${item.ProductID}, ${item.Quantity}, ${item.UnitPrice}, ${unit}, ${itemDate}, ${remarks}, ${project}, ${taxRate})
                   `);
        }
      }

      return { success: true, id: invoiceID };
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.handle('save-backup', async () => {
    if (!win) return { success: false, error: 'Window not found' };

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const defaultName = `database-backup-${date}.bak`;

    const { dialog } = await import('electron');
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save Database Backup',
      defaultPath: defaultName,
      filters: [{ name: 'Backup File', extensions: ['bak', 'accdb'] }]
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    try {
      const isPackaged = app.isPackaged;
      const dbPath = isPackaged
        ? path.join(app.getPath('userData'), 'sales.accdb')
        : path.join(process.cwd(), 'sales.accdb');

      const fs = await import('fs');
      await fs.promises.copyFile(dbPath, filePath);
      return { success: true, path: filePath };
    } catch (e: any) {
      console.error('Backup failed:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('restore-backup', async () => {
    if (!win) return { success: false, error: 'Window not found' };

    const { dialog } = await import('electron');
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select Backup File to Restore',
      properties: ['openFile'],
      filters: [{ name: 'Backup File', extensions: ['bak', 'accdb'] }]
    });

    if (canceled || !filePaths[0]) return { success: false, canceled: true };

    try {
      const isPackaged = app.isPackaged;
      const dbPath = isPackaged
        ? path.join(app.getPath('userData'), 'sales.accdb')
        : path.join(process.cwd(), 'sales.accdb');

      const fs = await import('fs');
      // Create safety backup
      await fs.promises.copyFile(dbPath, dbPath + '.pre-restore.bak').catch(() => { });

      // Restore
      await fs.promises.copyFile(filePaths[0], dbPath);
      return { success: true };
    } catch (e: any) {
      console.error('Restore failed:', e);
      return { success: false, error: e.message };
    }
  });
})
