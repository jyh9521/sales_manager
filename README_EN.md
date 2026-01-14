# Sales Manager

[中文](README.md) | [日本語](README_JA.md) | [English](README_EN.md)

## Introduction

Sales Manager is a modern sales management application built with Electron and React, designed to simplify invoice generation, client management, and product cataloging for small businesses. It aims to replace outdated tools with an intuitive Material Design interface and automation features.

## Features

*   **Invoice Management**:
    *   Create, edit, view, and delete invoices.
    *   **Automated Calculations**: Automatically calculates subtotal, tax (supports 8% and 10% rates), and total amount.
    *   **Smart Forms**: Supports autocomplete for client and product selection.
    *   **Print Support**: Optimized printing view for A4 paper, hiding non-printable elements.
    *   **Unit Auto-save**: Automatically saves new units to the database for future use.

*   **Client Management**:
    *   Manage client profiles (name, address, contact info).
    *   One-click filtering of historical invoices for specific clients.
    *   Supports automatic address lookup via postal code API.

*   **Product Management**:
    *   Maintain a product catalog including unit price, tax rate, and project assignment.
    *   Auto-fill product details when creating invoices.

*   **Settings**:
    *   Customize company header information (for invoice printing).
    *   Configure tax rates.
    *   Data backup and restore (Access database).

*   **Modern UI/UX**:
    *   Responsive design based on Material UI (MUI).
    *   Clear sidebar navigation and dashboard overview.

## Tech Stack

*   **Frontend**: React 18, TypeScript, Vite
*   **UI Framework**: Material UI (@mui/material), Emotion
*   **Desktop App**: Electron
*   **Database**: Microsoft Access (.accdb) via `node-adodb`
*   **Dev Tools**: ESLint, TailwindCSS

## Installation & Usage

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start Dev Mode**:
    ```bash
    npm run dev
    ```
    This will launch both the Vite dev server and the Electron window.

3.  **Build for Production**:
    ```bash
    npm run build
    ```

## Notes

*   This project relies on the Microsoft Access driver for Windows for database connection. Ensure the appropriate ODBC driver is installed.
*   The database file is located at `sales.accdb` in the project root.
