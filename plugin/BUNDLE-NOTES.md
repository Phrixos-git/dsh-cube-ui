# BUNDLE-NOTES — @local/dsh-cube-ui のバンドル仕様と導入手順

対象: DSH 0.2.2-rc.1（`~/.local/lib/node_modules/@deepseek-ai/dsh/`）
調査日: 2026-11-08 / 調査は読み取りのみ（`~/.dsh`・DSH インストール先への書き込みなし）

パス表記の短縮:

| 記号 | 実パス |
| --- | --- |
| `[M]` | `$NM/dsh-client-modules/lib/index.js`（クライアントモジュール系の**ホスト側**） |
| `[M-C]` | `$NM/dsh-client-modules/lib/client.js`（同**ブラウザ側**＝モジュールテーブル本体） |
| `[BOOT]` | `$NM/dsh-app-boot/lib/index.js` |
| `[PM]` | `$NM/dsh-plugin-manager/lib/index.js` |
| `[PM-OP]` | `$NM/dsh-plugin-manager/lib/types/operations.js` |
| `[HMR]` | `$NM/dsh-hmr/lib/index.js` |
| `[CHMR]` | `$NM/dsh-client-hmr/lib/index.js` |
| `[WEB]` | `$NM/dsh-web-app/lib/index.js` |
| `[STARTUP]` | `$NM/dsh-web-app/lib/startup.js` |
| `[LOADER]` | `$NM/cordis-plugin-loader/src/`（ソース同梱） |
| `[SHELL]` | `$NM/dsh-web-frontend/dist/assets/index-BgUyXZcc.js`（1行に minify。行番号の代わりに検索文字列を併記） |
| `[WS]` | `$NM/dsh-host-webserver/lib/index.js` |
| `$NM` | `~/.local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai` |
| `$CLI` | `~/.local/lib/node_modules/@deepseek-ai/dsh` |
| `$PROFILE` | `~/.dsh/profiles/web` |
| `<repo>` | このリポジトリのルート |
| `<workspace>` | 任意の作業ディレクトリ（バックアップの退避先など） |

要約（先に結論）:

1. `dsh web` は外部バンドルを**ビルドしません**。`client.js` はビルド済みの単一クラシックスクリプトとして
   パッケージに入れておく必要があります（手書きで可。esbuild 等は不要）。
2. `dsh.client.inject` は **パッケージ名**の配列です（Cordis サービス名ではありません）。Cordis サービスは
   `client.js` が `exports.inject` で宣言します。
3. ホスト側 `index.js` は必須です（Loader エントリとして import されるため）。
4. ブラウザ側プラグインへ Cordis config は渡りません。on/off の確実な手段は**ホスト行の `disabled: true`**。
5. `plugin_manager.install_bundle` は pnpm add（ローカルパスは `link:`、コピーではない）→
   `dsh.profile.bundles` へ追記 → HMR で即時反映、という流れです。CLI も `dsh plugin --profile web add` で同等です。
6. 稼働中サーバは systemd user サービス `dsh-web.service`（`127.0.0.1:3080`）。プロファイル変更は通常 HMR で
   反映され、再起動は不要です。必要な場合のコマンドは `systemctl --user restart dsh-web.service`。
7. ロールバックは `$PROFILE/package.json` / `pnpm-lock.yaml` / `cordis.patch.yml` の3点を戻し、
   `pnpm install --frozen-lockfile` → 必要なら再起動。

---

## 1. `dsh web` は `dsh.client` バンドルをどう発見・ビルド・配信するか

### 1.1 プロファイル合成から Loader 行まで

1. `dsh web` は `dsh --profile web` の省略です（[STARTUP]:25 の Help 例、`$CLI/lib/bin.js`）。
2. プロファイルは `$PROFILE/package.json` の `dsh.profile.bundles`（順序付き）→ 各バンドルの
   `dsh.bundle.patch` レイヤー → ユーザー層 `$PROFILE/cordis.patch.yml`、の順に合成されます。
   バンドル読込は [BOOT]:1798-1830 `loadProfileDirectory`、合成は [BOOT]:1865-1873 `composeEntries`。
   `dsh.bundle.patch` は文字列（または文字列配列）で、パッケージディレクトリ基準のパスです（[BOOT]:1335-1340）。
   patch ファイルは「トップレベル YAML 配列」であることが検証されます（[BOOT]:4740-4755 `parsePatchList`）。
3. 各行が Cordis Loader のエントリになります。行の `name` はモジュール指定子で、Loader が import します
   （[LOADER]/src/config/tree.ts:187-200 → `internal.import`、[LOADER]/src/config/entry.ts:262-285）。
   ホスト側は `unwrapExports` で `apply` を持つプラグインに正規化されます（[LOADER]/src/index.ts:208-216）。

