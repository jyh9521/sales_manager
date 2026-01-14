import ADODB from 'node-adodb';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { execSync } from 'child_process';

// 获取数据库文件路径
// 在生产环境中，使用 userData。在开发中，使用项目根目录。
const isPackaged = app.isPackaged;
const DB_PATH = isPackaged
  ? path.join(app.getPath('userData'), 'sales.accdb')
  : path.join(process.cwd(), 'sales.accdb');

console.log('Database Path:', DB_PATH);

// 初始化 ADODB 连接
// 对于 .accdb 使用 'Microsoft.ACE.OLEDB.12.0'
const rawConnection = ADODB.open(`Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${DB_PATH};Persist Security Info=False;`, true);

// 包装器，用于在 "spawn" 错误 (Cscript 快速调用时常见) 上重试操作
const connection = {
  async query(sql: string): Promise<any> {
    const maxRetries = 3;
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await rawConnection.query(sql);
      } catch (e: any) {
        lastError = e;
        // 仅在 spawn 相关错误或通用进程失败时重试
        if (e.message && (e.message.includes('Spawn') || e.message.includes('process'))) {
          console.warn(`Retry ${i + 1}/${maxRetries} for SQL: ${sql.substring(0, 50)}...`);
          await new Promise(r => setTimeout(r, 200 * (i + 1))); // Incremental backoff
          continue;
        }
        throw e; // Throw other errors immediately
      }
    }
    throw lastError;
  },
  async execute(sql: string): Promise<any> {
    // EXECUTE 上的重试导致重复插入，因为 'Spawn Error' 是误报。
    // 我们绝对不能盲目重试非幂等命令。
    try {
      return await rawConnection.execute(sql);
    } catch (e: any) {
      throw e;
    }
  }
};

export async function initDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    console.log('Creating new Access database...');
    try {
      // 使用 PowerShell/ADOX 创建 .accdb 文件
      // 这需要机器上安装了 Access 驱动程序。
      const cmd = `$catalog = New-Object -ComObject ADOX.Catalog; $catalog.Create('Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${DB_PATH}');`;
      execSync(`powershell -Command "${cmd}"`);
      console.log('Database file created successfully.');
    } catch (error) {
      console.error('Failed to create database:', error);
      throw error;
    }
  } else {
    console.log('Database already exists.');
  }

  // 确保架构和迁移应用于新数据库和现有数据库
  await createSchema();
}

