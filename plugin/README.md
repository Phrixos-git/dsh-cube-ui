# Cube UI（@local/dsh-cube-ui）

DSH 0.2.2-rc.1 Web GUI 用のクライアントプラグインです。メイン列の会話パネルを立方体ステージに置き換え、
ワークスペースを立方体の6面、選択中セッションの会話を立方体中央に表示します。右上に4分割のひし形ナビ、
左下に折りたたみ可能な「設定・プラグイン」ドックを描画します。

- 対象: DSH 0.2.2-rc.1（`engines.dsh: ">=0.2.2-rc.1 <0.3.0"`）
- 種別: クライアントプラグイン（`dsh.client.platform: "web"`）+ ホスト側は空のバンドル行
- 状態: 0.1.x（実験的。DSH の内部スロットに依存します）

## 構成

| ファイル | 役割 |
| --- | --- |
| `package.json` | バンドル宣言（`dsh.bundle.patch`）とクライアント宣言（`dsh.client`） |
| `cordis.patch.yml` | プロファイルへ挿入する1行（id: `cube-ui`） |
| `index.js` | ホスト側。何もしない（パッケージを Loader エントリとして発見させるためだけに存在） |
| `client.js` | ブラウザ側の実体。**生成物**（コミット対象。インストール時のビルドは不要） |
| `build.mjs` | `src/client.template.js` + `src/styles.css` + `locale/*.json` + バージョンを `client.js` に畳むだけの小さなビルド |
| `locale/{ja,en,zh}.json` | UI 文言の辞書（flat key→値）。ビルド時に埋め込み。任意で `meta`（プラグイン一覧の表示名）を置けます |
| `icon.svg` | 立方体モチーフの 24x24 単色アイコン（`currentColor` のみ） |
| `BUNDLE-NOTES.md` | バンドル仕様・反映方法・ロールバックの調査メモ（file:line 付き） |

## ビルド

`client.js` はコミット済みなので、通常はビルド不要です。ソースを変更したときだけ実行します。

```sh
cd <repo>/plugin
node build.mjs
```

（`<repo>` はこのリポジトリのルート、`<workspace>` は任意の作業ディレクトリを表すプレースホルダです。）

- 依存パッケージはありません（素の Node.js。esbuild / tsdown 等は不要）。
- 編集するのは `src/client.template.js`・`src/styles.css`・`locale/*.json` です。`client.js` は直接編集しないでください。
- 生成物は `window.__ModuleLoader__.load({ id, factory(require) { ... } })` 形式の**単一のクラシックスクリプト**です（ESM の
  `import` / `export` は使えません）。CSS とロケール辞書はビルド時に文字列として埋め込まれます。

## 導入

前提: `client.js` が存在すること（コミット済み。ソースを変えた場合は `node build.mjs`）。`client.js` が無い状態で
有効化すると、クライアントモジュールの走査が失敗し起動時エラーになります。

CLI（pnpm の薄いラッパーです）で Web プロファイルに追加します:

```sh
dsh plugin --profile web add <repo>/plugin
```

DSH に同梱のエージェント用ツール `plugin_manager` を使う場合は、`install_bundle` に `<repo>/plugin` を渡すと
同じ処理になります。

このパス指定は pnpm の `link:` 依存になり、プロファイルの `node_modules/@local/dsh-cube-ui` は
ソースディレクトリへのシンボリックリンクになります（コピーではありません）。`dsh.bundle` を持つ依存は
`dsh.profile.bundles` に自動で追加されます。

## 有効化 / 無効化

- 有効化: 上記導入で自動的に有効になります（`dsh.profile.bundles` に追加）。
- 無効化（確実）: DSH の「設定 → プラグイン」で Cube UI をオフにします。これはプロファイルの
  `~/.dsh/profiles/web/cordis.patch.yml` に次の行を書き込みます（HMR で即時反映）。

  ```yaml
  - id: cube-ui
    disabled: true
  ```

  手動で同じ行を追記しても同じ効果です。バンドルごと止める場合は「設定 → プラグイン」のバンドル一覧で
  無効化するか、`dsh.profile.bundles` から `@local/dsh-cube-ui` を外します（HMR で反映）。

