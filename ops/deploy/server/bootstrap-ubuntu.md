# Ubuntu 24.04 初回セットアップ

`bootstrap_ubuntu.py` は、既存の SETAE 配布ヘルパーを一度だけ root 管理で設置します。
対象は Ubuntu 24.04.4 と既存の WordPress です。**この処理ではプラグインの更新・
再インストール・コードバックアップ・DBエクスポートを実行しません。**

自動更新を許可する場合は `--enable-updates` を明示します。フラグがあっても、
確認が失敗すると有効化しません。実際の更新は、セットアップ後に固定ヘルパーへ
承認済みリリースを送る別の処理です。

## 必要な環境

- Ubuntu の既存管理者による sudo 実行権限。
- /usr/bin/python3 の Python 3.10 以上。Ubuntu 24.04 のシステムPythonを -I 付きで
  使います。pyenv のPythonは使いません。
- root 管理の /usr/bin/php、/usr/local/bin/wp、sudo、visudo、sshd、useradd、
  runuser、/bin/sh。PHP 8.3 であることはpreflightが確認します。
- /var/www/html/setae の単一サイトWordPressと、既に有効な setae-core。
  既存ヘルパーが必要とする書込み権限を www-data が持つ必要があります。
  このスクリプトはWordPressの所有者や権限を変更しません。
- 専用Ed25519公開鍵。秘密鍵はサーバーにも公開リポジトリにも置きません。

PHP-FPMとCLI PHPは別です。この手順はCLIの互換性を確認し、Web PHP設定は変更しません。

## 取得と実行

配布担当が指定した完全なコミットSHAに固定して、bootstrap_ubuntu.py、setae-deploy、
setae_deploy.py の3ファイルを取得します。mainの最新内容を無検証で実行したり、
curlの出力を直接sudoへ渡したりしないでください。

外側の取得手順で3ファイルのSHA256を確認してから、同じディレクトリで実行します。
次は取得・検証済みファイルに対する形式です。公開鍵部分は実際の専用公開鍵に置き換えます。

~~~sh
sudo /usr/bin/python3 -I ./bootstrap_ubuntu.py \
  --source-dir "$PWD" \
  --public-key 'ssh-ed25519 REPLACE_WITH_VERIFIED_PUBLIC_KEY_BASE64' \
  --enable-updates
~~~

公開鍵は引数に渡す1行のOpenSSH形式です。鍵の前にオプションを付けたり、
複数行・秘密鍵・別アルゴリズムを渡したりすると停止します。末尾コメントは保存しません。
個人用の公開鍵やホスト名をスクリプトへ埋め込む必要はありません。

スクリプト内でも次の2ファイルを厳密に照合します。固定対象はLFで、改行変換や
別バージョンを自動許可しません。ハッシュが違う場合は、固定コミットと取得内容を
確認します。スクリプト本体の信頼性は、実行前の外側のSHA256確認で確保します。

| ファイル | 固定SHA256 |
| --- | --- |
| setae-deploy | 1ba2415aae0d121dd37926475a0c012e985de28db3c3f416d6a371fa962077fa |
| setae_deploy.py | c0e4dbef71f7054c907f595533f971dbc0d0e71917f617f509efceedc5969d58 |

## 設置内容

| 対象 | 所有者 | モード |
| --- | --- | --- |
| /usr/local/sbin/setae-deploy | root:root | 0755 |
| /usr/local/lib/setae-deploy/ | root:root | 0755 |
| 同ディレクトリの setae_deploy.py | root:root | 0644 |
| /etc/setae-deploy/ | root:root | 0755 |
| 同ディレクトリの config.json | root:root | 0644 |
| 同ディレクトリの bootstrap.json | root:root | 0600 |
| /var/lib/setae-deploy-ssh/ と .ssh/ | root:root | 0755 |
| 同 .ssh/authorized_keys | root:root | 0644 |
| /etc/sudoers.d/setae-deploy | root:root | 0440 |
| /var/lib/setae-deploy/ | www-data のUID/GID | 0700 |

公開鍵は専用ユーザーから読める必要があります。SSH用homeと .ssh はroot管理の0755、
公開鍵は0644にして、専用ユーザーによる差し替えを防ぎます。将来の受信ZIPや
バックアップを扱う www-data の0700状態ディレクトリとは別です。

作成するアカウントは setae-deploy だけです。既存の管理者アカウントとその公開鍵、一般SSH設定、
WordPressのファイルやDB設定を変更しません。未知の同名アカウントやグループがあれば
停止します。新アカウントの作成には通常のuseraddによるOSアカウント登録を使います。

