# 東芝エアコン赤外線制御プロジェクト 引き継ぎ資料

## 1. プロジェクトの目的

東芝の家庭用エアコンを、M5Stack ATOM Liteと赤外線ユニットを使用して、自作Webアプリから操作できるようにしたい。

単純にリモコン信号を記録・再生するだけではなく、赤外線通信プロトコルを解析し、温度や運転モードなどの指定に応じて**動的に赤外線信号を生成する方式**を最終目標とする。

**現時点で赤外線の受信は成功しているが、ATOM Liteからの送信でエアコンを動作させることには一度も成功していない。**

### 対象機器

- エアコン本体：東芝 RAS-2214T
- 純正リモコン：RG10J5(B3H)/BGJ
- マイコン：M5Stack ATOM Lite（ESP32、Flash 4MB）
- 赤外線ユニット：M5Stack Unit IR（U002）
- 接続：Groveケーブル、はんだ付けなし
- ファームウェア：ESPHome（ESP-IDF）
- 開発PC：Windows + WSL（Ubuntu利用可能）
- 将来のアプリ実行環境：購入済みミニPCにUbuntuを導入し、Dockerで運用予定

### 最終的に実装したいリモコン機能

- 冷房、除湿、暖房、送風、自動運転
- 停止
- 温度上下（純正リモコンは0.5℃刻み）
- スイング
- 風向変更
- 風量変更
- 入タイマー
- 切タイマー
- タイマー取り消し

Webアプリは小規模で軽量な構成を希望。

SvelteKit、Nuxt、Hono + Astro、FastAPI + htmxを比較済み。SvelteKitが第一候補だが、まだ確定していない。

---

## 2. ハードウェアと配線

確認済みのピン配置：

| 用途 | GPIO |
|---|---|
| Unit IR赤外線受信 | GPIO32 |
| Unit IR赤外線送信 | GPIO26 |
| ATOM Lite内蔵赤外線送信 | GPIO12 |

- Unit IRの赤外線受信には成功している。
- GPIO26で送信LEDが発光することをスマートフォンのカメラで確認済み。
- GPIO12はATOM Lite内蔵LEDの送信テストにも使用した。
- GPIO26とGPIO12を混同しないこと。

### 給電関係

- PCのUSB接続では正常動作。
- PHILIPS DLP7721CモバイルバッテリーのUSB-C → USB-C接続では通信不能になった。
- **USB-A → USB-C接続に変更すると正常に動作した。**
- このため、モバイルバッテリーの問題は回避済み。

### 設置位置についての重要な制約

- 純正リモコンが正常に反応する場所からATOM Liteでも送信テストを行った。
- エアコンとの距離は5m未満。
- Unit IRの送信LEDの向きも調整済み。
- 物理的な都合でエアコンの受光部の10〜30cmまで近づけることはできない。
- 距離や向きを繰り返し変える提案は既に試しているので不要。

---

## 3. 現在のESPHome設定

主要設定は以下。

```yaml
esphome:
  name: aircontroller
  friendly_name: aircontroller

esp32:
  variant: esp32
  flash_size: 4MB
  framework:
    type: esp-idf

logger:

api:
  encryption:
    key: !secret api_encryption_key

ota:
  - platform: esphome

wifi:
  ssid: !secret wifi_ssid
  password: !secret wifi_password

captive_portal:

remote_receiver:
  pin:
    number: GPIO32
    inverted: true
  dump:
    - pronto
    - toshiba_ac

remote_transmitter:
  pin: GPIO26
  carrier_duty_percent: 50%

web_server:
  port: 80
  version: 3

button:
  - platform: template
    name: "冷房Prontoテスト"
    on_press:
      - remote_transmitter.transmit_pronto:
          data: >-
            （取得したProntoデータ）
```

※これは主要設定を再構成したもの。実際のYAMLにはWi-FiのフォールバックAP設定やAPI暗号化キーもある。上記の `!secret api_encryption_key` は説明用に置き換えたもので、そのまま既存環境に適用できるとは限らない。

