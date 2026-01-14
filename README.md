# Sales Manager (销售管理系统)

[中文](README.md) | [日本語](README_JA.md) | [English](README_EN.md)

## 简介 (Introduction)

Sales Manager 是一个基于 Electron 和 React 的现代化销售管理应用程序，专为简化小企业的发票生成、客户管理和产品目录管理而设计。它旨在替代过时的工具，提供直观的 Material Design 用户界面和自动化功能。

## 主要功能 (Features)

*   **发票管理 (Invoice Management)**:
    *   创建、编辑、查看和删除发票。
    *   **自动化计算**: 自动计算小计、消费税（支持 8% 和 10% 税率）和总金额。
    *   **智能表单**: 支持客户和产品的自动完成（Autocomplete）选择。
    *   **打印支持**: 针对 A4 纸张优化的打印视图，隐藏非打印元素。
    *   **单位自动保存**: 输入新单位时自动保存到数据库方便下次使用。

*   **客户管理 (Client Management)**:
    *   管理客户资料（名称、地址、联系方式）。
    *   一键筛选特定客户的历史发票。
    *   支持从外部 API 自动查找邮编地址。

*   **商品管理 (Product Management)**:
    *   维护产品目录，包括单价、税率和项目归属。
    *   发票创建时自动填充产品信息。

*   **设置 (Settings)**:
    *   自定义公司抬头信息（用于打印在发票上）。
    *   消费税率配置。
    *   数据备份与恢复（Access 数据库）。

*   **现代化 UI/UX**:
    *   基于 Material UI (MUI v5/6) 的响应式设计。
    *   清晰的侧边栏导航和仪表盘概览。

## 技术栈 (Tech Stack)

*   **前端**: React 18, TypeScript, Vite
*   **UI 框架**: Material UI (@mui/material), Emotion
*   **桌面应用框架**: Electron
*   **数据库**: Microsoft Access (.accdb) via `node-adodb`
*   **开发工具**: ESLint, TailwindCSS (辅助样式)

## 安装与运行 (Installation & Usage)

1.  **安装依赖**:
    ```bash
    npm install
    ```

2.  **启动开发模式**:
    ```bash
    npm run dev
    ```
    这将同时启动 Vite 开发服务器和 Electron 窗口。

3.  **构建生产版本**:
    ```bash
    npm run build
    ```

## 注意事项 (Notes)

*   本项目依赖 Windows 环境下的 Microsoft Access 驱动程序进行数据库连接。确保系统已安装相应的 ODBC 驱动。
*   数据库文件位于项目根目录下的 `sales.accdb`。