### 1.2 クライアントバンドルの発見（ホスト側スキャン）

`@deepseek-ai/dsh-client-modules` のホスト側（行 id `modules`、web-app patch 223 行目）が担当します。

- `static inject = ["loader"]`（[M]:571-572）。Loader のエントリを監視し、エントリ生成/破棄のたびに
  `internal/plugin` を受けて dirty 名を flush します（[M]:602-631）。
- エントリの `name` をモジュール解決して**最寄りの `package.json`** を探し（`locatePkgJson` [M]:815-880）、
  `dsh.client` を検証します（`parseDshClient` [M]:86-100。`platform` は必須文字列、`inject`/`external` は
  文字列配列、`immediately` は boolean）。
- `platform !== "web"` は無視（[M]:789-790）。Web なら `exports["./client"]` を解決し、無ければ
  明示エラー「declares dsh.client but exports no "./client" bundle」（[M]:200-213、[M]:791-792）。
- `clientPath = dirname(package.json) + clientRel` とし、**ファイルの mtime/ctime/size から rev を算出**、
  中身を `readFileSync` で読み込みます（[M]:884-895、[M]:946-975）。中身のハッシュは取りません
  （[M]:222-228 `artifactRevision`）。

### 1.3 ビルドはあるか

**DSH ランタイムに外部バンドルのビルド工程はありません。**

- DSH の実行時パッケージに esbuild / rollup / vite は同梱されていません（`$CLI/node_modules` に `esbuild`
  は無く、`grep -rn esbuild $CLI/node_modules/@deepseek-ai/*/lib` も 0 件。`dsh-hmr` の devDependencies に
  あるだけ）。
- サーバは `client.js` のバイト列をそのまま配信します。唯一の加工は、末尾の
  `//# sourceMappingURL=` / `//# sourceURL=` 行の除去です（[M]:193-194、[M]:312-329 `prepareSource`）。
- `CLIENT_BUNDLE_BUILD_INSTRUCTION = "run \`pnpm run build\` before launch"`（[M]:157）は DSH 自身の
  パッケージ（tsdown で `lib/client.js` を生成しているもの）向けのメッセージで、外部バンドルには
  当てはまりません。外部バンドルは**ビルド済みファイルを同梱**する必要があります。

したがって **`client.js` は手書きの単一ファイルで構いません**。前例 `example-plugin/client.js`（例示用の仮名。約257KB、
1ファイル、ビルド無し）がその実証です。本プラグインは CSS・ロケール・バージョンを埋め込むためだけに
`build.mjs`（素の Node、依存ゼロ）を使っています。esbuild 等は不要です。

本プラグインの `build.mjs` は、`src/client.template.js` のプレースホルダ `__STYLES_JSON__` /
`__LOCALE_JSON__` / `__PACKAGE_VERSION__` を、それぞれ `src/styles.css` / `locale/{ja,en,zh}.json` /
`package.json#version` で置換して `client.js` を書き出します（生成物をコミット）。ロケール JSON は
**flat な key→値の辞書**で、`client.js` 内の `LOCALE_DICTS` として `ctx.locale.register('cube-ui', ...)`
にそのまま渡る形です。`locale/*.json` の `meta`（`meta.title` / `meta.description`）は任意で、
置いた場合だけプラグイン一覧の表示名に使われます（[BOOT]:2863-2906 の icon、[BOOT]:2954-3000 の
`dictionariesOf`）。`exports["./locale/*.json"]` はその `meta` 読み取りのために必要です
（[BOOT]:3002-3011）。

### 1.4 配信ルート

`ClientModuleRegistry` が `webServer` に prefix ルート `/plugins` を登録します（[M]:620-627）。
配信対象（[M]:1095-1114 `bundleResource`）:

| URL | 内容 |
| --- | --- |
| `/plugins/??<id>/client.js,<id2>/client.js&rev=...` | 複数バンドルを `;\n` で連結した combo スクリプト（[M]:395-445） |
| `/plugins/<id>/client.js?rev=...` | 1パッケージ分（HMR のフォールバック等） |
| `.../client.js.map` | combo 用の indexed source map（任意。`.map` が無ければ identity map） |
| `/plugins/<id>/client.<chunk>.js?rev=...` | パッケージ内の動的チャンク（`^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$`、[M]:198） |
| `/plugins/<pkg>/assets/<path>` | `exports["./assets/*"]` で公開した画像等（[M]:1050-1092、[M]:12-38） |

`/plugins/events` は別パッケージ `dsh-client-hmr` の SSE チャンネルです（後述）。

### 1.5 ブラウザ側のブート

