# Sales Manager (Custom Sales Management System)

[中文] | [日本語](#sales-manager-カスタム販売管理システム)

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
    *   支持从外部 API 自动查找邮编地址（即使当前功能未启用 UI）。

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

---

# Sales Manager (カスタム販売管理システム)

## 概要 (Overview)

Sales Managerは、中小企業の請求書作成、顧客管理、製品カタログ管理を効率化するために設計された、ElectronとReactベースの最新の販売管理アプリケーションです。使いにくい既存のツールを置き換え、直感的なマテリアルデザインのUIと自動化機能を提供します。

## 主な機能 (Features)

*   **請求書管理 (Invoice Management)**:
    *   請求書の作成、編集、表示、削除。
    *   **自動計算**: 小計、消費税（8%と10%の軽減税率に対応）、合計金額を自動計算。
    *   **スマートフォーム**: 顧客と製品のオートコンプリート選択をサポート。
    *   **印刷対応**: A4用紙に最適化された印刷ビュー（不要なUI要素を非表示）。
    *   **単位の自動保存**: 新しい単位が入力されるとデータベースに自動保存。

*   **顧客管理 (Client Management)**:
    *   顧客情報（名称、住所、連絡先）の管理。
    *   特定の顧客の過去の請求書をワンクリックでフィルタリング。
    *   郵便番号からの住所自動検索（API連携）。

*   **商品管理 (Product Management)**:
    *   単価、税率、プロジェクト所属を含む製品カタログの保守。
    *   請求書作成時に製品情報を自動入力。

*   **設定 (Settings)**:
    *   自社情報のカスタマイズ（請求書ヘッダー用）。
    *   消費税率の設定。
    *   データのバックアップと復元（Accessデータベース）。

*   **モダンなUI/UX**:
    *   Material UI (MUI) を採用したレスポンシブデザイン。
    *   わかりやすいサイドバーナビゲーションとダッシュボード。

## 技術スタック (Tech Stack)

*   **フロントエンド**: React 18, TypeScript, Vite
*   **UIフレームワーク**: Material UI (@mui/material), Emotion
*   **デスクトップアプリ**: Electron
*   **データベース**: Microsoft Access (.accdb) via `node-adodb`
*   **開発ツール**: ESLint, TailwindCSS

## インストールと実行 (Installation & Usage)

1.  **依存関係のインストール**:
    ```bash
    npm install
    ```

2.  **開発モードで起動**:
    ```bash
    npm run dev
    ```
    Vite開発サーバーとElectronウィンドウが起動します。

3.  **本番ビルド**:
    ```bash
    npm run build
    ```

## 注意事項 (Notes)

*   本プロジェクトは、データベース接続にWindows環境のMicrosoft Accessドライバーを使用します。適切なODBCドライバーがインストールされていることを確認してください。
*   データベースファイルはプロジェクトルートの `sales.accdb` にあります。
