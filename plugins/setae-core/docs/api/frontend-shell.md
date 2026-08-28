# 新GUI App Shell運用仕様

## 役割分担

- WordPressプラグイン: REST API、認証Cookie、DB、CPT、公開QR・プロフィール等のPHPページ
- `assets/app/`: ログイン後の操作と、ログイン・登録・公開図鑑・相談を描画する新GUI
- `/`: 新GUIの正式入口。未ログイン時はログイン、ログイン済みならTodayを表示する
- `/app/`: 古いブックマークと外部リンクを保つ互換入口
- `[setae_dashboard]`: App Shellを起動する互換入口
- `Setae_Dashboard`: 障害時に戻せる旧GUI

`/v24b/`のような短縮QR、公開プロフィール、パートナー、共有ケアページはApp Shellへ統合しません。

## 切替

`1.0.207`では新GUIを既定で有効にします。`wp-config.php`でプラグイン読込前に次を定義すると旧GUIへ戻せます。

```php
define('SETAE_USE_NEW_GUI', false);
```

新GUIの`assets/app/app.js`が欠けている場合も旧GUIへ自動的にフォールバックします。旧テンプレートと旧資産は移行安定後まで削除しません。

## 読込範囲

URLとCSSは次のように分離します。

- `/`: `assets/app/`の新GUI CSS・JavaScript
- `/app/`: 互換用App Shellとして同じ新GUI資産
- 短縮QR: `public-foundation.css`と`public-passport.css`
- 公開共有・プロフィール・パートナー: `public-foundation.css`と`public-pages.css`
- `/wp-login.php`: `setae-login.css`のみ

通常の記事ではSETAE資産を読み込みません。旧`setae-global.css`には公開トップのスタイルを置きません。

## JavaScript設定

PHPからは接続情報だけを`window.SETAE_CONFIG`へ渡します。ユーザー情報は埋め込まず、`/app/bootstrap`と`/me`を正本にします。

```js
{
  apiRoot: 'https://setae.net/wp-json/setae/v1',
  followBootstrapApiRoot: true,
  credentials: 'same-origin',
  appUrl: 'https://setae.net/',
  embedded: true,
  enableMock: false,
  serviceWorkerUrl: 'https://setae.net/setae-sw.js'
}
```

ログイン後の`POST /session`が返すnonceはAPIクライアントが保存し、GETを含む以後の全RESTリクエストへ`X-WP-Nonce`として付与します。

## Service Worker更新

- HTML、JavaScript、CSSはNetwork Firstで取得する
- 画像とFontのみStale While Revalidateを使用する
- 新しいWorkerはwaiting状態で保持し、画面の「更新」が押された時だけ`SKIP_WAITING`を送る
- 登録時は`updateViaCache: 'none'`を指定し、Worker本体の更新確認にHTTPキャッシュを使わない
- Public Species以外のREST APIレスポンスはService Workerへ保存しない

## 配布確認

1. ログアウト状態で`/`を開き、新GUIのログイン画面が出る。
2. ログイン後に再読込せずTodayへ切り替わり、URLが`/`のままになる。
3. `/app/`を開いても互換用App Shellが表示される。
4. `/v24b/`等の公開QRが従来どおりPHPだけで表示される。
5. 通常記事に`setae-gui-*`資産が読み込まれない。
6. `SETAE_USE_NEW_GUI=false`で旧画面へ戻る。
