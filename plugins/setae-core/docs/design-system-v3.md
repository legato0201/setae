# SETAE Product UI Architecture 1.0.219 (superseded)

This document records the initial v3 migration. The current runtime ownership and layer contract is defined in `design-system-v4.md`.

SETAEの画面は「自然史標本台帳と研究用データベース」を基準にする。装飾的なカードを増やさず、罫線、余白、学名、個体番号、記録の時系列で秩序を作る。

## WordPressとの境界

Appは`templates/app-shell.php`から独立したHTML文書として描画する。通常テーマのheader、footer、content wrapperは使用しない。App requestではWordPress block styles、global styles、emoji styles、theme stylesを除外し、`setae-gui-*`だけを読み込む。

画面の全幅化はWordPress側の`100vw`や負のmargin補正に頼らない。`html`、`body`、`.setae-gui-host`、`#app`、`.app-shell`が自らfull viewportを構成する。

## CSSレイヤー

読込順と責務は次の通り。

1. `tokens.css`: 色、文字、余白、角丸、寸法
2. `foundation.css`: reset、本文、フォント役割、full viewport root
3. `components.css`と`styles/components/`: 再利用可能なControlとComponent内部構造
4. `app-frame.css`: App Shellとnavigation
5. `styles/patterns/`: 複数画面で共有する構造
6. `styles/screens/`: 画面固有の配置
7. `screens/qr.css`: QR、画面ラベル、物理印刷ラベル

後付けテーマ上書きやWordPress補正用stylesheetは使わず、Cascade Layersで責務と優先順位を固定する。互換用の巨大な共通stylesheetは作らない。

## Component Contract

操作と入力のdefault、hover、active、focus-visible、disabled、loading、error、success、mobile touch targetは`components.css`が一括管理する。ページ固有CSSからButtonやInputの見た目を再定義しない。

画面UIはsemantic tokenだけを使用し、任意の色、角丸、文字サイズを追加しない。Unicode action iconと装飾的なemojiは使わず、アイコンは共通SVGコンポーネントを使う。

## 文字

- 11px: ID、補足、Eyebrow
- 12px: 日付、メタ情報
- 14px: 本文
- 16px: 見出し
- 20px: セクション
- 28px: ページ
- 40px: Todayの日付、個体詳細の学名

UI、見出し、本文はSans。学名のみSerif italic。個体番号、日付、計測値、QR IDはMono。Todayの日付だけEditorial Serifを許可する。

## 形と余白

- 角丸: control 5px、surface 8px、overlay 12px、round 999px
- 余白: 4、8、12、16、24、32、48px
- 標準操作高: 40px
- モバイル操作高: 44px以上
- アイコン: 24x24 viewBox、1.5px stroke、表示16/18/20px

色は必ずSemantic Tokenを使用する。物理ラベルとカメラ画面にも専用トークンを使う。

## 画面規則

- Eyebrowは英語の小見出し、主見出しは日本語
- Todayは日付とCare Queueを最優先にする
- 通常時のDashboard項目は罫線中心で、編集時だけSurfaceと編集操作を見せる
- Collectionの写真表示は写真、個体番号、学名、性別、状態に絞る
- Collectionの操作はhover、focus、選択時だけ表示する
- Specimen Workspaceを他画面の基準とし、FIELD LABELは物理物として独立した表現を保つ

## Content Width

- 読み物、設定: 最大960px
- Today、Specimen: 最大1180px
- Collection: 最大1360px
- Mobile navigation: 最大5項目、操作領域44px以上

印刷ラベル内の5〜8px文字は実寸維持のため唯一の例外とする。画面UIには使わない。
