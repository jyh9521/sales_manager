# Sales Manager

[中文](README.md) | [日本語](README_JA.md) | [English](README_EN.md)

## Introduction

Sales Manager is a modern sales management application built with Electron and React, designed to simplify invoice generation, client management, and product cataloging for small businesses. It aims to replace outdated tools by providing an intuitive Material Design user interface and automation features.

## Key Features

*   **Invoice Management**:
    *   Create, edit, view, and delete invoices.
    *   **Automated Calculations**: Automatically calculates subtotals, consumption tax (supports 8% and 10% rates), and total amounts.
    *   **Smart Forms**: Supports Autocomplete for selecting clients and products.
    *   **Print Support**: Optimized print view for A4 paper, hiding non-printable elements.
    *   **Auto-save Units**: New units entered are automatically saved to the database for future use.
    *   **Bulk Operations**: Support for bulk deletion of invoices.
    *   **Merge Print**: Select multiple invoices to print them in a single batch.

*   **Estimate Management**:
    *   Create, edit, and manage estimates (quotations).
    *   **One-Click Conversion**: Convert estimates directly into invoices, automatically carrying over all information.
    *   **Print Support**: Dedicated print format for estimates.

*   **Client Management**:
    *   Manage client profiles (name, address, contact info).
    *   One-click filter to view historical invoices for specific clients.
    *   Automatic address lookup from postal codes.

*   **Product Management**:
    *   Maintain a product catalog including unit prices, tax rates, and project associations.
    *   **Inventory Management**: Automatically tracks stock levels and deducts inventory upon invoice creation.
    *   Auto-fill product information when creating invoices.

*   **Settings**:
    *   Customize company header information (used on invoice prints).
    *   Upload company logo.
    *   Customize theme colors.
    *   Configure consumption tax rates.
    *   **Data Security**: Automatic database backups, with support for manual import/export of backups.

*   **Modern Experience**:
    *   Responsive design based on Material UI.
    *   Clear sidebar navigation and dashboard overview.
    *   Full internationalization support (English, Japanese, Chinese).

## Tech Stack

*   **Frontend**: React 18, TypeScript, Vite
*   **UI Framework**: Material UI (@mui/material), Emotion
*   **Desktop App Framework**: Electron
*   **Database**: Microsoft Access (.accdb) via `node-adodb`

## Installation & Usage

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start Development Mode**:
    ```bash
    npm run dev
    ```
    This launches both the Vite development server and the Electron window.

3.  **Build for Production**:
    ```bash
    npm run build
    ```

## Notes

*   This project relies on Microsoft Access drivers in a Windows environment for database connections. Ensure the appropriate ODBC driver is installed on your system.
*   The database file is located at `sales.accdb` in the project root directory.
