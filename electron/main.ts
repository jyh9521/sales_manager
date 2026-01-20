import { app, BrowserWindow, ipcMain } from 'electron'
import { initDB, connection } from './db'

import { fileURLToPath } from 'node:url'
import path from 'node:path'


const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 构建目录结构
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 使用 ['ENV_NAME'] 避免 vite:define 插件问题 - Vite@2.x
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

  // 测试向渲染进程主动推送消息。
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

// 当所有窗口关闭时退出应用，除了 macOS。在这里，应用程序及其菜单栏正常应该会保持活动状态，
// 直到用户使用 Cmd + Q 显式退出。
app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await tryAutoBackup();
    app.quit()
    win = null
  }
})



app.on('activate', () => {
  // 在 OS X 上，常见的做法是当点击 dock 图标且没有打开的窗口时，
  // 在应用中重新创建一个窗口。
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

  // 数据库 IPC 处理程序
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

  // --- 单位 ---
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

  // --- 发票 ---
  ipcMain.handle('invoices-getAll', async () => {
    // ... (existing)
    // 确保也获取项目？通常先获取列表。
    // 列表的简化查询
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
    let invoiceID = Number(invoice.ID);
    console.log('=== SAVE INVOICE START ===', { invoiceID, clientID: invoice.ClientID });

    try {
      // 1. 验证客户是否存在 (防止外键约束错误)
      const clientCheck = await connection.query(`SELECT ID FROM Clients WHERE ID = ${invoice.ClientID}`) as any[];
      if (!clientCheck || clientCheck.length === 0) {
        console.error('Client not found:', invoice.ClientID);
        return { success: false, error: `客户 ID ${invoice.ClientID} 不存在` };
      }

      // 自动处理 ID: 如果为空或 NaN，则寻找下一个可用 ID
      if (!invoiceID || isNaN(invoiceID)) {
        const last = await connection.query('SELECT MAX(ID) as LastID FROM Invoices') as any[];
        invoiceID = (last?.[0]?.LastID || 0) + 1;
        console.log(`Generated new ID for invoice: ${invoiceID}`);
      }

      // 格式化日期以供 Access 使用 (YYYY-MM-DD)
      const invoiceDate = new Date(invoice.InvoiceDate).toISOString().split('T')[0];
      const dueDate = invoice.DueDate ? new Date(invoice.DueDate).toISOString().split('T')[0] : null;

      // 查看记录是否已真正存在于数据库中
      const existing = await connection.query(`SELECT ID FROM Invoices WHERE ID = ${invoiceID}`) as any[];
      const exists = existing && existing.length > 0;
      console.log('Invoice existence check:', { exists, invoiceID });

      // 转义 JSON 字符串中的单引号
      const itemsJson = JSON.stringify(invoice.Items).replace(/'/g, "''");
      const exampleFieldEscaped = (invoice.ExampleField || '').replace(/'/g, "''");

      if (exists) {
        // --- 更新逻辑 ---
        console.log(`Updating existing invoice #${invoiceID}...`);

        // 恢复旧项目的库存
        const oldItems = await connection.query(`SELECT ProductID, Quantity FROM InvoiceItems WHERE InvoiceID = ${invoiceID}`) as any[];
        if (oldItems && oldItems.length > 0) {
          for (const item of oldItems) {
            await connection.execute(`UPDATE Products SET Stock = Stock + ${item.Quantity} WHERE ID = ${item.ProductID}`);
          }
        }

        // 更新主表
        await connection.execute(`
          UPDATE Invoices 
          SET ClientID=${invoice.ClientID}, 
              InvoiceDate='${invoiceDate}', 
              DueDate=${dueDate ? `'${dueDate}'` : 'NULL'}, 
              TotalAmount=${invoice.TotalAmount},
              Status='${invoice.Status || 'Unpaid'}',
              Items='${itemsJson}',
              ExampleField='${exampleFieldEscaped}'
          WHERE ID=${invoiceID}
        `);

        // 删除旧项目以便重新插入
        await connection.execute(`DELETE FROM InvoiceItems WHERE InvoiceID = ${invoiceID}`);
      } else {
        // --- 插入逻辑 ---
        console.log(`Creating new invoice #${invoiceID}...`);

        // 如果 ID 冲突（虽然 exists 检查过，但为了安全再次确认最大 ID）
        // 这里的逻辑保持用户手动指定的 ID，直到确认冲突
        try {
          const insertSQL = `
            INSERT INTO Invoices (ID, ClientID, InvoiceDate, DueDate, TotalAmount, Status, Items, ExampleField)
            VALUES (${invoiceID}, ${invoice.ClientID}, '${invoiceDate}', ${dueDate ? `'${dueDate}'` : 'NULL'}, ${invoice.TotalAmount}, '${invoice.Status || 'Unpaid'}', '${itemsJson}', '${exampleFieldEscaped}')
          `;
          console.log('Insert SQL:', insertSQL);
          await connection.execute(insertSQL);
        } catch (insertError: any) {
          console.warn("Insert with ID failed, trying verify strategy:", insertError.message);
          // 验证是否已成功 (Access 有时会误报)
          await new Promise(r => setTimeout(r, 500));
          const verify = await connection.query(`SELECT ID FROM Invoices WHERE ID = ${invoiceID}`) as any[];
          if (!verify || verify.length === 0) {
            throw new Error(`发票主记录插入失败: ${insertError.message}`);
          }
        }

        // 等待 Access 文件系统同步
        await new Promise(r => setTimeout(r, 800));
      }

      // 3. 插入项目并扣除库存
      console.log(`Inserting items for invoice #${invoiceID}...`);
      if (invoice.Items && invoice.Items.length > 0) {
        for (const item of invoice.Items) {
          const itemDate = item.ItemDate ? `'${new Date(item.ItemDate).toISOString().split('T')[0]}'` : 'NULL';
          const remarks = (item.Remarks || '').replace(/'/g, "''");
          const unit = (item.Unit || '').replace(/'/g, "''");
          const project = (item.Project || '').replace(/'/g, "''");
          const taxRate = item.TaxRate || 10;

          const itemSQL = `
            INSERT INTO InvoiceItems (InvoiceID, ProductID, Quantity, UnitPrice, Unit, ItemDate, Remarks, Project, TaxRate)
            VALUES (${invoiceID}, ${item.ProductID}, ${item.Quantity}, ${item.UnitPrice}, '${unit}', ${itemDate}, '${remarks}', '${project}', ${taxRate})
          `;
          await connection.execute(itemSQL);

          // 扣除库存
          try {
            await connection.execute(`UPDATE Products SET Stock = Stock - ${item.Quantity} WHERE ID = ${item.ProductID}`);
          } catch (stockErr) {
            console.warn("Stock update warning:", stockErr);
          }

          await new Promise(r => setTimeout(r, 100)); // 节流
        }
      }

      console.log('=== SAVE INVOICE SUCCESS ===', invoiceID);
      return { success: true, id: invoiceID };

    } catch (e: any) {
      console.error('=== SAVE INVOICE ERROR ===', e);
      return { success: false, error: e.message || String(e) };
    }
  });

  ipcMain.handle('delete-invoice', async (_event, id) => {
    try {
      // 1. 恢复库存
      const oldItems = await connection.query(`SELECT ProductID, Quantity FROM InvoiceItems WHERE InvoiceID = ${id}`) as any[];
      if (oldItems && oldItems.length > 0) {
        for (const item of oldItems) {
          await connection.execute(`UPDATE Products SET Stock = Stock + ${item.Quantity} WHERE ID = ${item.ProductID}`);
        }
      }
      // 2. 删除发票 (级联删除项目)
      await connection.execute(`DELETE FROM Invoices WHERE ID = ${id}`);
      return { success: true };
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  // --- 报价单 ---
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
    let id = Number(estimate.ID);
    console.log('=== SAVE ESTIMATE START ===', { id, clientID: estimate.ClientID });

    try {
      // 自动处理 ID: 如果为空或 NaN，则寻找下一个可用 ID
      if (!id || isNaN(id)) {
        const last = await connection.query('SELECT MAX(ID) as LastID FROM Estimates') as any[];
        id = (last?.[0]?.LastID || 0) + 1;
        console.log(`Generated new ID for estimate: ${id}`);
      }

      const date = new Date(estimate.EstimateDate).toISOString().split('T')[0];
      const validUntil = estimate.ValidUntil ? `'${new Date(estimate.ValidUntil).toISOString().split('T')[0]}'` : 'NULL';
      const itemsJson = JSON.stringify(estimate.Items).replace(/'/g, "''");
      const remarks = estimate.Remarks ? `'${estimate.Remarks.replace(/'/g, "''")}'` : 'NULL';
      const status = estimate.Status || 'Draft';

      // 检查记录是否已存在 (支持手动 ID)
      const existing = await connection.query(`SELECT ID FROM Estimates WHERE ID = ${id}`) as any[];
      const exists = existing && existing.length > 0;

      if (exists) {
        console.log(`Updating existing estimate #${id}...`);
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
        console.log(`Creating new estimate #${id}...`);
        await connection.execute(`
          INSERT INTO Estimates (ID, ClientID, EstimateDate, ValidUntil, TotalAmount, Status, Items, Remarks)
          VALUES (${id}, ${estimate.ClientID}, '${date}', ${validUntil}, ${estimate.TotalAmount}, '${status}', '${itemsJson}', ${remarks})
        `);

        // 如果是自增 ID 或需要获取最新 ID，可以按需调整，但目前前端通常带手动 ID
        await new Promise(r => setTimeout(r, 500));
      }

      console.log('=== SAVE ESTIMATE SUCCESS ===', id);
      return { success: true, id };
    } catch (e: any) {
      console.error('=== SAVE ESTIMATE ERROR ===', e);
      return { success: false, error: e.message || String(e) };
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
      // 创建安全备份
      await fs.promises.copyFile(dbPath, dbPath + '.pre-restore.bak').catch(() => { });

      // 还原
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
    // 1. 检查设置
    const settingsRows = await connection.query("SELECT SettingValue FROM Settings WHERE SettingKey='MainConfig'") as any[];
    if (!settingsRows || settingsRows.length === 0 || !settingsRows[0].SettingValue) return;

    const config = JSON.parse(settingsRows[0].SettingValue);
    if (!config.AutoBackup) return;

    console.log('Auto Backup initiated...');

    // 2. 准备路径
    const fs = await import('fs');
    const isPackaged = app.isPackaged;
    const dbPath = isPackaged
      ? path.join(app.getPath('userData'), 'sales.accdb')
      : path.join(process.cwd(), 'sales.accdb');

    // 备份文件夹
    let backupDir = config.BackupPath;
    if (!backupDir) {
      backupDir = path.join(app.getPath('userData'), 'backups');
    }

    if (!fs.existsSync(backupDir)) {
      await fs.promises.mkdir(backupDir, { recursive: true });
    }

    // 3. 创建备份文件名
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${yyyy}${mm}${dd}-${hh}${min}`;

    const backupPath = path.join(backupDir, `auto-backup-${timestamp}.bak`);

    // 4. 复制文件
    await fs.promises.copyFile(dbPath, backupPath);
    console.log(`Auto Backup successful: ${backupPath}`);
  } catch (e) {
    console.error('Auto Backup failed:', e);
  }
}