- **dshmarket 経由の場合**: OFF→再起動後に dshmarket で ON にすると、dshmarket はホットマウント
  （`~/.dsh/profiles/web/.dsh-market/hot-N.yml` の `mkt-cube-ui` 行）で有効化します。この状態から OFF にすると、
  ブラウザへ配るプラグイン一覧に cube-ui が残り、再読み込みしても標準 UI に戻りません（dshmarket 1.73.14 で確認）。
  dshmarket で ON にしたら一度 DSH を再起動してください。以後の OFF は即時反映されます。
- 再起動は通常不要です（プロファイル HMR とクライアント HMR が効いている場合）。
  反映されないときだけ下記の再起動を行います。

```sh
systemctl --user restart dsh-web.service
```

## 反映のされ方

| 変更 | 反映 |
| --- | --- |
| `client.js` の書き換え（`link:` 導入時） | クライアント HMR が 500ms 間隔でバンドルを stat ポーリングし、`rebuilt` フレームでブラウザへ反映（通常は再読み込み不要） |
| `cordis.patch.yml` / プロファイル `package.json` の編集 | プロファイル HMR が監視して再構成（再起動不要） |
| `index.js`（ホスト側）の編集 | モジュールルートは監視対象外。プラグインの無効化→有効化、またはサーバ再起動で反映 |
| 新しい依存パッケージの追加 | pnpm によるインストールが必須（ファイルを置くだけでは解決できない） |

## アンインストール

`plugin_manager` の Remove（`removeBundle`）を使うのが最も安全です。手動の場合は次の順で行います。

1. 無効化する（上記「無効化」）。
2. `dsh.profile.bundles` から `@local/dsh-cube-ui` を外す。
3. 依存を削除する:

   ```sh
   dsh plugin --profile web remove @local/dsh-cube-ui
   ```

4. 必要なら再起動する（`systemctl --user restart dsh-web.service`）。

## ロールバック（バックアップからの復元）

導入前に次のファイルを控えておくと、元の状態へ確実に戻せます:

- `~/.dsh/profiles/web/package.json`
- `~/.dsh/profiles/web/pnpm-lock.yaml`
- `~/.dsh/profiles/web/cordis.patch.yml`
- `~/.dsh/profiles/web/pnpm-workspace.yaml`
- `~/.dsh/profiles/web/compatibility.json`（存在する場合のみ）
- `~/.dsh/profiles/web/cordis.yml`（起動時に再生成されるが念のため）

控え方の例（任意の退避先で構いません）:

```sh
cd <backup-dir>
cp ~/.dsh/profiles/web/package.json       "web-package.json.bak-$(date +%Y%m%d-%H%M%S)"
cp ~/.dsh/profiles/web/pnpm-lock.yaml     "web-pnpm-lock.yaml.bak-$(date +%Y%m%d-%H%M%S)"
cp ~/.dsh/profiles/web/cordis.patch.yml   "web-cordis.patch.yml.bak-$(date +%Y%m%d-%H%M%S)"
```

復元手順:

1. サーバを止める必要はありませんが、`plugin_manager` の操作中は編集しないでください（プロファイルの
   `package.json` ロックと競合します）。
2. バックアップから `package.json` / `pnpm-lock.yaml` / `cordis.patch.yml` を戻す。
3. `cd ~/.dsh/profiles/web && pnpm install --frozen-lockfile` で `node_modules` を戻す。
4. 反映されない場合のみ `systemctl --user restart dsh-web.service`。
5. ブラウザを再読み込みし、設定 → プラグインで Cube UI が消えていることを確認する。

## 既知の制約

- **Web 専用バンドル**: `platform: "web"`。デスクトップは同じ web-app 層を使うため動作見込みはありますが、
  デスクトップのプロファイルは Electron アプリが管理しており、`dsh plugin --profile desktop` は拒否されます。