1. `webserver/index-inject` で次の行が index.html に注入されます（[M]:518-556 `bootInjections`、
   [WS]:41-54 `renderRow`）。
   - 先頭: `window.__ModuleLoader__` の登録キュー（mode:"queue"）を作るインラインスクリプト
   - アプリケーションバッチは `<link rel="preload" as="script">`（`script-preload`、[M]:547-552）
   - ブートストラップ（`dsh-client-modules/client.js`）は `<script src>` で**同期実行**（[M]:553-557）
   - 最後: `globalThis.__DSH_BOOT__ = <graph>`（[M]:558-562）
2. ブートストラップが `window.__ModuleLoader__.create(...)` を呼び、`createClientModuleSystem` が
   キュー済み登録を live モードへ切り替えます（[M-C]:694-702、[M-C]:988-1001）。
3. シェルは `manifest.plugins` の全行について Loader エントリを作成し（[M-C]:383-397、
   [M-C]:486-495）、各エントリの import が `arriveGraphRow` → combo スクリプト取得 → factory 登録 →
   materialize（factory 実行）→ `apply` という順に進みます（[M-C]:779-797、[M-C]:704-717）。

### 1.6 `window.__ModuleLoader__.load` の契約

```js
window.__ModuleLoader__.load({
  id: '@local/dsh-cube-ui',            // 登録 id。パッケージ名（末尾 /client は正規化される）
  factory(require) {                   // 遅延実行。同期関数。戻り値が exports
    const React = require('react');
    function apply(ctx) { /* ... */ }
    const inject = ['slots', 'locale', 'layout', 'uiWorkspace', 'shortcuts'];
    return { apply, inject };
  },
});
```

- `id`: 登録キー。`stripClientSuffix` により `<pkg>/client` と `<pkg>` は同一視されます（[M]:123-125）。
- `chunk`（任意）: パッケージ内チャンクを登録する場合のファイル名（[M-C]:704-717）。
- `factory`: **materialize 時に1回だけ**実行され、結果がメモ化されます（[M-C]:819-826）。
  同期でなければなりません（`require` は同期解決）。循環 require は即エラーです（[M-C]:817-818）。
- トップレベルで実行されるのは **登録だけ**です。CSS 注入などの副作用は factory の中に置きます
  （[M-C]:37-55 の設計コメント）。factory 内で `<style>` を作ると `data-plugin` が自動付与され、
  アンロード時に回収されます（[M-C]:620-632）。
- 同じ id の二重登録はエラー（[M-C]:704-712）。スクリプトが登録前に例外を投げた場合は
  「loaded without registering」として扱われ、同じ URL は再実行されません（[M-C]:757-776）。
- combo スクリプトは各バンドルを `;\n` で連結するので、**ESM の `import`/`export` は書けません**
  （クラシックスクリプトとして評価）。`sourceMappingURL` を付けたい場合は同ディレクトリに
  `<file>.map` を置けば配信されます（無くても動く）。

### 1.7 `immediately` の意味

- `dsh.client.immediately: true` はグラフ行に `immediately: true` として載り（[M]:460-468、[M]:800）、
  ブラウザ側の plugin ビューにも引き継がれます（[M-C]:137-141）。
- シェルは Cordis 起動**前**に、`immediately` の全行を `modules.prefetch(id)` で並列に取得します
  （[SHELL] 検索語 `prefetchImmediateTier`、`manifest.plugins.filter(e=>e.immediately)`）。
  `prefetch` の実体は「バンドルを取得して factory を登録するまで」で、materialize はしません
  （[M-C]:896-903）。
- つまり **「起動時に先読みする」** 意味であり、サービスの待ち合わせや適用順序を変えるものではありません。
  `false`/省略でも全行は Loader エントリとして起動時に import されるため、機能差はほぼ起動時間だけです。
  本プラグインは主要 UI を置き換えるため `true` にして初回表示の遅延を避けます。

### 1.8 サイズ上限・制約

- **バンドル本体のバイト数上限はありません**。ただし `readFileSync` で丸ごとメモリに保持し
  （[M]:967）、rev 変化のたびに読み直します。実用上は数百KBまで（前例 257KB は動作）。
- combo URL の長さ上限 **3KB**（[M]:190 `MAX_COMBO_URL_BYTES`）。これは「1リクエストに束ねる
  パッケージ数」の制限で、ファイルサイズとは無関係です。
- プラグインアイコンは **256KiB まで**・SVG/PNG/JPEG/WebP のみ（[BOOT]:2863、[BOOT]:2871-2906）。
- 無制限の `message` 等はありません。巨大な base64 埋め込みは避け、画像は `./assets/*` 経由を推奨。

### 1.9 `require` で import できるもの

`makeRequire` の解決順は「seed → materialize 済み → 登録済み factory」（[M-C]:834-843）。

