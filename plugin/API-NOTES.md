# API-NOTES — `@local/dsh-cube-ui` クライアント API 実測メモ

対象: DSH 0.2.2-rc.1（Web GUI）クライアントプラグイン。
調査日: 2026-11-08。読み取りのみで調査し、コードは一切変更していない。

## 0. 表記と調査方法

- `$PKG/` = `~/.local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/`
  （以下 `$PKG/dsh-client-ui-conversation/lib/client.js:20287` のように書く）
- `$FRONT/` = `$PKG/dsh-web-frontend/dist/assets/`
- `$NPX/` = `~/.npm/_npx/<hash>`（npx キャッシュ。`<hash>` は環境依存）
- `<repo>/` = このリポジトリのルート（例: `<repo>/plugin`）、`<workspace>/` = 任意の作業ディレクトリ（バックアップの退避先など）
- 実例として参照する `example-plugin` は**例示用の仮名**（作者の別プラグインの構成をそのまま例示したもの）
- 凡例: **✅実測** = インストール済み 0.2.2-rc.1 の実コードで確認した。**⚠️推測** = コードから強く推測されるが未実行・未確認。
- 型情報についての重要な注意:
  - `@deepseek-ai/dsh-client-ui-slots` は 0.2.2-rc.1 のインストール先 `node_modules/@deepseek-ai/` には**存在しない**。このパッケージは Web シェルのバンドル（`$FRONT/index-BgUyXZcc.js`）にインライン同梱されており、`staticModules` としてプラグインへ配られる（後述 §2）。
  - そのため `SlotCore` / `SlotMap` / `PropsRuntime` 等の**型宣言**は、npm npx キャッシュに残っていた `@deepseek-ai/dsh-client-ui-slots@0.2.0-rc.2` の d.ts を参照した。**バージョン差があるため、型の引用は「参考」**とし、挙動に関わる結論はすべて 0.2.2-rc.1 の実バンドル／実 d.ts で裏取りした。
  - `@deepseek-ai/dsh-client-store` も同様にバンドル同梱で、型は npx キャッシュの 0.2.0-rc.2 から引用（`SnapshotSelectorHook` 等）。
- 依頼メモにあった `dsh-client-ui-nav` は **0.2.2-rc.1 に存在しない**。ナビゲーションは `dsh-client-ui-sidebar`（左）と `dsh-client-ui-sidebar-right`（右）が担う。`dsh-client-ui-chat`（会話本文の描画）は conversation から間接的に使われる。
- `<repo>/DESIGN.md` は設計意図の参照のみに留め、API の断定には使っていない（本ノートの結論はすべて実コード由来）。
- バージョン（すべてインストール済みで確認）: `dsh` / `dsh-client-ui-renderer` / `dsh-client-ui-layout` / `dsh-client-ui-conversation` / `dsh-client-ui-session` / `dsh-client-ui-workspace` / `dsh-client-ui-theme` / `dsh-client-locale` / `dsh-client-ui-sidebar-right` / `dsh-cordis-client-runner` / `dsh-client-modules` / `dsh-package-manifest` = **0.2.2-rc.1**。

---

## 1. 結論サマリ（構成Aの可否）

**構成A（main の key `conversation` を priority:-1 で上書きし、自前コンポーネントから `renderFactorySlot('conversation.content', …)` を呼ぶ）は成立する。** ✅実測（登録・解決・描画経路を実コードで確認）

成立の根拠:

1. `main` は **keyed / root** スロットで、同一 `key` の entry は**優先度違いで共存できる**。低い priority が勝つ。既存の ConversationPanel は priority 無指定（=0）なので `priority:-1` で確実に勝てる。**同一 priority での二重登録は throw** されるため、-1 など必ず異なる値にする。→ §5
2. どの entry も `renderFactorySlot` を受け取る（root entry でも常に供給される）。`conversation.content` は **Factory（スロットではない）** なので、entry が子スロットを宣言していなくても描画できる。→ §6
3. `main` entry は root scope で `sessionId` を持たないが、レンダラは**ルートツリー全体を `ScopeProvider scope="session-maybe"` で包んでいる**。したがって root entry から `renderFactorySlot('conversation.content')` を呼ぶと、**現在選択中セッションの binding** が自動的に使われる。→ §6, §12
4. 上書きされた標準 entry は台帳に残る。**プラグインを unload すれば標準 Conversation が自動で戻る**。また自前 entry がクラッシュした場合は abdicate（退場）して標準が復帰する。→ §5, §12

ただし**失うもの・副作用**が明確に存在する（最重要注意点）:

- **標準 Conversation ヘッダーが丸ごと消える**。`conversation.header` 配下に集まっている右バー開閉ボタン（`conversation.session.header.corner` の `ExpandButton`）、セッション操作、サブエージェント／ジョブ／セッションログ等のヘッダー寄与、デスクトップのウィンドウドラッグ領域が描画されなくなる。→ §12
- 右バー開閉ボタンが消えるため、自前 UI で `ctx.sidebarRight.toggleExpanded()` 等を用意しないと**右サイドバーを開く手段が実質なくなる**。→ §12
- `dsh-experimental-session-inspector` は `[data-slot="main.conversation"] …` という **DOM セレクタ**でメイン会話を探すため、置き換えると機能が動かなくなる。→ §12
- 標準の conversation 幅ハンドル（`widthControls`）は自動では描かれない（`renderFactorySlot` の `options.slots` で明示しない限り）。→ §6, §12

推奨: 構成Aを採用しつつ、**自前ヘッダーに「右バー開閉」「新規セッション」「設定入口」を実装**し、デスクトップ向けに `data-window-drag` を持つ上部バーを置く。会話の表示状態は「現在セッション（`retainedBy.mainView > 0`）」を単一の真実として駆動する。→ §14

---

## 2. プラグインのロード契約（実装の前提）

### 2.1 package.json / bundle patch

前例 `<workspace>/example-plugin/package.json` がそのまま雛形になる。

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": {
    "platform": "web",
    "immediately": true,
    "inject": ["@deepseek-ai/dsh-client-ui-theme", "@deepseek-ai/dsh-client-ui-layout", "@deepseek-ai/dsh-client-ui-settings"]
  }
}
```

- `dsh.client.platform` は必須。`inject` は「情報提供用のパッケージ依存辺」であり **Cordis のサービス注入ではない**。
  `$PKG/dsh-package-manifest/lib/types/types.d.ts:82-95`:

```ts
export interface DshClientManifest {
    /** Client platform identifier; the Web consumer selects `web`. */
    platform: string;
    /** Informational package-name dependencies, not Cordis service injection. */
    inject?: string[];
    /** Boot phase-one registration barrier; absent means the shared application batch. */
    immediately?: boolean;
    /** Exact module-table requests beyond the implicit client baseline ... */
    external?: string[];
}
```

- `dsh.bundle.patch` → `cordis.patch.yml` でプロファイル構成にプラグイン行を差し込む（example-plugin の実例は `<workspace>/example-plugin/cordis.patch.yml`）。

### 2.2 client.js の形（`window.__ModuleLoader__.load`）

`<workspace>/example-plugin/client.js:16-20`（実際の前例）:

```js
window.__ModuleLoader__.load({
  id: '@local/dsh-example-plugin',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    ...
    return { inject, apply };
  },
});
```

- モジュール本体の副作用（CSS 注入を含む）は **factory 実行時**に走る（script 実行時ではない）。
  `$PKG/dsh-client-modules/lib/client.js:3-32` のモジュール説明:

```ts
 * Lazy CJS model: executing a plugin bundle only REGISTERS its
 * factory (`window.__ModuleLoader__.load({id, factory})`); every module body
 * side effect — including CSS injection — lives inside the factory closure
 * and runs at materialization, not at script execution.