async function createSchema() {
  try {
    // 设置表
    await rawConnection.execute(`
      CREATE TABLE Settings (
        SettingKey VARCHAR(255) PRIMARY KEY,
        SettingValue MEMO
      )
    `).catch(() => { });

    // 客户表
    await rawConnection.execute(`
      CREATE TABLE Clients (
        ID AUTOINCREMENT PRIMARY KEY,
        Name VARCHAR(100),
        Address MEMO,
        ContactInfo MEMO,
        IsActive BIT DEFAULT 1
      )
    `).catch(() => { });

    // 项目表 (新增)
    await rawConnection.execute(`
      CREATE TABLE Projects (
        ID AUTOINCREMENT PRIMARY KEY,
        Name VARCHAR(255) UNIQUE
      )
    `).catch(() => { });

    // 单位表 (新增)
    await rawConnection.execute(`
      CREATE TABLE Units (
        ID AUTOINCREMENT PRIMARY KEY,
        Name VARCHAR(100) UNIQUE
      )
    `).catch(() => { });

    // 产品表
    await rawConnection.execute(`
      CREATE TABLE Products (
        ID AUTOINCREMENT PRIMARY KEY,
        Code VARCHAR(50),
        Name VARCHAR(100),
        Description MEMO,
        UnitPrice CURRENCY,
        ClientIDs MEMO,
        Project VARCHAR(255),
        TaxRate INT DEFAULT 10,
        Stock INT DEFAULT 0,
        IsActive BIT DEFAULT 1
      )
    `).catch(() => { });

    // 发票项目表
    await rawConnection.execute(`
      CREATE TABLE InvoiceItems (
        ID AUTOINCREMENT PRIMARY KEY,
        InvoiceID INT,
        ProductID INT,
        Quantity INT,
        UnitPrice CURRENCY,
        Unit VARCHAR(50),
        ItemDate DATETIME,
        Remarks MEMO,
        Project VARCHAR(255),
        TaxRate INT DEFAULT 10,
        FOREIGN KEY (InvoiceID) REFERENCES Invoices(ID) ON DELETE CASCADE
      )
    `).catch(() => { });

    // 发票表
    await rawConnection.execute(`
      CREATE TABLE Invoices (
        ID AUTOINCREMENT PRIMARY KEY,
        ClientID LONG,
        InvoiceDate DATETIME,
        TotalAmount CURRENCY,
        Status VARCHAR(50) DEFAULT 'Unpaid',
        DueDate DATETIME,
        ExampleField MEMO,
        Items MEMO
      )
    `).catch(() => { });

    // 报价单表 (新增)
    await rawConnection.execute(`
      CREATE TABLE Estimates (
        ID AUTOINCREMENT PRIMARY KEY,
        ClientID LONG,
        EstimateDate DATETIME,
        ValidUntil DATETIME,
        TotalAmount CURRENCY,
        Status VARCHAR(50) DEFAULT 'Draft',
        Items MEMO,
        Remarks MEMO
      )
    `).catch(() => { });

    // --- 现有数据库的迁移 ---
    // Add Status column if missing
    try {
      await rawConnection.execute(`ALTER TABLE Invoices ADD COLUMN Status VARCHAR(50) DEFAULT 'Unpaid'`);
    } catch (e) { /* Column likely exists */ }

    // Add DueDate column if missing
    try {
      await rawConnection.execute(`ALTER TABLE Invoices ADD COLUMN DueDate DATETIME`);
    } catch (e) { /* Column likely exists */ }

    // Add ExampleField column if missing
    try {
      await rawConnection.execute(`ALTER TABLE Invoices ADD COLUMN ExampleField MEMO`);
    } catch (e) { /* Column likely exists */ }

    // Add Items column if missing (for JSON storage)
    try {
      await rawConnection.execute(`ALTER TABLE Invoices ADD COLUMN Items MEMO`);
    } catch (e) { /* Column likely exists */ }

    // Add Project column if missing
    try {
      await rawConnection.execute(`ALTER TABLE Products ADD COLUMN Project VARCHAR(255)`);
    } catch (e) { /* Column likely exists */ }

    try {
      await rawConnection.execute('ALTER TABLE InvoiceItems ADD COLUMN Remarks MEMO');
    } catch (e) { }

    try {
      await rawConnection.execute('ALTER TABLE Products ADD COLUMN TaxRate INT DEFAULT 10');
    } catch (e) { }

    try {
      await rawConnection.execute('ALTER TABLE InvoiceItems ADD COLUMN TaxRate INT DEFAULT 10');
    } catch (e) { }

    // Add IsActive column if missing
    try {
      await rawConnection.execute(`ALTER TABLE Products ADD COLUMN IsActive BIT DEFAULT 1`);
      await rawConnection.execute(`UPDATE Products SET IsActive = 1 WHERE IsActive IS NULL`);
    } catch (e) { /* Column likely exists */ }

    // Add Stock column if missing
    try {
      await rawConnection.execute(`ALTER TABLE Products ADD COLUMN Stock INT DEFAULT 0`);
    } catch (e) { /* Column likely exists */ }

    // 从现有产品填充项目表
    try {
      await rawConnection.execute(`
            INSERT INTO Projects (Name) 
            SELECT DISTINCT Project FROM Products 
            WHERE Project IS NOT NULL AND Project <> ''
        `);
    } catch (e) { /* Likely duplicates or already migrated */ }

    console.log('Database schema initialized.');
  } catch (error) {
    console.error('Error creating schema:', error);
  }
}

export { connection };
