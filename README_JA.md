# Sales Manager (カスタム販売管理システム)

[中文](README.md) | [日本語](README_JA.md) | [English](README_EN.md)

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
