# pin-notes

プレビュー画面にピンと範囲でメモを残すツール。
制作中のサイトを関係者と見ながら、気づいたことや決めたことを、画面のその場所に記録する。
依存はなく、JS 1つと PHP 1つで動く。

## ファイル

| ファイル | 役割 |
|---|---|
| `pin-notes.js` | ブラウザ側。ピンの表示と書き込み |
| `api.php` | サーバー側。メモを JSON で保存する。PHP 7.4 以降 |
| `export.mjs` | メモを Markdown に書き出す。Node 18 以降 |
| `copy.mjs` | npm で入れたとき、`pin-notes.js` と `api.php` を公開ディレクトリに複製する |
| `wordpress/pin-notes.php` | WordPress のプラグイン本体。リリースの zip に、`pin-notes.js` と `api.php` と一緒に入る |

## 導入する前に

- サイト全体に Basic 認証をかける。pin-notes は、利用者ごとの権限を持たない
- メモのデータは、案件ごとにその案件のサーバーに保存する。このリポジトリには入らない
- 保存先は、ドキュメントルートの外に用意する

## 導入方法1: Astro など Node.js の案件

GitHub から npm で入れる。バージョンはタグで指定する。

```sh
npm i github:hgw/pin-notes#v0.7.0
```

`pin-notes-copy` で、`pin-notes.js` と `api.php` を公開ディレクトリに複製する。
`--config` を付けると、設定ファイルも複製する。
開発サーバーとビルドの前に毎回複製するように、`package.json` に書いておく。

```json
{
  "scripts": {
    "predev": "pin-notes-copy public/pin-notes",
    "prebuild": "pin-notes-copy public/pin-notes --config pin-notes.config.php"
  }
}
```

`--config` は、本番用のビルドでだけ付ける。開発サーバーは PHP を動かさないので、公開ディレクトリに置いた設定ファイルを文字のまま返してしまう。設定ファイルには、保存先のパスと project 名が入っている。

複製したファイルは git に入れない。`.gitignore` に `public/pin-notes/` を足す。
設定ファイルには保存先のパスが入る。案件のリポジトリが公開なら、設定ファイルも git に入れない。

ページに script タグを足す。Astro では、手元の開発サーバーで `data-endpoint` を空にする。

```astro
<script is:inline src="/pin-notes/pin-notes.js"
        data-endpoint={import.meta.env.DEV ? '' : '/pin-notes/api.php'}
        data-project="myproject" defer></script>
```

## 導入方法2: WordPress

WordPress のプラグインとして入れる。script タグも API も、プラグインが用意する。

