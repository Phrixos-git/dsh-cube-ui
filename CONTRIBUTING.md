# Contributing

- ソースは `plugin/src/client.template.js`・`plugin/src/styles.css`・`plugin/locale/*.json` です。
  `plugin/client.js` は生成物なので直接編集せず、`cd plugin && node build.mjs` で再生成してコミットしてください。
- 文言を追加・変更したら ja / en / zh の 3 ファイルすべてに同じキーを入れてください。
- 色は `--dsw-*` テーマトークンから導出し、ハードコードしないでください。機能的なメタ情報
  （パス・時刻・件数・ヒント）は `--cube-text-meta` と 12px 以上（`--cube-font-meta`）を使います。
- 3D 変形される `.face` / `.face-inner` / `.face-room` に `box-shadow` / `filter` を付けないでください
  （Firefox で文字が二重描画されます）。
- 送る前に:

  ```sh
  cd plugin
  node build.mjs
  node tools/smoke.mjs
  # 任意: jsdom + React 19 での描画チェック
  npm i --no-save --prefix /tmp/cube-ui-test jsdom react@19 react-dom@19
  CUBE_UI_TEST_MODULES=/tmp/cube-ui-test/node_modules node tools/render-check.cjs
  ```