デバイスのLAN内IPとして `192.168.11.9` を使用していた。ただし現在も同じIPであるかは要確認。

---

## 4. 試したことと結果（時系列）

### ① ESPHomeの導入

- 最初にApollo ESK-1用のESP32-C6テンプレートを誤選択。
- ATOM Liteとは異なるハードウェア設定だった。
- ESPHome側でボード設定に関するエラーが発生。
- M5Stack ATOM Lite専用テンプレートを選び直した。
- `variant: esp32`、Flash 4MB、ESP-IDFに修正。
- **ビルドとファームウェア書き込みに成功。**

現在、この問題は解消済み。

### ② 純正リモコンの赤外線受信

- `remote_receiver` をGPIO32に設定。
- `inverted: true` を指定。
- 当初 `dump: all`、後に `dump: [pronto, toshiba_ac]` に変更。
- 純正リモコンのボタンを押すとESPHomeのログに信号が表示された。
- Toshiba ACプロトコルとしても認識された。

代表的なログ：

```text
Received Toshiba AC:
rc_code_1=0xC23DBF4040BF
rc_code_2=0xD5662000005B
```

**受信自体は成功。**

ただし、これらのコードが表す運転状態や温度のバイト構造は未解析。

また、異なる操作のログで同じToshiba ACコードが出ることがあったため、ESPHomeのデコーダーが全情報を正確に復元できているかは未検証。

### ③ `transmit_toshiba_ac` による送信

以下をテストした。

```yaml
remote_transmitter:
  pin: GPIO26
  carrier_duty_percent: 50%

button:
  - platform: template
    name: "冷房テスト"
    on_press:
      - remote_transmitter.transmit_toshiba_ac:
          rc_code_1: 0xC23DBF4040BF
          rc_code_2: 0xD5662000005B
```

結果：

- ESPHome Web画面からボタンを実行できた。
- ログにToshiba AC信号の受信結果が出た。
- 自身が送信した信号をUnit IRで再受信している可能性が高い。
- **エアコンは無反応だった。**

原因は未確定。

可能性として、ESPHomeのToshiba ACエンコーダーと純正リモコンの通信仕様が一致していないことを疑った。

ただし、信号の不一致を実測で証明できたわけではない。

### ④ ログの追加

送信処理の前後に `logger.log` を追加した。

目的：

- ボタンが押されているか確認する。
- `transmit_toshiba_ac` アクションまで処理が到達しているか確認する。

結果：

- 送信アクション自体は実行されていることを確認。
- しかし、エアコンは反応しなかった。

**アクションが正常実行されたことと、正しい赤外線波形が出力されたことは別。**

### ⑤ GPIO12（ATOM Lite内蔵IR）での送信

- 外付けUnit IRの送信GPIO26から、内蔵IRのGPIO12に変更。
- Pronto信号の再送信もテストした。
- エアコンは反応しなかった。

GPIO12はATOM Lite内蔵IR用なので設定自体は用途に合っているが、これで外付けUnit IRの送信性能を評価することはできない。

### ⑥ Pronto形式での受信

Toshiba ACエンコーダーを使わずに再送信するため、純正リモコンの信号をPronto形式で取得した。

代表的なヘッダー：

```text
0000 006D 0096 0000
```

- 搬送波：約38kHz
- データ：150ペア（ON/OFFタイミング300個）
- Pronto全体：304個の16進数値

受信ログには以下も含まれていた。

```text
Received Toshiba AC:
rc_code_1=0xC23DBF4040BF
rc_code_2=0xD5662000005B
```

取得したProntoデータは、現在ESPHomeの `transmit_pronto` ボタンに設定している。

### ⑦ Pronto形式の直接再送信

```yaml
button:
  - platform: template
    name: "冷房Prontoテスト"
    on_press:
      - remote_transmitter.transmit_pronto:
          data: >-
            0000 006D 0096 0000 ...
```

目的：