1. **シェルの静的表（seed）**。シェル dist の `function YZ(){return{...}}`（[SHELL] で検索）に定義:
   `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@deepseek-ai/cordis`, `zod`,
   `@tanstack/react-virtual`, `@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots`,
   `@deepseek-ai/dsh-client-ui-primitives`, `@deepseek-ai/dsh-client-ui-dockkit`。
   これらは常に require 可能です。
2. **ブートグラフ上のパッケージ行**（`pkg` または `pkg/client`）。その factory が到着済みであれば
   materialize されます（[M-C]:830-842）。未到着・非公開は
   `require("...") missed the module table ...` の明示エラー（[M-C]:841-842）。
   このために `dsh.client.external`（後述）と `inject`（後述）があります。
3. `require.async('<pkg>')`: グラフ行の非同期 import（[M-C]:845-847）。
4. `require.async('./client.<chunk>.js')`: パッケージ内チャンクの非同期 import（[M-C]:848-854）。
5. `require.asset(reference)`: シェルが渡す asset resolver（[M-C]:844。Web の既定は恒等関数、
   [M-C]:684）。画像 URL をそのまま渡す用途。

**不可**: Node ビルトイン、任意の相対ファイル、seed にもグラフにも無いパッケージ。
`external` に書いても実体が無ければ同じエラーになります。

---

## 2. `inject` に書くべき値（2種類あるので注意）

### 2.1 `package.json` の `dsh.client.inject` = **パッケージ名**

- ホスト側でグラフ行にそのまま載り（[M]:460-468）、ブラウザ側 `arriveGraphRow` が
  **自バンドルの到着前に、列挙されたパッケージ行のバンドルを取得・登録**します（[M-C]:778-797）。
- 値は**ブートグラフ上のパッケージ名**（例: `@deepseek-ai/dsh-client-ui-renderer`）。
  `<pkg>/client` 形式でも `stripClientSuffix` で解決されますが、`inject` 側は完全一致で
  `graphRows.get(name)` を引くだけなので（[M-C]:791-795）、bare 名が安全です。
- **誤った場合の挙動**: 該当行が無ければ単に無視されます（`graphRows.get` が undefined）。
  ロード失敗や警告にはならず、「先読みされない」だけです。ただし自バンドルがそのパッケージを
  `require` する場合は、到着順によって `missed the module table` エラーになり得ます。

### 2.2 `client.js` の `exports.inject` = **Cordis サービス名**

- これは Loader（Cordis）のサービス注入です。ホスト側プラグインの `inject` と同じ意味で、
  本プラグインは `const inject = ['slots', 'locale', 'layout', 'uiWorkspace', 'shortcuts'];`
  （`src/client.template.js` の該当行。参考: `example-plugin/client.js:847` は
  `['theme', 'slots', 'locale', 'configForms']`）。
- **誤った場合の挙動**: エントリは `pending`（待機）のままになり、ブート監査が
  `${name}: pending (waiting for service: ...)` を列挙して失敗します（[SHELL] 検索語 `function KZ` の
  末尾、`entry.fiber.inject` を検査する箇所）。存在しないサービス名なら永久に pending です。
- サービス名はパッケージ名ではありません（例: `slots` を提供するのは `ui-renderer` パッケージ）。

### 2.3 `dsh.client.external`（参考）

ビルド時にバンドルへ含めず、モジュールグラフから解決する指定子の一覧です。値は `<pkg>/client`
（例: `["@deepseek-ai/dsh-api-gateway/client"]`）。ホスト側 `orderByModuleGraph` が依存順を確定し
（[M]:480-500）、自己参照や循環を拒否します。本プラグインは手書きで seed しか require しないため
`external` は不要です（省略）。

### 2.4 本プラグインの最終値と根拠

実装側の確定事項（Lead 確認済み）:

- `ctx.slots.inject('main.conversation', () => ctx.slots.register({ name: 'main.conversation',
  id: 'cube-ui-stage', priority: -1, locale: 'cube-ui',
  children: { 'conversation.header': { kind: 'single', scope: 'session-maybe' } },
  inject: () => ({ channel, actions }) }, CubeStage))` で標準会話パネルを置き換え。
- `shell.overlay` に `id: 'cube-ui-chrome', order: 40, locale: 'cube-ui'` でひし形ナビ＋ドックを描画。
- 会話本文とコンポーザはスロット標準 prop `renderFactorySlot('conversation.content',
  { variant: 'embedded' })` で再利用（自前実装しない）。
- ホスト側 `index.js` は `export function apply() {}` のみ。
- クライアントのサービス注入は `['slots', 'locale', 'layout', 'uiWorkspace', 'shortcuts']`。

