import { app, BrowserWindow, ipcMain } from "electron";
import ADODB from "node-adodb";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
const isPackaged = app.isPackaged;
const DB_PATH = isPackaged ? path.join(app.getPath("userData"), "sales.accdb") : path.join(process.cwd(), "sales.accdb");
console.log("Database Path:", DB_PATH);
const connection = ADODB.open(`Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${DB_PATH};Persist Security Info=False;`, true);
async function initDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    console.log("Creating new Access database...");
    try {
      const cmd = `$catalog = New-Object -ComObject ADOX.Catalog; $catalog.Create('Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${DB_PATH}');`;
      execSync(`powershell -Command "${cmd}"`);
      console.log("Database file created successfully.");
    } catch (error) {
      console.error("Failed to create database:", error);
      throw error;
    }
  } else {
    console.log("Database already exists.");
  }
  await createSchema();
}
async function createSchema() {
  try {
    await connection.execute(`
      CREATE TABLE Settings (
        SettingKey VARCHAR(255) PRIMARY KEY,
        SettingValue MEMO
      )
    `).catch(() => {
    });
    await connection.execute(`
      CREATE TABLE Clients (
        ID AUTOINCREMENT PRIMARY KEY,
        Name VARCHAR(100),
        Address MEMO,
        ContactInfo MEMO,
        IsActive BIT DEFAULT 1
      )
    `).catch(() => {
    });
    await connection.execute(`
      CREATE TABLE Projects (
        ID AUTOINCREMENT PRIMARY KEY,
        Name VARCHAR(255) UNIQUE
      )
    `).catch(() => {
    });
    await connection.execute(`
      CREATE TABLE Units (
        ID AUTOINCREMENT PRIMARY KEY,
        Name VARCHAR(100) UNIQUE
      )
    `).catch(() => {
    });
    await connection.execute(`
      CREATE TABLE Products (
        ID AUTOINCREMENT PRIMARY KEY,
        Code VARCHAR(50),
        Name VARCHAR(100),
        Description MEMO,
        UnitPrice CURRENCY,
        ClientIDs MEMO,
        Project VARCHAR(255),
        TaxRate INT DEFAULT 10,
        IsActive BIT DEFAULT 1
      )
    `).catch(() => {
    });
    await connection.execute(`
      CREATE TABLE InvoiceItems (
        ID AUTOINCREMENT PRIMARY KEY,
        InvoiceID INT,
        ProductID INT,
        Quantity INT,
        UnitPrice CURRENCY,
        Unit VARCHAR(50),
        ItemDate DATETIME,
        ItemDate DATETIME,
        Remarks MEMO,
        Project VARCHAR(255),
        TaxRate INT DEFAULT 10,
        FOREIGN KEY (InvoiceID) REFERENCES Invoices(ID) ON DELETE CASCADE
      )
    `).catch(() => {
    });
    await connection.execute(`
      CREATE TABLE Invoices (
        ID AUTOINCREMENT PRIMARY KEY,
        ClientID LONG,
        InvoiceDate DATETIME,
        TotalAmount CURRENCY,
        Status VARCHAR(50) DEFAULT 'Unpaid',
        DueDate DATETIME,
        ExampleField MEMO
      )
    `).catch(() => {
    });
    try {
      await connection.execute(`ALTER TABLE Invoices ADD COLUMN Status VARCHAR(50) DEFAULT 'Unpaid'`);
    } catch (e) {
    }
    try {
      await connection.execute(`ALTER TABLE Invoices ADD COLUMN DueDate DATETIME`);
    } catch (e) {
    }
    try {
      await connection.execute(`ALTER TABLE Invoices ADD COLUMN ExampleField MEMO`);
    } catch (e) {
    }
    try {
      await connection.execute(`ALTER TABLE Invoices ADD COLUMN Items MEMO`);
    } catch (e) {
    }
    try {
      await connection.execute(`ALTER TABLE Products ADD COLUMN Project VARCHAR(255)`);
    } catch (e) {
    }
    try {
      await connection.execute("ALTER TABLE InvoiceItems ADD COLUMN Remarks MEMO");
    } catch (e) {
    }
    try {
      await connection.execute("ALTER TABLE Products ADD COLUMN TaxRate INT DEFAULT 10");
    } catch (e) {
    }
    try {
      await connection.execute("ALTER TABLE InvoiceItems ADD COLUMN TaxRate INT DEFAULT 10");
    } catch (e) {
    }
    try {
      await connection.execute(`ALTER TABLE Products ADD COLUMN IsActive BIT DEFAULT 1`);
      await connection.execute(`UPDATE Products SET IsActive = 1 WHERE IsActive IS NULL`);
    } catch (e) {
    }
    try {
      await connection.execute(`
            INSERT INTO Projects (Name) 
            SELECT DISTINCT Project FROM Products 
            WHERE Project IS NOT NULL AND Project <> ''
        `);
    } catch (e) {
    }
    console.log("Database schema initialized.");
  } catch (error) {
    console.error("Error creating schema:", error);
  }
}
const __dirname$1 = path$1.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path$1.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path$1.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path$1.join(__dirname$1, "preload.mjs")
    }
  });
  win.setMenuBarVisibility(false);
  win.setMenu(null);
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$1.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(async () => {
  try {
    await initDB();
    console.log("Database initialized successfully");
  } catch (e) {
    console.error("Database initialization failed:", e);
  }
  createWindow();
  ipcMain.handle("db-query", async (_event, sql) => {
    console.log("SQL Query:", sql);
    try {
      const result = await connection.query(sql);
      return { success: true, data: result };
    } catch (e) {
      console.error("SQL Error:", e);
      return { success: false, error: e.message || String(e) };
    }
  });
  ipcMain.handle("db-execute", async (_event, sql) => {
    console.log("SQL Execute:", sql);
    try {
      const result = await connection.execute(sql);
      return { success: true, data: result };
    } catch (e) {
      console.error("SQL Error:", e);
      return { success: false, error: e.message || String(e) };
    }
  });
  ipcMain.handle("units-getAll", async () => {
    try {
      return await connection.query("SELECT * FROM Units ORDER BY Name ASC");
    } catch (error) {
      console.error(error);
      return [];
    }
  });
  ipcMain.handle("units-add", async (_event, name) => {
    try {
      await connection.execute(`INSERT INTO Units (Name) VALUES ('${name}')`);
      return { success: true };
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
  ipcMain.handle("units-delete", async (_event, id) => {
    try {
      await connection.execute(`DELETE FROM Units WHERE ID = ${id}`);
      return { success: true };
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
  ipcMain.handle("units-rename", async (_event, id, newName) => {
    try {
      await connection.execute(`UPDATE Units SET Name = '${newName}' WHERE ID = ${id}`);
      return { success: true };
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
  ipcMain.handle("invoices-getAll", async () => {
    const sql = `
            SELECT Invoices.*, Clients.Name as ClientName
            FROM Invoices
            LEFT JOIN Clients ON Invoices.ClientID = Clients.ID
            ORDER BY Invoices.ID DESC
        `;
    return await connection.query(sql);
  });
  ipcMain.handle("invoices-getOne", async (_event, id) => {
    const invoice = await connection.query(`SELECT * FROM Invoices WHERE ID = ${id}`);
    const items = await connection.query(`
            SELECT InvoiceItems.*, Products.Name as ProductName, Products.Code as ProductCode 
            FROM InvoiceItems 
            LEFT JOIN Products ON InvoiceItems.ProductID = Products.ID 
            WHERE InvoiceID = ${id}
        `);
    return { ...invoice[0], Items: items };
  });
  ipcMain.handle("save-invoice", async (_event, invoice) => {
    try {
      let invoiceID = invoice.ID;
      const invoiceDate = new Date(invoice.InvoiceDate).toISOString().split("T")[0];
      const dueDate = invoice.DueDate ? new Date(invoice.DueDate).toISOString().split("T")[0] : null;
      if (invoiceID) {
        await connection.execute(`
                    UPDATE Invoices 
                    SET ClientID=${invoice.ClientID}, 
                        InvoiceDate='${invoiceDate}', 
                        DueDate=${dueDate ? `'${dueDate}'` : "NULL"}, 
                        TotalAmount=${invoice.TotalAmount},
                        Status='${invoice.Status || "Unpaid"}',
                        ExampleField='${invoice.ExampleField || ""}'
                    WHERE ID=${invoiceID}
                `);
        await connection.execute(`DELETE FROM InvoiceItems WHERE InvoiceID = ${invoiceID}`);
      } else {
        await connection.query(`
                    INSERT INTO Invoices (ClientID, InvoiceDate, DueDate, TotalAmount, Status, ExampleField)
                    VALUES (${invoice.ClientID}, '${invoiceDate}', ${dueDate ? `'${dueDate}'` : "NULL"}, ${invoice.TotalAmount}, '${invoice.Status || "Unpaid"}', '${invoice.ExampleField || ""}')
                `);
        const res = await connection.query("SELECT @@IDENTITY AS id");
        invoiceID = res[0].id;
      }
      if (invoice.Items && invoice.Items.length > 0) {
        for (const item of invoice.Items) {
          const itemDate = item.ItemDate ? `'${new Date(item.ItemDate).toISOString().split("T")[0]}'` : "NULL";
          const remarks = item.Remarks ? `'${item.Remarks.replace(/'/g, "''")}'` : "NULL";
          const unit = item.Unit ? `'${item.Unit.replace(/'/g, "''")}'` : "NULL";
          const project = item.Project ? `'${item.Project.replace(/'/g, "''")}'` : "NULL";
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
  ipcMain.handle("save-backup", async () => {
    if (!win) return { success: false, error: "Window not found" };
    const date = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "");
    const defaultName = `database-backup-${date}.bak`;
    const { dialog } = await import("electron");
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Save Database Backup",
      defaultPath: defaultName,
      filters: [{ name: "Backup File", extensions: ["bak", "accdb"] }]
    });
    if (canceled || !filePath) return { success: false, canceled: true };
    try {
      const isPackaged2 = app.isPackaged;
      const dbPath = isPackaged2 ? path$1.join(app.getPath("userData"), "sales.accdb") : path$1.join(process.cwd(), "sales.accdb");
      const fs2 = await import("fs");
      await fs2.promises.copyFile(dbPath, filePath);
      return { success: true, path: filePath };
    } catch (e) {
      console.error("Backup failed:", e);
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle("restore-backup", async () => {
    if (!win) return { success: false, error: "Window not found" };
    const { dialog } = await import("electron");
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: "Select Backup File to Restore",
      properties: ["openFile"],
      filters: [{ name: "Backup File", extensions: ["bak", "accdb"] }]
    });
    if (canceled || !filePaths[0]) return { success: false, canceled: true };
    try {
      const isPackaged2 = app.isPackaged;
      const dbPath = isPackaged2 ? path$1.join(app.getPath("userData"), "sales.accdb") : path$1.join(process.cwd(), "sales.accdb");
      const fs2 = await import("fs");
      await fs2.promises.copyFile(dbPath, dbPath + ".pre-restore.bak").catch(() => {
      });
      await fs2.promises.copyFile(filePaths[0], dbPath);
      return { success: true };
    } catch (e) {
      console.error("Restore failed:", e);
      return { success: false, error: e.message };
    }
  });
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