```

- プラグイン本体は `{ inject: string[], apply(ctx) }` を返す（example-plugin の `inject = ['theme','slots','locale','configForms']` と `apply(ctx)`。`<workspace>/example-plugin/client.js:875, 880-1124`）。
- `ctx.effect(disposerFactory, label)` でプラグインfiberの寿命に紐づける。`ctx.on(event, fn)` で購読。`ctx.get(name)` で**任意サービス**の有無を見る（例: `$PKG/dsh-client-ui-sidebar/lib/client.js:684` `ctx.get("productAnalytics")?.track(...)`）。
- 診断用 registrant 名は `ctx.fiber?.name` から自動で付く。`$PKG/dsh-client-ui-renderer/lib/client.js:1603-1606`:

```js
_register(options, component) {
    const store = typeof options.store === "function" ? options.store() : options.store;
    const registrant = options.registrant ?? this.ctx.fiber?.name;
```

### 2.3 `require()` できるモジュール（重要）

プラグインの `require` は「プラットフォーム seed（static modules）」「materialize 済みモジュール」「登録済み factory」だけ引ける。**標準バンドルは次の 11 個のみ**が seed。`$FRONT/index-BgUyXZcc.js:196`（実コード、1行バンドル内）:

```js
function YZ(){return{react:fk,"react/jsx-runtime":gk,"react-dom":xk,"react-dom/client":Ck,
"@deepseek-ai/cordis":Rb,zod:JS,"@tanstack/react-virtual":rI,
"@deepseek-ai/dsh-client-store":SI,"@deepseek-ai/dsh-client-ui-slots":MI,
"@deepseek-ai/dsh-client-ui-primitives":FU,"@deepseek-ai/dsh-client-ui-dockkit":WZ}}
```

- 実測: インストール済みクライアントパッケージで他パッケージを `require` しているのは primitives / slots / dockkit / client-store のみ。**`@deepseek-ai/dsh-client-ui-conversation` 等の API を直接 require する前例は無い**（`grep -rh "require(\"@deepseek-ai/dsh-client-ui-"` の結果 64+7+1 件すべて seed 語）。
- したがって `conversationPhase` のような他パッケージのヘルパを使いたい場合は、(a) 数行を自前コピーする、(b) 自パッケージの `dependencies` に当該パッケージを入れ `dsh.client.inject` と `external` を宣言して graph row として引く、のどちらか。**(a) を推奨**（結合を増やさない）。
- `require.asset(ref)` / `await require.async(spec)` も factory に渡る（`$PKG/dsh-client-modules/lib/types/client/manifest.d.ts:180-195`）。

### 2.4 注入できる Cordis サービス名（Context augmentation 実測）

- `slots`（`$PKG/dsh-client-ui-renderer/lib/types/client/index.d.ts:34-37`）、`uiRenderer` 同上
- `layout`（`$PKG/dsh-client-ui-layout/lib/types/client/index.d.ts` の Context 拡張）
- `locale`（`$PKG/dsh-client-locale/lib/types/client/index.d.ts`）
- `theme`（`$PKG/dsh-client-ui-theme/lib/types/client/index.d.ts`）
- `uiWorkspace`（`$PKG/dsh-client-ui-workspace/lib/types/client/navigation.d.ts` 末尾の Context 拡張）
- `sessions`（`$PKG/dsh-api-session-controller/lib/types/client/index.d.ts`）
- `sidebarRight` / `sidebarRightTabs`（`$PKG/dsh-client-ui-sidebar-right/lib/types/client/index.d.ts:21-26`）
- その他: `shortcuts`, `configForms`, `contextMenus`, `resources`, `remoteAccess`, `uiSession`, `commandUi` 等

`ctx.uiWorkspace` のように「必ずあるとは限らない」ものは `ctx.get("uiWorkspace")` で有無確認できる。必須なら `inject: ['slots','locale','theme','layout','uiWorkspace']` のように宣言する。

---

## 3. スロットの基本モデル（実測）

### 3.1 kind と scope

`$PKG/dsh-cordis-client-runner/lib/client.js:2606-7560` に、ビルド時生成の**スロットカタログ**（109 スロット）が同梱されている。カタログの型は同ファイル d.ts:

```ts
export interface ClientSlotEntry {
    key: string; kind: string; scope: string;
    summary: string; doc: string;
    registerOptions: readonly ClientSlotOption[];
    ownerProps: readonly string[];
    standardProps: readonly string[];
    keyDomain: string;
    ...
    occupants: readonly string[];
    replaceRisk: string;
    example: string;
    source: string;
}
```

- `root`（built-in, single/root, AppFrame が占有）
- `main`（keyed/root。**key で中央パネルを選ぶ**。既存 key = `conversation`, `plugins`, `schedules`）
- `main.conversation`（single/session-maybe。ConversationRoot が占有）
- `shell.overlay`（list/root、追加型。フレーム全面の自前 UI を出すならここ）
- `sidebar`, `rightbar`, `shell.bottom`, `shell.leading` など。

`main` のカタログ entry（`$PKG/dsh-cordis-client-runner/lib/client.js:4758-4795`）:

```js
{
    key: "main",
    kind: "keyed",
    scope: "root",
    summary: "Central panel selected by sidebar entry id.",
    doc: "Central panel selected by sidebar entry id. The reserved `conversation`\nkey hosts the Conversation; other keys receive no Session binding.",
    registerOptions: [{
        name: "key",
        requirement: "required",
        type: "string",
        doc: "Your cell key: the entry renders where the owner dispatches this exact key. Registering an already-occupied key replaces that occupant."
    }],
    ...
    declaredBy: "an entry in 'root' (client-ui-layout), so it exists while that entry is mounted",
    occupants: [
        "client-ui-conversation ConversationPanel key 'conversation'",
        "client-ui-plugin-manager PluginManagerPage",
        "client-ui-schedule TaskManagerPage"
    ],
    replaceRisk: "shadows-shipped-ui",
```

### 3.2 登録オプションの型（参考: ui-slots 0.2.0-rc.2 d.ts）

`$NPX/_npx/<hash>/node_modules/@deepseek-ai/dsh-client-ui-slots/lib/types/index.d.ts:520-590`（`KindOptions` / `BaseOptions`）の要点:

```ts
export type KindOptions<K, EntryKey, M = never> = ... SlotMap[K]['kind'] extends 'keyed' ? {
    key: EntryKey;
    /** Cell shadowing rank (ascending, default 0, lowest renders; same key + same priority throws). */
    priority?: number;
} : ... list ? { id: string; order?: number; label?: SlotLabel; priority?: number }
  : ... chain ? { select: ChainSelect<...>; priority?: number }
  : { priority?: number };

type BaseOptions<...> = {
    name: K;
    children?: D;
    store?: H;
    locale?: N;
    registrant?: string;
} & KindOptions<...>;
```

`register` の完全な型（同 d.ts:789-805, 802-816）は「`options` + `component`」で、component は `ComposedProps<…>`（後述 §4）を受ける関数。返り値は **idempotent な disposer**。

### 3.3 登録の実挙動（0.2.2-rc.1 実バンドル）

`SlotCore` は `$FRONT/index-BgUyXZcc.js:196` に同梱（1 行バンドルなので行番号は 196 のみ。以下は同バンドルからの抜粋）。

```js
register(e,t){
  const r=this.records.get(e.name);
  if(!r?.spec) throw new Error(`slot "${e.name}" is not declared (a parent entry's children table must declare it)`);
  const i=r.spec, n=e.priority??0,
    s=f=>`at priority ${n}${f.registrant!==void 0?` (registered by ${f.registrant})`:""} — register at a different priority to shadow it (lowest renders)`;
  switch(i.kind){
    case"single":{const f=r.entries.find(h=>(h.options.priority??0)===n);
      if(f) throw new Error(`single slot "${e.name}" already has a registration ${s(f)}`); break;}
    case"keyed":{if(e.key===void 0) throw new Error(`keyed slot "${e.name}" requires options.key`);
      const f=r.entries.find(h=>h.options.key===e.key&&(h.options.priority??0)===n);
      if(f) throw new Error(`keyed slot "${e.name}" already has an entry for key "${e.key}" ${s(f)}`); break;}
    ...
  }
  ...
  const l={component:t, options:{...e.key!==void 0?{key:e.key}:{}, ...e.priority!==void 0?{priority:e.priority}:{}, ...}};
  const u=[...r.entries,l];
  if(u.sort(i.kind==="list"
      ?(f,h)=>(f.options.priority??0)-(h.options.priority??0)||(f.options.order??0)-(h.options.order??0)
      :(f,h)=>(f.options.priority??0)-(h.options.priority??0)),
     ...)
```

勝者の決め方（同バンドル `entriesOfSlot`）:

```js
entriesOfSlot(e){const t=this.records.get(e);
  if(!t?.spec)return b1;
  const r=t.spec.kind;
  if(r==="chain")return t.entries;
  const i=[],n=new Set;
  for(const s of t.entries){
    if(this.abdicated.has(s))continue;
    const l=r==="keyed"?s.options.key:r==="list"?s.options.id:void 0;
    n.has(l)||(n.add(l),i.push(s))
  }
  return i}
```

要点（✅実測）:
- ソートは **priority 昇順**。同じセル（single はスロット自体 / keyed は key / list は id）は**最初の 1 件だけ**が描画対象になる。よって **priority が小さい方が勝つ**。
- **同一セル・同一 priority の 2 件目は throw**。key 省略時は keyed では throw。
- chain は priority が「試行順」（小さい方が先に select される）。
- 宣言されていないスロットへの register は throw。宣言は**親 entry の `children`** で行う（＝宣言した entry だけが `renderSlot` で描ける）。
- 登録の disposal は `ctx.effect` 経由で fiber unload に連動し、**宣言した子スロットも連鎖破棄**される。

### 3.4 宣言待ち `ctx.slots.inject(key, callback)`

スロット `main` は layout の root entry（AppFrame）が宣言する。**layout より先に apply されても `inject` で待てばよい**。実例 `$PKG/dsh-client-ui-conversation/lib/client.js:23102`、`$PKG/dsh-client-ui-workspace/lib/client.js:5780`、`$PKG/dsh-client-ui-subagent/lib/client.js:835`（`ctx.slots.inject("sidebar.right.pane.tab", ...)`）。

---

## 4. 設問1: slot コンポーネントが受け取る props の正確な形

### 4.1 型の合成式（参考: ui-slots 0.2.0-rc.2）

`…/dsh-client-ui-slots/lib/types/index.d.ts:150-180`（`PropsRuntime`）と `:395-410`（`ComposedProps`）:

```ts
export type PropsRuntime<K extends keyof SlotMap & string, EntryKey extends EntryKeyOf<K> = EntryKeyOf<K>> =
    OwnerOf<K> & KeyPropsOf<K, EntryKey> & SlotInjectFace<SlotInjectOf<K>> & ScopeStandardProps<ScopeOf<K>>;

export type ComposedProps<K, EntryKey, S, H, I extends object, M = never, N = undefined> =
    PropsRuntime<K, EntryKey>
  & PropsRenderSlots<S>
  & PropsRenderFactories
  & PropsStore<H>
  & InjectFace<I>
  & MatchedShare<SlotMap[K], M>
  & PropsLocale<N>;
```

`PropsRenderFactories`（同 d.ts:395-399）:

```ts
export interface PropsRenderFactories {
    renderFactorySlot: RenderFactorySlot;
}
```

`PropsRenderSlots`（同 d.ts:320-350）は `renderSlot`（+ chain 子があれば `renderSlotChain`、session 系の子があれば `SessionProvider`）を供給し、`PropsLocale<N>` は `t` を供給する（同 d.ts:137-140）。**`binding` という props は存在しない**（binding はレンダラ内部の `ScopedStandardSourceBinding` で、コンポーネントには渡らない）。**`slots` という props も存在しない**（`renderFactorySlot` の options.slots とは別物）。

### 4.2 実装（0.2.2-rc.1、実際の合成）

`$PKG/dsh-client-ui-renderer/lib/client.js:736-770`（`standardKit`。全 entry 共通で `renderFactorySlot` を付ける）:

```js
function standardKit(host, entry, scope, rootBinding, scopeBinding) {
    const standard = standardProps(scope, rootBinding, scopeBinding);
    const kit = {
        ...standard,
        renderFactorySlot: boundRenderFactorySlot(entry)
    };
    if (entry.locale !== void 0) {
        ... kit["t"] = localeSeat(face, entry.locale);
    }
    const scopedStoreBinding = scopeBinding?.key === void 0 ? void 0 : scopeBinding;
    const store = host.storeOf(entry, scopedStoreBinding);
    if (store !== void 0) { kit["useStore"] = observableHook(store); kit["actions"] = store.actions; }
    if (entry.children !== void 0) {
        kit["renderSlot"] = boundRenderSlot(host, entry);
        if (Object.values(entry.children).some((spec) => spec.kind === "chain")) kit["renderSlotChain"] = ...;
        if (Object.values(entry.children).some((spec) => spec.scope !== "root")) {
            const adapter = host.scope("session");
            ...
            kit["SessionProvider"] = scopeAreaProvider(adapter);
        }
    }
    return { kit, standard, actions: store?.actions };
}
```

`RootEntry`（root scope entry。まさに我々の main entry）: `$PKG/dsh-client-ui-renderer/lib/client.js:882-888`:

```js
function RootEntry({ entry, ownerProps, slotKey, slotInjected, hookContext, hasHookContext }) {
    const host = useHost();
    const rootBinding = useRootBinding();
    const Comp = entry.component;
    const { kit, standard, actions } = standardKit(host, entry, "root", rootBinding, void 0);
    return renderEntry(slotKey, Comp, kit, standard, cachedRootInject(entry, actions), slotInjected, ownerProps, hookContext, hasHookContext);
}
```

最終的にコンポーネントへ渡るのは `{...kit, ...injected, ...slotInjected.props, ...contextual, ...ownerProps}`（`renderEntry` / `ContextualEntry`、`$PKG/dsh-client-ui-renderer/lib/client.js:792-860`）。**owner props が最後に勝つ**。

### 4.3 main（root scope）entry が実際に受け取る props ✅

`$PKG/dsh-cordis-client-runner/lib/client.js:4758-4795` の `standardProps` フィールド（`main`）:

```
useRemoteAccess: (action: RemoteEndpoint) => boolean
useResource: UseResource
useContextMenu: UseContextMenu
useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>
usePanelInfo: UsePanelInfo
useSessions: UseSessions
useSessionStatus: UseSessionStatus
useSessionRetainInfo: UseSessionRetainInfo
useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean
useWorkspaceAccess: (workspaceId: WorkspaceId, action: RemoteEndpoint) => boolean
```

加えて `renderFactorySlot`（§4.2）、`children` を宣言すれば `renderSlot`（+ chain/session 子があれば `renderSlotChain` / `SessionProvider`）、`locale:` を指定すれば `t`、`store:` を指定すれば `useStore` / `actions`、`inject` を指定すればその戻り値の面。

`standardHookPropName` の実装（snake 名を `use<Capitalized>` にする）は `$FRONT/index-BgUyXZcc.js:196` 内:

```js
function II(e){return`use${e[0]?.toUpperCase()??""}${e.slice(1)}`}
```

（したがって `hooks: { sessions: … }` → `useSessions`。実供給は §7 参照。）

### 4.4 session-maybe / session scope の追加 props ✅

`$PKG/dsh-client-ui-session/lib/types/client/index.d.ts` の module augmentation:

```ts
interface GlobalStandardProps {
    /** Session list and current selection. */
    useSessions: UseSessions;
    useSessionStatus: UseSessionStatus;
    useSessionRetainInfo: UseSessionRetainInfo;
    useSessionAccess: (sessionId: SessionId, action: RemoteEndpoint) => boolean;
}
interface SessionStandardProps {
    useSession: SessionSnapshotSelector;
    sessionId: SessionId;
    useProjection: UseProjection;
    useAccess: (action: RemoteEndpoint) => boolean;
}
interface SessionMaybeStandardProps {
    useSession: MaybeSnapshotSelectorHook<SessionSnapshot>;
    sessionId: SessionId | undefined;
    useProjection: UseProjection;
    useAccess: (action: RemoteEndpoint) => boolean | undefined;
}
```

さらに `$PKG/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts:480-500` の augmentation:

```ts
interface SessionStandardProps {
    useConversation: UseConversation;
    useInput: SnapshotSelectorHook<InputState>;
    inputActions: InputActions;
}
interface SessionMaybeStandardProps {
    useConversation: MaybeSnapshotSelectorHook<ConversationSnapshot>;
    useInput: MaybeSnapshotSelectorHook<InputState>;
    inputActions: InputActions | undefined;
}
```

`main.conversation`（session-maybe）のカタログ `standardProps`（`$PKG/dsh-cordis-client-runner/lib/client.js:4797-4830`）に上記が全部載っている。**session-maybe のフックは「セッション未選択でも呼べる」**（戻り値が undefined）。

### 4.5 実例コンポーネント

**(a) root scope（`main` の key `conversation`）**: `$PKG/dsh-client-ui-conversation/lib/types/client/skeleton/ConversationPanel.d.ts:8`:

```ts
export declare function ConversationPanel({ renderSlot }: PropsRuntime<'main'> & PropsRenderSlots<'main.conversation'>): import("react").ReactNode;
```

実装 `$PKG/dsh-client-ui-conversation/lib/client.js:20623-20626`:

```js
function ConversationPanel({ renderSlot }) {
    return renderSlot("main.conversation", {});
}
```

**(b) session-maybe の実例**: サブエージェントの埋め込み会話 `$PKG/dsh-client-ui-subagent/lib/client.js:790-802`（後述 §6 に全文）:
`function ConversationSlotPanel({ sessionId, useSession, useConversation, useSessions, renderFactorySlot })`

### 4.6 props 早見表

| entry の置き場所 | scope | 必ず来るもの | 条件付き |
| --- | --- | --- | --- |
| `main` key=`conversation` | root | 上記 root standard props + `renderFactorySlot` | `children`→`renderSlot` 系 / `locale:`→`t` / `store:`→`useStore`,`actions` / `inject`→面 |
| `main.conversation` | session-maybe | root 全部 + session-maybe 全部（`sessionId`, `useSession`, `useConversation`, `useInput`, `inputActions`, `useProjection`, `useAccess`）+ `renderFactorySlot` | `renderSlot` / `t` 等 |
| `conversation.session` | session | root 全部 + session 全部（`sessionId` は非 undefined）+ 上記 | `renderSlot` / `t` / store / inject |
| chain entry | session | root + session + `matched`（select の戻り値） | fallback は owner 側 |

---

## 5. 設問2: main スロットの上書き登録

### 5.1 正しい登録オプション ✅

```js
ctx.slots.inject('main', () =>
  ctx.slots.register(
    {
      name: 'main',
      key: 'conversation',     // keyed なので必須
      priority: -1,            // 既存(0)より小さい = 勝つ
    },
    CubeRoot,
  ),
);
```

- `{ name:'main', key:'conversation', priority:-1 }` で**上書きできる**（§3.3 のソート／勝者規則）。
- `key` を省略 → `throw new Error('keyed slot "main" requires options.key')`（実バンドル、§3.3 引用）。
- `priority` を省略 → 0。既存 ConversationPanel も 0 なので**同一セル同一 priority で throw**（`keyed slot "main" already has an entry for key "conversation" at priority 0 … register at a different priority to shadow it (lowest renders)`）。
- **`priority:-1` が最小値である必要はない**。負値なら何でも勝つ（例 -100）。`-1` を推奨（他の拡張と衝突しにくい）。
- 同じ priority で**別プラグインも `conversation` を狙うと throw** するので、複数プラグイン競合は設計上「1つだけ」。
- `priority` は「セルの影武者順位」であり、`list` の `order`（表示順）とは別物。

### 5.2 priority 比較が行われる箇所 ✅

- 登録時: `SlotCore.register` の `u.sort(...)`（§3.3 引用、`$FRONT/index-BgUyXZcc.js:196`）。
- 描画時: `entriesOfSlot` のセル重複排除（§3.3 引用）。
- keyed の描画選択: `$PKG/dsh-client-ui-renderer/lib/client.js:1176-1181`:

```js
if (spec.kind === "single") {
    const entry = host.entriesOfSlot(slotKey)[0];
    if (!entry) return entries.length > 0 ? deadCell() : ...fallback;
    return guarded(entry, entryKeyOf(entry));
}
if (spec.kind === "keyed") {
    const entry = host.entriesOfSlot(slotKey).find((e) => e.options.key === opts?.entryKey);
    if (!entry) return entries.some((e) => e.options.key === opts?.entryKey) ? deadCell() : ...fallback;
    return guarded(entry, entryKeyOf(entry));
}
```

- `main` の dispatch 側: `$PKG/dsh-client-ui-layout/lib/client.js:108-130`:

```js
/** Subscribe to the main key without subscribing the column frame to each panel id. */
function MainPanel({ usePanelInfo, renderSlot }) {
    const panelId = usePanelInfo((info) => info.activePanelId);
    return (0, react_jsx_runtime.jsx)("div", {
        className: AppFrame_module_css_default.mainPanel,
        "data-global-panel": panelId !== null || void 0,
        children: renderSlot("main", {}, { entryKey: panelId ?? "conversation" })
    });
}
```

つまり `panelInfo.activePanelId === null` のとき、`main` の key `conversation` セルが描画される。我々の entry が勝てばここに自前 UI が出る。

### 5.2.1 実測: 出荷済み SlotCore を実行して確認した結果 ✅

バンドルから `OI=class`（SlotCore）を切り出して Node で実行した（書き込みなし・メモリ内 eval）。`root` entry に `children:{main:{kind:'keyed',scope:'root'}}` を宣言させた上で:

```
winner(s): [["mine",-1]]
after dispose mine: [["standard",null]]
same-priority throw: keyed slot "main" already has an entry for key "conversation" at priority 0 — register at a different priority to shadow it (lowest renders)
missing key throw: keyed slot "main" requires options.key
undeclared throw: slot "nope" is not declared (a parent entry's children table must declare it)
```

→ **`priority:-1` が勝つ / 同一 priority は throw / key 省略は throw / 未宣言は throw / dispose で標準に復帰**、を出荷コードそのもので確認した。

### 5.3 登録寿命・上書き時の安全性 ✅

- `ctx.slots.register` の戻り値 disposer は `ctx.slots.inject` の効果に包むと **プラグイン unload で自動破棄**（`SlotRegistry` の `register` は呼び出し元 fiber の `ctx.effect` に紐づく。`$PKG/dsh-client-ui-renderer/lib/types/client/registry.d.ts:40-70` の説明参照）。
- 標準 entry は台帳に残り続けるので、**unload 後は自動的に標準 ConversationPanel が復帰**する。
- 自前 entry が描画中にクラッシュすると `SlotErrorBoundary` が `onEntryError` → `reportEntryError(..., {abdicate:true})` → 台帳上は残るが `entriesOfSlot` から除外され、**次の生存 entry（標準）が描画される**。`$PKG/dsh-client-ui-renderer/lib/client.js:631-650`:

```js
var SlotErrorBoundary = class extends react.Component {
    state = { failed: false };
    static getDerivedStateFromError(error) {
        if (error instanceof SlotAssemblyError) throw error;
        return { failed: true };
    }
    componentDidCatch(error) {
        console.error(`slot entry crashed in '${this.props.slotKey}':`, error);
        this.props.onEntryError(error);
    }
    ...
```

### 5.4 `main` の key 集合を検査する消費者 ✅

`$PKG/dsh-client-ui-layout/lib/client.js:696-703`（layout の apply）:

```js
const retainMainPanels = () => {
    instance.actions.retainMainPanels(ctx.slots.entries("main").flatMap((entry) => entry.options.key === void 0 ? [] : [entry.options.key]));
};
const layout = new LayoutController(instance.actions, (id) => ctx.slots.entries("main").some((entry) => entry.options.key === id), {
    getSnapshot: () => instance.getSnapshot().panelInfo,
    subscribe: (listener) => instance.subscribe(listener)
});
```

- `entries("main")` は**生の台帳**（shadow 前）なので、`conversation` キーは我々の entry でも標準 entry でも「登録済み」と判定される。`selectPanel('conversation')` も `selectPanel(null)` も問題なく通る。
- 他に `main` の key 集合を読む消費者は無い（`grep 'name: "main"'` は conversation / plugin-manager / schedule の 3 箇所のみ）。

---

## 6. 設問3: `renderFactorySlot` の正確なシグネチャと実例

### 6.1 型（ui-slots 0.2.0-rc.2 d.ts:383-395 / 0.2.2-rc.1 TYPE_API も同一文字列）

`$PKG/dsh-cordis-client-runner/lib/client.js:1891` 以降の `TYPE_API` に **0.2.2-rc.1 ビルド時の実宣言**が入っている（`TYPE_API` 該当 entry: `RenderFactorySlot`）:

```ts
export type RenderFactorySlot = <F extends keyof SlotFactoryMap & string>(
  name: F,
  props: FactoryInputPropsOf<F>,
  options?: {
    slots?: Partial<{ [N in FactoryLocalNameOf<F>]: FactoryLocalComponent<F, N> }>;
    fallback?: ReactNode;
  }
) => ReactNode;
```

- 第3引数は `{ slots, fallback }` のみ。**`ctx` ではない**。
- `slots` は Factory が宣言した**ローカルスロット**（`conversation.content` なら `views`(session) と `widthControls`(root)）に自前コンポーネントを差し込むためのもの。
- `fallback` は Factory 未登録時に描くノード（`FactoryOutlet` が `definition === void 0` のとき `fallback ?? null`）。

実装 `$PKG/dsh-client-ui-renderer/lib/client.js:322-335`:

```js
function boundRenderFactorySlot(caller) {
    let render = factoryRenderCache.get(caller);
    if (render !== void 0) return render;
    render = ((name, props, options) => (0, react_jsx_runtime.jsx)(FactoryOutlet, {
        name,
        inputProps: props,
        slots: options?.slots,
        fallback: options?.fallback,
        caller
    }));
    factoryRenderCache.set(caller, render);
    return render;
}
```

`FactoryOutlet` 側 `$PKG/dsh-client-ui-renderer/lib/client.js:1061-1100`（要点）:

```js
function FactoryOutlet({ name, inputProps, slots: selected = EMPTY_FACTORY_SELECTION, fallback, caller }) {
    const host = useHost();
    const binding = useScopeBinding();
    ...
    const definition = host.factoryOf(name);
    if (definition === void 0) return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: fallback ?? null });
    ...
```

### 6.2 標準 ConversationPanel が実際に呼ぶ箇所（全文）✅

`$PKG/dsh-client-ui-conversation/lib/client.js:20267-20292`（全文）:

```js
const CONTENT_SLOTS = { widthControls: ConversationWidthControls };
/**
 * Render the existing main Conversation frame around the extracted content.
 * @param props - the original `main.conversation` Slot props.
 * @returns the unchanged root, Header, content, and width-control subtree.
 */
function ConversationMainPanel(props) {
    const { sessionId, useSession, useSessions, useConversation, renderSlot, renderFactorySlot } = props;
    const session = useSession((s) => s);
    const conversation = useConversation((s) => s);
    const shellPhase = session === void 0 || conversation === void 0 ? "blank" : conversationPhase(session, conversation);
    const openState = session?.openState;
    const summaryBlank = useSessions((s) => sessionId === void 0 ? void 0 : s.byId[sessionId]?.blank);
    const parentAvailabilityPending = session?.subagent?.address.mode === "continuable" && session.subagent.parentAvailable === void 0;
    const settling = sessionId !== void 0 && (shellPhase === "blank" && openState === "loading" && summaryBlank !== true || parentAvailabilityPending);
    const hero = sessionId === void 0 || shellPhase === "blank" && (openState === "open" || summaryBlank === true);
    const phase = settling ? "settling" : hero ? "hero" : "active";
    return (0, react_jsx_runtime.jsxs)("div", {
        className: ConversationRoot_module_css_default.root,
        "data-phase": phase,
        children: [renderSlot("conversation.header", {}), renderFactorySlot("conversation.content", {
            variant: "main",
            phase,
            hero
        }, { slots: CONTENT_SLOTS })]
    });
}
```

- `variant` は `"main"`（標準）か `"embedded"`（埋め込み）の 2 値。`phase` は `"settling" | "hero" | "active"`、`hero` は boolean。
  型は `$PKG/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts:698-703`:

```ts
/** Inputs shared by main and embedded Conversation content occurrences. */
export interface ConversationContentInputProps {
    variant: 'main' | 'embedded';
    phase: 'settling' | 'hero' | 'active';
    hero: boolean;
}
```

- 第 3 引数の `CONTENT_SLOTS` は `{ widthControls: ConversationWidthControls }` のみ。`views` は指定していないので Factory 既定（`ConversationSessionView`）が使われる。

### 6.3 埋め込み（`variant:'embedded'`）の先行実装 ✅

`$PKG/dsh-client-ui-subagent/lib/client.js:786-802`（全文）:

```js
/** Fixed Chat selection used by an embedded Conversation occurrence. */
function FixedChatConversationView(props) {
    return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: props.renderSlot("conversation.session", { view: "chat" }) });
}
/** Render the shared Conversation content for one explicitly provided child Session. */
function ConversationSlotPanel({ sessionId, useSession, useConversation, useSessions, renderFactorySlot }) {
    const session = useSession((value) => value);
    const shellPhase = useConversation((value) => value).activeTargets.size > 0 || !session.blank && !session.awaitingFirstTurn || session.running ? "active" : session.promptAttempted ? "engaging" : "blank";
    const summaryBlank = useSessions((state) => state.byId[sessionId]?.blank);
    const parentAvailabilityPending = session.subagent?.address.mode === "continuable" && session.subagent.parentAvailable === void 0;
    const settling = shellPhase === "blank" && session.openState === "loading" && summaryBlank !== true || parentAvailabilityPending;
    const hero = shellPhase === "blank" && (session.openState === "open" || summaryBlank === true);
    return renderFactorySlot("conversation.content", {
        variant: "embedded",
        phase: settling ? "settling" : hero ? "hero" : "active",
        hero
    }, { slots: { views: FixedChatConversationView } });
}
```

※ この `ConversationSlotPanel` は **strict session scope の slot** から呼ばれる（`sessionId` が必ず存在する文脈）。我々の main entry は root scope なので、同等のことをするには session-maybe の子スロット／Factory を 1 枚挟む（§12.2）。`conversationPhase` は 5 行なので自前コピーでよい:

`$PKG/dsh-client-ui-conversation/lib/client.js:20052-20054`:

```js
function conversationPhase(session, conversation) {
    return conversation.activeTargets.size > 0 || !session.blank && !session.awaitingFirstTurn || session.running ? "active" : session.promptAttempted ? "engaging" : "blank";
}
```

### 6.4 自前 root entry からの最小呼び出し（概念コード）

```js
function CubeConversation(props) {
  // props: session-maybe の standard props + renderFactorySlot
  const { sessionId, useSession, useConversation, useSessions, renderFactorySlot } = props;
  const session = useSession((s) => s);
  const conversation = useConversation((s) => s);
  const shellPhase = session === undefined || conversation === undefined ? 'blank' : conversationPhase(session, conversation);
  const summaryBlank = useSessions((s) => sessionId === undefined ? undefined : s.byId[sessionId]?.blank);
  const parentPending = session?.subagent?.address.mode === 'continuable' && session.subagent.parentAvailable === undefined;
  const settling = sessionId !== undefined && (shellPhase === 'blank' && session.openState === 'loading' && summaryBlank !== true || parentPending);
  const hero = sessionId === undefined || shellPhase === 'blank' && (session.openState === 'open' || summaryBlank === true);
  const phase = settling ? 'settling' : hero ? 'hero' : 'active';
  return renderFactorySlot(
    'conversation.content',
    { variant: 'embedded', phase, hero },
    {
      slots: { widthControls: CubeWidthControls }, // 省略可。省略時は幅ハンドル無し
      fallback: h('div', { className: 'cube-conv-missing' }, 'Conversation unavailable'),
    },
  );
}
```

**Provider は不要**。理由は §12.1。

---

## 7. 設問4: データ取得フックのシグネチャと戻り値

### 7.1 フックの一般形

`SnapshotSelectorHook`（npx キャッシュ `dsh-client-store/lib/types/contract.d.ts:18`）:

```ts
export type SnapshotSelectorHook<T> = <S>(sel: (s: T) => S, eq?: (a: S, b: S) => boolean) => S;
export type MaybeSnapshotSelectorHook<T> = <S>(sel: (s: T) => S, eq?: (a: S, b: S) => boolean) => S | undefined;
```

実装は React 外の observable source に `useSyncExternalStore` を当てたもの（`$PKG/dsh-client-ui-renderer/lib/client.js:480-540` の `observableHook`）。**セレクタは毎レンダー呼ばれる**ので、`s` 全体を返すと再レンダーが増える（`useSessions((s) => s)` は標準実装でも使われているが注意）。

### 7.2 `useSessions` — `useSessions(selector) => SessionListState`

供給: `$PKG/dsh-client-ui-session/lib/client.js:1120-1129`:

```js
ctx.slots.provideRoot({
    hooks: {
        sessions: ctx.sessions.list,
        sessionStatus: service.sessionStatus
    },
    keyedHooks: {
        sessionRetainInfo: (key) => ctx.sessions.retainInfo(key),
        sessionAccess: (sessionId, action) => action === void 0 ? void 0 : ctx.remoteAccess.source("session", sessionId, action)
    }
});
```

戻り型 `SessionListState`（`$PKG/dsh-api-session-controller/lib/types/client/sessions/service.d.ts`）:

```ts
export interface SessionListState {
    /** Host list order; every id has a matching byId row in the same snapshot. */
    ids: SessionId[];
    /** Host/catalog rows plus retained subagent fallbacks; only `ids` expresses Host-list membership. */
    byId: Record<SessionId, SessionSummary>;
    /** Arrival lifecycle ... empty-with-ready means "truly no sessions". */
    phase: SessionListPhase;
    /** Shared projection values and explicit-read state, including unopened Sessions. */
    projectionsBySession: Readonly<Record<SessionId, SessionProjectionSnapshot>>;
}
```

`SessionSummary` の主要フィールド（同ファイル）:

```ts
export interface SessionSummary {
    id: SessionId;
    title?: string;                 // durable ログ由来。未投影なら undefined
    displayTitle: string;           // 表示用（title → プロジェクト basename → id）
    cwd?: string;
    parentId?: SessionId;
    origin?: 'subagent';
    formatStatus?: SessionListEntry['formatStatus'];
    running: boolean;               // Host の実行状態（表示用フォールバック）
    readonly retainedBy: SessionRetainInfo['retainedBy'];  // ローカル参照カウント
    blank: boolean;                 // 新規セッションの未送信状態
    updatedAt: number;
    projectionValues?: Readonly<Partial<SessionProjectionSummaryValues>>;
}
```

### 7.3 `useSessionStatus` — `ReadonlyMap<SessionId, SessionStatus>`

```ts
export interface SessionStatus {
    readonly running: boolean | undefined;
    readonly pendingInteraction: SessionPendingInteraction | undefined;
    readonly completionUnread: boolean;
}
export type SessionStatusSnapshot = ReadonlyMap<SessionId, SessionStatus>;
export type UseSessionStatus = SnapshotSelectorHook<SessionStatusSnapshot>;
```

（`$PKG/dsh-client-ui-session/lib/types/client/index.d.ts`）

### 7.4 `useWorkspaces` — `WorkspaceSnapshot`

供給: `$PKG/dsh-client-ui-workspace/lib/client.js:5780-5784`（前掲）。型（`$PKG/dsh-api-workspace-controller/lib/types/client/model.d.ts:9-22`）:

```ts
export interface WorkspaceSnapshot {
    readonly items: readonly WorkspaceView[];
    readonly archivedSessionIds: WorkspaceArchiveValue['archivedSessionIds'];
    readonly pinnedSessionIds: WorkspacePinValue['pinnedSessionIds'];
    readonly state: 'idle' | 'loading' | 'error';
    readonly phase: WorkspaceListPhase;      // 'pending' | 'ready'
    readonly error: RemoteFailure | null;
}
```

`WorkspaceView`（`$PKG/dsh-api-workspace-controller/lib/types/types.d.ts:13-26`）:

```ts
export interface WorkspaceView {
    readonly workspaceId: WorkspaceId;
    readonly path: string;        // canonical host directory path
    readonly title: string;       // user-visible title
    readonly sessionIds: readonly SessionId[];   // manual order
    readonly createdAt: string;   // ISO-8601
    readonly updatedAt: string;   // ISO-8601
}
```

### 7.5 その他の keyed / 補助フック

| フック | シグネチャ | 供給元 |
| --- | --- | --- |
| `useSessionRetainInfo` | `(sessionId, sel?, eq?) => ...` / Provider 文脈版あり（`$PKG/dsh-client-ui-session/lib/types/client/index.d.ts`） | ui-session |
| `useSessionAccess` | `(sessionId, action) => boolean` | ui-session（remoteAccess） |
| `useWorkspaceAccess` | `(workspaceId, action) => boolean` | ui-workspace（remoteAccess） |
| `usePanelInfo` | `SnapshotSelectorHook<PanelInfo>`（`{ activePanelId: MainPanelId \| null }`） | layout |
| `useResource` | `UseResource` | dsh-client-resources |
| `useContextMenu` | `UseContextMenu` | ui-context-menu |
| `useRemoteAccess` | `(action: RemoteEndpoint) => boolean` | api-remote-access |
| `useSession` | session/session-maybe のみ | ui-session |
| `useProjection` / `useAccess` | session/session-maybe のみ | ui-session |
| `useConversation` / `useInput` / `inputActions` | session/session-maybe のみ | ui-conversation |

`usePanelInfo` の型は `$PKG/dsh-client-ui-layout/lib/types/client/index.d.ts`:

```ts
/** Selector hook over root-scoped panel selection. */
export type UsePanelInfo = SnapshotSelectorHook<PanelInfo>;
```

### 7.6 「現在アクティブなセッション」を得る方法 ✅

**`binding` props は無い。** 現行セッションは「`mainView` 参照カウント > 0 の Session」として判定するのが公式パターン。実例:

- `$PKG/dsh-client-ui-layout/lib/client.js:56-64`（`DocumentTitle`）:

```js
const current = Object.values(state.byId).find((session) => (session.retainedBy.mainView ?? 0) > 0)?.id;
```

- `$PKG/dsh-client-ui-session/lib/client.js:929-940`（`UiSession.publishMain`。**session-maybe binding の供給源そのもの**）:

```js
publishMain() {
    if (!this.active) return;
    const byId = this.sessions.list.getSnapshot().byId;
    const currentId = this.current.value.key;
    const nextId = currentId !== void 0 && (this.sessions.retainInfo(currentId).getSnapshot().retainedBy.mainView ?? 0) > 0 ? currentId : Object.values(byId).find((candidate) => (candidate.retainedBy.mainView ?? 0) > 0)?.id;
    this.watchMainRetention(nextId);
    ...
```

- `main` entry（root scope）での推奨取得:
  `const currentSessionId = useSessions((s) => Object.values(s.byId).find((row) => (row.retainedBy.mainView ?? 0) > 0)?.id);`
  （配列を毎回走査するので、必要なら `useMemo` は不可 — セレクタ内では返り値だけ。負荷が気になるなら session-maybe 子スロットに任せる＝§12.2）
- session-maybe の子・Factory の中なら `sessionId` がそのまま使える（推奨）。

### 7.7 「現在アクティブなワークスペース」を得る方法 ✅

`$PKG/dsh-client-ui-conversation/lib/client.js:20520-20522` が実例:

```js
const workspaces = useWorkspaces((s) => s);
const sessionWorkspace = sessionId === void 0 ? void 0 : workspaces.items.find((workspace) => workspace.sessionIds.includes(sessionId));
```

- 補足: `SessionSummary.cwd` から `WorkspaceView.path` を照合する方法もあるが、`find(sessionIds.includes(id))` が canonical。

### 7.8 明示的に「このセッションの会話」を描く場合

`SessionProvider`（session/session-maybe の子を宣言した entry に配られる）の `session` には `SessionReference` を渡す:

```ts
export interface SessionAreaProps {
    readonly session?: SlotScopeTargetMap[keyof SlotScopeTargetMap & 'session'] | undefined;  // = SessionReference
    empty?: (() => ReactNode) | undefined;
    children: ReactNode;
}
```

`SessionReference` は `ctx.sessions.retain(target, { source: 'cubeFace' })` で取得し、`reference.ready` で初期オープン完了を待てる（`$PKG/dsh-api-session-controller/lib/types/client/contract/sessions.d.ts:20-35`）。**`source` は実行時には任意文字列**（実装 `$PKG/dsh-api-session-controller/lib/client.js:3858-3870` に検証なし。型上は declaration merging が必要）。不要になったら `reference.release()`。

---

## 8. 設問5: `ctx.layout` API

### 8.1 全メソッド（型: `$PKG/dsh-client-ui-layout/lib/types/client/service.d.ts:24-90`）

```ts
export interface ILayout {
    /** Selected central panel from the same root store used by `usePanelInfo`. */
    readonly panelInfo: HostObservable<PanelInfo>;
    /**
     * Select a global central panel without changing the current Session.
     * @param panelId - registered main key, or null to show the Conversation.
     * @throws if the selected main key is not registered; preserves the current selection.
     */
    selectPanel(panelId: MainPanelId | null): void;
    /** Start an asynchronous navigation, superseding any earlier pending navigation. */
    beginNavigation(): AbortSignal;
    /** Toggle the sidebar panel (closed ⟷ contract default width). */
    toggleSidebar(): void;
    openRightbar(track: boolean, fullscreen: boolean): void;
    closeRightbar(): void;
}
```

- `selectPanel('plugins')` / `selectPanel('schedules')` で既存のグローバルパネルへ。`selectPanel(null)` で会話（= 我々の main key `conversation` セル）へ戻る。
  key は「`main` に登録済みの key」でなければ throw（`$PKG/dsh-client-ui-layout/lib/client.js:516-520`）。
- 実在する key（✅）: `conversation`（conversation）、`plugins`（plugin-manager, `$PKG/dsh-client-ui-plugin-manager/lib/client.js:7680` `const PANEL_ID = "plugins"`）、`schedules`（schedule, `$PKG/dsh-client-ui-schedule/lib/client.js:19198`）。
- 設定モーダルを開く API は **無い**（§12.6）。

### 8.2 `toggleSidebar` の意味（レスポンシブ）✅

`$PKG/dsh-client-ui-layout/lib/client.js:18`:

```js
/** Viewport width below which the sidebar auto-collapses to the rail (deepsuite
* LG breakpoint); a manual toggle below it re-expands over the squeezed center
* (stores.ts narrowExpanded). */
const SIDEBAR_AUTO_COLLAPSE = 1024;
```

`$PKG/dsh-client-ui-layout/lib/client.js:470-480`（store action）:

```js
toggleSidebar: (d) => {
    d.layoutInfo.rightbarInstant = false;
    if (d.layoutInfo.viewportWidth < 1024) d.layoutInfo.narrowExpanded = !d.layoutInfo.narrowExpanded;
    else d.layoutInfo.sidebar = d.layoutInfo.sidebar === 0 ? 280 : 0;
},
```

`$PKG/dsh-client-ui-layout/lib/client.js:248-254`（AppFrame の判定）:

```js
const narrow = viewport < SIDEBAR_AUTO_COLLAPSE;
const windowsTitlebar = document.documentElement.hasAttribute("data-windows-titlebar");
const drawer = viewport < 768 && !windowsTitlebar;
const centeredSidebar = foldedLandscape && viewport >= 768;
const sidebarCollapsed = narrow ? !layoutInfo.narrowExpanded : layoutInfo.sidebar === 0;
const drawerOpen = drawer && !sidebarCollapsed;
```

まとめ:

| viewport | 挙動 |
| --- | --- |
| ≥1024 | `sidebar` 幅 280 ⇔ 0 のトグル（レール幅 56 は `collapsedWidth`。darwin/windows-titlebar では 0） |
| 768–1023 | 自動で rail に折り畳み。`toggleSidebar` は `narrowExpanded` をトグル（中央を圧迫して再展開） |
| <768（windows titlebar 無し） | **ドロワー**。サイドバーは absolute overlay、frame に `data-sidebar-drawer`、mask が付く（中央は `inert`） |

### 8.3 折りたたみ状態の読み取り・購読（公式 API なし）⚠️

`ctx.layout` に「現在の折りたたみ状態」を返す API は無い（`panelInfo` はパネル選択のみ）。`useStore`（layout store）は **AppFrame の root entry 専用の store seat** であり、後から登録するプラグインからは取れない。

実測できる代替（⚠️ワークアラウンド）:
1. **DOM 属性**。AppFrame は frame div に状態を出している（`$PKG/dsh-client-ui-layout/lib/client.js:349-363`）:

```js
"data-sidebar-collapsed": sidebarCollapsed || void 0,
"data-sidebar-drawer": drawer || void 0,
"data-sidebar-instant": drawer && sidebarCollapsed && sidebarTransition.instant || void 0,
"data-rightbar-collapsed": cols.rightbar === 0 || void 0,
"data-rightbar-fullscreen": layoutInfo.rightbarFullscreen || void 0,
"data-rightbar-instant": layoutInfo.rightbarInstant || void 0,
"data-dragging": dragging || void 0,
"data-animating": animateTracks || void 0,
```

frame 要素の特定は `document.querySelector('[data-rightbar-col]')?.parentElement`（右バー列は常に描画され `data-rightbar-col` を持つ。`$PKG/dsh-client-ui-layout/lib/client.js:389-396`）が確実。購読は `MutationObserver` で `data-sidebar-collapsed` / `data-sidebar-drawer` の属性変化を見る（⚠️未検証だが DOM 仕様上動くはず）。
2. **メディアクエリ**で閾値だけ判定: `matchMedia('(max-width: 1023px)')` と `'(max-width: 767px)'`。ただし「ユーザーが rail を再展開したか（`narrowExpanded`）」「`sidebar===0` か」は分からない。
3. **自前 UI から開閉を制御**: `ctx.layout.toggleSidebar()` のみ（絶対指定 API は無い）。現在状態を知りたければ 1 の DOM 読み取りと併用し、「閉じたい/開きたい」と比較して必要な時だけ toggle する。
   ⚠️ トグルは非同期ではなく同期的に store を書くので、DOM 属性の反映は次のレンダー。連打は避ける。

### 8.4 右サイドバー（rightbar）✅

- `ctx.layout.openRightbar(track, fullscreen)` / `closeRightbar()` は **rightbar の占有者（ui-sidebar-right）が自分の表示状態を frame に報告するための API**。プラグインが「右バーを開く」ために呼ぶものではない。
- 右バーを開く公式手段は `ctx.sidebarRight`（`$PKG/dsh-client-ui-sidebar-right/lib/types/client/service.d.ts:164-240`）:

```ts
export interface ISidebarRight {
    readonly mounted: ObservableSnapshot<SessionId | undefined>;
    openResource(address: string, options?: SidebarRightOpenResourceOptions): void;
    openTab<K extends string>(kind: K, options?: SidebarRightOpenTabOptions<K>): void;
    active(): TabRecord | undefined;
    isExpanded(): boolean;
    toggleExpanded(): void;
    focus(tabId: TabId): void;
    split(paneId?: PaneId): PaneId | undefined;
    ...
}
```

  - `openResource` の契約文には「docked タブは**同じステップで列を expand** する」と明記されている（`$PKG/dsh-client-ui-sidebar-right/lib/types/client/service.d.ts:183-192`）。`openTab` はその page 版であり、同じ挙動とみられる（⚠️ openTab 単体の文言は未確認。`$PKG/dsh-client-ui-sidebar-right/lib/types/client/service.d.ts:199`）。
  - `ctx.sidebarRight.toggleExpanded()` が標準の ExpandButton と同じ「開閉」動作（`$PKG/dsh-client-ui-sidebar-right/lib/client.js:709-731` の `ExpandButton` は store action `setExpanded(sessionId, true)` を呼ぶだけで、公開 API は `toggleExpanded`）。
  ⚠️ `ctx.sidebarRight` が構成に無いこともあるので `ctx.get('sidebarRight')` でガード。

### 8.5 `ctx.layout.panelInfo` の購読

`ctx.layout.panelInfo` は `HostObservable<PanelInfo>`（`{ getSnapshot, subscribe }`）。スロット内なら `usePanelInfo` フックが使える（root/session-maybe どの entry でも供給される）。

---

## 9. 設問6: テーマ CSS カスタムプロパティと購読

### 9.1 仕組み ✅

- ベーストークンは **ui-theme のクライアントバンドルに CSS 文字列として同梱**され、プラグイン activate 時に `<style data-plugin data-plugin-css>` として head に挿入される。`$PKG/dsh-client-ui-theme/lib/client.js:1489-1540`:

```js
const HAIRLINE_WIDTH = "--dsh-hairline-width";
const STYLES = [
    ["base.css", base_css_default],
    ["corner-shape.css", corner_shape_css_default],
    ["design-platform.css", design_platform_css_default],
    ["focus.css", focus_css_default],
    ["onboarding.css", onboarding_css_default],
    ["scrollbar.css", scrollbar_css_default],
    ["gradient-shadow-text.css", gradient_shadow_text_css_default],
    ["shiki.css", shiki_css_default]
];
...
for (const [name, css] of STYLES) ctx.effect(() => {
    const tag = document.createElement("style");
    tag.dataset.plugin = PLUGIN_ID;
    tag.dataset.pluginCss = `${PLUGIN_ID}/${name}`;
    tag.textContent = css;
    document.head.appendChild(tag);
    return () => { tag.remove(); };
}, `ui-theme: ${name} stylesheet`);
```

- `root` に radius / transition / font-family 既定、`body` に light の static+alias、`body[data-ds-dark-theme]` に dark の static+alias が定義される。
  実体: `$PKG/dsh-client-ui-theme/lib/client.js:1464`（base.css 文字列。`:root{--dsh-font-family-text-default:…;--ds-ease-in-out:…;--dsw-radius-xs:4px;…}`）、`:1470`（design-platform.css 文字列。`body{--dsw-static-…;--dsw-alias-bg-base:var(--dsw-static-neutral-bluish-00);…}` と `body[data-ds-dark-theme]{…}`）。
- **テーマ切替時の反映は ui-layout の ThemePresenter** が行う。`$PKG/dsh-client-ui-layout/lib/client.js:571-650`。抜粋:

```js
/** Body attribute selecting the dark base palette in the token stylesheets. */
const DARK_ATTRIBUTE = "data-ds-dark-theme";
const THEME_SOURCE_ATTRIBUTE = "data-ds-theme-source";
const FONT_SIZE_VARIABLES = { text: "--dsh-content-font-size", code: "--dsh-code-font-size", terminal: "--dsh-terminal-font-size" };
...
apply(snapshot) {
    const scheme = snapshot.active.colorScheme;
    document.documentElement.style.colorScheme = scheme;
    document.documentElement.setAttribute(THEME_SOURCE_ATTRIBUTE, snapshot.preference === "system" ? "system" : scheme);
    const body = document.body;
    if (scheme === "dark") body.setAttribute(DARK_ATTRIBUTE, ""); else body.removeAttribute(DARK_ATTRIBUTE);
    for (const [role, name] of Object.entries(FONT_SIZE_VARIABLES)) body.style.setProperty(name, `${snapshot.fontSizes[role]}px`);
    ...
    for (const [name, value] of Object.entries(snapshot.active.tokens)) { body.style.setProperty(name, value); this.appliedTokens.push(name); }
    ...
}
```

  → **テーマのトークンは `body` のインライン CSS 変数**として乗る。プラグインの DOM は body 配下なので、`var(--dsw-alias-…)` を書くだけで追従する（再レンダー不要）。ダーク判定は `document.body.hasAttribute('data-ds-dark-theme')`。

### 9.2 実在する変数名の一覧（`$PKG/dsh-client-ui-theme/lib/client.js` の CSS 文字列から抽出。unique 441 個）

**セマンティック層（プラグインが使うべきもの）— `--dsw-alias-*` 114 個:**

```
--dsw-alias-bg-base, --dsw-alias-bg-document-preview, --dsw-alias-bg-document-selection, --dsw-alias-bg-layer-1
--dsw-alias-bg-layer-2, --dsw-alias-bg-layer-3, --dsw-alias-bg-mask-1, --dsw-alias-bg-mask-2
--dsw-alias-bg-mask-3, --dsw-alias-bg-mask-drop, --dsw-alias-bg-mask-photo, --dsw-alias-bg-module-platform
--dsw-alias-bg-multi-select, --dsw-alias-bg-overlay, --dsw-alias-bg-skeleton, --dsw-alias-border-inverted
--dsw-alias-border-inverted2, --dsw-alias-border-l1, --dsw-alias-border-l2, --dsw-alias-border-l2-darkmode-thin
--dsw-alias-border-l3, --dsw-alias-border-l4, --dsw-alias-brand-primary, --dsw-alias-brand-primary-invert
--dsw-alias-brand-primary-new-colorprimary-new-color, --dsw-alias-brand-text, --dsw-alias-button-contrast-fill, --dsw-alias-button-elevated-fill
--dsw-alias-button-floating-fill, --dsw-alias-button-floating-hover, --dsw-alias-button-ghost-active-border, --dsw-alias-button-ghost-active-fill
--dsw-alias-button-ghost-active-hover, --dsw-alias-button-info-fill, --dsw-alias-button-info-hover, --dsw-alias-button-primary-dimmed
--dsw-alias-button-primary-fill, --dsw-alias-button-primary-hover, --dsw-alias-button-tool-bar-fill, --dsw-alias-button-tool-bar-fill-invisible
--dsw-alias-button-tool-bar-hover, --dsw-alias-code-diff-added, --dsw-alias-code-diff-deleted, --dsw-alias-file-diff-added-bg
--dsw-alias-file-diff-added-gutter, --dsw-alias-file-diff-added-marker, --dsw-alias-file-diff-deleted-bg, --dsw-alias-file-diff-deleted-gutter
--dsw-alias-file-diff-deleted-marker, --dsw-alias-illustration-background, --dsw-alias-illustration-backing, --dsw-alias-illustration-detail
--dsw-alias-illustration-inset, --dsw-alias-illustration-shadow, --dsw-alias-illustration-surface, --dsw-alias-interactive-bg-active
--dsw-alias-interactive-bg-hover, --dsw-alias-interactive-bg-hover-accent, --dsw-alias-interactive-bg-hover-danger, --dsw-alias-interactive-bg-hover-solid
--dsw-alias-label-caption, --dsw-alias-label-deep-diving, --dsw-alias-label-deep-diving-shimmer, --dsw-alias-label-dimmed
--dsw-alias-label-document-preview, --dsw-alias-label-primary, --dsw-alias-label-primary-bluish, --dsw-alias-label-primary-dimmed
--dsw-alias-label-primary-foreground, --dsw-alias-label-primary-inverted, --dsw-alias-label-secondary, --dsw-alias-label-shimmer
--dsw-alias-label-tertiary, --dsw-alias-link, --dsw-alias-markdown-citation, --dsw-alias-markdown-code-block
--dsw-alias-markdown-code-block-banner, --dsw-alias-markdown-code-segment-selected, --dsw-alias-markdown-code-segment-unselected, --dsw-alias-markdown-inline-code
--dsw-alias-markdown-placeholder, --dsw-alias-markdown-tag, --dsw-alias-menu-group-header-fill, --dsw-alias-menu-icon
--dsw-alias-onboarding-accent, --dsw-alias-onboarding-card-fill, --dsw-alias-onboarding-checkbox-border, --dsw-alias-onboarding-secondary-fill
--dsw-alias-scrollbar-bg-l1, --dsw-alias-scrollbar-bg-l2, --dsw-alias-scrollbar-hover-l1, --dsw-alias-scrollbar-hover-l2
--dsw-alias-settings-card-fill, --dsw-alias-settings-card-stroke, --dsw-alias-state-business-primary, --dsw-alias-state-business-tertiary
--dsw-alias-state-done-primary, --dsw-alias-state-error-primary, --dsw-alias-state-error-secondary, --dsw-alias-state-idle-primary
--dsw-alias-state-success-primary, --dsw-alias-state-success-secondary, --dsw-alias-state-success-tertiary, --dsw-alias-state-warn-label
--dsw-alias-state-warn-primary, --dsw-alias-state-warn-secondary, --dsw-alias-state-warn-tertiary, --dsw-alias-switch-thumb
--dsw-alias-toast-bg, --dsw-alias-toast-label, --dsw-alias-tooltip-bg, --dsw-alias-tooltip-key-bg
--dsw-alias-turn-trigger-bg, --dsw-alias-turn-trigger-bg-hover
```

**サーフェス特化 — `--dsw-specific-*` 10 個:**

```
--dsw-specific-bubble, --dsw-specific-bubble-highlight, --dsw-specific-input-major, --dsw-specific-login-input
--dsw-specific-menu, --dsw-specific-selector, --dsw-specific-sidebar-fill, --dsw-specific-sidebar-nav-item-active
--dsw-specific-sidebar-nav-item-active-accent, --dsw-specific-tip
```

**静的色彩パレット — `--dsw-static-*` 82 個（原則として直接使わず、alias 経由で使う）:**

```
--dsw-static-amber-100, --dsw-static-amber-400, --dsw-static-amber-500, --dsw-static-amber-600, --dsw-static-amber-900
--dsw-static-blue-100, --dsw-static-blue-300, --dsw-static-blue-400, --dsw-static-blue-450, --dsw-static-blue-50
--dsw-static-blue-500, --dsw-static-blue-50p, --dsw-static-blue-600, --dsw-static-blue-75, --dsw-static-blue-800
--dsw-static-blue-900, --dsw-static-blue-950, --dsw-static-deepseek-100, --dsw-static-deepseek-200, --dsw-static-deepseek-300
--dsw-static-deepseek-400, --dsw-static-deepseek-450, --dsw-static-deepseek-50, --dsw-static-deepseek-500, --dsw-static-deepseek-600
--dsw-static-deepseek-700-delete, --dsw-static-deepseek-800, --dsw-static-deepseek-900, --dsw-static-green-100, --dsw-static-green-400
--dsw-static-green-500, --dsw-static-green-500-a08, --dsw-static-green-500-a12, --dsw-static-green-900, --dsw-static-neutral-00
--dsw-static-neutral-100, --dsw-static-neutral-1000, --dsw-static-neutral-150, --dsw-static-neutral-200, --dsw-static-neutral-250
--dsw-static-neutral-300, --dsw-static-neutral-400, --dsw-static-neutral-50, --dsw-static-neutral-500, --dsw-static-neutral-550
--dsw-static-neutral-600, --dsw-static-neutral-700, --dsw-static-neutral-800, --dsw-static-neutral-850, --dsw-static-neutral-900
--dsw-static-neutral-bluish-00, --dsw-static-neutral-bluish-100, --dsw-static-neutral-bluish-1000, --dsw-static-neutral-bluish-150, --dsw-static-neutral-bluish-200
--dsw-static-neutral-bluish-300, --dsw-static-neutral-bluish-310, --dsw-static-neutral-bluish-400, --dsw-static-neutral-bluish-50, --dsw-static-neutral-bluish-500
--dsw-static-neutral-bluish-55, --dsw-static-neutral-bluish-60, --dsw-static-neutral-bluish-600, --dsw-static-neutral-bluish-700, --dsw-static-neutral-bluish-75
--dsw-static-neutral-bluish-750, --dsw-static-neutral-bluish-800, --dsw-static-neutral-bluish-850, --dsw-static-neutral-bluish-875, --dsw-static-neutral-bluish-90
--dsw-static-neutral-bluish-900, --dsw-static-neutral-bluish-950, --dsw-static-red-100, --dsw-static-red-400, --dsw-static-red-400-a12
--dsw-static-red-50, --dsw-static-red-500, --dsw-static-red-600, --dsw-static-red-600-a08, --dsw-static-red-900
--dsw-static-violet-400, --dsw-static-violet-600
```

**形状・影・フォーカス・グラデーション他 26 個:**

```
--dsw-corner-shape, --dsw-elevation-panel, --dsw-elevation-prominent, --dsw-elevation-soft
--dsw-elevation-stroke, --dsw-elevation-stroke-color, --dsw-focus-ring-color, --dsw-focus-ring-width
--dsw-gradient-onboarding-blue-stops, --dsw-gradient-onboarding-cyan-stops, --dsw-gradient-onboarding-violet-stops, --dsw-linear-gradient-think
--dsw-linear-think-select, --dsw-mask-blur, --dsw-menu-backdrop-filter, --dsw-menu-surface-fill
--dsw-radius-lg, --dsw-radius-md, --dsw-radius-panel, --dsw-radius-sm
--dsw-radius-xl, --dsw-radius-xs, --dsw-shadow-lv1, --dsw-shadow-lv1-blur
--dsw-shadow-lv2, --dsw-shadow-lv3
```

radius の実値（`$PKG/dsh-client-ui-theme/lib/client.js:1464`）: `xs:4px / sm:8px / md:12px / lg:16px / xl:20px / panel:28px`。

**タイポグラフィ — `--dsw-font-*` 182 個（パターン）:**

- サイズ系グループ（各 5 サブプロパティ + 合成 shorthand）: `base-16`, `base-strong-16`, `l-20`, `m-18`, `s-14`, `s-strong-14`, `xl-24`, `xs-13`, `xs-strong-13`, `xxs-12`, `xxs-strong-12`, `xxxs-11`, `xxxs-strong-11`
  例: `--dsw-font-s-14`, `--dsw-font-s-14-font-family`, `--dsw-font-s-14-font-size`, `--dsw-font-s-14-font-style`, `--dsw-font-s-14-font-weight`, `--dsw-font-s-14-line-height`
- Markdown 系: `--dsw-font-markdown-base`, `-base-italic`, `-base-strong`, `-base-strong-italic`, `-code`, `-code-block`, `-code-block-small`, `-h1`〜`-h4`, `-small`, `-small-italic`, `-small-strong`, `-small-strong-italic`, `-table`, `-table-head`（各サブプロパティ付き）
- その他: `--dsw-font-family`, `--dsw-font-family-brand`
- 使い方は `font: var(--dsw-font-s-14);` または `font-size: var(--dsw-font-s-14-font-size);`。

**トランジション — `--ds-*` 5 個（root 定義）:**

```
--ds-ease-in-out, --ds-font-family-code, --ds-transition-duration, --ds-transition-duration-fast
--ds-transition-duration-slow
```

**`--dsh-*`（テーマ CSS 内定義 11 個）:**

```
--dsh-code-font-delta, --dsh-content-font-delta, --dsh-content-font-delta-secondary, --dsh-content-font-size-secondary
--dsh-font-family-code-default, --dsh-font-family-text-default, --dsh-scrollbar-thumb, --dsh-scrollbar-thumb-border
--dsh-scrollbar-thumb-hover, --dsh-scrollbar-track-margin, --dsh-scrollbar-width
```

**`--dsh-*`（テーマ CSS 外で実行時に設定されるもの。読むだけ）:**

- ThemePresenter が `body` に設定: `--dsh-content-font-size`, `--dsh-code-font-size`, `--dsh-terminal-font-size`, `--dsh-font-family-text`, `--dsh-font-family-code`, `--dsh-font-family-terminal`（`$PKG/dsh-client-ui-layout/lib/client.js:627-635, 665-676`）
- ui-theme が `documentElement` に: `--dsh-hairline-width`（`$PKG/dsh-client-ui-theme/lib/client.js:1489, 1509-1526`）
- AppFrame が `html` / frame に: `--dsh-frame-top-clearance`, `--dsh-frame-chrome-top`, `--dsh-frame-overlay-top`, `--dsh-frame-leading-clearance`, `--dsh-windows-titlebar-height`, `--dsh-windows-content-radius`, `--dsh-windows-sidebar-width`（`$PKG/dsh-client-ui-layout/lib/client.js:74` の CSS 文字列と `:353`）
- 会話コンテンツが親要素に: `--dsh-conversation-column-width`, `--dsh-chat-user-width`（`$PKG/dsh-client-ui-conversation/lib/client.js:20222-20229` `publishWidths`）、`--dsh-composer-height`, `--dsh-conversation-viewport-height`（同 `:20499-20500`）
- 会話 CSS 内: `--dsh-chat-content-width`, `--dsh-composer-card-max-width`, `--dsh-composer-side-clearance`, `--dsh-composer-dock-inset`（`$PKG/dsh-client-ui-conversation/lib/client.js:20057` の CSS 文字列。`.wSkVaW_body` / `.wSkVaW_embeddedBody`）

### 9.3 プラグイン CSS の推奨

- **色・境界・影は `--dsw-alias-*` のみ**を使う（example-plugin もそうしている。`<workspace>/example-plugin/client.js:44-140` は暗色パレットのために alias を上書きしているだけ）。
  例: `background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); border: .5px solid var(--dsw-alias-border-l3); box-shadow: var(--dsw-elevation-panel);`
- ダーク固有の分岐が必要なら `body[data-ds-dark-theme] .cube-… { … }`。ただし基本は alias で足りる。
- 立方体の独自色（ガラス壁など）は `ctx.theme.overrideTokens('@local/dsh-cube-ui', { '--dsw-alias-…': { light, dark } })` で**両モード必須**のレイヤとして定義できる（§9.4）。自前 CSS に直値で書くより追従性が高い。
- 自前 `<style>` は `data-plugin` / `data-plugin-css` 付きで head に 1 回だけ入れる（example-plugin の `installStyles` が実例。`<workspace>/example-plugin/client.js:774-840` 付近）。

### 9.4 テーマ API（`$PKG/dsh-client-ui-theme/lib/types/client/index.d.ts`）

```ts
export interface ThemeSnapshot {
    preference: ThemePreference;         // 'light' | 'dark' | 'system' | registered id
    fontSizes: FontSizes;
    fontFamilies: FontFamilies;
    active: ThemeDefinition;             // 解決済み。tokens = override 層
    themes: readonly ThemeDefinition[];
    revision: number;
}
export interface ThemeDefinition {
    id: string;
    colorScheme: 'light' | 'dark';       // body[data-ds-dark-theme] を決める
    tokens: ThemeTokens;                 // --dsw-alias-* の上書き辞書
    icons?: IconReplacements;
}
getTheme(): ThemeSnapshot;
setTheme(id: string): void;
setFontSize(role, px): void;
register(definition: ThemeDefinition): () => void;
overrideTokens(source: string, tokens: ThemeTokenOverrides): () => void;
```

- 購読: `ctx.on('theme/change', (snapshot) => { … })`。イベント定義は同 d.ts:

```ts
interface Events {
    /**
     * Theme state changed (preference switched, registry updated, or the OS
     * color scheme changed while the preference is `system`).
     * @param snapshot - Current immutable theme snapshot.
     * @mode emit
     */
    'theme/change'(snapshot: ThemeSnapshot): void;
}
```

- Canvas / WebGL の立方体色を CSS 変数から取りたい場合は、`getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base')` を `theme/change` 時に読み直す（⚠️ 自前検証はしていないが、ThemePresenter が body インライン変数を書くので成立する）。
- トークン名の実行時列挙: `ctx.theme.exportInspectTokens()`（`$PKG/dsh-client-ui-theme/lib/client.js:1948-1953`）は**curated 14 個 + 登録テーマのトークン**しか返さない。全 441 個の一覧は本節のリストを使う。

---

## 10. 設問7: `ctx.uiWorkspace` の全メソッド

型: `$PKG/dsh-client-ui-workspace/lib/types/client/navigation.d.ts:17-117`（全文に近い抜粋）:

```ts
export interface UiWorkspace {
    /** Select a Session and show its Conversation as one UI navigation action. */
    openSession(target: SessionTarget): void;
    /** Connect a Workspace and open its Session unless a later navigation supersedes it. */
    openWorkspace(workspaceId: WorkspaceId, beforeOpen?: (sessionId: SessionId) => void, options?: Pick<StartSessionOptions, 'agentPreset'>): Promise<void>;
    /** Fork a Session without changing the current selection. */
    forkSession(sessionId: SessionId, onCreated?: (childId: SessionId) => void, options?: Pick<Parameters<ISessions['fork']>[0], 'allowMigration'>): Promise<SessionId>;
    /** Resolve the Session for a new conversation in a Workspace ... */
    connectWorkspace(workspaceId: WorkspaceId, options?: Pick<StartSessionOptions, 'agentPreset'>): Promise<SessionId>;
    /** Open the Workspace blank `connectWorkspace` resolves ... */
    startSession(workspaceId?: WorkspaceId, options?: StartSessionOptions): void;
    archiveSession(sessionId: SessionId, options?: { readonly stopActivity?: boolean }): Promise<void>;
    unarchiveSession(sessionId: SessionId): Promise<void>;
    pinSession(sessionId: SessionId): Promise<void>;
    unpinSession(sessionId: SessionId): Promise<void>;
    pickDirectory(): Promise<string | null>;
    listDirectory(path?: string, signal?: AbortSignal): Promise<DirectoryListing>;
    createDirectory(path: string, name: string): Promise<string>;
    whenAccess(workspaceId: WorkspaceId, action: RemoteEndpoint, callback: () => AccessEffect): () => void;
}
```

`StartSessionOptions` は `DraftInitializationOptions` 拡張（`navigation.d.ts:12-15`）:

```ts
export interface StartSessionOptions extends DraftInitializationOptions {
    /** Agent preset the Session runs; the Host default when omitted. */
    readonly agentPreset?: string;
}
```

実装（`$PKG/dsh-client-ui-workspace/lib/client.js`）:

- `openSession(target)` :1473 → `replaceMain(target, signal, "reveal")`。**選択して会話を表示**（`ctx.layout.selectPanel(null)` も行う。:1476-1493 / :1660-1686）。
- `openWorkspace(workspaceId, beforeOpen?, options?)` :1476 → `connectBlank` → 成功したら `replaceMain(..., "reveal", beforeOpen)`。
- `connectWorkspace(workspaceId, options?)` :1399 → `connectBlank`。**選択は変えない**（blank を作成/再利用して SessionId を返すだけ）。
- `forkSession(sessionId, onCreated?, options?)` :1494 → `ctx.sessions.fork({ sessionId, increaseTitle: true, ... })`。
- `startSession(workspaceId?, options?)` :1502 → 対象ワークスペースを決め（引数 → 現在セッションの所属 → 直近）、`openWorkspace` を呼ぶ。**＝ 新規 blank セッションを選択して開く**。`whenDraftExists` / `prompt` / `clearPreviousDraft` で既存ドラフトの扱いを指示。
- `archiveSession` / `unarchiveSession` / `pinSession` / `unpinSession` :1530 以降。
- `whenAccess(workspaceId, action, callback)` :1570 付近（`ctx.remoteAccess.whenAccess` の薄いラッパ）。

### 「指定ワークスペースに新規セッションを作る」正しい手順 ✅

1. **その場で作成だけして自前 UI を維持したい**:
   `const id = await ctx.uiWorkspace.connectWorkspace(workspaceId);`
   → blank が無ければ Host が作成、あれば再利用。**選択は変わらない**。その後ユーザーが面をクリックしたら `ctx.uiWorkspace.openSession(id)`。
2. **新規セッションを開いて会話へ入る（標準の「New Session」と同じ）**:
   `ctx.uiWorkspace.startSession(workspaceId);`
   → 選択が変わり `panelInfo.activePanelId` が null に戻る。我々の main entry が描画されるので、**現在セッションの変化を見て会話モードへ遷移する**実装にする。
3. 既存セッションへ入る: `ctx.uiWorkspace.openSession(sessionId)`。
4. `SessionTarget = SessionId | SubagentAddress`（`$PKG/dsh-api-session-controller/lib/types/client/contract/sessions.d.ts:20`）。

⚠️ 注意: `startSession` は「ドラフト準備」も行う。`prompt` 付きで呼ぶと入力欄に流し込まれる。立方体 UI から使うなら `startSession(workspaceId)`（オプション無し）が無難。

---

## 11. 設問8: `ctx.locale` のプラグイン向け API

### 11.1 API（`$PKG/dsh-client-locale/lib/types/client/index.d.ts`）

```ts
export interface LocaleSnapshot {
    active: LocaleId;
    locales: readonly LocaleDefinition[];
    revision: number;
}
export class LocaleRuntime {
    getLocale(): LocaleSnapshot;
    getSnapshot(): LocaleSnapshot;                 // LocaleFace
    subscribe(fn: () => void): () => void;         // LocaleFace
    setLocale(id: string): void;
    addLanguage(input: LanguageRegistration): () => void;
    register<N extends Extract<keyof LocaleNamespaceMap, string>>(
        ns: N, dicts: Record<BuiltInLocaleId, LocaleDictOf<N>> & Record<LocaleId, LocaleDictOf<N>>
    ): () => void;
    register(ns: string, locale: string, dict: LocaleDict): () => void;
    bind<N extends Extract<keyof LocaleNamespaceMap, string>>(ns: N): TranslateNS<N>;
    bind(ns: string): Translate;
}
```

実装上のポイント（`$PKG/dsh-client-locale/lib/client.js:1675-1714`）:

```js
register(ns, localeOrDicts, dict) {
    const pairs = typeof localeOrDicts === "string" ? [[localeOrDicts, dict]] : Object.entries(localeOrDicts);
    for (const [locale] of pairs) if (!LOCALE_ID_PATTERN.test(locale)) throw new Error(`locale id "${locale}" is not a BCP 47-style tag`);
    ...
    for (const [locale] of pairs) if (locales.has(localeKey(locale))) throw new Error(`locale namespace "${ns}" already has locale "${locale}"`);
    ...
}
bind(ns) { ... t = (key, params) => this.translate(ns, key, params); ... }
```

- 名前空間は**単なる文字列**（例 `'settings.example-plugin'`, `'cube'`）。型付きにするには `LocaleNamespaceMap` への declaration merging が必要だが、**JS プラグインなら不要**。
- 参照チェーン: アクティブロケール → その fallback → 英語 → 見つからなければ `common` 名前空間 → それでも無ければ **キー文字列そのもの**（`translate` 実装 :1711-1715）。
- 実装 0.2.2-rc.1 は「baseline 2 言語必須」を**実行時には検証しない**（型でしか課していない）。ただしフォールバックの都合上 `zh` と `en` は必ず入れる。
- 購読: `ctx.on('locale/change', snapshot)`（**辞書登録では発火しない**。辞書・表示の追従は LocaleFace の revision 経由）。スロット内コンポーネントは renderer が `useLocaleRevision` で再レンダーする（`$PKG/dsh-client-ui-renderer/lib/client.js:1117-1122`）ので、登録時に `locale: NS` を付けて `t` props を受け取るのが最も簡単。

### 11.2 example-plugin の実装例（前例そのまま）✅

`<workspace>/example-plugin/client.js:883-890`:

```js
ctx.effect(
  () =>
    ctx.locale.register(LOCALE_NS, {
      ja: LOCALE_DICTS.ja,
      en: LOCALE_DICTS.en,
      zh: LOCALE_DICTS.zh,
    }),
  'example-plugin: dictionaries',
);
```

（`LOCALE_NS = 'settings.example-plugin'`、辞書は `<workspace>/example-plugin/locale/*.json`。）

スロット登録側で `locale` を宣言する例（同 `:1093-1115`）:

```js
ctx.slots.inject('settings.general.item', () =>
  ctx.slots.register(
    { name: 'settings.general.item', id: 'example-plugin', order: 13, locale: LOCALE_NS, inject: ... },
    ThemeRow,
  ),
);
```

`ThemeRow` は `t('title')` を使う。→ `locale:` を付けると `t` が props に来る（§4.2）。

### 11.3 cube-ui での推奨

- 名前空間: `'cube-ui'`（他パッケージと衝突しない名前にする）。
- 辞書は `zh` / `en` / `ja`（+ 余裕があれば他言語）。`ctx.effect(() => ctx.locale.register('cube-ui', { zh, en, ja }), 'cube-ui: dictionaries')`。
- スロット登録に `locale: 'cube-ui'` を付けて `t` を受け取る。`t` の第2引数で `{name}` 展開可: `t('session.count', { count: 3 })`。

---

## 12. 設問9: main の `conversation` を上書きした場合の副作用

### 12.1 置き換わるもの（描画されなくなる）✅

標準の `ConversationPanel` は `renderSlot("main.conversation", {})` しかしない（§4.5）。その先 `ConversationRoot → ConversationMainPanel` が **標準ヘッダー + ConversationContent** を描く。したがって我々がセルを奪うと以下が**丸ごと消える**:

1. **`conversation.header` とその配下**:
   - `conversation.session.header` → タイトル（lineage）、actions、utilities、corner、view タブ
   - 実際の寄与元（`grep 'name: "conversation.session.header.*"'` 実測）:
     - `conversation.session.header.actions`: `dsh-client-ui-jobs`（:892）、`dsh-client-ui-subagent`（:1267）、`dsh-client-ui-agent-preset`（:3033）、`dsh-experimental-client-ui-agent-team`（:666）
     - `conversation.session.header.utilities`: `dsh-client-ui-open-in-app`（:1441）、`dsh-client-ui-schedule`（:19411）、`dsh-session-log-export`（:628）、`dsh-experimental-client-ui-forge`（:11692）
     - `conversation.session.header.corner`: **`dsh-client-ui-sidebar-right` の `ExpandButton`（右バー開閉）**（:5719-5722）
     - `conversation.session.header.lineage`: `dsh-client-ui-subagent`
   - これらは**スロット登録が生きていても、親（標準ヘッダー）が描かれないので一切マウントされない**。
2. **標準の幅ハンドル**: `CONTENT_SLOTS = { widthControls: ConversationWidthControls }` は `ConversationMainPanel` が渡しているもの。我々が `renderFactorySlot` を呼ぶときに `slots.widthControls` を渡さなければ描かれない（＝既定で消える）。
3. **デスクトップのウィンドウドラッグ領域**: `ConversationHeader` は `data-window-drag: true` を持つ（`$PKG/dsh-client-ui-conversation/lib/client.js:20640`）。macOS デスクトップでは `html[data-platform=darwin] [data-window-drag]{-webkit-app-region:drag}`（`$FRONT/index-lh_YM6sT.css` 内のグローバル CSS）でドラッグ領域になる。**自前ヘッダーに `data-window-drag` を付けないと、メイン領域でウィンドウを掴めなくなる**（サイドバーのロゴ行だけが残る）。
4. **`data-slot="main.conversation"` という DOM 目印**。`dsh-experimental-session-inspector` が `document.querySelectorAll("[data-slot=\"main.conversation\"] [data-slot=\"conversation.view\"] [data-chat-flow]")` でメイン会話を探している（`$PKG/dsh-experimental-session-inspector/lib/client.js:719-720`）。置き換えると**セッションインスペクタのピッカーが動かない**。

### 12.2 影響を受けないもの ✅

- **レイアウトフレーム**: sidebar / main / rightbar / shell.bottom / overlay / leading の各列は AppFrame が描くので無傷。ドロワー（<768px）の overlay・mask・`inert` もそのまま。
- **右サイドバー本体**（`rightbar` / `rightbar.session` の登録）と `ctx.layout.openRightbar` 連携。ただし開くためのボタンが消える（§12.3）。
- **DocumentTitle**: `mainView` retention から直接タイトルを出しており、スロットに依存しない（`$PKG/dsh-client-ui-layout/lib/client.js:56-64`）。
- **サブエージェントの埋め込み会話**: `conversation.content` Factory を独自に呼ぶので無関係（`$PKG/dsh-client-ui-subagent/lib/client.js:791`）。
- **パネル切替**: `plugins` / `schedules` の key はそのまま。`selectPanel(null)` で我々のセルに戻る。
- **`root` / `sidebar` / `rightbar` を占める他プラグイン**。

### 12.3 右バー開閉の消失と対策 ✅

`ExpandButton` は `conversation.session.header.corner` に登録されていて、`actions.setExpanded(sessionId, true)` を呼ぶ（`$PKG/dsh-client-ui-sidebar-right/lib/client.js:709-731`）。我々の UI では代替として:

```js
// sidebar-right が構成にある場合のみ
const right = ctx.get('sidebarRight');
right?.toggleExpanded();          // 開閉トグル（公開 API）
// または特定タブを開く（docked タブは開くと同時に expand される）
right?.openTab('guide');          // GUIDE_KIND = 'guide'（:751）
```

⚠️ `guide` タブ種別は `$PKG/dsh-client-ui-sidebar-right/lib/client.js:750-751` で `GUIDE_KIND = "guide"`。存在は確認済み。

### 12.4 クラッシュ時・unload 時の安全網 ✅

- 自前 entry がクラッシュ → abdicate → **標準 Conversation が自動で描画される**（§5.3）。
- プラグイン unload → 標準 entry が再び唯一のセル占有者になり復帰。
- ただし**会話モードの内部 state は消える**ので、クラッシュ復帰時に立方体 UI の状態（回転角など）は失われる（⚠️想定）。

### 12.5 「会話を閉じる」と選択状態 ✅

- アプリ全体の「現在セッション」は `mainView` retention で表現される（§7.6）。立方体のブラウズモードに戻っても**選択は解除されない**。したがって:
  - サイドバーのセッション強調、`DocumentTitle`、右バーの `mounted` はそのセッションのまま。
  - 立方体の「閉じる（Esc）」は**自前の表示モード state** で実装し、選択は触らない。再度セッションをクリックしたら会話モードへ。
  - もし選択自体を解除したいなら `ctx.uiWorkspace` に clear 公開 API は無い（`clearMain` は private）。⚠️ 「未選択」に戻す公式手段は無いと考えてよい（`startSession` 失敗時など内部でのみ clear される）。

### 12.6 設定モーダルを開く API は無い ✅

- settings は `sidebar.settings` スロット配下のモーダルで、開閉は SettingsRoot のローカル state（`shellStore`）。公開サービスは無い。
- 唯一の受け口は `settings.launcher` スロットの owner props `openSettings`（`$PKG/dsh-client-ui-settings-general/lib/client.js:436-444`）だが、これは **`settings.launcher` に登録したコンポーネントにしか渡らない**。
- 現実的な回避策（⚠️推奨しないが動く）: `[data-slot="settings.launcher"] button` を `click()` する。または設定モーダルを自前で作らず、`ctx.layout.selectPanel('plugins')`（プラグインマネージャ）と `settings.section` への自前登録で代替する。

### 12.7 モバイル/狭幅 ✅

- フレームは viewport 幅で自動対応（§8.2）。`data-sidebar-drawer` 時は中央列が `inert` になる（`$PKG/dsh-client-ui-layout/lib/client.js:382-390`）ので、我々の UI も自動的に操作不能になり、ドロワーを閉じれば戻る。
- 我々の UI は `drawer` 時（<768px）に立方体 3D を軽くする/タブ UI に切り替えるなどが必要（⚠️デザイン判断）。`useFoldedLandscape` 相当（折りたたみ端末）は AppFrame の inject hooks でしか取れないため、自前で `matchMedia('(device-posture: folded) and (orientation: landscape)')` を張る。
- 左上の `shell.leading`（ドロワー時の再開ボタン/New Session）は frame が重ねてくる。**自前ヘッダーの左上は `padding-left: var(--dsh-frame-leading-clearance, 0px)` で避ける**（`$PKG/dsh-client-ui-layout/lib/client.js:74` の CSS を参照）。

---

## 13. 設問10: 埋め込み会話の最小構成

### 13.1 必要なもの / 不要なもの ✅

必要なもの:

1. **描画コンテナ**（高さが確定した flex カラム）。`ConversationContent` のルートは `display:flex; flex-direction:column; height:100%` を前提にした CSS（`.wSkVaW_root{...height:100%;display:flex}`、`$PKG/dsh-client-ui-conversation/lib/client.js:20057` の CSS 文字列）。親に `height` / `min-height:0` の連鎖が必要。
2. **`renderFactorySlot('conversation.content', {variant:'embedded', phase, hero}, options?)`**。
3. **phase/hero の算出**（`ConversationMainPanel` の 7 行ロジック。§6.2）。これには `sessionId` / `useSession` / `useConversation` / `useSessions` が要る → root entry には無いので **session-maybe の子スロット（または自前 Factory）を 1 枚挟む**。

不要なもの:

- **Provider の手動マウントは不要**。レンダラがルートを `ScopeProvider scope="session-maybe"` で包んでいるため、root entry 配下のどこから `renderFactorySlot` を呼んでも**現在セッションの binding** が解決される。`$PKG/dsh-client-ui-renderer/lib/client.js:1267-1278`:

```js
function createSlotRenderer() {
    return { renderRoot(host, ownerProps) {
        return (0, react_jsx_runtime.jsx)(HostContext.Provider, {
            value: host,
            children: (0, react_jsx_runtime.jsx)(RootStandardProvider, { children: (0, react_jsx_runtime.jsx)(ScopeProvider, {
                scope: "session-maybe",
                children: (0, react_jsx_runtime.jsx)(RootOutlet, { ownerProps })
            }) })
        });
    } };
}
```

- 逆に「**特定の**セッション」（例: 立方体の面に並べるプレビュー）を strict に描く場合は `SessionProvider` を自分で使い、`ctx.sessions.retain(id, {source:'cubeFace'})` の `SessionReference` を `session` prop に渡す（§7.8）。

### 13.2 未選択（セッションなし）の挙動 ✅

`ConversationContent` は `sessionId === undefined` でも描ける:

- `useSession` / `useConversation` / `useInput` は session-maybe なので `undefined` を返す。
- `hero=true` を渡すと `HeroShell`（ブランド・ワークスペースチップ・大きな composer）を描き、composer は `disabled` で「ワークスペースを選べ」の placeholder になる。
  `$PKG/dsh-client-ui-conversation/lib/client.js:20540-20615` の流れ:

```js
const inert = sessionId === void 0 || hero && chipTitle === void 0;
const inputBar = renderSlot("conversation.composer.bar", {
    variant: hero ? "hero" : "composer",
    ...inert ? {
        disabled: true,
        placeholder: t("placeholder.workspace"),
        workspacePickerOpen: pickerOpen,
        onRequestWorkspace: () => { setPickerOpen(true); },
    } : ... 
});
...
const composer = renderSlotChain("conversation.composer", { sessionId, session, pendingInteraction }, {
    fallback: composerBar,
    fallbackOnly: sessionId === void 0,   // ← 未選択時は fallback のみ
    overlay: true
});
```

- セッション未選択の間は `Views` も描かれない（`:20609` の `sessionId === void 0 ? null : <Views />`）。
- **立方体 UI としては「未選択なら会話パネル自体を出さない」方が素直**（`renderFactorySlot` を呼ばない or 自前のプレースホルダを出す）。どちらも可。

### 13.3 ストリーミング中の挙動 ✅

- 会話のライブ更新は Factory 内部の stores（`useConversation` / `useSession` / `useInput`）が持ち、描画は購読で更新される。**我々の側で特別なことは不要**。
- Factory occurrence の識別子は `name + factory version + scope identity`（`$PKG/dsh-client-ui-renderer/lib/client.js:1080-1110`）。**セッションを切り替えると occurrence が remount する**（component-local state は消える。会話の状態は Controller 側にあるので失われない）。
- 立方体のブラウズ中に会話を**隠す**場合、`display:none` で残すより**アンマウント**が無難（Chat のスクロール・ResizeObserver・`data-conversation-scroll` 連携が走り続けるのを避ける）。ただし戻すたびにスクロール位置がリセットされる点はトレードオフ（⚠️デザイン判断）。
- 未読・実行中バッジは `useSessionStatus`（§7.3）で描ける（`sessionStatus.get(sessionId)?.running` 等）。

### 13.4 `conversation.content` Factory が未登録の場合

`renderFactorySlot` は `fallback` を描く（§6.1）。conversation プラグインが構成に無い・読み込み順で未登録の瞬間はこれが出る。**永続的に欠ける構成は異常**なので、フォールバックは「会話を利用できません」程度の控えめな表示にする。

### 13.5 推奨する実装形（構成Aの具体形）✅

```
ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: 'conversation',
    priority: -1,
    locale: 'cube-ui',
    children: {
        // 立方体の各面（必要な場合）
        'cube.face':        { kind: 'list',   scope: 'root' },
        // 会話モードの中心パネル（session-maybe で標準 props を受ける）
        'cube.center':      { kind: 'single', scope: 'session-maybe' },
        // 自前ヘッダー/ナビ（root でよい）
        'cube.header':      { kind: 'single', scope: 'root' },
        'cube.diamond':     { kind: 'list',   scope: 'root' },
        'cube.dock':        { kind: 'single', scope: 'root' },
    },
}, CubeRoot));

ctx.slots.inject('cube.center', () => ctx.slots.register(
    { name: 'cube.center' }, CubeCenterConversation)   // props に sessionId/useSession/useConversation/renderFactorySlot
);
```

`CubeCenterConversation` は §6.4 のコードで `conversation.content` を描く。`CubeRoot` は root props（`useWorkspaces` / `useSessions` / `useSessionStatus` / `usePanelInfo` / `t` / `renderSlot` / `renderFactorySlot`）だけで立方体・ナビ・ドックを描く。

- **宣言した子は必ず描く**こと（`RendersCheck` は型検査だが、実行時も「宣言＝描画権限」なので描かない宣言は無駄。型なし JS なら問題ないが、将来の型付けのために守る）。
- `cube.center` を session-maybe にすることで、**セッション未選択時も `sessionId: undefined` で呼ばれる**（`useFactorySlot` 的な扱い）。未選択時に何も描かないなら `return null`。
- 立方体の面に「セッション一覧」を出すだけなら root props の `useWorkspaces` / `useSessions` / `useSessionStatus` で足りる（§7）。

---

## 14. 実装上の落とし穴チェックリスト

- [ ] `main` 登録は `ctx.slots.inject('main', …)` で行う（layout より先に apply され得るため）。
- [ ] `priority` は必ず 0 以外（-1 推奨）。同じ値で二重登録すると throw する。
- [ ] 自前 entry のクラッシュは標準 UI へのフォールバックになる。ただしクラッシュを握りつぶさない（`SlotAssemblyError` は再 throw される）。
- [ ] 標準ヘッダーを失うので、右バー開閉（`ctx.get('sidebarRight')?.toggleExpanded()`）、新規セッション（`ctx.uiWorkspace.startSession()`）、設定入口（DOM クリック or 自前設定）を用意する。
- [ ] デスクトップ用に `data-window-drag` を持つ上部バーを付ける。左上は `var(--dsh-frame-leading-clearance)` で避ける。
- [ ] 色は `--dsw-alias-*`、半径は `--dsw-radius-*`、影は `--dsw-elevation-*`、フォントは `--dsw-font-*`。直値は使わない。
- [ ] 立方体の独自色は `ctx.theme.overrideTokens('@local/dsh-cube-ui', { … light/dark 両方 })`。
- [ ] 「現在セッション」は `retainedBy.mainView > 0`。選択の変更（サイドバーの New Session 等）に反応して会話モードへ遷移する。
- [ ] 立方体のブラウズ中に会話をアンマウントするかはスクロール位置とのトレードオフ。
- [ ] `renderFactorySlot` には `fallback` を渡す。
- [ ] `ctx.sidebarRight` / `ctx.uiWorkspace` などは `inject` or `ctx.get` で有無を保証する。

---

## 付録A: 参照した主な file:line

| 内容 | 場所 |
| --- | --- |
| スロット props 合成（実装） | `$PKG/dsh-client-ui-renderer/lib/client.js:667-770, 811-888, 1003-1116` |
| main/keyed 描画 dispatch | `$PKG/dsh-client-ui-renderer/lib/client.js:1176-1200` |
| slot renderer の root Provider | `$PKG/dsh-client-ui-renderer/lib/client.js:1267-1278` |
| register の登録・寿命・registrant | `$PKG/dsh-client-ui-renderer/lib/client.js:1603-1634` |
| SlotCore.register / entriesOfSlot | `$FRONT/index-BgUyXZcc.js:196`（1行バンドル） |
| SlotCore の型・JSDoc | npx キャッシュ `…/dsh-client-ui-slots@0.2.0-rc.2/lib/types/index.d.ts:520-900`（参考） |
| ConversationPanel（型・実装） | `$PKG/dsh-client-ui-conversation/lib/types/client/skeleton/ConversationPanel.d.ts:8` / `lib/client.js:20623` |
| ConversationMainPanel 全文 | `$PKG/dsh-client-ui-conversation/lib/client.js:20267-20292` |
| ConversationContent の composer/未選択処理 | `$PKG/dsh-client-ui-conversation/lib/client.js:20478-20615` |
| conversation.content Factory 定義 | `$PKG/dsh-client-ui-conversation/lib/client.js:22799-22870`、`lib/types/client/contract/slots.d.ts:425-480` |
| 埋め込み会話の前例 | `$PKG/dsh-client-ui-subagent/lib/client.js:786-802` |
| main の宣言（layout root entry） | `$PKG/dsh-client-ui-layout/lib/client.js:703-737` |
| MainPanel / DocumentTitle | `$PKG/dsh-client-ui-layout/lib/client.js:58-130` |
| サイドバー閾値・toggle | `$PKG/dsh-client-ui-layout/lib/client.js:18, 248-254, 470-480` |
| AppFrame の data 属性 | `$PKG/dsh-client-ui-layout/lib/client.js:349-363` |
| layout service（ctx.layout） | `$PKG/dsh-client-ui-layout/lib/types/client/service.d.ts:24-90` |
| ThemePresenter | `$PKG/dsh-client-ui-layout/lib/client.js:571-650` |
| テーマ CSS（base / design-platform） | `$PKG/dsh-client-ui-theme/lib/client.js:1464, 1470` |
| テーマ CSS インストール | `$PKG/dsh-client-ui-theme/lib/client.js:1489-1540` |
| テーマ API 型 | `$PKG/dsh-client-ui-theme/lib/types/client/index.d.ts` |
| Session 標準 props | `$PKG/dsh-client-ui-session/lib/types/client/index.d.ts` |
| session-maybe binding 供給 | `$PKG/dsh-client-ui-session/lib/client.js:929-940, 1120-1134` |
| Workspace 標準 props | `$PKG/dsh-client-ui-workspace/lib/types/client/index.d.ts`、`lib/client.js:5780-5784` |
| uiWorkspace 型 | `$PKG/dsh-client-ui-workspace/lib/types/client/navigation.d.ts:17-117` |
| uiWorkspace 実装 | `$PKG/dsh-client-ui-workspace/lib/client.js:1399-1530, 1650-1700` |
| locale API 型/実装 | `$PKG/dsh-client-locale/lib/types/client/index.d.ts` / `lib/client.js:1675-1714` |
| sidebarRight API | `$PKG/dsh-client-ui-sidebar-right/lib/types/client/service.d.ts:164-240`、`lib/client.js:709-731, 5719-5722` |
| session-inspector の DOM 依存 | `$PKG/dsh-experimental-session-inspector/lib/client.js:719-720` |
| スロットカタログ | `$PKG/dsh-cordis-client-runner/lib/client.js:2606-7560`（`main`:4758, `main.conversation`:4797, `root`:5311, `shell.overlay`:5948, `conversation.header`:3364） |
| サービスカタログ | `$PKG/dsh-cordis-client-runner/lib/client.js:1281-1846`（`layout`:1283, `locale`:1326, `sessions`:1422, `slots`:1518, `theme`:1555, `uiWorkspace`:1645, `workspaces`:1771） |
| イベントカタログ | 同 `:1847-1890`（`connection/reset`, `locale/change`, `slots/changed`, `theme/change`） |
| staticModules（require 可能） | `$FRONT/index-BgUyXZcc.js:196` |
| モジュールローダ契約 | `$PKG/dsh-client-modules/lib/types/client/manifest.d.ts:180-330` |
| package.json の dsh フィールド | `$PKG/dsh-package-manifest/lib/types/types.d.ts:26-96` |
| 前例プラグイン | `<workspace>/example-plugin/{package.json,cordis.patch.yml,client.js,index.js}` |

## 付録B: 調査に使った実測コマンド（読み取りのみ）

```bash
# スロットカタログ / サービスカタログの抽出（インストール済み 0.2.2-rc.1 の実データ）
node --input-type=module -e '
import fs from "node:fs";
const src = fs.readFileSync("'$PKG'/dsh-cordis-client-runner/lib/client.js","utf8");
// "const SERVICE_API = [" … 対応する "]" までを eval して JSON 化（本文の各抜粋の出所）
'
# 型の参照（0.2.0-rc.2。バージョン差のため参考）
grep -n "Shadowing (single/keyed/list)" $NPX/_npx/<hash>/node_modules/@deepseek-ai/dsh-client-ui-slots/lib/types/index.d.ts
# テーマ変数の抽出
grep -o -- "--[A-Za-z0-9_-]*[[:space:]]*:" $PKG/dsh-client-ui-theme/lib/client.js | sort -u
# プラグイン間 require の実測
grep -rh "require(\"@deepseek-ai/dsh-client-ui-" --include=client.js $PKG | sort | uniq -c
# 出荷 SlotCore の実行テスト（priority の勝敗・throw を実測）
node --input-type=module -e '
import fs from "node:fs";
const src = fs.readFileSync("'$FRONT'/index-BgUyXZcc.js","utf8");
const start = src.indexOf("OI=class"), end = src.indexOf("const MI=", start);
let cls = src.slice(start, end).trim().replace(/,$/, "");
const SlotCore = new Function("b1", cls + "; return OI;")(Object.freeze([]));
const core = new SlotCore();
core.register({ name:"root", children:{ main:{ kind:"keyed", scope:"root" } } }, ()=>"root");
core.register({ name:"main", key:"conversation" }, ()=>"standard");
core.register({ name:"main", key:"conversation", priority:-1 }, ()=>"mine");
console.log(core.entriesOfSlot("main").map(e=>[e.component(), e.options.priority]));
'
```

## 付録C: 未検証・要注意（⚠️）

1. **DOM 属性によるサイドバー折りたたみ検知**（§8.3）: 設計上は動くはずだが、実ブラウザでの動作確認はしていない。MutationObserver の購読コスト・初回値取得のタイミングは実装時に検証すること。
2. **設定モーダルの起動**（§12.6）: 公開 API は無い。DOM クリックはセレクタ（`data-slot="settings.launcher"`）に依存する脆い回避策。
3. **`data-window-drag` の要否**（§12.1-3）: デスクトップ（Electron）での実機確認はしていない。Web 単体では無関係。
4. **`ctx.slots.register` の型（SlotRegistration）**（§3.2）: 0.2.2-rc.1 の `dsh-client-ui-slots` d.ts はインストール先に無い。本ノートの型は 0.2.0-rc.2 の d.ts と 0.2.2-rc.1 の生成カタログ `TYPE_API` の突き合わせ。**実装時に TS 型チェックを回すなら、`@deepseek-ai/dsh-client-ui-slots@0.2.2-rc.1` を devDependencies に追加して型を取るのが確実**（パッケージ導入には承認が必要）。
5. **session-maybe の子スロットを自前で宣言する方式**（§13.5）: 型上は `SlotMap` への declaration merging が必要（JS 実行時は任意文字列で可）。型なし JS で書くなら問題ない。
6. **`useSessions` で毎レンダー配列走査**（§7.6）: セッション数が多い環境での性能は未計測。気になる場合は session-maybe 子に任せる。