`dsh.client.inject` は「自バンドルの factory が動く前に、バンドルだけ先に届いていてほしい
パッケージ」の一覧です（§2.1）。本プラグインが注入する Cordis サービスは5つなので、
その提供パッケージだけを列挙します。セッション・ワークスペース・会話のデータは Cordis サービスとして
直接注入するのではなく、**スロット標準 props**（`useWorkspaces` / `useSessions` / `useSessionStatus` /
`useSession` / `renderFactorySlot` / `usePanelInfo`）として `uiRenderer` から渡されます。
そのため `ui-session` / `ui-conversation` は `dsh.client.inject` には不要です（それらの hooks は
スロットの render 時に解決され、パッケージ自体は web-app 構成で常に有効）。

| 使うサービス | 提供パッケージ | 根拠 |
| --- | --- | --- |
| `slots`（`main.conversation` / `shell.overlay` / `conversation.content`） | `@deepseek-ai/dsh-client-ui-renderer` | `SlotRegistry` が `super(ctx, "slots")`（$NM/dsh-client-ui-renderer/lib/client.js:1348）。`uiRenderer` も同パッケージが提供（同:1869） |
| `locale` | `@deepseek-ai/dsh-client-locale` | `ctx.provide("locale", locale)`（$NM/dsh-client-locale/lib/client.js:1838） |
| `layout`（`selectPanel` / `toggleSidebar`） | `@deepseek-ai/dsh-client-ui-layout` | `reflect.provide("layout", ...)`（$NM/dsh-client-ui-layout/lib/client.js:704） |
| `uiWorkspace`（`openSession` / `startSession`） | `@deepseek-ai/dsh-client-ui-workspace` | `super(ctx, "uiWorkspace")`（$NM/dsh-client-ui-workspace/lib/client.js:1382） |
| `shortcuts`（`settings.open` の binding 取得） | `@deepseek-ai/dsh-client-shortcuts` | `super(ctx, "shortcuts")`（$NM/dsh-client-shortcuts/lib/client.js:2483） |

いずれも web-app patch で有効な行として存在することを確認済み（`$NM/dsh-web-app/cordis.patch.yml`）。

`@deepseek-ai/dsh-client-ui-theme` は**入れていません**。立方体は `--dsw-*` トークンを CSS で参照する
だけで `ctx.theme` を呼ばないためです（入れてあっても無害ですが、依存を実態に合わせています）。

最終値:

```json
"inject": [
  "@deepseek-ai/dsh-client-ui-renderer",
  "@deepseek-ai/dsh-client-locale",
  "@deepseek-ai/dsh-client-ui-layout",
  "@deepseek-ai/dsh-client-ui-workspace",
  "@deepseek-ai/dsh-client-shortcuts"
]
```

---

## 3. ホスト側 `index.js` は必須か

**必須です。** 理由:

- バンドル patch の行 `name: '@local/dsh-cube-ui'` は Loader が import するモジュール指定子です。
  package.json の `exports["."]` が `index.js` を指し、そのモジュールは Cordis プラグイン
  （`apply` を export）である必要があります（[LOADER]/src/config/entry.ts:262-285、`unwrapExports` は
  [LOADER]/src/index.ts:208-216）。
- index.js が無い / import に失敗する場合、エントリは `failed` になり、起動監査
  （`auditStartupEntries`、[WEB]:1-40 の import 参照）で起動が失敗します。
- 同時に、この行が **client-modules の走査対象**（パッケージを解決する入口）になります（[M]:783-800）。

`example-plugin/index.js` の役割は「パッケージをクライアントモジュールグラフに発見させるための
何もしないホスト行」です（`example-plugin/index.js:1-15`、`export function apply() {}` のみ）。
本プラグインの `index.js` も同じです（既に Lead が作成済み）。

最小実装:

```js
export function apply() {}
```

本プラグインの実装はこの最小形で確定しています（`cube-ui/plugin/index.js`:
`export function apply() {}` のみ。ホスト側の設定・サービス・注入はなし）。

任意でホスト側にできること: `Config`（schemastery）で設定を受ける、`webserver/index-inject` に
`kind: "global"` 行を足してブラウザへ値を渡す、等。今回は不要なので入れていません（§4 参照）。

---

## 4. on/off スイッチは持てるか

### 4.1 ブラウザ側プラグインに Cordis config は渡らない

- ブラウザ側の Loader エントリは `{ name: id }` だけで作られます（[M-C]:486-495 `create()`）。
- `window.__DSH_BOOT__` の行が持つのは `id/url/rev/inject/external`（と plugin ビュー用の
  `immediately`）だけです（[M-C]:108-142）。**config フィールドはありません**。
- したがって `package.json` の `dsh.client` にも config を書く場所はなく、プロファイル patch の
  `config:` はホスト側 `index.js` にしか届きません。