- **内部スロット依存**: `shell.overlay`、`main` の `key: 'conversation'`（priority: -1 で標準会話パネルを置換）、
  `conversation.content` ファクトリ、`--dsw-*` CSS トークンに依存します。DSH の更新で壊れる可能性があります。
  壊れた場合はプラグインを無効化すれば標準 UI に戻ります。
- **`engines.dsh` の範囲**: 範囲外の DSH では導入が拒否され、既に導入済みの場合は起動時にバンドルが
  スキップされます（標準 UI のまま起動し、stderr に警告）。範囲は `>=0.2.2-rc.1 <0.3.0`。
- **ロケールはビルド時埋め込み**: 実行時に `locale/*.json` を取得しません。辞書は flat な key→値の
  JSON で、`node build.mjs` が `client.js` に埋め込みます（文言の変更は再生成が必要）。
  ホストがプラグイン一覧の表示に読むのは任意の `meta.title` / `meta.description` です
  （置かなければパッケージ名と package.json の description にフォールバック）。
- **表示状態**: 立方体のサイズ・操作ガイドの既読・ヒントを閉じたこと・サイドバー初回折りたたみ済みは `localStorage`
  （`dsh.cube-ui.*`）に保存します。回転角・モード・ページ・ドック開閉はメモリのみで、再読み込みで初期化されます。
- **UI 文言**: ja / en / zh のみ。
- **パフォーマンス**: 3D 変形は transform のみ。Firefox のソフトウェア合成対策として面に
  `box-shadow` / `drop-shadow` を使いません。

---

## 現在の挙動（Phase 1 実装 / 2026-11）

- **立方体は最寄りの面へスナップして停止**する。ドラッグ中は自由に傾き、離すと最寄りの面（`rx = 0 / ±90°`、`ry = 90°` 単位）へスナップする。ブラウズ中は立方体と分かるよう静止時に軽く傾け（上 6°・横 8°）、会話中は正対する。5px 未満の押下はクリック扱いで回転しない。
- **キーボードで回せる**。立方体（Tab で到達）にフォーカスして ←/→ で左右の面、↑/↓ で上下の面、Home で最初の面、Enter で前面のワークスペースに入る。下部 HUD の ‹ ▲ ▼ › ボタン、会話ヘッダの ‹ › でも回せる。前面の切り替えはスクリーンリーダーに通知される。
- **会話は立方体の面そのもの**。選択中セッションの会話本文・入力欄は前面のフェイス内にインセット表示され（面の内側に 18px の余白）、立方体の回転とともに移動する。`Esc` または右上の × で立方体ビューへ戻る。
- **ワークスペース名は左上**。旧・下部中央のラベルは廃止し、ステージ左上に「名前 + セッション数」、立方体内部では短い操作ヒントを併記する。
- **回転中は各面を識別表示に簡略化**（タイトル + セッション数のみ）。停止すると一覧・パス・会話が戻る。
- **立方体サイズを右下のピル（− / % / +）で変更**できる（60–160%、ブラウザごとに localStorage 保存）。会話はフェイス内にあるため同じ比率で追従する。上限は画面内に収まるよう自動クランプ。
- **同じワークスペース内のセッション切替では立方体を回転しない**（ドロップダウン）。サイドバー等で**別のワークスペース**のセッションを選んだときは、その面を正面へ回す（面・ヘッダ・会話が常に同じワークスペースを指すように）。
- **セッションの無いワークスペースへ回すと**、その面に「セッションがありません + 新規セッション」を表示する（前の会話は残さない）。
- **初回だけ操作ガイド**（3 ステップ・スキップ可）を表示する。「その他 → 操作ガイド」で再表示できる。
- **サイドバーの既定折りたたみは初回だけ**。以後はユーザーの開閉状態を上書きしない。サイドバーの状態を読めないときは何もしない。
- **サイズピル**の % をクリックすると 100% に戻る。幅 640px 以下ではピルを隠し、「その他」のサイズ行で操作する（ドックはアイコンのみ）。
- **失敗は画面に出す**。セッションを開く・作るなどホスト呼び出しが失敗すると上部にトーストを表示する。ワークスペース一覧の読み込み中は面に「読み込み中…」、取得失敗時は中央に再読み込みボタンを出す。
- 会話内スクロール: 内部スクロール領域はそのまま（ホイール実測で動作確認済み）。`touch-action: pan-y` を会話面に許可し、タッチ/トラックパッドでもスクロールできる。