- ESPHomeのToshiba ACエンコーダーによる信号再生成を回避する。
- 純正リモコンから受信したタイミングデータを再送信する。

試した構成：

- GPIO12（内蔵IR）
- GPIO26（外付けUnit IR）

GPIO26での送信時、以下のようなログを確認。

```text
Send Pronto: frequency=38kHz
Send Pronto: intros=300, repeats=0
```

結果：

- Pronto送信処理は実行された。
- GPIO26で送信した信号はUnit IR自身で再受信できた。
- ただし、再受信時のProntoタイミング値は純正リモコンの受信値と完全一致しなかった。
- 純正リモコンからの受信ではToshiba ACとして認識したが、ATOMのPronto再送信を再受信したログではToshiba ACとして認識した結果が確認できなかった。
- **エアコンは無反応だった。**

考えられる原因：

- 実際の送信波形のタイミング誤差
- 38kHz搬送波の実際の生成精度
- 赤外線の光量・指向性
- 受信したProntoデータ自体の欠落・変形
- 受信波形をProntoへ変換したことによる差

いずれも未確定。

### ⑧ Prontoデータ数の検証

途中、ChatGPTがデータ数を誤ってカウントし、不足していると説明した。

その後、同じデータを再検証し、期待値304個と実データ304個が一致すると判断した。

**データ数不足が原因とする初期診断は誤りだった。**

Prontoデータの意味的な正しさまで確認できたわけではない。

### ⑨ 送信LEDの発光確認

- スマートフォンのカメラを使ってUnit IRの赤外線送信LEDを確認。
- ボタン操作時に発光することを確認できた。

結論：

- 少なくとも送信LEDは発光している。
- GPIO26からの送信制御が動作していることを裏付ける。
- ただし、発光だけでは搬送波の周波数や光量、データの正しさは保証できない。

### ⑩ 距離・向きの検証

- エアコンから5m未満の位置で試した。
- 純正リモコンでは同じ位置から操作できる。
- Unit IRの発光方向も調整した。
- 何度も試したがエアコンは無反応。

Unit IRの送信性能が不足している可能性は残るが、**距離が原因とは確定していない**。

さらに近づける実験は物理的に困難。

### ⑪ OTA書き込みエラー

ESPHomeのOTA更新で次のエラーが発生したことがある。

```text
Successfully compiled program.
Connecting to 192.168.11.9 port 3232...
failed: timed out
```

- YAMLのコンパイルは成功していた。
- ネットワーク経由のOTA接続でタイムアウト。
- PCへのUSB接続に戻して書き込むことで作業を継続できた。
- モバイルバッテリーのUSB-A → USB-C接続でも給電・通信が可能になった。

根本的なOTAタイムアウト原因は未確定だが、現在の赤外線制御失敗とは別問題。

---

## 5. 現在の到達点

### 確認済み

- ATOM Liteは正常起動する。
- ESPHomeファームウェアを書き込める。
- Wi-Fiに接続できる。
- ESPHome Web画面にアクセスできる。
- 純正リモコンの赤外線信号を受信できる。
- Pronto形式の受信ログを取得できる。
- Toshiba ACデコーダーが反応する。
- Webボタンから送信処理を呼び出せる。
- GPIO26からUnit IRのLEDが発光する。
- ATOMから送信した赤外線をUnit IR自身で再受信できる。

### 未達成・未検証

- エアコン本体を一度も操作できていない。
- ATOMの送信波形と純正リモコンの波形が一致するか不明。
- Toshiba ACデコーダーがこのリモコンの全ビットを正確に解釈できるか不明。
- 温度、運転モード、風量などのビット位置が不明。
- チェックサムやデータ反転規則が未確定。
- 送信光量が十分か不明。
- 実際の搬送波が38kHzになっているか未計測。
- 任意の設定値から赤外線コードを生成する仕組みは未実装。

---

## 6. プロトコル解析について

今まで受信したデータは、基本的にESPHomeのログに出力されているだけであり、ATOM Lite内部に永続保存されているわけではない。