config をブラウザへ渡したい場合の唯一の素直な方法は、ホスト側 `index.js` が
`webserver/index-inject` に `kind: "global"` 行を足し、`[M]:628-631` / [WS]:41-45 の仕組みで
`globalThis.__CUBE_UI_CONFIG__` のような値を埋め込むことです（DESIGN 4.6 の A/B/OFF 切替を
本気で実装するならこれ）。

### 4.2 確実な無効化（推奨）

1. **プラグイン管理 UI のトグル**（`plugin_manager.setPluginEnabled`）。実体は
   `$PROFILE/cordis.patch.yml` への追記または `disabled` 更新です（[PM]:1139-1186
   `writePluginEnabled`）:

   ```yaml
   - id: cube-ui
     disabled: true
   ```

   行 id は本バンドルの patch が挿入する `cube-ui` です。HMR が patch を監視しているので即時反映され、
   グラフから行が消える → ブラウザ側のエントリも破棄され、標準 UI に戻ります。
2. **手動**: 同じ行を `$PROFILE/cordis.patch.yml` に追記（同ファイルは HMR 監視対象、[HMR]:852-874）。
3. **バンドルごと無効化**: `dsh.profile.bundles` から `@local/dsh-cube-ui` を外す
   （`plugin_manager.setBundleEnabled(name,false)` の実体、[PM]:3048-3074）。
4. **ブラウザ内のソフトスイッチ**: `localStorage` 等のフラグで描画を止める方法は「コードは動く」ため
   完全な無効化ではありません（example-plugin のテーマ切替はこの方式）。

環境変数によるスイッチは DSH に用意されていません（必要ならホスト index.js で `process.env` を読む）。

---

## 5. `plugin_manager` の `install_bundle` の実体

### 5.1 何をするか

実装: [PM]:2712 `installBundle(spec, options)`（`pluginManager/installBundle` の Remote メソッド）。
ツール `plugin_manager` の `install_bundle` はこれの呼び出しです。

1. spec を検証（ローカルパスは**絶対パス必須**、[PM]:161-200 `parseInstallSpec`）。
2. 既にプロファイル依存にある場合は `already-installed` で拒否（HMR 有効時、[PM]:2733）。
3. **`pnpm add <spec>` をプロファイルディレクトリで実行**（[PM]:2801-2806、`runProfilePnpm`）。
   - ローカルディレクトリを渡すと pnpm は **`link:` 依存**にします（コピーしません）。
     既存プロファイルの `"@local/dsh-example-plugin": "link:~/.../example-plugin"` が実例。
     依存値の解釈は [PM]:223-238 `dependencySpec`、パス解決は [PM]:388-393 `anchorPathSpec`。
   - 書き換わるファイル: `$PROFILE/package.json`（dependencies）、`$PROFILE/pnpm-lock.yaml`、
     `$PROFILE/node_modules/`（`@local/dsh-cube-ui` はソースディレクトリへの symlink）。
4. 前後の差分から「追加された依存」を1件特定し、その `package.json` に **`dsh.bundle` が必須**
   （[PM]:2842、無ければ `not-bundle` 失敗。その場合 `package.json` と `pnpm-lock.yaml` は元に戻され、
   ダウンロード済みファイルは残ることがあります）。
5. **互換性検証**: `evaluatePluginCompatibility`（[PM]:2843-2844、[BOOT]:1129-1145）が
   `engines.dsh`（あれば優先）または `@deepseek-ai/dsh*` の peerDependencies をセマンティック
   バージョンで検査します。不一致は `incompatible-version` で失敗（`compatibility.json` の
   バンドル単位 exemption か `dsh plugin allow-version` で明示許可した場合のみ通る）。
6. patch ファイルの構文検証: `bundlePatchPaths` で列挙し `loadOverlayPatches` でパース
   （[PM]:2845、[BOOT]:4708-4723）。
7. **バンドル選択を保存**: `selectBundle(name, true)` が `$PROFILE/package.json` の
   `dsh.profile.bundles` に名前を追記（[PM]:2859、[PM]:3048-3074、保存は [PM]:3073 `saveManifest`）。
8. **反映**: `reload` → HMR があれば `hmr.reconcileProfile`（[PM]:3100-3135 付近）。
   無ければ `application: "restart-required"`、理由 `"no-hmr"`。

**link かコピーか**: ローカルパスの場合は **link（symlink）** です。ソースを直せばそのまま反映され、
再インストールは不要です。レジストリ指定なら通常の pnpm インストールです。

**再起動は必要か**: 稼働中の web サーバには `hmr` 行が有効（dsh-base patch 28-34 行目）なので、
新規追加のローカルバンドルは **HMR で live 適用（再起動不要）が期待されます**。
ただし `resolution` の差し替えが拒否されるケース（`package-moved` 等）は `restart-required` になり、
その場合は §6 の再起動が必要です。`installBundle` の戻り値 `application` を見て判断してください。