新アカウントには /bin/sh と、パスワードとして使用できない `*NP*` を設定します。
UbuntuのsshdではLinuxの ! ロックが公開鍵認証も妨げる場合があり、強制コマンドも
ユーザーのシェルを経由します。このためnologinをログインシェルにする構成は使いません。
公開鍵にはrestrictと固定commandを付けます。
[Ubuntu sshd(8)](https://manpages.ubuntu.com/manpages/noble/man8/sshd.8.html)

~~~text
restrict,command="/usr/bin/sudo -n -u www-data -- /usr/local/sbin/setae-deploy" ssh-ed25519 ...
~~~

sudoersの許可は次の1行です。末尾の空文字列は引数なしを表します。NOPASSWDとNOSETENVを
指定し、rootでのヘルパー実行や任意シェルは許可しません。候補と設置後の両方を
visudoで確認します。
[Ubuntu sudoers(5)](https://manpages.ubuntu.com/manpages/noble/man5/sudoers.5.html)

~~~text
setae-deploy ALL=(www-data) NOPASSWD:NOSETENV: /usr/local/sbin/setae-deploy ""
~~~

## 有効化までの順序

1. Ubuntu・固定Python・root実行・既存バイナリと親ディレクトリを確認します。
   現在のsudoersとsshd設定は読み取り検査だけを行います。
2. 既存管理ファイル、アカウント、以前のセットアップ記録を照合します。
   異なる内容や所有者を見つけたら上書き・削除せず停止します。
3. root管理ファイルと専用ユーザーを用意し、更新フラグをfalseに保ちます。
   同じセットアップの再検査時も、確認中は更新フラグをfalseにします。
4. sudoの許可が固定ヘルパー1件だけであることを確認し、引数付き実行、root実行、
   シェル実行の許可がないことを照合します。
5. preflightを実際のwww-dataで実行します。この段階のdeployment_ready:falseは想定どおりです。
   PHP互換性、メンテナンス状態、未解決の復旧マーカーは別々に判定します。
6. www-dataの固定WP-CLI呼出しでget_rest_url()を読みます。既存ヘルパーのHTTPS検査で、
   リダイレクトなしのREST index、HTTP 200、JSON形式、setae/v1 namespaceを確認します。
   URLをCLIから受け取る機能はありません。
7. 実際のsetae-deployから、SSHと同じ/bin/sh -cの固定コマンドを動かします。
   送るのはpreflightの1行だけです。sudo -Eが拒否されることも確認します。
8. 設置済みヘルパー・公開鍵・sudoersを再読込みして照合します。明示フラグがある場合だけ
   enabledとauth_readyをtrueにし、再度preflightを実行します。最終確認が失敗した場合は
   認識済みconfigをfalseへ戻します。無効化も確認できない場合はdisable_failedで停止します。

auth_readyはローカル設定確認の記録で、外部SSH接続を検証したという意味ではありません。
通常のWordPress起動を伴う読み取り確認なので、既存MUプラグイン等の副作用を遮断する
DB隔離機構でもありません。bootstrap自身は更新・DB書込み・バックアップのWP-CLI
コマンドを要求しません。

## JSON結果

成功時は標準出力にJSONを1件返し、終了コードは0です。

- updates_enabled: 今回の明示フラグと確認結果。
- preflight: 現在のプラグイン・WordPress・CLIのバージョンと準備状態。
- deployment_key_fingerprint: 指定した専用公開鍵のSHA256 fingerprint。
- host_public_keys: sshdに設定されたEd25519ホスト公開鍵のfingerprint。
- local_forced_command_verified:true、remote_ssh_authentication_verified:false。
- plugin_update_performed:false、plugin_backup_performed:false、
  database_backup_performed:false、database_write_requested:false。

ホストfingerprintは既に信頼しているknown_hosts等と別経路で照合してください。
秘密ホスト鍵は読み出して返しません。外部からの公開鍵認証、ファイアウォール、
実際の待受ポート、PAMの遠隔ログイン条件は、このローカル実行だけでは証明できません。
後続の配布側から、ホスト鍵を固定した専用ユーザーのpreflight接続を別途確認します。

将来の更新時のOPcache反映、CDNの挙動、復旧の実運用試験を、
このbootstrapの成功として扱わないでください。

## 停止と再実行

エラー時は終了コード1と定型のcode/messageを返します。WP-CLI・sudo・sshd等の
生のstdout/stderr、秘密値、Python tracebackは転送しません。
updates_enabled:nullは現在のフラグを結果だけでは断定しないという意味です。

| 主なcode | 対応 |
| --- | --- |
| python_runtime / ubuntu_version | 固定システムPythonと対象Ubuntuで実行しているか確認する。 |
| source_hash | 固定コミットとSHA256を確認する。無検証の別ファイルで代用しない。 |
| existing_account / existing_file_conflict / existing_receipt | 既存内容を管理者が確認する。自動上書き・自動削除は行わない。 |
| sshd_match / sshd_access_rules / sshd_policy | 既存制限を管理者が確認する。既存ユーザーの許可を削除・緩和して通さない。 |
| sudo_policy | 既存の追加権限やsudo出力形式との差を管理者が確認する。 |
| preflight_failed / php_cli_incompatible / wordpress_not_ready | 元のWordPress状態を確認する。この手順で再インストールしない。 |
| rest_probe_failed / rest_smoke | HTTPS REST indexとnamespaceを確認する。検査を省略しない。 |
| disable_failed | 後続リリースを止め、root管理configの状態を管理者が直接確認する。 |

同じ公開鍵・同じ固定内容・一致するセットアップ記録なら再実行できます。
電源断などでアカウント作成と記録保存の間に停止した場合は、所有を推測せず停止します。
認識済みファイル以外を後片付けとして削除しません。鍵の交換やヘルパー自身の
バージョン変更は、別途レビューする管理作業です。

sshdの再起動、一般設定の追記、既存アカウントの権限変更、
不足パッケージの自動インストールは行いません。www-dataの他のPHPも同じUIDの
状態ディレクトリへアクセスできるため、同じUIDのプロセス間を隔離する仕組みではありません。

## オフライン検証の範囲

純関数はWindowsでもimportできます。試験ではPathsを一時ディレクトリへ、
Hostのコマンド・ユーザー情報・所有者・ロック境界をstubへ置き換えます。
そこでのPASSは、実Ubuntu・実SSH・実sudo・本番WordPressの動作確認ではありません。
本番コマンドは利用者が承認済みの手順を実行した時にだけ動きます。