### 既知の制約（Phase 1）

- 標準の会話ヘッダ（右バー開閉・セッション操作・jobs 等の寄与）は置き換えのため出ない。右バーは現状サイドバー等から開く。
- `dsh-experimental-session-inspector` は `main.conversation` の DOM を直接探すため、本プラグイン導入中は機能しない。
- 設定モーダルは Web では `settings.open` ショートカットの合成イベントで開く。デスクトップ（Electron）では合成イベントが通らないため、折りたたみ済みサイドバーの設定ボタンを使う。
- 他の `shell.overlay` 系プラグイン（[whale-chan-pet](https://github.com/Phrixos-git/dsh-whale-chan-pet) 等）は立方体の上に重なって表示される。

### スクロールの扱い（2026-11 追記・改訂）

GPU 合成された 3D フェイスでは、ホイールのヒットテストが会話パネル外（ステージや兄弟要素）に解決されることがあり、その場合ネイティブのスクロールが動かない。対策として **document の capture 段階で wheel を監視**し、立方体サーフェス上（inside モード）なら縦差分を会話のスクロール領域へ直接適用する。内側に縦スクロールできる要素がある場合はそれを優先し、`Ctrl`/`Cmd` 併用（ズーム）やフローティング UI 上のホイールは素通しする。タッチ操作は `.stage` を `touch-action: pan-y` にして縦スクロールを許可（横ドラッグは立方体回転）。

**スクロール不調時の確認**: 右上のひし形 →「その他」→「診断情報」で viewport・パネル寸法・スクロール領域の `clientHeight / scrollHeight` を表示できる。両者が同じならそのセッションは内容が収まっており、スクロール対象がない。



### 可読性（2026-11 追記）

- 立方体（`.cube-ui`）をフレームのオーバーレイ層（`z-index: 20`）より前面（`z-index: 21`）に上げ、`example-plugin`（例示用の仮名）などのオーバーレイ装飾が会話の文字に重ならないようにした。
- ダイヤモンド／ドック／ダイアログは立方体ルート内に描画し、同じ前面レイヤーで操作できる。
- 会話面のヘッダ・本文の背景はテーマトークンそのまま（不透明）にし、透過による文字の読みにくさを解消。
- これにより他の `shell.overlay` 系プラグイン（[whale-chan-pet](https://github.com/Phrixos-git/dsh-whale-chan-pet) 等）は立方体の**背面**に入るため、立方体と重なる位置では隠れることがある。

### 操作範囲と文字選択（2026-11 追記）

- **サイズピルの位置**: 右下のまま、右端から `210px + 28px + 6px`（= 244px）へ移動。[whale-chan-pet](https://github.com/Phrixos-git/dsh-whale-chan-pet) のスプライト幅（210px）と右余白（28px）、および隅の召喚ボタンと重ならないようにするため。
- **回転ドラッグは立方体の面の上だけ**: `.stage` 全体で受けていた `pointerdown` を、`target.closest('.cube')` が真のとき（= 実際にフェイスへ当たったとき）だけ回転開始に変更。立方体の周囲の余白では回転しない。カーソルも立方体上のみ `grab` / ドラッグ中 `grabbing`。
- **会話面はドラッグ回転しない**: 会話パネル（`.face-conv`）内ではヘッダも含めて回転を開始しない。会話のドロップダウン・×・送信などは通常どおりクリックできる。
- **会話の文字を選択できる**: `.stage` の `user-select: none` を会話面だけ `user-select: text` で解除（ヘッダとボタンは `none` のまま）。範囲選択・コピーが可能。