1. [リリース](https://github.com/hgw/pin-notes/releases) から `pin-notes-wordpress-<版>.zip` をダウンロードする
2. 管理画面の「プラグイン」→「新規追加」→「プラグインのアップロード」で入れて、有効にする
3. `wp-config.php` に定数を書く

   ```php
   define('PIN_NOTES_DATA_DIR', '/home/xxx/data/example.com/pin-notes');
   define('PIN_NOTES_PROJECT', 'myproject');
   ```

4. サイト全体に Basic 認証をかける

| 定数 | 意味 |
|---|---|
| `PIN_NOTES_DATA_DIR` | 必須。メモの保存先。ドキュメントルートの外にする |
| `PIN_NOTES_PROJECT` | 任意。メモの保存単位。英小文字、数字、`-`、`_`。省くと `site` |
| `PIN_NOTES_ALLOW_ANONYMOUS` | 任意。`true` にすると、Basic 認証の確認を外す |
| `PIN_NOTES_DEFAULT_ON` | 任意。`true` にすると、初めて開いた人にもメモを表示する |

`PIN_NOTES_DATA_DIR` を書いていない環境では、プラグインは何もしない。script タグも API も出さない。テスト環境の `wp-config.php` にだけ定数を書けば、本番にプラグインが入っていても動かない。

API は `wp-admin/admin-ajax.php?action=pin_notes` で受ける。書き出しのときは、この URL を `--endpoint` に渡す。

mu-plugins に置くときは、zip の中の `pin-notes` フォルダを `wp-content/mu-plugins/` に置く。そのうえで、読み込むだけのファイルを `wp-content/mu-plugins/pin-notes-loader.php` として足す。

```php
<?php
require __DIR__ . '/pin-notes/pin-notes.php';
```

## 導入方法3: 静的サイトなど

`pin-notes.js` は jsDelivr から読み込む。サーバーに置くのは `api.php` と設定ファイルだけ。

1. `api.php` をサーバーの公開ディレクトリに置く。例 `/pin-notes/api.php`
2. `api.php` と同じ場所に `pin-notes.config.php` を置く

   ```php
   <?php return [
       'data_dir' => '/home/xxx/data/example.com/pin-notes',
       'projects' => ['myproject'],
   ];
   ```

3. ページに script タグを足す

   ```html
   <script src="https://cdn.jsdelivr.net/gh/hgw/pin-notes@v0.7.0/pin-notes.js"
           data-endpoint="/pin-notes/api.php"
           data-project="myproject" defer></script>
   ```

`api.php` は、script タグと同じバージョンのタグからダウンロードする。

## 設定ファイル

`pin-notes.config.php` に書く値は次のとおり。

| キー | 意味 |
|---|---|
| `data_dir` | 必須。メモの保存先。ドキュメントルートの中を指すと、api.php は 500 を返して止まる |
| `projects` | 必須。使える `data-project` の名前の配列。ほかの名前では保存ファイルを作れない。書かないと、api.php は 500 を返して止まる |
| `allow_anonymous` | 任意。`true` にすると、Basic 認証の確認を外す |

api.php は、Basic 認証を通っていないリクエストを 403 で断る。かけ忘れたまま動き続けないようにするため。

- 確認には、サーバーが ID とパスワードを確かめたあとに PHP に渡す `REMOTE_USER` と `REDIRECT_REMOTE_USER` を使う
- 手元の `php -S` には Basic 認証がない。手元で試すときだけ `allow_anonymous` を `true` にする
- Basic 認証の ID を PHP に渡さないサーバーでも、`allow_anonymous` が必要になる

ほかにも、次の上限がある。

- 1つの project に保存できるメモは 2000 件まで
- 1回の書き込みのリクエストは 64KB まで

## script タグの属性

| 属性 | 意味 |
|---|---|
| `data-endpoint` | api.php の URL。省くとブラウザの localStorage に保存する |
| `data-project` | メモの保存単位。英小文字、数字、`-`、`_` |
| `data-ui="none"` | 左下の「メモ」ボタンを出さない。ほかの UI から API で操作する |
| `data-default="on"` | 初めて開いた人にもメモを表示する。表示・非表示を選んだあとは、その選択を優先する |

ページ側の要素に `data-pin-notes-ignore` を付けると、その中のクリックはメモを置く操作に使われない。設定パネルなど、ツールと一緒に使う UI に付ける。

メモのバーや一覧が出ている間は、`html` に CSS 変数 `--pin-notes-offset` を設定する。値は画面下端からバーや一覧の上端までの高さ。値に余白は含まない。左下に置くほかの部品は、`bottom: max(16px, calc(var(--pin-notes-offset, 0px) + 8px))` のように余白を足して使う。

## 見た目の変更

色と角丸は CSS 変数で変えられる。`html` などに `--pin-notes-*` を書く。

```css
html {
  --pin-notes-primary: #1e3a8a;
  --pin-notes-radius: 4px;
}
```

| 変数 | 意味 | 初期値 |
|---|---|---|
| `--pin-notes-fg` | 文字の色 | `#09090b` |
| `--pin-notes-muted` | 補助の文字の色 | `#52525b` |
| `--pin-notes-bg` | バーや吹き出しの背景 | `#fff` |
| `--pin-notes-subtle` | ボタンの背景 | `#f4f4f5` |
| `--pin-notes-input` | 入力欄の枠 | `#71717a` |
| `--pin-notes-primary` | キーカラー。主なボタンと、選択中のボタンの背景 | `#047857` |
| `--pin-notes-ring` | フォーカスリング | `#047857` |
| `--pin-notes-danger` | 削除の色 | `#b91c1c` |
| `--pin-notes-open` | 未完了のピンの色 | `#c2410c` |
| `--pin-notes-done` | 完了のピンの色 | `#52525b` |
| `--pin-notes-star` | 重要度の星の色 | `#b45309` |
| `--pin-notes-radius` | 角丸 | `8px` |

初期値は WCAG 2.2 AA のコントラストを満たす。変えるときも、次の比を保つ。

- 文字と背景は 4.5:1 以上。状態の色の上には白い文字が載る
- 入力欄の枠とフォーカスリングは、背景に対して 3:1 以上

## アクセシビリティ

WCAG 2.2 AA を目指している。

- バー、吹き出し、一覧は、キーボードだけで操作できる
- メモを置く操作とピンの移動も、キーボードでできる。十字のカーソルを矢印キーで動かし、Enter で決める。Shift と矢印キーで大きく動く
- 範囲の指示とピンの移動は、ドラッグのほかにクリックだけでもできる
- ピンは Tab で選べる。Enter で吹き出しが開き、Esc で閉じるとピンにフォーカスが戻る
- 完了かどうかは、色に加えてアイコンでも示す。完了のピンにはチェックが付く
- ピンの読み上げには、番号、状態、種類、範囲かどうか、重要度が入る

キーボードの十字のカーソルは、画面に見えている範囲の中だけを動く。画面の外に置きたいときは、先にページをスクロールする。

## JavaScript の API

```js
PinNotes.enable();   // メモを表示する
PinNotes.disable();  // メモを隠す
PinNotes.toggle();
PinNotes.isEnabled();
PinNotes.onChange((enabled) => { ... });
```

読み込み完了時に `document` で `pin-notes:ready` イベントが発生する。

## 使い方

- バーの「メモ」を押してから、メモを付けたい場所をクリックすると点、ドラッグすると四角の範囲を指定できる
- 置き方は「点」と「範囲」から選べる。「範囲」では、2つの角を順にクリックして指定できる。ドラッグでも引ける
- キーボードで「メモ」を押すと、十字のカーソルが出る。矢印キーで動かし、Enter で置く
- メモを置く間は、バーに「戻る」、置き方、案内だけを出す。「戻る」か Esc で置くのをやめる
- バーの右の × で、メモの表示を閉じる
- 範囲は枠で表示し、左上に番号のピンを出す。範囲の両端を含む一番近い共通の親要素を基準に、相対位置で記録する
- 打ったピンはドラッグで動かせる。範囲のメモでは範囲ごと動く。離した位置で基準を求め直して保存する
- 吹き出しの「移動」を押してから移動先をクリックしても動かせる。範囲のメモは、大きさを保ったまま左上が押した位置に来る
- ピンを押すと、本文の確認、完了の切り替え、編集ができる。削除は、編集の吹き出しのゴミ箱から行う。1回目で「本当に削除？」と出て、もう一度押すと消える
- 編集欄では、⌘ / Ctrl + Enter でも保存できる
- 吹き出しの外側を押すと閉じる。書きかけの内容がある編集中の吹き出しは、うっかり消えないように閉じない
- メモは未完了か完了のどちらか。新しいメモは未完了で作る。吹き出しの「完了」で完了にし、「未完了に戻す」で戻せる
- 未完了のピンはオレンジ、完了のピンは灰色にチェックが付く
- 種類は メモ / アイデア / 修正 / 質問・情報 / いいね の5つ。メモ以外は、ピンの番号の前にアイコンが出る
- 重要度は 0〜3 の星。0 は指定なし。吹き出しと一覧に星が出る。ピンには出さない
- 完了したメモは、バーの「完了も表示」にチェックを入れたときだけ表示する。チェックの状態はブラウザに保存する
- ピンの番号は、完了も含めた作成順で振る。完了を隠しても番号はずれない
- 名前を書かなかったメモは「ななしさん」と表示する。保存データの名前は空のまま
- 日時は、1週間未満なら「5分前」「17時間前」のように相対で、それより前は日付で表示する。マウスを乗せると、正確な日時が出る
- 「一覧」で、そのページのメモを一覧できる
- ピンは、クリックした要素からの相対位置で記録する。要素が消えた場合は、記録時の座標に点線付きで表示する
- 固定表示の要素やスクロールする枠の中に置いたピンも、スクロールに合わせて位置を計算し直す
- 要素の階層が深くセレクターが長すぎるときは、上限に収まる一番近い親要素を基準にする

## 書き出し

メモを Markdown に書き出す。npm で入れた案件では `npx pin-notes-export` でも動く。
`PIN_NOTES_AUTH` には Basic 認証の ID とパスワードを入れる。シェルの履歴に残さないように、パスワード管理のツールから読み込むとよい。

```sh
PIN_NOTES_AUTH="user:pass" node export.mjs \
  --endpoint https://example.com/pin-notes/api.php \
  --project myproject \
  --out docs/notes.md
```

ページ別の一覧になる。各ページの中は、未完了と完了に分けて並べる。日付は実行環境の時刻で書く。範囲のメモには「［範囲］」、メモ以外の種類には「［修正］」のような種類名、重要度には星を付ける。

## 保存先

保存先は `data-endpoint` の有無だけで決める。

- `data-endpoint` があれば、常に api.php に保存する。403、401、5xx、WAF のエラーページなどはエラーとして表示し、保存先は切り替えない
- `data-endpoint` がなければ、ブラウザの localStorage に保存する
- 応答の形から PHP の有無を推測して切り替える方式は不採用。WAF の画面やログイン画面へのリダイレクトで誤り、メモがサーバーに届かなくなるため
- 手元の開発サーバーでは `data-endpoint` を空にする。Astro なら `import.meta.env.DEV` で分けられる

## 保存の安全策

- 保存データのファイルを読み込めないときは、一時的な I/O エラーとみなして 500 を返す。ファイルには触らない
- 保存データの中身が壊れているときは、上書きしない
  - 読み取りは空の一覧を返し、`X-Pin-Notes-Warning` ヘッダーで知らせる。メモのバーに通知が出る
  - 更新と削除は 409 を返して止める。黙って全件が消えるのを防ぐため
  - 作成のときだけ、`<名前>.json.corrupt-<日時>` に退避して空から続ける。中身は手で戻せる
- 書き込みは一時ファイルに書いてから置き換える。失敗したらエラーを返し、元のファイルは残る
- 読み取りは共有ロック、書き込みは排他ロックを取る

## ライセンス

MIT。詳しくは [LICENSE](LICENSE) を見る。
不具合の報告や Pull Request の扱いは [CONTRIBUTING.md](CONTRIBUTING.md)、脆弱性の報告は [SECURITY.md](SECURITY.md) に書いた。
