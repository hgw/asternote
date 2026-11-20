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

## 導入する前に

- サイト全体に Basic 認証をかける。pin-notes は、利用者ごとの権限を持たない
- メモのデータは、案件ごとにその案件のサーバーに保存する。このリポジトリには入らない
- 保存先は、ドキュメントルートの外に用意する

## 導入方法1: Astro など Node.js の案件

GitHub から npm で入れる。バージョンはタグで指定する。

```sh
npm i github:hgw/pin-notes#v0.1.0
```

`pin-notes-copy` で、`pin-notes.js` と `api.php` を公開ディレクトリに複製する。
`--config` を付けると、設定ファイルも複製する。
開発サーバーとビルドの前に毎回複製するように、`package.json` に書いておく。

```json
{
  "scripts": {
    "predev": "pin-notes-copy public/pin-notes --config pin-notes.config.php",
    "prebuild": "pin-notes-copy public/pin-notes --config pin-notes.config.php"
  }
}
```

複製したファイルは git に入れない。`.gitignore` に `public/pin-notes/` を足す。
設定ファイルには保存先のパスが入る。案件のリポジトリが公開なら、設定ファイルも git に入れない。

ページに script タグを足す。Astro では、手元の開発サーバーで `data-endpoint` を空にする。

```astro
<script is:inline src="/pin-notes/pin-notes.js"
        data-endpoint={import.meta.env.DEV ? '' : '/pin-notes/api.php'}
        data-project="myproject" defer></script>
```

## 導入方法2: WordPress や静的サイト

`pin-notes.js` は jsDelivr から読み込む。サーバーに置くのは `api.php` と設定ファイルだけ。

1. `api.php` をサーバーの公開ディレクトリに置く。例 `/pin-notes/api.php`
2. `api.php` と同じ場所に `pin-notes.config.php` を置く

   ```php
   <?php return [
       'data_dir' => '/home/xxx/data/example.com/pin-notes',
       'projects' => ['myproject'],
   ];
   ```

3. ページに script タグを足す。WordPress なら、テーマの `footer.php` などに書く

   ```html
   <script src="https://cdn.jsdelivr.net/gh/hgw/pin-notes@v0.1.0/pin-notes.js"
           data-endpoint="/pin-notes/api.php"
           data-project="myproject" defer></script>
   ```

`api.php` は、script タグと同じバージョンのタグからダウンロードする。

## 設定ファイル

`pin-notes.config.php` に書く値は次のとおり。

| キー | 意味 |
|---|---|
| `data_dir` | 必須。メモの保存先。ドキュメントルートの中を指すと、api.php は 500 を返して止まる |
| `projects` | 任意。使える `data-project` の名前の配列。書いておくと、ほかの名前では保存ファイルを作れない |
| `allow_anonymous` | 任意。`true` にすると、Basic 認証の確認を外す |

api.php は、Basic 認証を通っていないリクエストを 403 で断る。かけ忘れたまま動き続けないようにするため。

- 確認には、サーバーが PHP に渡す `REMOTE_USER` などの値を使う
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
| `--pin-notes-primary` | 主なボタンと、選択中のボタンの背景 | `#18181b` |
| `--pin-notes-ring` | フォーカスリング | `#18181b` |
| `--pin-notes-danger` | 削除の色 | `#b91c1c` |
| `--pin-notes-open` | 未対応の色 | `#c2410c` |
| `--pin-notes-decided` | 決定の色 | `#1d4ed8` |
| `--pin-notes-done` | 対応済みの色 | `#52525b` |
| `--pin-notes-star` | 重要度の星の色 | `#b45309` |
| `--pin-notes-radius` | 角丸 | `8px` |

初期値は WCAG 2.2 AA のコントラストを満たす。変えるときも、次の比を保つ。

- 文字と背景は 4.5:1 以上。状態の色の上には白い文字が載る
- 入力欄の枠とフォーカスリングは、背景に対して 3:1 以上

## アクセシビリティ

WCAG 2.2 AA を目指している。

- バー、吹き出し、一覧は、キーボードだけで操作できる
- ピンは Tab で選べる。Enter で吹き出しが開き、Esc で閉じるとピンにフォーカスが戻る
- 状態は、色に加えてアイコンでも示す。決定はチェック1つ、対応済みはチェック2つ
- ピンの読み上げには、番号、状態、種類、範囲かどうか、重要度が入る

次の操作はまだマウスやタッチでしかできない。

- メモを置く操作
- ピンの移動と、範囲の指示。どちらもドラッグを使う

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

- 「＋ メモを追加」を押してから、メモを付けたい場所をクリックすると点、ドラッグすると四角の範囲を指示できる
- 範囲は枠で表示し、左上に番号のピンを出す。範囲の両端を含む一番近い共通の親要素を基準に、相対位置で記録する
- 打ったピンはドラッグで動かせる。範囲のメモでは範囲ごと動く。離した位置で基準を求め直して保存する
- ピンを押すと、本文の確認、状態の変更、編集、削除ができる
- 編集欄では、⌘ / Ctrl + Enter でも保存できる
- 吹き出しの外側を押すと閉じる。書きかけの内容がある編集中の吹き出しは、うっかり消えないように閉じない
- 状態は 未対応 / 決定 / 対応済み の3つ。ピンの色とアイコンが変わる。色の意味は状態だけにしている
- 種類は メモ / アイデア / 修正 / 質問・情報 / いいね の5つ。メモ以外は、ピンの番号の前にアイコンが出る
- 重要度は 0〜3 の星。0 は指定なし。吹き出しと一覧に星が出る。ピンには出さない
- 対応済みのメモは、バーの「対応済みも表示」にチェックを入れたときだけ表示する。チェックの状態はブラウザに保存する
- ピンの番号は、対応済みも含めた作成順で振る。対応済みを隠しても番号はずれない
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

ページ別、状態別の一覧になる。状態は「決定」を先頭に並べる。日付は実行環境の時刻で書く。範囲のメモには「［範囲］」、メモ以外の種類には「［修正］」のような種類名、重要度には星を付ける。

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
