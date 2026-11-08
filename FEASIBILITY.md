# DSH Web GUI「立方体ワークスペース UI」実現可能性調査

- 調査日: 2026-11-08
- 対象: DeepSeek Harness 0.2.2-rc.1（`~/.local/lib/node_modules/@deepseek-ai/dsh`）
- 調査対象の UI: 画面中央の立方体でワークスペースを回転閲覧、立方体上部のプルダウンでセッション選択、
  右上の 4 分割ひし形に既定のナビゲーション、左下に折りたたみ式の設定・プラグイン UI

## 結論

**実装可能。** DSH の Web クライアントプラグイン（バンドル）として、DSH 本体のビルドを変更せずに追加できる。
単一の `client.js`（`window.__ModuleLoader__.load` 形式・ビルド不要）の中で、React と DSH の公開サービスだけで
立方体・ドラッグ回転・プルダウン・右上ひし形・左下折りたたみを実装できる。3D は CSS 3D transform で足りるため、
追加の npm 依存も不要。

ただし **「既定の左サイドバー等のシェルを撤去して画面構成を丸ごと変える」部分だけは公式拡張点の外**で、
内部 DOM / CSS クラスへの依存が発生する。ここは段階実装とフォールバックが必要。

## 要件別の実現性

| 要件 | 判定 | 実装手段 |
|---|---|---|
| 画面中央に立方体を表示 | ○ | `shell.overlay`（全画面・前面レイヤー）に自前コンポーネントを登録 |
| マウスドラッグで立方体を回転 | ○ | Pointer Events + CSS `transform: rotateX/rotateY`。追加ライブラリ不要 |
| 立方体上部のプルダウンでセッション選択 | ○ | React で実装。`useSessions` / `useWorkspaces` で一覧取得、`ctx.uiWorkspace.openSession()` で遷移 |
| ワークスペース・セッションを立方体に表示 | ○ | 面の内容はタイトル・状態・件数などのメタ情報。会話画面そのものを面に描くことは不可 |
| 右上に 4 分割ひし形で既定ナビ | ○ | 自前 UI + `startSession` / `selectPanel('plugins')` / `selectPanel('schedules')` |
| 左下に折りたたみ式の設定・プラグイン UI | ○（設定のみ △） | ドロワー UI は自前。設定モーダルを開く導線だけ非公開 API のため回避策が必要 |
| 既定の左サイドバーを撤去 | △ | スロット置換は可能だが設定等のシートも消える。CSS で隠す方式は内部依存 |
| プラグイン画面（Plugins / Schedules 等） | ○ | `main` スロットのパネル。`ctx.layout.selectPanel()` で表示し、立方体表示とモード切替 |
| 追加 npm 依存 | 不要 | three.js を使わない CSS 3D 方式。使う場合はインストール承認が必要 |

## 根拠（確認した実装）

### 1. クライアントプラグインの載せ方

- この環境には同方式のプラグインが導入済み:
  `~/Documents/deepseek-harness/creator/abyss-whale`（`package.json` の `dsh.bundle.patch` と
  `dsh.client`、`cordis.patch.yml`、`index.js`（ホスト側）、`client.js`（ブラウザ側））。
- `client.js` は `window.__ModuleLoader__.load({ id, factory(require) { ... return { inject, apply } } })` 形式。
  `require('react')` と `ctx` サービスだけで書ける。ビルド工程なし。
- プラグインは Web プロファイル（`~/.dsh/profiles/web`）に追加され、全セッション共通で反映される。
- `client.js` の変更はページ再読み込みで反映（HMR は DSH のソースチェックアウトで `pnpm run dev:web` を
  動かしている場合のみ）。

### 2. UI の差し込み先（スロット）

`@deepseek-ai/dsh-client-ui-layout/lib/types/client/index.d.ts` で定義:

- `sidebar`（single）: 左カラム。**登録すると既定のナビゲーションカラムを置き換える**。
  「その席（sidebar.workspaces / sidebar.settings 等）も一緒に消える」と明記。
- `main`（keyed）: 中央パネル。`conversation` が予約キー。`plugins` / `schedules` などのパネルが登録されている。
- `shell.bottom`（single）: 3 カラム下の全幅領域。
- `shell.overlay`（list）: **全カラムの上・スクロール領域の外側の全画面フローティングレイヤー**。
  「additive（追加型）で、エントリが明示しない限りクリック透過」と説明されている。
