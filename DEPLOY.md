# ミニPC（Ubuntu）へのデプロイ
## 1. Docker を入れる（ミニPC）

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

→ 一度ログアウトしてログインし直す。

## 2. GitHub 用の SSH 鍵を作る（ミニPC）

```sh
ssh-keygen -t ed25519 -C "minipc" -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

→ 表示された1行を GitHub の Settings → SSH and GPG keys に登録する。

## 3. リポジトリを取ってくる（ミニPC）

```sh
git clone git@github.com:ichiken26/air-controller.git ~/air-controller
cd ~/air-controller
```

## 4. マイコンに届くか確認（ミニPC）

```sh
curl http://192.168.11.9/text/ir_frames
```

→ IP が違うときだけ:

```sh
echo "ESPHOME_URL=http://<マイコンのIP>" > .env
```

→ 3000 番が他で使われているときだけ:

```sh
echo "AIR_PORT=3001" >> .env
```

## 5. 起動（ミニPC）

```sh
docker compose up -d --build
```

## 6. 動作確認（ミニPC）

```sh
docker compose ps
curl http://localhost:3000/api/state
hostname -I
```

→ スマホで `http://<ミニPCのIP>:3000` を開く。

## 7. Tailscale で外から使う（ミニPC）

```sh
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

→ 表示された URL をブラウザで開いて認証。

```sh
sudo tailscale serve --bg 3000
tailscale serve status
```

→ 表示された `https://<ミニPC名>.<tailnet名>.ts.net` を、Tailscale を ON にしたスマホで開く。
→ HTTPS 証明書のエラーが出たら、Tailscale 管理画面の DNS で MagicDNS と HTTPS Certificates を有効化。

## （任意）Tailscale 経由だけにする（LAN から直接開けなくする）

```sh
echo "AIR_BIND=127.0.0.1" >> .env
docker compose up -d
```

## 更新

```sh
cd ~/air-controller && git pull && docker compose up -d --build
```

## ログ

```sh
docker compose logs -f
```

## 停止

```sh
docker compose down
```

## ルーター

→ マイコンとミニPCの IP を固定（DHCP 予約）。
