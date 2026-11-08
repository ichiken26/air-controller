# web — エアコン操作 Web アプリ（SvelteKit）

画面仕様は [../DESIGN.md](../DESIGN.md)、赤外線の符号化は [../protocol](../protocol) を参照。

## 構成

```
ブラウザ ──/api/*──▶ SvelteKit サーバー ──POST /text/ir_frames/set──▶ ESP32 (ESPHome) ──IR──▶ エアコン
                     │ protocol の encode() で6バイトのフレームを作る
                     │ data/state.json に「最後に送った設定」とタイマー予約を保存
                     └ タイマーはサーバー内で実行（ブラウザを閉じても動く）
```

- エアコンの状態は読み取れない。画面の設定は「最後に送った設定」。
- ESP32 側は `firmware/aircontroller.yaml` の `ir_frames` テキストエンティティを使う。届いたフレームを、実測タイミング（`MEASURED_RG10J5`）で赤外線に変換して送信する。

## 動かし方

Node.js 22.17 以上が必要（リポジトリ直下の `.nvmrc`）。npm 10.9 は依存関係の解決で落ちるので、npm 11 を使う。

```sh
nvm use
npx npm@11 install      # prepare で svelte-kit sync と panda codegen が走る
npm run dev             # ESPHOME_URL なし = モック送信（何も送らない）
ESPHOME_URL=http://aircontroller.local npm run dev   # 実機に送る
```

| 環境変数 | 既定値 | 内容 |
|---|---|---|
| `ESPHOME_URL` | なし（モック） | ESP32 の URL。例 `http://aircontroller.local` |
| `DATA_DIR` | `data` | `state.json` の保存先 |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | 本番サーバー（adapter-node） |
| `TZ` | OS の設定 | タイマーの時刻はこのタイムゾーンで解釈される。Docker では `Asia/Tokyo` を指定する |

本番:

```sh
npm run build
ESPHOME_URL=http://aircontroller.local node build
```

## API

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/state` | 現在の状態（最後に送った設定・電源・タイマー・ESP32 の接続） |
| POST | `/api/command` | `{action:'run', settings}` / `{action:'off'}` / `{action:'swing'}` / `{action:'direction'}` |
| POST | `/api/timers` | `{kind:'on', time:'HH:MM', settings}` / `{kind:'off', time:'HH:MM'}` |
| DELETE | `/api/timers` | 予約を全件取り消し（とりけし） |
| DELETE | `/api/timers/:id` | 1件取り消し |

POST/DELETE は `content-type: application/json` を付ける。付けないと、SvelteKit の CSRF 対策でフォーム送信と見なされ、403 になる。

## スタイル

Panda CSS（`strictTokens`）。トークンは `panda.config.ts` に定義し、値は DESIGN.md §2 と同じ。トークン以外の値は `'[62px]'` のように明示的にエスケープする。

## テスト

```sh
npm test         # vitest（操作ルール・入力検証・タイマー・送信）
npm run check    # svelte-check（型）
```