### 5.2 `engines.dsh` の要否

- **省略可**。省略して `@deepseek-ai/dsh*` peerDependencies も無ければ、互換性チェックは常に通ります
  （[BOOT]:1097-1115: どちらも無ければ unmet 0 件）。
- 本プラグインは内部スロットに依存するため、**入れる方針**にしました:
  `"engines": { "dsh": ">=0.2.2-rc.1 <0.3.0" }`（現行 0.2.2-rc.1 は適合）。
  範囲外では導入が拒否され（上記5）、導入済みでも起動時にバンドルがスキップされます
  （[BOOT]:1806-1817、警告は [BOOT]:1355-1357 `reportSkippedBundles` が stderr に出力）。
  DSH 更新後は `compatibility.json` か `dsh plugin allow-version` で明示許可するか、範囲を更新します。

### 5.3 CLI 相当

`dsh plugin --profile web add <spec>` が同じ pnpm 処理を行います（`dsh plugin --help` で確認:
「manage a profile's plugins by forwarding the remaining arguments to pnpm in the profile directory」）。
CLI 経路でも pnpm 実行後に **`dsh.bundle` を持つ新規依存を `dsh.profile.bundles` へ自動追記**します
（[PM-OP]:97-137 `reconcile`、呼び出しは [PM]:576 付近）。互換性検査と不適合時のロールバックも
同じです（[PM]:820-855）。

- 導入: `dsh plugin --profile web add <repo>/plugin`
- 削除: `dsh plugin --profile web remove @local/dsh-cube-ui`（ただし `dsh.profile.bundles` は
  自動では消えないので、`plugin_manager.removeBundle` を使うか手で外す）
- `dsh plugin --profile web list` 等は pnpm へそのまま渡ります。

---

## 6. 稼働中サーバの特定と、プロファイル変更の反映

### 6.1 特定結果

| 項目 | 値 | 根拠 |
| --- | --- | --- |
| 起動方法 | systemd **user** サービス `dsh-web.service` | `~/.config/systemd/user/dsh-web.service` |
| ExecStart | `~/.local/bin/dsh web --host 127.0.0.1 --port 3080 --no-open --public-url https://<tailnet>.ts.net/ --trusted-host <tailnet>.ts.net` | 同 unit ファイル |
| 待受 | `127.0.0.1:3080`（LISTEN を確認） | `ss -ltnp` の出力 |
| 公開 URL | `https://<tailnet>.ts.net/`（tailscale 443） | runtime context / unit / `nohup.out` |
| 旧起動ログ | `dsh web: http://127.0.0.1:3080/?token=...` | `~/.dsh/profiles/web/nohup.out` |
| 自動起動 | `default.target.wants/dsh-web.service` symlink 済み | `~/.config/systemd/user/default.target.wants/` |

注意: 本調査はサンドボックス内（PID namespace 分離）で行ったため `ps`/`pgrep` ではホストの
`dsh` プロセスが見えません。`systemctl --user` も user DBus に接続できず
（`Failed to connect to user scope bus`）実行できませんでした。上記は unit ファイル・`ss`・
`nohup.out` からの確定です。

### 6.2 反映方法（何が必要か）

| 変更 | 反映 |
| --- | --- |
| `client.js` の書き換え（`link:` 導入済み） | 再起動不要。`dsh-client-hmr` が 500ms で stat ポーリングし（[CHMR]:22、[CHMR]:46、[CHMR]:108）、変更を `clientModules.rebuilt(id)` に伝え、`/plugins/events` SSE の `rebuilt` フレームでブラウザへ反映（[CHMR]:108-140 付近） |
| `$PROFILE/cordis.patch.yml` の編集 | 再起動不要。プロファイル HMR が patch を監視して再構成（[HMR]:767-773、[HMR]:852-874） |
| `$PROFILE/package.json` の `dsh.profile.bundles` 編集 | 再起動不要。manifest を監視（[HMR]:873）して再構成 |
| `index.js`（ホスト側）の編集 | HMR の module root は `[]`（dsh-base patch 28-34 行目）なので**監視外**。プラグインの無効化→有効化でエントリを再生成するか、サーバ再起動 |
| 新規依存の追加 | 先に pnpm（`plugin_manager` / `dsh plugin`）でインストールが必要。インストール後は HMR が resolution を再計算して live 適用（新規名の追加は `ResolutionRouter.replace` が拒否しない。[BOOT]:2322-2360、再構成は [BOOT]:4532-4610） |

