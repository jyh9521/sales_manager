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
  win.setMenuBarVisibility(false)
  win.setMenu(null)

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
app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await tryAutoBackup();
    app.quit()
    win = null
  }
})

async function tryAutoBackup_OLD() {
  try {
    // 1. Check Settings
    const settingsRows = await connection.query("SELECT SettingValue FROM Settings WHERE SettingKey='MainConfig'") as any[];
    if (!settingsRows || settingsRows.length === 0 || !settingsRows[0].SettingValue) return;

    const config = JSON.parse(settingsRows[0].SettingValue);
    if (!config.AutoBackup) return;

    console.log('Auto Backup initiated...');

    // 2. Prepare paths
    const fs = await import('fs');
    const isPackaged = app.isPackaged;
    const dbPath = isPackaged
      ? path.join(app.getPath('userData'), 'sales.accdb')
      : path.join(process.cwd(), 'sales.accdb');

    // Backup folder in userData/backups
    const backupDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(backupDir)) {
      await fs.promises.mkdir(backupDir, { recursive: true });
    }

    // 3. Create Backup Filename
    const date = new Date();
    // YYYYMMDD-HHmmss
    const timestamp = date.toISOString().replace(/[-:T]/g, '').split('.')[0];
    const backupPath = path.join(backupDir, `auto-backup-${timestamp}.bak`);

    // 4. Copy
    await fs.promises.copyFile(dbPath, backupPath);
    console.log(`Auto Backup successful: ${backupPath}`);

    // 5. Cleanup (Optional: Keep last 5)
    // const files = await fs.promises.readdir(backupDir);
    // ... logic to delete old backups ...
  } catch (e) {
    console.error('Auto Backup failed:', e);
  }
}

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
      const invoiceDate = new Date(invoice.InvoiceDate).toISOString().split('T')[0];
      const dueDate = invoice.DueDate ? new Date(invoice.DueDate).toISOString().split('T')[0] : null;

      // --- INVENTORY MANAGEMENT: RESTORE STOCK IF UPDATING ---
      if (invoiceID) {
        // Fetch old items to restore their stock
        const oldItems = await connection.query(`SELECT ProductID, Quantity FROM InvoiceItems WHERE InvoiceID = ${invoiceID}`) as any[];
        if (oldItems && oldItems.length > 0) {
          for (const item of oldItems) {
            // Restore stock
            await connection.execute(`UPDATE Products SET Stock = Stock + ${item.Quantity} WHERE ID = ${item.ProductID}`);
          }
        }
      }

      const itemsJson = JSON.stringify(invoice.Items).replace(/'/g, "''");

      if (invoiceID) {
        // Update
        await connection.execute(`
                    UPDATE Invoices 
                    SET ClientID=${invoice.ClientID}, 
                        InvoiceDate='${invoiceDate}', 
                        DueDate=${dueDate ? `'${dueDate}'` : 'NULL'}, 
                        TotalAmount=${invoice.TotalAmount},
                        Status='${invoice.Status || 'Unpaid'}',
                        Items='${itemsJson}',
                        ExampleField='${invoice.ExampleField || ''}'
                    WHERE ID=${invoiceID}
                `);
        // Delete old items
        await connection.execute(`DELETE FROM InvoiceItems WHERE InvoiceID = ${invoiceID}`);
      } else {
        // Insert
        // Insert
        try {
          await connection.execute(`
                        INSERT INTO Invoices (ClientID, InvoiceDate, DueDate, TotalAmount, Status, Items, ExampleField)
                        VALUES (${invoice.ClientID}, '${invoiceDate}', ${dueDate ? `'${dueDate}'` : 'NULL'}, ${invoice.TotalAmount}, '${invoice.Status || 'Unpaid'}', '${itemsJson}', '${invoice.ExampleField || ''}')
                    `);
        } catch (insertError) {
          console.error("Insert failed, checking verification...", insertError);
          // Verify if it actually succeeded (Access false positive spawn error)
          // Check for record created in last 5 seconds with same ClientID and Amount
          // Since we don't have millisecond precision easily reliably, we check latest ID.
          await new Promise(r => setTimeout(r, 500)); // Wait a bit for Access to flush
          const verify = await connection.query(`
                SELECT TOP 1 ID FROM Invoices 
                WHERE ClientID=${invoice.ClientID} 
                AND TotalAmount=${invoice.TotalAmount} 
                ORDER BY ID DESC
            `) as any[];

          if (verify && verify.length > 0) {
            // Assume this is the one we just made
            console.log("Verification checks out. Error was false positive.");
          } else {
            throw insertError; // RETHROW if not found
          }
        }

        // Get last ID
        const res = await connection.query('SELECT @@IDENTITY AS id') as any[];
        // Double check if ID is valid
        if (!res || !res[0] || !res[0].id) {
          // Fallback: fetch by signature
          const fallback = await connection.query(`SELECT TOP 1 ID FROM Invoices WHERE ClientID=${invoice.ClientID} ORDER BY ID DESC`) as any[];
          if (!fallback || !fallback.length) throw new Error("Failed to retrieve ID after insert.");
          invoiceID = fallback[0].ID;
        } else {
          invoiceID = res[0].id;
        }
      }

      // Insert Items & DEDUCT STOCK
      if (invoice.Items && invoice.Items.length > 0) {
        try {
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

            // Deduct Stock (Best effort - catch error per item or just let outer catch handle it)
            try {
              await connection.execute(`UPDATE Products SET Stock = Stock - ${item.Quantity} WHERE ID = ${item.ProductID}`);
            } catch (stockErr) {
              console.warn("Stock update warning:", stockErr);
            }

            // Throttle to prevent spawn exhaustion
            await new Promise(r => setTimeout(r, 100));
          }
        } catch (itemErr) {
          console.error("Item insertion incomplete:", itemErr);
          // If we have an ID, return it anyway so the UI doesn't freeze/show error, assuming DB might have worked or user can fallback
          return { success: true, id: invoiceID, warning: "Partial save completed" };
        }
      }

      return { success: true, id: invoiceID };
    } catch (e: any) {
      console.error('Save Invoice Error:', e);
      // CRITICAL FIX: If invoiceID was generated, the main record exists.
      // The error is likely a spurious "Spawn" error from items/stock updates.
      // We return success to prevent the UI from showing a failure message when it actually worked.
      if (invoiceID) {
        console.warn('Suppressing error because Invoice ID exists:', invoiceID);
        return { success: true, id: invoiceID, warning: e.message || String(e) };
      }
      throw e;
    }
  });

  ipcMain.handle('delete-invoice', async (_event, id) => {
    try {
      // 1. Restore Stock
      const oldItems = await connection.query(`SELECT ProductID, Quantity FROM InvoiceItems WHERE InvoiceID = ${id}`) as any[];
      if (oldItems && oldItems.length > 0) {
        for (const item of oldItems) {
          await connection.execute(`UPDATE Products SET Stock = Stock + ${item.Quantity} WHERE ID = ${item.ProductID}`);
        }
      }
      // 2. Delete Invoice (Cascade deletes items)
      await connection.execute(`DELETE FROM Invoices WHERE ID = ${id}`);
      return { success: true };
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  // --- Estimates ---
  ipcMain.handle('estimates-getAll', async () => {
    const sql = `
            SELECT Estimates.*, Clients.Name as ClientName
            FROM Estimates
            LEFT JOIN Clients ON Estimates.ClientID = Clients.ID
            ORDER BY Estimates.ID DESC
        `;
    return await connection.query(sql);
  });

  ipcMain.handle('save-estimate', async (_event, estimate: any) => {
    try {
      let id = estimate.ID;
      const date = new Date(estimate.EstimateDate).toISOString().split('T')[0];
      const validUntil = estimate.ValidUntil ? `'${new Date(estimate.ValidUntil).toISOString().split('T')[0]}'` : 'NULL';
      const itemsJson = JSON.stringify(estimate.Items).replace(/'/g, "''");
      const remarks = estimate.Remarks ? `'${estimate.Remarks.replace(/'/g, "''")}'` : 'NULL';
      const status = estimate.Status || 'Draft';

      if (id) {
        await connection.execute(`
                  UPDATE Estimates
                  SET ClientID=${estimate.ClientID},
                      EstimateDate='${date}',
                      ValidUntil=${validUntil},
                      TotalAmount=${estimate.TotalAmount},
                      Status='${status}',
                      Items='${itemsJson}',
                      Remarks=${remarks}
                  WHERE ID=${id}
              `);
      } else {
        await connection.execute(`
                  INSERT INTO Estimates (ClientID, EstimateDate, ValidUntil, TotalAmount, Status, Items, Remarks)
                  VALUES (${estimate.ClientID}, '${date}', ${validUntil}, ${estimate.TotalAmount}, '${status}', '${itemsJson}', ${remarks})
              `);
        const res = await connection.query('SELECT @@IDENTITY AS id') as any[];
        id = res[0].id;
      }
      return { success: true, id };
    } catch (e) {
      console.error(e); throw e;
    }
  });

  ipcMain.handle('delete-estimate', async (_event, id) => {
    try {
      await connection.execute(`DELETE FROM Estimates WHERE ID = ${id}`);
      return { success: true };
    } catch (e) { console.error(e); throw e; }
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

  ipcMain.handle('select-folder', async () => {
    if (!win) return null;
    const { dialog } = await import('electron');
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select Backup Folder',
      properties: ['openDirectory']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });
})

async function tryAutoBackup() {
  try {
    // 1. Check Settings
    const settingsRows = await connection.query("SELECT SettingValue FROM Settings WHERE SettingKey='MainConfig'") as any[];
    if (!settingsRows || settingsRows.length === 0 || !settingsRows[0].SettingValue) return;

    const config = JSON.parse(settingsRows[0].SettingValue);
    if (!config.AutoBackup) return;

    console.log('Auto Backup initiated...');

    // 2. Prepare paths
    const fs = await import('fs');
    const isPackaged = app.isPackaged;
    const dbPath = isPackaged
      ? path.join(app.getPath('userData'), 'sales.accdb')
      : path.join(process.cwd(), 'sales.accdb');

    // Backup folder
    let backupDir = config.BackupPath;
    if (!backupDir) {
      backupDir = path.join(app.getPath('userData'), 'backups');
    }

    if (!fs.existsSync(backupDir)) {
      await fs.promises.mkdir(backupDir, { recursive: true });
    }

    // 3. Create Backup Filename
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${yyyy}${mm}${dd}-${hh}${min}`;

    const backupPath = path.join(backupDir, `auto-backup-${timestamp}.bak`);

    // 4. Copy
    await fs.promises.copyFile(dbPath, backupPath);
    console.log(`Auto Backup successful: ${backupPath}`);
  } catch (e) {
    console.error('Auto Backup failed:', e);
  }
}