これからは受信ログをPC側に保存して解析したい。

想定ディレクトリ：

```text
air-controller/
├── firmware/
│   └── aircontroller.yaml
├── captures/
│   ├── cool-24_0.log
│   ├── cool-24_5.log
│   ├── cool-25_0.log
│   ├── heat-25_0.log
│   └── off.log
├── scripts/
│   └── analyze_ir.py
└── web/
```

過去にChatGPTからPythonの解析スクリプトを提供されたが、まだ実機ログでの動作検証はできていない。信頼できるものとして扱わず、必要に応じて新規実装・レビューしてほしい。

解析では以下を行いたい。

- Prontoデータのパルス列をビット列へ変換。
- 48ビットフレームの構造を確認。
- 冷房24.0℃、24.5℃、25.0℃などを比較。
- 設定温度の変更に対応するビットを特定。
- 運転モード・風量・風向などを同様に解析。
- チェックサム、反転バイト、固定ヘッダーなどの規則を特定。
- プロトコルをTypeScriptでエンコードできるようにする。

ただし、**プロトコル解析の前後で、現状の送信不良の原因を特定することが最優先**。

---

## 7. Claudeに最優先で依頼したいこと

### P0：エアコンの無反応を解決する

1. 東芝 RAS-2214TおよびリモコンRG10J5(B3H)/BGJの赤外線プロトコルについて、技術資料・既存実装・ESPHomeのソースコードを調査する。
2. ESPHomeの `remote_transmitter.transmit_pronto` と `transmit_toshiba_ac` が、実際にどのような赤外線波形を生成するか確認する。
3. Unit IR U002の送信回路・極性・出力条件とESPHomeの設定が適合しているか検証する。
4. 純正リモコンの受信波形と、ATOMから再送信した波形の差を分析する。
5. 計測機材なしで検証できることと、計測機材が必要なことを明確に分ける。
6. 根拠のある修正案を提示し、変更箇所と期待されるログ・結果を具体的に説明する。

**送信処理の実行やLED発光を、エアコン制御成功と混同しないこと。**

### P1：通信プロトコルの解析

- 取得したProntoデータの解析。
- 各フレームの構造確認。
- 温度・モード・風量・風向の符号化規則を推定し、実測で検証。
- チェックサムの解析。
- 動的な赤外線コード生成機能の実装。

### P2：自作Webアプリ開発

- 軽量なDocker構成。
- SvelteKitを第一候補。
- TypeScript中心で実装。
- Web画面から運転モード・温度・風量・風向・タイマーを制御。
- ESPHomeと通信して赤外線コマンドを実行。
- 原則LAN内で利用。
- 初期段階ではDBなしで構わない。
- 純正リモコンとアプリ操作が混在した場合の状態不整合も考慮する。

### P3：UbuntuミニPCへのデプロイ

- ミニPCは購入済み、まだUbuntu未セットアップ。
- Docker / Docker Composeで常時稼働させたい。
- ミニPCのセットアップは別途行う予定。

---

## 8. Claudeへの対応上の要望

これまでChatGPTとの作業で1時間以上を費やし、原因の特定に至っていない。

特に以下を避けてほしい。

- すでに試したテストを何度も提案すること。
- 距離・向きなど、検証済みの条件を再確認させること。
- 公式仕様の裏付けなくGPIOやプロトコル設定を変更させること。
- 「送信処理が実行された」だけで成功と断定すること。
- 仮説を確定事項として説明すること。
- 実行する理由を説明せず、YAMLの変更だけ指示すること。
- 不要なPowerShell操作を強いること（WSL、Python、TypeScriptなど利用可能）。

**まずこれまでの実測結果から原因を絞り、何を検証するための変更なのか、成功時・失敗時に何が分かるのかを明示してほしい。**

最終的には単なる信号再生ではなく、Webアプリから任意の設定を指定して、実際にエアコンを操作できるシステムを完成させたい。

**まずはP0の送信不良の解決から着手してほしい。**