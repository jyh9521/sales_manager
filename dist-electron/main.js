import { app as l, BrowserWindow as R, ipcMain as E } from "electron";
import w from "node-adodb";
import A from "path";
import D from "fs";
import { execSync as h } from "child_process";
import { fileURLToPath as U } from "node:url";
import i from "node:path";
const O = l.isPackaged, u = O ? A.join(l.getPath("userData"), "sales.accdb") : A.join(process.cwd(), "sales.accdb");
console.log("Database Path:", u);
const a = w.open(`Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${u};Persist Security Info=False;`, !0);
async function S() {
  const c = A.dirname(u);
  if (D.existsSync(c) || D.mkdirSync(c, { recursive: !0 }), D.existsSync(u))
    console.log("Database already exists.");
  else {
    console.log("Creating new Access database...");
    try {
      const e = `$catalog = New-Object -ComObject ADOX.Catalog; $catalog.Create('Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${u}');`;
      h(`powershell -Command "${e}"`), console.log("Database file created successfully.");
    } catch (e) {
      throw console.error("Failed to create database:", e), e;
    }
  }
  await y();
}
async function y() {
  try {
    await a.execute(`
      CREATE TABLE Settings (
        SettingKey VARCHAR(255) PRIMARY KEY,
        SettingValue MEMO
      )
    `).catch(() => {
    }), await a.execute(`
      CREATE TABLE Clients (
        ID AUTOINCREMENT PRIMARY KEY,
        Name VARCHAR(100),
        Address MEMO,
        ContactInfo MEMO,
        IsActive BIT DEFAULT 1
      )
    `).catch(() => {
    }), await a.execute(`
      CREATE TABLE Projects (
        ID AUTOINCREMENT PRIMARY KEY,
        Name VARCHAR(255) UNIQUE
      )
    `).catch(() => {
    }), await a.execute(`
      CREATE TABLE Units (
        ID AUTOINCREMENT PRIMARY KEY,
        Name VARCHAR(100) UNIQUE
      )
    `).catch(() => {
    }), await a.execute(`
      CREATE TABLE Products (
        ID AUTOINCREMENT PRIMARY KEY,
        Code VARCHAR(50),
        Name VARCHAR(100),
        Description MEMO,
        UnitPrice CURRENCY,
        ClientIDs MEMO,
        Project VARCHAR(255),
        UnitPrice CURRENCY,
        ClientIDs MEMO,
        Project VARCHAR(255),
        TaxRate INT DEFAULT 10,
        IsActive BIT DEFAULT 1
      )
    `).catch(() => {
    }), await a.execute(`
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
    }), await a.execute(`
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
      await a.execute("ALTER TABLE Invoices ADD COLUMN Status VARCHAR(50) DEFAULT 'Unpaid'");
    } catch {
    }
    try {
      await a.execute("ALTER TABLE Invoices ADD COLUMN DueDate DATETIME");
    } catch {
    }
    try {
      await a.execute("ALTER TABLE Invoices ADD COLUMN ExampleField MEMO");
    } catch {
    }
    try {
      await a.execute("ALTER TABLE Products ADD COLUMN Project VARCHAR(255)");
    } catch {
    }
    try {
      await a.execute("ALTER TABLE InvoiceItems ADD COLUMN Remarks MEMO");
    } catch {
    }
    try {
      await a.execute("ALTER TABLE Products ADD COLUMN TaxRate INT DEFAULT 10");
    } catch {
    }
    try {
      await a.execute("ALTER TABLE InvoiceItems ADD COLUMN TaxRate INT DEFAULT 10");
    } catch {
    }
    try {
      await a.execute("ALTER TABLE Products ADD COLUMN IsActive BIT DEFAULT 1"), await a.execute("UPDATE Products SET IsActive = 1 WHERE IsActive IS NULL");
    } catch {
    }
    try {
      await a.execute(`
            INSERT INTO Projects (Name) 
            SELECT DISTINCT Project FROM Products 
            WHERE Project IS NOT NULL AND Project <> ''
        `);
    } catch {
    }
    console.log("Database schema initialized.");
  } catch (c) {
    console.error("Error creating schema:", c);
  }
}
const m = i.dirname(U(import.meta.url));
process.env.APP_ROOT = i.join(m, "..");
const T = process.env.VITE_DEV_SERVER_URL, b = i.join(process.env.APP_ROOT, "dist-electron"), L = i.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = T ? i.join(process.env.APP_ROOT, "public") : L;
let n;
function C() {
  n = new R({
    icon: i.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: i.join(m, "preload.mjs")
    }
  }), n.webContents.on("did-finish-load", () => {
    n == null || n.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), T ? n.loadURL(T) : n.loadFile(i.join(L, "index.html"));
}
l.on("window-all-closed", () => {
  process.platform !== "darwin" && (l.quit(), n = null);
});
l.on("activate", () => {
  R.getAllWindows().length === 0 && C();
});
l.whenReady().then(async () => {
  try {
    await S(), console.log("Database initialized successfully");
  } catch (c) {
    console.error("Database initialization failed:", c);
  }
  C(), E.handle("db-query", async (c, e) => {
    console.log("SQL Query:", e);
    try {
      return { success: !0, data: await a.query(e) };
    } catch (t) {
      return console.error("SQL Error:", t), { success: !1, error: t.message || String(t) };
    }
  }), E.handle("db-execute", async (c, e) => {
    console.log("SQL Execute:", e);
    try {
      return { success: !0, data: await a.execute(e) };
    } catch (t) {
      return console.error("SQL Error:", t), { success: !1, error: t.message || String(t) };
    }
  }), E.handle("units-getAll", async () => {
    try {
      return await a.query("SELECT * FROM Units ORDER BY Name ASC");
    } catch (c) {
      return console.error(c), [];
    }
  }), E.handle("units-add", async (c, e) => {
    try {
      return await a.execute(`INSERT INTO Units (Name) VALUES ('${e}')`), { success: !0 };
    } catch (t) {
      throw console.error(t), t;
    }
  }), E.handle("units-delete", async (c, e) => {
    try {
      return await a.execute(`DELETE FROM Units WHERE ID = ${e}`), { success: !0 };
    } catch (t) {
      throw console.error(t), t;
    }
  }), E.handle("units-rename", async (c, e, t) => {
    try {
      return await a.execute(`UPDATE Units SET Name = '${t}' WHERE ID = ${e}`), { success: !0 };
    } catch (r) {
      throw console.error(r), r;
    }
  }), E.handle("invoices-getAll", async () => await a.query(`
            SELECT Invoices.*, Clients.Name as ClientName
            FROM Invoices
            LEFT JOIN Clients ON Invoices.ClientID = Clients.ID
            ORDER BY Invoices.ID DESC
        `)), E.handle("invoices-getOne", async (c, e) => {
    const t = await a.query(`SELECT * FROM Invoices WHERE ID = ${e}`), r = await a.query(`
            SELECT InvoiceItems.*, Products.Name as ProductName, Products.Code as ProductCode 
            FROM InvoiceItems 
            LEFT JOIN Products ON InvoiceItems.ProductID = Products.ID 
            WHERE InvoiceID = ${e}
        `);
    return { ...t[0], Items: r };
  }), E.handle("save-invoice", async (c, e) => {
    try {
      let t = e.ID;
      const r = new Date(e.InvoiceDate).toISOString().split("T")[0], o = e.DueDate ? new Date(e.DueDate).toISOString().split("T")[0] : null;
      if (t ? (await a.execute(`
                    UPDATE Invoices 
                    SET ClientID=${e.ClientID}, 
                        InvoiceDate='${r}', 
                        DueDate=${o ? `'${o}'` : "NULL"}, 
                        TotalAmount=${e.TotalAmount},
                        Status='${e.Status || "Unpaid"}',
                        ExampleField='${e.ExampleField || ""}'
                    WHERE ID=${t}
                `), await a.execute(`DELETE FROM InvoiceItems WHERE InvoiceID = ${t}`)) : (await a.query(`
                    INSERT INTO Invoices (ClientID, InvoiceDate, DueDate, TotalAmount, Status, ExampleField)
                    VALUES (${e.ClientID}, '${r}', ${o ? `'${o}'` : "NULL"}, ${e.TotalAmount}, '${e.Status || "Unpaid"}', '${e.ExampleField || ""}')
                `), t = (await a.query("SELECT @@IDENTITY AS id"))[0].id), e.Items && e.Items.length > 0)
        for (const s of e.Items) {
          const I = s.ItemDate ? `'${new Date(s.ItemDate).toISOString().split("T")[0]}'` : "NULL", d = s.Remarks ? `'${s.Remarks.replace(/'/g, "''")}'` : "NULL", N = s.Unit ? `'${s.Unit.replace(/'/g, "''")}'` : "NULL", P = s.Project ? `'${s.Project.replace(/'/g, "''")}'` : "NULL", p = s.TaxRate || 10;
          await a.execute(`
                       INSERT INTO InvoiceItems (InvoiceID, ProductID, Quantity, UnitPrice, Unit, ItemDate, Remarks, Project, TaxRate)
                       VALUES (${t}, ${s.ProductID}, ${s.Quantity}, ${s.UnitPrice}, ${N}, ${I}, ${d}, ${P}, ${p})
                   `);
        }
      return { success: !0, id: t };
    } catch (t) {
      throw console.error(t), t;
    }
  }), E.handle("save-backup", async () => {
    if (!n) return { success: !1, error: "Window not found" };
    const e = `database-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "")}.bak`, { dialog: t } = await import("electron"), { canceled: r, filePath: o } = await t.showSaveDialog(n, {
      title: "Save Database Backup",
      defaultPath: e,
      filters: [{ name: "Backup File", extensions: ["bak", "accdb"] }]
    });
    if (r || !o) return { success: !1, canceled: !0 };
    try {
      const I = l.isPackaged ? i.join(l.getPath("userData"), "sales.accdb") : i.join(process.cwd(), "sales.accdb");
      return await (await import("fs")).promises.copyFile(I, o), { success: !0, path: o };
    } catch (s) {
      return console.error("Backup failed:", s), { success: !1, error: s.message };
    }
  }), E.handle("restore-backup", async () => {
    if (!n) return { success: !1, error: "Window not found" };
    const { dialog: c } = await import("electron"), { canceled: e, filePaths: t } = await c.showOpenDialog(n, {
      title: "Select Backup File to Restore",
      properties: ["openFile"],
      filters: [{ name: "Backup File", extensions: ["bak", "accdb"] }]
    });
    if (e || !t[0]) return { success: !1, canceled: !0 };
    try {
      const o = l.isPackaged ? i.join(l.getPath("userData"), "sales.accdb") : i.join(process.cwd(), "sales.accdb"), s = await import("fs");
      return await s.promises.copyFile(o, o + ".pre-restore.bak").catch(() => {
      }), await s.promises.copyFile(t[0], o), { success: !0 };
    } catch (r) {
      return console.error("Restore failed:", r), { success: !1, error: r.message };
    }
  });
});
export {
  b as MAIN_DIST,
  L as RENDERER_DIST,
  T as VITE_DEV_SERVER_URL
};