- `shell.leading`: ウィンドウ左上のチロム席。

`@deepseek-ai/dsh-client-ui-renderer/lib/types/client/registry.d.ts` の `root` スロットには
「**ここには登録しないこと**」と明記されている。登録すると AppFrame ごと影に隠れ、会話・サイドバー・設定など
すべての席が消えるため、全面シェル置き換えはこの経路では行わない。

全画面レイヤーの CSS（`dsh-client-ui-layout/lib/client.js` 内の `overlayLayer`）:

```
z-index: 20; position: absolute; inset: 0; pointer-events: none;
.overlayLayer > * { pointer-events: auto; }
```

→ 全面を覆うインタラクティブなオーバーレイは技術的に可能（公式の想定はバッジ・トースト等の追加要素で、
全面操作 UI は想定外寄り）。

### 3. ワークスペース・セッションのデータ

- 標準フック（root スコープの登録に自動で渡される）:
  - `useWorkspaces`（`@deepseek-ai/dsh-client-ui-workspace/lib/types/client/index.d.ts`）
  - `useSessions`, `useSessionStatus`, `useSessionAccess`（`dsh-client-ui-session/lib/types/client/index.d.ts`）
- `WorkspaceView`（`dsh-api-workspace-controller/lib/types/types.d.ts`）:
  `workspaceId` / `path` / `title` / `sessionIds`（所属セッションを順序付きで保持） / `createdAt` / `updatedAt`。
- `SessionSummary`（`dsh-api-session-controller/lib/types/client/sessions/service.d.ts`）:
  `id` / `title` / `displayTitle` / `running` / `blank` / `updatedAt` など。
- 立方体の面に置けるのはこのメタ情報まで。会話の本文・入力欄を複数同時に面へ描くことはできない
  （会話 UI は 1 インスタンス）。

### 4. 画面遷移（公開 API）

- `ctx.uiWorkspace`（`dsh-client-ui-workspace/lib/types/client/navigation.d.ts`）:
  - `openSession(sessionId | subagentAddress)` … セッションを開いて会話へ
  - `openWorkspace(workspaceId)` … ワークスペースを開く
  - `startSession(workspaceId?, options?)` … 新規セッション
  - `connectWorkspace` / `forkSession` / `archiveSession` など
- `ctx.layout`（`dsh-client-ui-layout/lib/types/client/service.d.ts`）:
  - `selectPanel(null)` … 会話へ戻す
  - `selectPanel(panelId)` … 登録済みグローバルパネルへ（`'plugins'` / `'schedules'` など）
  - `panelInfo`（現在のパネル）を購読可能
- パネル ID の実例: `'plugins'`（`dsh-client-ui-plugin-manager/lib/client.js`）、
  `'schedules'`（`dsh-client-ui-schedule/lib/client.js`）。

### 5. 設定モーダルだけが非公開

- 設定の開閉状態とモーダルは `sidebar.settings` スロットのオカレント内で生成される
  （`dsh-client-ui-settings-general/lib/client.js` の `ctx.slots.inject("sidebar.settings", ...)`）。
  つまり **サイドバーをスロット置換で消すと設定を開く手段が失われる**。
- サイドバーを CSS で不可視化する場合も、設定トリガー（`aria-haspopup="dialog"` のボタン）は
  DOM 上に残るため、プログラム的にクリックする回避策がある。ただし内部 DOM 依存。
  設定モーダル自体は `document.body` へのポータルで `z-index: 1000` のため、前面オーバーレイの上に表示される。
- プラグイン一覧・自動化タスクは `main` パネルなので、`selectPanel` で正式に開ける。

### 6. 3D 表現

- CSS `transform-style: preserve-3d` の立方体（6 面）+ `rotateX` / `rotateY` で実装可能。
- ドラッグ回転は Pointer Events（`setPointerCapture`）+ 慣性 + 最寄り面へのスナップ。
- 追加依存なし。three.js / WebGL を使う場合も実装可能だが、依存追加の承認と実装量が増える。

## 推奨アーキテクチャ

新規バンドル `@local/dsh-cube-ui` を作成する（`abyss-whale` と同じ構成）。

- `shell.overlay` に「HUD」を登録:
  - 右上の 4 分割ひし形（新規セッション / プラグイン / 自動化タスク / その他）
  - 左下の折りたたみ式ドロワー（設定・プラグイン UI への入口）
  - 立方体表示に戻るための小さなトグル