ブラウザは通常リロード不要（クライアント HMR がグラフ/バンドル更新を適用）。不調時のフォールバックは
`Ctrl+Shift+R`（ページ再読み込み）→ それでもだめならサーバ再起動。

### 6.3 再起動の正確なコマンド（※今回は実行しない）

```sh
systemctl --user restart dsh-web.service
```

確認:

```sh
systemctl --user status dsh-web.service
ss -ltnp '( sport = :3080 )'
curl -sS -I --max-time 5 http://127.0.0.1:3080/
```

- unit ファイル自体を編集した場合のみ `systemctl --user daemon-reload` を先に実行。
- **サービス稼働中に手動で `dsh web` を起動しない**こと（ポート競合・二重プロセスになる）。

---

## 7. ロールバック手順とバックアップ対象

### 7.1 バックアップ対象（絶対パス）

| ファイル | 理由 |
| --- | --- |
| `~/.dsh/profiles/web/package.json` | dependencies と `dsh.profile.bundles` が変わる（最重要） |
| `~/.dsh/profiles/web/pnpm-lock.yaml` | pnpm add で書き換わる |
| `~/.dsh/profiles/web/cordis.patch.yml` | 無効化行・手動追記が入る |
| `~/.dsh/profiles/web/pnpm-workspace.yaml` | pnpm が `allowBuilds` 等を追記することがある |
| `~/.dsh/profiles/web/compatibility.json` | 存在する場合のみ（exemption を書いた場合） |
| `~/.dsh/profiles/web/cordis.yml` | 起動時に再生成されるが念のため |
| `~/.dsh/profiles/web/node_modules/` | symlink 構成。`pnpm install --frozen-lockfile` で復元可能 |

退避先の慣例（既存の運用に合わせる）: `<workspace>/backups/`
に `web-<name>.bak-YYYYMMDD-HHMMSS` で保存（既存例: `web-package.json.bak-20261108-213848`、
`web-cordis.patch.yml.bak-20261108-213848`）。

```sh
cd <workspace>/backups
cp ~/.dsh/profiles/web/package.json     "web-package.json.bak-$(date +%Y%m%d-%H%M%S)"
cp ~/.dsh/profiles/web/pnpm-lock.yaml   "web-pnpm-lock.yaml.bak-$(date +%Y%m%d-%H%M%S)"
cp ~/.dsh/profiles/web/cordis.patch.yml "web-cordis.patch.yml.bak-$(date +%Y%m%d-%H%M%S)"
```

### 7.2 ロールバック手順

1. 無効化（任意の段階）: プラグイン管理 UI でオフ、または `$PROFILE/cordis.patch.yml` に
   `- id: cube-ui` / `disabled: true` を追記（HMR で即時反映）。
2. バンドル選択を外す: `$PROFILE/package.json` の `dsh.profile.bundles` から `@local/dsh-cube-ui` を
   削除（または `plugin_manager.setBundleEnabled` 相当）。
3. 依存を削除: `plugin_manager.removeBundle` 相当、または
   `dsh plugin --profile web remove @local/dsh-cube-ui`。
4. 完全復元:
   ```sh
   cp <workspace>/backups/web-package.json.bak-<ts>     ~/.dsh/profiles/web/package.json
   cp <workspace>/backups/web-pnpm-lock.yaml.bak-<ts>   ~/.dsh/profiles/web/pnpm-lock.yaml
   cp <workspace>/backups/web-cordis.patch.yml.bak-<ts> ~/.dsh/profiles/web/cordis.patch.yml
   cd ~/.dsh/profiles/web && pnpm install --frozen-lockfile
   ```
5. 反映されない場合のみ `systemctl --user restart dsh-web.service`。
6. ブラウザを再読み込みし、設定 → プラグイン一覧に Cube UI が無いこと、標準 UI に戻ったことを確認。

注意: `plugin_manager` の操作中（pnpm 実行中）は `$PROFILE/package.json` を手で編集しないこと。
プロファイルの `package.json` ロック（[PM]:3178 付近 `withFileLock`）と競合します。

---

## 付録: 調査で実行したコマンド（読み取りのみ）

- `dsh --version` → `0.2.2-rc.1`、`dsh --help`、`dsh plugin --help`
- `dsh web --help` はプロファイル準備で `$PROFILE/cordis.yml` を書こうとして
  `EROFS: read-only file system` で失敗（本サンドボックスが `~/.dsh` 読み取り専用のため）。
  Web フラグは [STARTUP]:25 のソースで確認。
- `ss -ltnp`、`cat $PROFILE/nohup.out`、`cat ~/.config/systemd/user/dsh-web.service`
- 各パッケージの `package.json` / `lib/*.js` / `src/*.ts` の grep・read（上記 file:line のとおり）
- パッケージ導入・プロファイル変更・サーバ再起動は一切実施していません。
