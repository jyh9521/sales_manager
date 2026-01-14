import ADODB from 'node-adodb';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { execSync } from 'child_process';

// Get the path to the database file
// In production, use userData. In dev, project root.
const isPackaged = app.isPackaged;
const DB_PATH = isPackaged
  ? path.join(app.getPath('userData'), 'sales.accdb')
  : path.join(process.cwd(), 'sales.accdb');

console.log('Database Path:', DB_PATH);

// Initialize ADODB connection
// Use 'Microsoft.ACE.OLEDB.12.0' for .accdb
const connection = ADODB.open(`Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${DB_PATH};Persist Security Info=False;`, true);

export async function initDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    console.log('Creating new Access database...');
    try {
      // Use PowerShell/ADOX to create the .accdb file
      // This requires the machine to have Access drivers installed.
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

  // Ensure schema and migrations are applied to both new and existing databases
  await createSchema();
}

async function createSchema() {
  try {
    // Settings Table
    await connection.execute(`
      CREATE TABLE Settings (
        SettingKey VARCHAR(255) PRIMARY KEY,
        SettingValue MEMO
      )
    `).catch(() => { });

    // Clients Table
    await connection.execute(`
      CREATE TABLE Clients (
        ID AUTOINCREMENT PRIMARY KEY,
        Name VARCHAR(100),
        Address MEMO,
        ContactInfo MEMO,
        IsActive BIT DEFAULT 1
      )
    `).catch(() => { });

    // Projects Table (New)
    await connection.execute(`
      CREATE TABLE Projects (
        ID AUTOINCREMENT PRIMARY KEY,
        Name VARCHAR(255) UNIQUE
      )
    `).catch(() => { });

    // Units Table (New)
    await connection.execute(`
      CREATE TABLE Units (
        ID AUTOINCREMENT PRIMARY KEY,
        Name VARCHAR(100) UNIQUE
      )
    `).catch(() => { });

    // Products Table
    await connection.execute(`
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
    `).catch(() => { });

    // InvoiceItems Table
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
    `).catch(() => { });

    // Invoices Table
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
    `).catch(() => { });

    // --- MIGRATIONS for Existing DBs ---
    // Add Status column if missing
    try {
      await connection.execute(`ALTER TABLE Invoices ADD COLUMN Status VARCHAR(50) DEFAULT 'Unpaid'`);
    } catch (e) { /* Column likely exists */ }

    // Add DueDate column if missing
    try {
      await connection.execute(`ALTER TABLE Invoices ADD COLUMN DueDate DATETIME`);
    } catch (e) { /* Column likely exists */ }

    // Add ExampleField column if missing
    try {
      await connection.execute(`ALTER TABLE Invoices ADD COLUMN ExampleField MEMO`);
    } catch (e) { /* Column likely exists */ }

    // Add Project column if missing
    try {
      await connection.execute(`ALTER TABLE Products ADD COLUMN Project VARCHAR(255)`);
    } catch (e) { /* Column likely exists */ }

    try {
      await connection.execute('ALTER TABLE InvoiceItems ADD COLUMN Remarks MEMO');
    } catch (e) { }

    try {
      await connection.execute('ALTER TABLE Products ADD COLUMN TaxRate INT DEFAULT 10');
    } catch (e) { }

    try {
      await connection.execute('ALTER TABLE InvoiceItems ADD COLUMN TaxRate INT DEFAULT 10');
    } catch (e) { }

    // Add IsActive column if missing
    try {
      await connection.execute(`ALTER TABLE Products ADD COLUMN IsActive BIT DEFAULT 1`);
      await connection.execute(`UPDATE Products SET IsActive = 1 WHERE IsActive IS NULL`);
    } catch (e) { /* Column likely exists */ }

    // Populate Projects table from existing Products
    try {
      await connection.execute(`
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
