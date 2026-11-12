# dsh-cube-ui

DeepSeek Harness（DSH）0.2.2-rc.1 の Web GUI 向けクライアントプラグイン。
メイン列の会話パネルを立方体ステージに置き換え、ワークスペースを立方体の 6 面に並べて、
選んだセッションの会話をその面の上で開きます。

![空きスロット面を斜め上から見た立方体](docs/oblique-empty-slot.png)

*開発中に視点を大きく傾けて撮影した、空きスロット（ワークスペース未割り当て）の面。実際のブラウズ画面は
もっと正面寄りの軽い傾きで表示されます。背景のクジラは別プラグインのテーマで、cube-ui の既定の背景ではありません。*

## できること

- **1 面 = 1 ワークスペース**。面にパスとセッション一覧（実行中バッジ・更新時刻）を表示。7 個以上はページ切り替え
- **立方体を回して切り替え**: ドラッグ、下部の ‹ ▲ ▼ › ボタン、または立方体にフォーカスして矢印キー
- **面のセッションをクリックすると、その面の上で会話が開く**。本文・ストリーミング・ツールカード・入力欄は DSH 標準のもの。
  会話ヘッダのプルダウンでセッション切り替え・新規作成、`Esc` で立方体に戻る
- 右上の **ひし形ナビ**（新規セッション / プラグイン / 自動化タスク / その他）、左下の **設定・プラグイン ドック**、
  右下の **サイズピル**（60〜160%）
- 既存テーマ（`--dsw-*` トークン）にライト／ダークとも追従。追加の npm 依存なし（3D は CSS transform のみ）
- キーボード・スクリーンリーダー対応（面の切り替えを通知、`prefers-reduced-motion` / `forced-colors` / `prefers-contrast`）

## Quick start

前提: DSH 0.2.2-rc.1 の Web プロファイルが動いていること。

```sh
git clone https://github.com/Phrixos-git/dsh-cube-ui.git
dsh plugin --profile web add "$PWD/dsh-cube-ui/plugin"
```

ブラウザを再読み込みすると、会話パネルが立方体に置き換わります。初回だけ 3 ステップの操作ガイドが出ます。

**元に戻す**: DSH の「設定 → プラグイン」で Cube UI をオフにすると、すぐに標準 UI に戻ります
（アンインストールは `dsh plugin --profile web remove @local/dsh-cube-ui`）。

導入・反映・ロールバックの詳細は [plugin/README.md](plugin/README.md) を参照してください。

## 操作

| 操作 | マウス / タッチ | キーボード |
| --- | --- | --- |
| 隣の面へ | 立方体を横にドラッグ / HUD の ‹ › | 立方体にフォーカスして ← → |
| 上下の面へ | 立方体を縦にドラッグ / HUD の ▲ ▼ | ↑ ↓ |
| 最初の面へ | — | Home |
| ワークスペースに入る | 面のセッションをクリック | Enter（前面のワークスペース） |
| 立方体に戻る | 会話右上の × | Esc |
| 別のワークスペースセット | HUD / 会話ヘッダのページャ | Tab で移動して Enter |

## 既知の制約

- **DSH の内部スロットに依存**します（`main.conversation` の置き換え、`conversation.content` ファクトリ、`--dsw-*` トークン）。
  DSH の更新で壊れる可能性があり、その場合はプラグインをオフにすれば標準 UI に戻ります。
- **dshmarket で ON/OFF する場合の注意**: 一度 OFF にして再起動したあとに dshmarket で ON にすると、dshmarket は
  cube-ui を再起動なしで読み込む方式（ホットマウント）で有効にします。この状態で OFF にすると、成功と表示されても
  ブラウザ側の立方体が残り、ページを再読み込みしても標準 UI に戻りません。サーバーを再起動すると戻ります。
  **回避策**: dshmarket で ON にしたら、一度 DSH を再起動してください（`systemctl --user restart dsh-web.service` など）。
  再起動後は通常の読み込みになり、以後の OFF は再起動なしで反映されます。原因は dshmarket 1.73.14 のホットマウント解除の
  不具合と見ており、cube-ui 側では対処できません。
- 標準の会話ヘッダ（右バー開閉・jobs など）は置き換えのため表示されません。
- **Firefox** のソフトウェア合成では 3D 要素の影が文字を二重描画するため、面に影を使っていません。
- **デスクトップ版（Electron）は未検証**です。設定モーダルを開く操作は合成キーイベントに頼るため、デスクトップ版では
  サイドバーの設定ボタンを使ってください。
- ライトテーマ・640px 以下の狭幅・スクリーンリーダー実機での確認は限定的です。気づいた点は Issue で知らせてください。

## 不具合の報告

右上のひし形 →「その他」→「診断情報」の内容を添えて [Issue](https://github.com/Phrixos-git/dsh-cube-ui/issues) を
作成してください（テンプレートがあります）。会話内容やワークスペース名が写るスクリーンショットは伏せてください。

## リポジトリ構成

| パス | 内容 |
| --- | --- |
| `plugin/` | プラグイン本体（`@local/dsh-cube-ui`。npm には公開していないローカルパッケージ。`private: true`） |
| `plugin/src/` | ビルド前のソース（`client.template.js` と `styles.css`） |
| `plugin/locale/` | UI 文言（ja / en / zh） |
| `plugin/client.js` | ビルド成果物。コミット済みで、インストール時のビルドは不要 |
| `plugin/tools/` | `smoke.mjs`（依存なしの読み込み検査）と `render-check.cjs`（jsdom + React での描画検査） |
| `DESIGN.md` | 設計メモ（決定事項・経緯・UX 改善の記録） |
| `FEASIBILITY.md` | DSH 0.2.2-rc.1 の拡張点の調査結果 |

`mock/` と `shots/`（モックアップと実機スクリーンショット）は会話内容が写るためこのリポジトリには含めていません。

<details>
<summary>調査メモ</summary>

- [plugin/API-NOTES.md](plugin/API-NOTES.md) — クライアントプラグイン API の調査メモ（file:line 付き）
- [plugin/BUNDLE-NOTES.md](plugin/BUNDLE-NOTES.md) — バンドル仕様・反映方法・ロールバック手順

</details>

## ビルドとテスト

`client.js` はコミット済みなので、通常はビルド不要です。ソースを変更したときだけ実行します。

```sh
cd plugin
node build.mjs         # src/ + locale/ を client.js に畳む
node tools/smoke.mjs   # 依存なしの読み込み検査
```

依存パッケージはありません（素の Node.js）。描画検査と貢献の手順は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

[MIT](LICENSE)