- 立方体ビューは全画面オーバーレイの「モード」として表示し、セッション選択で閉じて通常の会話画面へ。
- サイドバーの扱いは 2 段階:
  - **Phase 1**: サイドバーはそのまま（オーバーレイの背景で覆う）。設定・プラグインは既存 UI をそのまま利用。
  - **Phase 2**: CSS でサイドバーを不可視化し、グリッドを上書きして中央を全幅化。設定トリガーをブリッジ。
- 配色は `--dsw-*` トークン経由で既存テーマ（深海テーマ等）に追従。

### 実装ファイル（想定）

```
cube-ui/
  package.json        # dsh.bundle.patch / dsh.client 宣言
  cordis.patch.yml    # プラグイン行の挿入
  index.js            # ホスト側（空）
  client.js           # 本体（React.createElement で記述、ビルド不要）
  locale/{en,ja,zh}.json
  icon.svg
  README.md
```

## リスクと制約

1. **内部 DOM / CSS クラス名への依存（Phase 2）**: サイドバー非表示・グリッド上書きは
   CSS Modules のクラス名（`sidebarCol` 等の部分一致）や DOM 構造に依存する。DSH 更新で壊れる可能性。
2. **`root` スロットは使用不可**: 全面シェル置き換えの正攻法は用意されていない。
3. **設定導線が非公開**: 回避策（非表示トリガーのプログラムクリック / ショートカット合成送出）は
   内部依存で、動作確認が必要。
4. **目視確認はユーザー側**: エージェント環境からブラウザ画面の操作・撮影はできない。実装後は
   ページ再読み込みのうえ、見た目・操作感の確認をお願いする。
5. **全セッション共通の変更**: プラグイン導入はプロファイル全体に影響。インストール時に承認が必要で、
   `~/.dsh/profiles/web/package.json` と `cordis.patch.yml` はバックアップを取る。
6. **立方体は 6 面**: ワークスペースが 6 個を超える場合の割り当て（複数立方体・リング・面の入れ替え等）は
   設計判断が必要。
7. **会話の表示位置が未定義**: 立方体と会話の共存方法（立方体を閉じる / 横に並べる / 立方体の中に表示）は
   仕様として決まっていない。
8. **DSH 0.2.2-rc.1 前提**: 将来のバージョンでスロット仕様や CSS が変わる可能性。

## 進め方（提案）

| フェーズ | 内容 | インストール | 目安 |
|---|---|---|---|
| Phase 0 | 静的 HTML/CSS/JS モック（立方体・回転・プルダウン・ひし形・ドロワーの操作感確認） | 不要 | 短時間 |
| Phase 1 | プラグイン化（オーバーレイ + 立方体 + ひし形 + ドロワー。サイドバー温存） | 必要（承認） | 中 |
| Phase 2 | シェル全面置換（サイドバー非表示・全幅化・設定ブリッジ） | 必要 | 中〜大 |

Phase 0 を先に作ることで、DSH のプロファイルに触れずに操作感と見た目を固められる。
各フェーズでバックアップ、`node --check`、プラグイン管理画面からのロールバック手順を用意する。

## 未確定の設計判断（要確認）

1. セッション選択後、会話はどこに出すか
   （a: 立方体が引っ込んで通常の会話画面 / b: 立方体の横や中に会話 / c: 立方体はナビ専用で会話は別画面）
2. 立方体の面の割り当て: 1 面 = 1 ワークスペースか。7 個以上はどうするか。
   セッションは面に表示するのか、上部プルダウンだけに出すのか。
3. 既定の左サイドバーは完全に撤去するのか、会話表示中だけ出すのか。
4. 対象は Web（ブラウザ）のみか、デスクトップアプリ（Electron）も含むか。
5. 見た目の方向性: 既存テーマ（`--dsw-*` トークン）に追従させるか、独自の世界観を持たせるか。

## 参考ファイル

- プラグイン事例: `~/Documents/deepseek-harness/creator/abyss-whale/`
- レイアウト仕様: `~/.local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/`
- レンダラー / スロット仕様: `.../dsh-client-ui-renderer/`
- ワークスペース UI: `.../dsh-client-ui-workspace/`
- セッション UI: `.../dsh-client-ui-session/`
- 設定シェル: `.../dsh-client-ui-settings-general/`
