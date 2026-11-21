/*!
 * Asternote
 * プレビュー画面にピンを立ててメモを残すツール。依存なし。
 *
 * 使い方:
 *   <script src="/asternote/asternote.js"
 *           data-endpoint="/asternote/api.php"
 *           data-project="myproject" defer></script>
 *
 * data-endpoint を省略すると、ブラウザの localStorage に保存する（手元での確認用）。
 * data-endpoint があれば常に api.php に保存する。失敗してもエラーを出すだけで、保存先は切り替えない。
 * data-ui="none" にすると、起動ボタンを出さない。window.Asternote の API で操作する。
 * data-default="on" にすると、初めて開いた人にもメモを表示する。表示・非表示を選んだあとは、その選択を優先する。
 * メモは、クリックで点、ドラッグで四角の範囲として残せる。打ったピンはドラッグで動かせる。
 * ドラッグを使わずに、2つの角のクリックで範囲を指定したり、吹き出しの「移動」とクリックでピンを動かしたりもできる。
 * キーボードでは、置く位置を十字のカーソルで示す。矢印キーで動かし、Enter で決める。
 * 完了したメモは、設定の「完了したメモも表示」にチェックを入れたときだけ表示する。
 * バーの設定ボタンで、キーボード操作、バーの非表示、バーの位置を選べる。設定は見る人のブラウザに保存する。
 * バーはつまみのドラッグで、画面の辺のどこにでも動かせる。
 * data-asternote-ignore 属性を付けた要素の中では、メモを置くクリックを横取りしない。
 * 表示中は html に --asternote-offset を設定する。値は画面下端からバーや一覧の上端までの高さで、余白は含まない。
 * バーが下の辺にないときは設定しない。
 * 左下に置くほかの部品は、この値に余白を足した分だけ上に逃げれば重ならない。
 * 色と角丸は、html などに CSS 変数 --asternote-primary などを書くと上書きできる。一覧は injectStyle() にある。
 *
 * MIT License. https://github.com/hgw/asternote
 *
 * アイコンは Lucide v1.76.0 の SVG を使っている。https://lucide.dev
 * plus、x、arrow-left、move、trash-2、check、chevron-down、external-link は Feather 由来で MIT License、ほかは ISC License。
 *
 * ISC License
 * Copyright (c) 2026 Lucide Icons and Contributors
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * The MIT License (MIT) (for the icons derived from Feather)
 * Copyright (c) 2013-present Cole Bemis
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function () {
  'use strict';

  // 版の番号。package.json と同じ値にする。scripts/build-wordpress.sh が確かめる
  var VERSION = '0.11.1';

  var script = document.currentScript;
  var config = {
    endpoint: (script && script.dataset.endpoint) || '',
    project: (script && script.dataset.project) || 'default',
    ui: (script && script.dataset.ui) || 'button',
    defaultOn: !!(script && script.dataset.default === 'on'),
  };

  // ---------- 文言 ----------
  // 画面の文言はすべてここに置く。言語を足すときは、ja と同じキーをそろえる
  // {n} などは、t() の2つ目の引数の値で置き換える
  var MESSAGES = {
    ja: {
      'status.open': '未完了', 'status.done': '完了',
      'anonymous': 'ななしさん',
      'kind.memo': 'メモ', 'kind.idea': 'アイデア', 'kind.fix': '修正', 'kind.info': '質問・情報', 'kind.like': 'いいね',
      'importance': '重要度', 'importance.n': '重要度 {n}', 'importance.none': 'なし', 'importance.noneLabel': '重要度の指定なし',
      'sep': '、',
      'bar.region': 'メモ', 'bar.add': 'メモを追加', 'bar.list': '一覧', 'bar.close': 'メモを閉じる',
      'bar.settings': '設定', 'bar.grip': 'ドラッグでバーを動かす', 'bar.back': '戻る', 'bar.backTitle': '戻る（Esc）',
      'bar.area': '範囲で指定', 'bar.areaTitle': '2つの角のクリックで範囲を指定する',
      'launcher': 'メモ',
      'hint.move': '移動先をクリック', 'hint.corner1': '1つ目の角をクリック', 'hint.corner2': '2つ目の角をクリック',
      'hint.point': 'クリックで点、ドラッグで範囲を指定', 'hint.keys': '。矢印キーで動かし、Enter で決定',
      'cursor': 'メモを置く位置。矢印キーで動かし、Enter で決定。Shift と矢印キーで大きく動く',
      'pin.note': 'メモ {n}', 'pin.area': '範囲', 'pin.lost': '（元の要素が見つからない）',
      'close': '閉じる',
      'editor.new': '新しいメモ', 'editor.edit': 'メモを編集',
      'editor.kind': '種類', 'editor.body': '本文', 'editor.bodyPlaceholder': '決まったこと、直したいこと', 'editor.name': '名前',
      'editor.save': '保存', 'editor.saveTitle': '⌘ / Ctrl + Enter でも保存できる', 'editor.cancel': 'キャンセル',
      'editor.empty': '本文を入力してください', 'editor.saving': '保存しています', 'editor.deleting': '削除しています',
      'editor.delete': '削除', 'editor.confirmDelete': '本当に削除？',
      'editor.dirty': '書きかけの内容があります。保存するか、キャンセルしてください',
      'viewer.note': 'メモ {n}', 'viewer.noteNoNum': 'メモ', 'viewer.done': '完了', 'viewer.reopen': '未完了に戻す',
      'viewer.edit': '編集', 'viewer.move': '移動',
      'list.region': 'メモの一覧', 'list.empty': 'このページのメモはまだありません。',
      'list.doneHidden': '完了したメモが {n} 件あります。設定の「完了したメモも表示」で見られます。',
      'list.doneHidden1': '完了したメモが 1 件あります。設定の「完了したメモも表示」で見られます。',
      'settings.title': '設定', 'settings.close': '設定を閉じる', 'settings.showDone': '完了したメモも表示',
      'settings.keyboard': 'キーボード操作', 'settings.key': 'メモを追加するキー',
      'settings.keyInvalid': '英字か数字の1文字にしてください', 'settings.keyEmpty': 'キーを1文字入れてください',
      'settings.hideBar': 'バーを非表示', 'settings.hideBarNote': 'キーを押すと、バーが出ます',
      'settings.pos': 'バーの位置', 'settings.reset': '最初の位置に戻す', 'newTab': '（新しいタブで開く）',
      'pos.tl': '左上', 'pos.t': '上', 'pos.tr': '右上', 'pos.l': '左', 'pos.r': '右', 'pos.bl': '左下', 'pos.b': '下', 'pos.br': '右下',
      'time.now': 'たった今', 'time.min': '{n}分前', 'time.hour': '{n}時間前', 'time.day': '{n}日前', 'time.day1': '{n}日前',
      'notice.corrupt': '保存データが壊れているため、空として表示しています。管理者に連絡してください',
      'notice.recovered': '壊れた保存データを退避して、新しく保存しました。管理者に連絡してください',
      'error.saveFailed': '保存できませんでした', 'error.deleteFailed': '削除できませんでした', 'error.loadFailed': '読み込めませんでした',
      'error.colon': ': ',
      'error.response': 'サーバーの応答が不正です（{n}）', 'error.localSave': 'ブラウザに保存できませんでした',
      // api.php の code に対応する文言。知らない code は、api.php の error の文をそのまま出す
      'api.not_found': 'メモが見つかりません', 'api.too_many_notes': 'メモの数が上限の {limit} 件に達しています',
      'api.empty_body': '本文が空です', 'api.too_large': 'リクエストが大きすぎます', 'api.bad_json': 'JSON が不正です',
      'api.bad_action': 'action が不正です', 'api.bad_project': 'project が不正です', 'api.unknown_project': 'project が見つかりません',
      'api.missing_header': 'ヘッダーがありません', 'api.method_not_allowed': 'GET か POST だけを受け付けます',
      'api.auth_required': 'Basic 認証の情報が届いていません。サイトに Basic 認証をかけてください。認証なしで使う場合は、設定に allow_anonymous を書いてください',
      'api.corrupt_data': '保存データが壊れています。管理者に連絡してください',
      'api.save_failed': '保存できませんでした', 'api.read_failed': '保存データを読み込めませんでした',
      'api.backup_failed': '保存データを退避できませんでした', 'api.lock_failed': 'ロックを取れません',
      'api.config': 'サーバーの設定に問題があります。管理者に連絡してください',
    },
    en: {
      'status.open': 'Open', 'status.done': 'Done',
      'anonymous': 'Anonymous',
      'kind.memo': 'Note', 'kind.idea': 'Idea', 'kind.fix': 'Fix', 'kind.info': 'Question', 'kind.like': 'Like',
      'importance': 'Importance', 'importance.n': 'Importance {n}', 'importance.none': 'None', 'importance.noneLabel': 'No importance',
      'sep': ', ',
      'bar.region': 'Notes', 'bar.add': 'Add note', 'bar.list': 'List', 'bar.close': 'Close notes',
      'bar.settings': 'Settings', 'bar.grip': 'Drag to move the bar', 'bar.back': 'Back', 'bar.backTitle': 'Back (Esc)',
      'bar.area': 'Select area', 'bar.areaTitle': 'Click two corners to select an area',
      'launcher': 'Notes',
      'hint.move': 'Click where to move', 'hint.corner1': 'Click the first corner', 'hint.corner2': 'Click the second corner',
      'hint.point': 'Click for a point, drag for an area', 'hint.keys': '. Move with the arrow keys and press Enter',
      'cursor': 'Where to place the note. Move with the arrow keys and press Enter. Hold Shift to move faster',
      'pin.note': 'Note {n}', 'pin.area': 'area', 'pin.lost': '(original element not found) ',
      'close': 'Close',
      'editor.new': 'New note', 'editor.edit': 'Edit note',
      'editor.kind': 'Type', 'editor.body': 'Text', 'editor.bodyPlaceholder': 'Decisions, things to fix', 'editor.name': 'Name',
      'editor.save': 'Save', 'editor.saveTitle': 'You can also save with ⌘ / Ctrl + Enter', 'editor.cancel': 'Cancel',
      'editor.empty': 'Enter some text', 'editor.saving': 'Saving', 'editor.deleting': 'Deleting',
      'editor.delete': 'Delete', 'editor.confirmDelete': 'Really delete?',
      'editor.dirty': 'You have unsaved text. Save or cancel it',
      'viewer.note': 'Note {n}', 'viewer.noteNoNum': 'Note', 'viewer.done': 'Done', 'viewer.reopen': 'Mark as open',
      'viewer.edit': 'Edit', 'viewer.move': 'Move',
      'list.region': 'Note list', 'list.empty': 'No notes on this page yet.',
      'list.doneHidden': '{n} done notes are hidden. Turn on "Show done notes" in Settings to see them.',
      'list.doneHidden1': '1 done note is hidden. Turn on "Show done notes" in Settings to see it.',
      'settings.title': 'Settings', 'settings.close': 'Close settings', 'settings.showDone': 'Show done notes',
      'settings.keyboard': 'Keyboard shortcut', 'settings.key': 'Key to add a note',
      'settings.keyInvalid': 'Use one letter or digit', 'settings.keyEmpty': 'Enter one key',
      'settings.hideBar': 'Hide the bar', 'settings.hideBarNote': 'Press the key to show the bar',
      'settings.pos': 'Bar position', 'settings.reset': 'Reset position', 'newTab': '(opens in a new tab)',
      'pos.tl': 'Top left', 'pos.t': 'Top', 'pos.tr': 'Top right', 'pos.l': 'Left', 'pos.r': 'Right', 'pos.bl': 'Bottom left', 'pos.b': 'Bottom', 'pos.br': 'Bottom right',
      'time.now': 'just now', 'time.min': '{n} min ago', 'time.hour': '{n} hr ago', 'time.day': '{n} days ago', 'time.day1': '1 day ago',
      'notice.corrupt': 'The saved data is corrupted, so nothing is shown. Contact the administrator',
      'notice.recovered': 'The corrupted data was backed up and saved again. Contact the administrator',
      'error.saveFailed': 'Could not save', 'error.deleteFailed': 'Could not delete', 'error.loadFailed': 'Could not load',
      'error.colon': ': ',
      'error.response': 'Unexpected server response ({n})', 'error.localSave': 'Could not save in the browser',
      'api.not_found': 'Note not found', 'api.too_many_notes': 'The number of notes has reached the limit of {limit}',
      'api.empty_body': 'The text is empty', 'api.too_large': 'The request is too large', 'api.bad_json': 'Invalid JSON',
      'api.bad_action': 'Invalid action', 'api.bad_project': 'Invalid project', 'api.unknown_project': 'Project not found',
      'api.missing_header': 'A required header is missing', 'api.method_not_allowed': 'Only GET and POST are allowed',
      'api.auth_required': 'Basic authentication is not configured. Protect the site with Basic authentication, or set allow_anonymous in the config to use it without authentication',
      'api.corrupt_data': 'The saved data is corrupted. Contact the administrator',
      'api.save_failed': 'Could not save', 'api.read_failed': 'Could not read the saved data',
      'api.backup_failed': 'Could not back up the saved data', 'api.lock_failed': 'Could not lock the saved data',
      'api.config': 'The server is misconfigured. Contact the administrator',
    },
  };
  // 言語は data-lang を優先し、なければブラウザの言語で決める。日本語でなければ英語にする
  var LANG = (function () {
    // ja-JP のような地域付きの書き方も受け付ける。組み込みの名前を言語と取り違えないよう、自分のキーだけを見る
    var fixed = ((script && script.dataset.lang) || '').toLowerCase().split('-')[0];
    if (Object.prototype.hasOwnProperty.call(MESSAGES, fixed)) return fixed;
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    return /^ja\b/i.test(nav) ? 'ja' : 'en';
  })();
  config.lang = LANG;
  function t(key, vars) {
    var text = MESSAGES[LANG][key];
    if (text == null) text = MESSAGES.ja[key];
    if (text == null) return key;
    return vars ? text.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? String(vars[k]) : m; }) : text;
  }

  // メモは未完了か完了のどちらか。保存データの status が done なら完了、それ以外は未完了として扱う
  // v0.3.0 までの decided（確認待ち）も、ここで未完了になる
  // 色は CSS の [data-status] で付ける。色だけに頼らないよう、完了のピンにはアイコンも出す
  var STATUS = [
    { key: 'open', label: t('status.open'), icon: null },
    { key: 'done', label: t('status.done'), icon: 'check' },
  ];
  // 名前を書かなかったメモの表示名。保存データには空のまま残す
  var ANONYMOUS = t('anonymous');
  // key で探し、見つからなければ最初の要素を返す。状態と種類で共通に使う
  var byKey = function (list, key) {
    return list.filter(function (x) { return x.key === key; })[0] || list[0];
  };
  var statusOf = function (key) { return byKey(STATUS, key); };

  // メモの種類。ピンにアイコンで出す。「メモ」はふつうのメモで、アイコンは出さない
  // 種類のキーと重要度の上限は api.php と export.mjs にも同じ値がある。変えるときは3か所をそろえる
  // アイコンは Lucide の SVG を、使う分だけ埋め込む。外部の素材を読み込まず、このファイルだけで配れるようにする
  // 大きさは CSS で決める
  var ICONS = {
    'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
    'x': '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    'move': '<path d="M12 2v20"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/>',
    'list': '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>',
    'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    'trash-2': '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'sticky-note': '<path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/><path d="M15 3v5a1 1 0 0 0 1 1h5"/>',
    'lightbulb': '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
    'circle-help': '<circle cx="12" cy="12" r="10"/><path d="M9 9.5a3 2.5 0 016 0c0 2-2 2-3 3.5"/><path d="M12 17h.01"/>',
    'settings': '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>',
    'grip-vertical': '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    'heart': '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
  };
  // Asternote のロゴ。星と3本の線。塗りの図形で、Lucide とは描き方が違うので、svg ごと持つ
  // 元の図は 43×43。上下の余白を詰め、ほかのアイコンと見た目の大きさをそろえる
  var LOGO = '<svg viewBox="3 2 39 39" fill="currentColor" aria-hidden="true" focusable="false"><path d="M16.2138 13.0366C16.4242 13.0661 16.6267 13.1396 16.8085 13.2524C16.9904 13.3653 17.1459 13.5144 17.2656 13.6899L17.373 13.8735V13.8745L19.6835 18.5532C19.764 18.7159 19.8825 18.8566 20.0292 18.9634C20.1762 19.0703 20.3475 19.1401 20.5273 19.1665H20.5263L25.6923 19.9224H25.6914C25.9032 19.9531 26.1051 20.0281 26.2851 20.1411L26.458 20.2661L26.6103 20.4146C26.7051 20.5202 26.7844 20.6386 26.8466 20.7661L26.9267 20.9634L26.9785 21.1704C27.0154 21.3796 27.0082 21.5955 26.957 21.8032C26.8886 22.0802 26.7442 22.3326 26.54 22.5317L26.539 22.5327L22.8037 26.1704C22.6735 26.2973 22.5758 26.4536 22.5195 26.6265C22.4633 26.7992 22.45 26.9835 22.4804 27.1626L23.3613 32.2983L23.3837 32.5112C23.3911 32.7245 23.3539 32.9379 23.2734 33.1372C23.166 33.4031 22.9859 33.6337 22.7539 33.8022C22.5218 33.9707 22.2469 34.0704 21.9609 34.0903C21.6748 34.1102 21.3888 34.0493 21.1357 33.9146V33.9136L16.5224 31.4888C16.3617 31.4045 16.1824 31.3608 16.0009 31.3608C15.8196 31.3609 15.641 31.4046 15.4804 31.4888L10.8642 33.9146L10.8652 33.9155C10.6122 34.0494 10.3265 34.1096 10.041 34.0894C9.75556 34.069 9.48138 33.9695 9.24995 33.8013C9.01846 33.6329 8.83873 33.4026 8.73139 33.1372C8.65085 32.938 8.61376 32.7244 8.62104 32.5112L8.64253 32.2993L9.52339 27.1636C9.55408 26.9844 9.5405 26.8004 9.48432 26.6274C9.44214 26.4977 9.37693 26.3767 9.29194 26.271L9.20014 26.1704L5.46382 22.5337L5.46479 22.5327C5.26023 22.3341 5.11492 22.0828 5.04585 21.8062C4.97649 21.5281 4.98575 21.2359 5.07417 20.9634L5.15425 20.7651C5.24777 20.5733 5.38121 20.4025 5.54585 20.2642C5.76518 20.0799 6.03176 19.9606 6.31538 19.9204L11.4765 19.1665L11.6093 19.1382C11.7403 19.1026 11.8641 19.0436 11.9746 18.9634C12.1215 18.8566 12.2407 18.7161 12.3212 18.5532L14.6298 13.8745L14.6308 13.8735C14.7572 13.6181 14.9522 13.4028 15.1943 13.2524C15.4366 13.102 15.7167 13.022 16.0019 13.022L16.2138 13.0366ZM21.3916 32.646V32.6411L21.3896 32.6333L21.3916 32.646ZM22.0712 32.147L22.0761 32.1489C22.0739 32.1477 22.0715 32.1462 22.0693 32.145L22.0712 32.147ZM9.92964 32.1479L9.93257 32.147L9.9355 32.145C9.9336 32.146 9.93152 32.147 9.92964 32.1479ZM14.1142 19.438V19.439C13.8902 19.8923 13.5594 20.2843 13.1503 20.5815C12.7413 20.8787 12.2658 21.0721 11.7656 21.145L7.53901 21.7622L10.5957 24.7378C10.9583 25.091 11.2301 25.5269 11.3867 26.0083C11.5432 26.4898 11.5796 27.0024 11.4941 27.5015L10.7734 31.7046L14.5498 29.7192V29.7183C14.9973 29.4832 15.4954 29.3609 16.0009 29.3608C16.5066 29.3608 17.0054 29.4832 17.4531 29.7183L21.2304 31.7046L20.5087 27.5015V27.5005C20.4235 27.0017 20.4616 26.4895 20.6181 26.0083C20.7747 25.5271 21.0457 25.091 21.4082 24.7378L24.4619 21.7632L20.2373 21.145H20.2363C19.7366 21.0716 19.262 20.8785 18.8535 20.5815C18.4449 20.2844 18.1144 19.8919 17.8906 19.439H17.8896L16.0009 15.6138L14.1142 19.438Z"/><path d="M28.1668 8.00214L28.6355 8.01289L28.6775 8.01582C29.4307 8.07255 30.3452 8.19925 31.2605 8.32636C31.8073 8.40254 32.189 8.9074 32.113 9.45429C32.0371 10.0013 31.5321 10.3827 30.9851 10.3068C30.0567 10.1779 29.2167 10.0625 28.5418 10.0109C27.3979 9.97524 26.6282 10.0295 26.0857 10.1203C24.9659 10.4895 24.4021 10.8 24.0828 11.4016C23.3043 12.8687 23.2498 13.3565 23.2488 13.3654C23.1835 13.9138 22.6858 14.3057 22.1375 14.2404C21.5891 14.1751 21.1972 13.6774 21.2625 13.1291C21.3041 12.7799 21.4771 12.0464 22.3162 10.465C23.0488 9.08434 24.3606 8.57807 25.533 8.19648L25.6668 8.16328C26.3078 8.04846 27.1101 7.98751 28.1668 8.00214Z"/><path d="M35.4967 16.187C35.8074 16.2086 36.03 16.2603 36.3277 16.3853C36.5681 16.4861 36.8736 16.6409 37.1715 16.8003C37.6582 17.0609 37.8412 17.6669 37.5807 18.1538C37.3201 18.6407 36.7141 18.8245 36.2271 18.564C35.9374 18.4089 35.7026 18.2913 35.5543 18.229C35.4874 18.2009 35.4651 18.1954 35.4586 18.1938C35.4527 18.1925 35.4352 18.1894 35.3814 18.1851C34.3935 18.1898 32.8455 18.2356 31.8502 19.1997C30.0866 20.9081 30.0035 21.3267 29.9889 21.3872C29.8587 21.9237 29.3184 22.2534 28.7818 22.1235C28.2451 21.9933 27.9153 21.4522 28.0455 20.9155C28.2113 20.2325 28.7105 19.4565 30.4586 17.7632C32.1336 16.1406 34.5698 16.1882 35.4234 16.1851L35.4967 16.187Z"/><path d="M34.6858 25.1829C36.64 25.0937 37.7079 25.2142 38.3567 25.4387L38.6106 25.5413L38.6556 25.5637C38.9126 25.7004 39.1608 25.8701 39.4124 26.138C39.7904 26.5404 39.7707 27.1729 39.3685 27.551C38.9659 27.9292 38.3326 27.9096 37.9544 27.5071C37.8854 27.4337 37.8273 27.3914 37.7396 27.343C37.5627 27.2704 36.89 27.0876 34.8216 27.179C34.0381 27.2977 33.5386 27.3764 33.0628 27.6555C32.4043 28.0419 31.8534 28.4472 31.4573 28.7717C31.2594 28.9339 31.1038 29.0726 30.9964 29.1751C30.8613 29.3039 30.8552 29.3239 30.8948 29.2659C30.5832 29.7219 29.9612 29.8392 29.5052 29.5276C29.0494 29.216 28.9329 28.5939 29.2444 28.138C29.3403 27.9978 29.4956 27.8422 29.6155 27.7278C29.7631 27.5871 29.9566 27.4151 30.1888 27.2249C30.6531 26.8443 31.2893 26.3763 32.0501 25.9299C32.9324 25.4123 33.8585 25.3032 34.5813 25.1936C34.6159 25.1884 34.6509 25.1845 34.6858 25.1829Z"/></svg>';
  var KINDS = [
    { key: 'memo', label: t('kind.memo'), icon: 'sticky-note' },
    { key: 'idea', label: t('kind.idea'), icon: 'lightbulb' },
    { key: 'fix', label: t('kind.fix'), icon: 'wrench' },
    { key: 'info', label: t('kind.info'), icon: 'circle-help' },
    { key: 'like', label: t('kind.like'), icon: 'heart' },
  ];
  var kindOf = function (key) { return byKey(KINDS, key); };
  var isMemo = function (kind) { return kind.key === 'memo'; };
  // 重要度。0 は指定なし、1〜3 は星の数
  var MAX_IMPORTANCE = 3;
  // 丸め方は api.php と export.mjs と同じにする。数として読めない値は 0、小数は切り捨て、範囲外は端に寄せる
  var importanceOf = function (note) {
    var v = note && note.importance;
    if (typeof v !== 'number' && typeof v !== 'string') return 0;
    var n = Number(v);
    if (v === '' || !isFinite(n)) return 0;
    return Math.min(MAX_IMPORTANCE, Math.max(0, Math.trunc(n)));
  };
  var stars = function (n) { return n > 0 ? '★'.repeat(n) : ''; };
  // 星は記号なので、読み上げでは「重要度 2」のように読ませる
  var starsEl = function (n) {
    return h('span', { class: 'pn-stars', role: 'img', 'aria-label': t('importance.n', { n: n }), text: stars(n) });
  };
  // 固定の SVG 文字列からアイコン要素を作る。利用者の入力は入らない
  // 解釈はアイコンごとに1回だけにし、あとは複製して使う。読み上げでは無視させる
  var iconCache = {};
  var iconEl = function (name) {
    if (!iconCache[name]) {
      var span = document.createElement('span');
      span.className = 'pn-icon';
      span.innerHTML = name === 'logo' ? LOGO : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
      iconCache[name] = span;
    }
    return iconCache[name].cloneNode(true);
  };
  // アイコンと文字を並べたボタンの中身
  var label = function (icon, text) {
    return [iconEl(icon), h('span', { text: text })];
  };

  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても続ける */ } },
  };
  var KEY = 'asternote:' + config.project + ':';

  // ---------- 見る人ごとの設定 ----------
  // ブラウザに保存する。サイトごとに別の設定になる。壊れた値や知らない値は、初期値に戻す
  // バーの位置は、辺と、辺に沿った割合 t で持つ。t は 0 が左端か上端、1 が右端か下端
  // 四隅は上か下の辺として持つ。左右の辺の t は 0 と 1 にならない
  var EDGES = ['top', 'right', 'bottom', 'left'];
  var KEY_CHAR = /^[a-z0-9]$/;
  var DEFAULT_PREFS = { key: true, keyChar: 'c', hideBar: false, edge: 'bottom', t: 0 };
  var prefs = loadPrefs();
  function loadPrefs() {
    var saved = {};
    try { saved = JSON.parse(ls.get(KEY + 'prefs') || '{}') || {}; } catch (e) { saved = {}; }
    var p = Object.assign({}, DEFAULT_PREFS);
    if (typeof saved.key === 'boolean') p.key = saved.key;
    if (typeof saved.keyChar === 'string' && KEY_CHAR.test(saved.keyChar)) p.keyChar = saved.keyChar;
    // キーがオフのままバーを隠すと、戻す手段がなくなる。保存した値が食い違っていても、隠さない
    if (saved.hideBar === true && p.key) p.hideBar = true;
    if (EDGES.indexOf(saved.edge) >= 0 && typeof saved.t === 'number' && isFinite(saved.t)) {
      p.edge = saved.edge;
      p.t = Math.min(1, Math.max(0, saved.t));
    }
    return p;
  }
  function savePrefs() { ls.set(KEY + 'prefs', JSON.stringify(prefs)); }

  var pagePath = function () {
    var p = location.pathname.replace(/index\.html$/, '');
    return p.endsWith('/') ? p : p + '/';
  };

  // ---------- 保存先 ----------
  // 保存先は data-endpoint の有無だけで決める。応答の形から推測して切り替えると、WAF やログイン画面で誤るため
  var store = config.endpoint ? remoteStore() : localStore();

  function remoteStore() {
    var call = function (payload) {
      return fetch(config.endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Asternote': '1' },
        body: JSON.stringify(Object.assign({ project: config.project }, payload)),
      }).then(parse);
    };
    // api.php の code があれば、画面の言語の文言にする。知らない code なら、api.php の文をそのまま出す
    var fail = function (res, data) {
      var known = data && data.code && MESSAGES.ja['api.' + data.code] != null ? t('api.' + data.code, data) : null;
      // 設定の不備は原因が多いので、管理者のために api.php の文も添える
      if (known && data.code === 'config' && data.error) known += t('error.colon') + data.error;
      var err = new Error(known || (data && data.error) || t('error.response', { n: res.status }));
      err.status = res.status;
      return err;
    };
    // WAF のエラーページや認証切れなど、JSON として読めない応答はステータス付きのエラーにする
    function parse(res) {
      if ((res.headers.get('Content-Type') || '').indexOf('application/json') === -1) return Promise.reject(fail(res));
      return res.json().catch(function () { throw fail(res); }).then(function (data) {
        if (!res.ok) throw fail(res, data);
        var warning = res.headers.get('X-Asternote-Warning');
        if (warning === 'corrupt-data') {
          setNotice(t('notice.corrupt'), 'corrupt');
        } else if (warning === 'recovered-from-corrupt-data') {
          setNotice(t('notice.recovered'), 'recovered');
        }
        return { data: data, warning: warning };
      });
    }
    return {
      list: function (page) {
        // WordPress の admin-ajax.php?action=asternote のように、URL にすでに ? があれば & でつなぐ
        var q = (config.endpoint.indexOf('?') === -1 ? '?' : '&') + 'project=' + encodeURIComponent(config.project) + '&page=' + encodeURIComponent(page);
        return fetch(config.endpoint + q, { credentials: 'same-origin', cache: 'no-store' })
          .then(parse)
          .then(function (r) {
            // 警告のない一覧が返ったら、データは直っている。前の通知を消す
            if (!r.warning && noticeKind === 'corrupt') setNotice('');
            return r.data.notes;
          });
      },
      create: function (note) { return call({ action: 'create', note: note }).then(function (r) { return r.data.note; }); },
      update: function (id, fields) { return call({ action: 'update', id: id, fields: fields }).then(function (r) { return r.data.note; }); },
      remove: function (id) { return call({ action: 'delete', id: id }).then(function (r) { return r.data; }); },
    };
  }

  function localStore() {
    var read = function () { try { return JSON.parse(ls.get(KEY + 'notes') || '[]'); } catch (e) { return []; } };
    // 書けなかったら例外にする。保存できたように見せて、メモが黙って消えないようにする
    var write = function (notes) {
      try { localStorage.setItem(KEY + 'notes', JSON.stringify(notes)); } catch (e) { throw new Error(t('error.localSave')); }
    };
    var now = function () { return new Date().toISOString(); };
    return {
      list: function (page) {
        return Promise.resolve(read().filter(function (n) { return n.page === page; }));
      },
      // 中で投げた例外は、Promise の失敗として呼び出し側に届く
      create: function (note) {
        return new Promise(function (resolve) {
          var n = Object.assign({}, note, { id: Math.random().toString(16).slice(2, 14), createdAt: now(), updatedAt: now() });
          var all = read(); all.push(n); write(all);
          resolve(n);
        });
      },
      update: function (id, fields) {
        return new Promise(function (resolve) {
          var all = read(); var found = null;
          all.forEach(function (n) { if (n.id === id) { Object.assign(n, fields, { updatedAt: now() }); found = n; } });
          if (!found) throw new Error(t('api.not_found'));
          write(all);
          resolve(found);
        });
      },
      remove: function (id) {
        return new Promise(function (resolve) {
          var all = read();
          var rest = all.filter(function (n) { return n.id !== id; });
          if (rest.length === all.length) throw new Error(t('api.not_found'));
          write(rest);
          resolve({ ok: true });
        });
      },
    };
  }

  // ---------- 位置の記録と復元 ----------
  var isOwn = function (el) { return el && el.closest && el.closest('[data-asternote], [data-asternote-ignore]'); };

  // api.php の上限と同じ値にする。セレクターは ASCII だけなので文字数の数え方は一致する
  var MAX_SELECTOR = 500;

  function selectorFor(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) {
        parts.unshift('#' + el.id);
        return parts.join(' > ');
      }
      var tag = el.tagName.toLowerCase();
      var index = 1;
      var sib = el;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === el.tagName) index++;
      parts.unshift(tag + ':nth-of-type(' + index + ')');
      el = el.parentElement;
    }
    parts.unshift('body');
    return parts.join(' > ');
  }

  // 画面上の点にあるページの要素を返す。ツール自身の UI と、data-asternote-ignore の中は飛ばす
  // 画面の外の点では要素を探せないので、探すときだけ点を画面内に寄せる。位置の比率は元の点で計算する
  function hitElement(cx, cy) {
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    cx = Math.min(Math.max(cx, 0), vw - 1);
    cy = Math.min(Math.max(cy, 0), vh - 1);
    var els = document.elementsFromPoint ? document.elementsFromPoint(cx, cy) : [document.elementFromPoint(cx, cy)];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el || isOwn(el)) continue;
      return el === document.documentElement ? document.body : el;
    }
    return document.body;
  }

  // 基準にする要素とセレクター。長すぎるセレクターはサーバーで捨てられるので、上限に収まる一番近い親要素にする
  function anchorFor(el) {
    var target = el;
    var selector = selectorFor(target);
    while (selector.length > MAX_SELECTOR && target.parentElement) {
      target = target.parentElement;
      selector = selectorFor(target);
    }
    return { el: target, selector: selector };
  }

  var ratio = function (v, start, size) { return size ? (v - start) / size : 0; };

  // 点のメモの位置。target を渡さないときは、その点にある要素を探す
  function pointAnchor(cx, cy, target) {
    var a = anchorFor(target || hitElement(cx, cy));
    var r = a.el.getBoundingClientRect();
    return {
      selector: a.selector,
      rx: ratio(cx, r.left, r.width),
      ry: ratio(cy, r.top, r.height),
      px: (cx + window.scrollX) / document.documentElement.scrollWidth,
      py: cy + window.scrollY,
      vw: window.innerWidth,
    };
  }

  // 範囲のメモの位置。左上と右下の両方を含む一番近い共通の親要素を基準にし、両端を相対位置で持つ
  function areaAnchor(x1, y1, x2, y2) {
    var left = Math.min(x1, x2), right = Math.max(x1, x2);
    var top = Math.min(y1, y2), bottom = Math.max(y1, y2);
    var common = hitElement(left, top);
    var other = hitElement(right, bottom);
    while (common && common !== document.body && !common.contains(other)) common = common.parentElement;
    var a = anchorFor(common || document.body);
    var r = a.el.getBoundingClientRect();
    var docW = document.documentElement.scrollWidth;
    return {
      selector: a.selector,
      rx: ratio(left, r.left, r.width),
      ry: ratio(top, r.top, r.height),
      rx2: ratio(right, r.left, r.width),
      ry2: ratio(bottom, r.top, r.height),
      px: (left + window.scrollX) / docW,
      py: top + window.scrollY,
      px2: (right + window.scrollX) / docW,
      py2: bottom + window.scrollY,
      vw: window.innerWidth,
    };
  }

  var isArea = function (note) { return note.rx2 != null && note.ry2 != null; };

  function findAnchor(note) {
    try { return document.querySelector(note.selector); } catch (e) { return null; }
  }

  // ページ上の位置。範囲のメモでは右下の x2, y2 も返す
  // el を渡したときは探し直さない。null を渡せば「見つからない」として扱う
  function positionOf(note, el) {
    if (arguments.length < 2) el = findAnchor(note);
    var area = isArea(note);
    if (el && el.isConnected && el.getClientRects().length) {
      var r = el.getBoundingClientRect();
      var ox = r.left + window.scrollX, oy = r.top + window.scrollY;
      return {
        x: ox + r.width * note.rx, y: oy + r.height * note.ry,
        x2: area ? ox + r.width * note.rx2 : null, y2: area ? oy + r.height * note.ry2 : null,
        lost: false,
      };
    }
    var w = document.documentElement.scrollWidth;
    return {
      x: note.px * w, y: note.py,
      x2: area ? (note.px2 != null ? note.px2 * w : note.px * w) : null,
      y2: area ? (note.py2 != null ? note.py2 : note.py) : null,
      lost: true,
    };
  }

  // ---------- 画面 ----------
  var state = { enabled: false, placing: false, notes: [], openId: null, showDone: false };
  var layer, bar, popover, listPanel, settingsPanel, launcher;
  var listeners = [];

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    // ツールの部品には言語を付ける。ページと言語が違っても、読み上げが正しく読めるように
    if (attrs && 'data-asternote' in attrs) el.setAttribute('lang', LANG);
    // 利用者が書いた文字は、画面の言語ではなくページの言語で読ませる。英語の画面で日本語のメモを英語の声で読まないように
    if (attrs && attrs['data-user-text'] != null) el.setAttribute('lang', document.documentElement.getAttribute('lang') || '');
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'data-user-text') return;
      if (k === 'text') el.textContent = attrs[k];
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }

  function injectStyle() {
    // 色と角丸。導入先は --asternote-* で上書きできる。初期値は WCAG 2.2 AA を満たす
    // 文字は背景に対して 4.5:1 以上、入力欄の枠とフォーカスリングは 3:1 以上。変えるときもこの比を保つ
    // 内部のクラス名と CSS 変数の接頭辞 pn- は、旧名の頭文字。導入先には公開しないので、名前を変えても残している
    var vars = [
      ['fg', '#09090b'], ['muted', '#52525b'], ['bg', '#fff'], ['subtle', '#f4f4f5'], ['subtle-hover', '#e4e4e7'],
      ['border', '#e4e4e7'], ['input', '#71717a'], ['primary', '#3f3f46'], ['primary-fg', '#fff'], ['ring', '#3f3f46'],
      ['danger', '#b91c1c'], ['open', '#2b8265'], ['done', '#52525b'], ['star', '#2b8265'], ['radius', '8px'],
    ].map(function (v) { return '--pn-' + v[0] + ':var(--asternote-' + v[0] + ',' + v[1] + ')'; }).join(';');
    var css = [
      '[data-asternote]{' + vars + ';font:13px/1.5 system-ui,sans-serif;letter-spacing:0;text-transform:none;color:var(--pn-fg);box-sizing:border-box}',
      '[data-asternote] *,[data-asternote] *::before,[data-asternote] *::after{box-sizing:border-box}',
      // display を指定した要素でも hidden 属性で隠れるようにする。指定すると UA の display:none より優先されるため
      '[data-asternote][hidden],[data-asternote] [hidden]{display:none!important}',
      // ピンのフォーカスリングは白の縁を挟み、どの背景でも見えるようにする
      '[data-asternote] :focus-visible,.pn-pin:focus-visible{outline:2px solid var(--pn-ring);outline-offset:2px}',
      '.pn-pin:focus-visible{outline:none;box-shadow:0 0 0 2px #fff,0 0 0 4px var(--pn-ring)}',
      '.pn-icon{display:inline-flex;flex:none;line-height:0}',
      '.pn-icon svg{width:16px;height:16px}',
      '.pn-layer{position:absolute;left:0;top:0;width:0;height:0;z-index:2147483000}',
      // ピンは押せる大きさの基準に合わせて 24px 以上にする
      '.pn-pin{position:absolute;display:inline-flex;align-items:center;justify-content:center;gap:2px;min-width:24px;height:24px;margin:-24px 0 0 -2px;padding:0 6px;border:2px solid #fff;border-radius:12px 12px 12px 3px;color:#fff;font:600 12px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.4);touch-action:none;white-space:nowrap}',
      '.pn-pin .pn-icon svg{width:12px;height:12px;stroke-width:2.5}',
      STATUS.map(function (x) { var a = '[data-status="' + x.key + '"]'; return '[data-asternote] ' + a + ',[data-asternote]' + a + '{--pn-c:var(--pn-' + x.key + ')}'; }).join(''),
      '.pn-pin,.pn-tag{background:var(--pn-c)}',
      '.pn-area{background:color-mix(in srgb,var(--pn-c) 10%,transparent)}',
      // 見失ったピンは点線の枠だけで示す。半透明にすると番号のコントラストが足りなくなる
      '.pn-pin.is-lost{outline:2px dashed var(--pn-open);outline-offset:1px}',
      '.pn-pin.is-dragging{cursor:grabbing;opacity:.85}',
      '.pn-area{position:absolute;border:2px solid var(--pn-c);border-radius:4px;pointer-events:none}',
      '.pn-area.is-lost{border-style:dashed;opacity:.6}',
      // キーボードで置く位置を示す十字。中心が置く位置になる
      '.pn-cursor{position:fixed;z-index:2147483002;width:32px;height:32px;margin:-16px 0 0 -16px;border:2px solid var(--pn-open);border-radius:999px;box-shadow:0 0 0 2px #fff;pointer-events:none;outline:none}',
      '.pn-cursor::before,.pn-cursor::after{content:"";position:absolute;left:50%;top:50%;background:var(--pn-open);box-shadow:0 0 0 1px #fff}',
      '.pn-cursor::before{width:2px;height:44px;margin:-22px 0 0 -1px}',
      '.pn-cursor::after{width:44px;height:2px;margin:-1px 0 0 -22px}',
      '.pn-mode{margin:0}',
      '.pn-draft{position:fixed;z-index:2147483000;border:2px dashed var(--pn-primary);border-radius:4px;background:color-mix(in srgb,var(--pn-primary) 8%,transparent);pointer-events:none}',
      'html.pn-placing{touch-action:none;user-select:none}',
      'html.pn-placing,html.pn-placing *{cursor:crosshair!important}',
      'html.pn-placing [data-asternote],html.pn-placing [data-asternote] *,html.pn-placing [data-asternote-ignore],html.pn-placing [data-asternote-ignore] *{cursor:auto!important}',
      'html.pn-placing [data-asternote] button,html.pn-placing [data-asternote-ignore] button,html.pn-placing [data-asternote-ignore] a{cursor:pointer!important}',
      // 浮いている面の枠は飾りなので薄くてよい
      '.pn-island,.pn-pop,.pn-list,.pn-settings,.pn-close{border:1px solid var(--pn-border);border-radius:var(--pn-radius);background:var(--pn-bg);box-shadow:0 8px 16px rgba(0,0,0,.12)}',
      '.pn-bar{position:fixed;left:12px;bottom:12px;z-index:2147483001;display:flex;align-items:center;gap:8px;max-width:calc(100vw - 24px)}',
      // バーの高さは決め打ちにする。置くモードや通知で中身が変わっても、高さが変わらないように
      // 折り返さず、入りきらない案内と通知は末尾を省略する。読み上げでは全文を読む
      '.pn-island{display:flex;flex-wrap:nowrap;gap:6px;align-items:center;min-width:0;height:46px;padding:6px}',
      '.pn-island>*{flex:none}',
      '.pn-island .pn-seg{flex-wrap:nowrap}',
      // 狭い画面では、一覧のボタンをアイコンだけにし、すき間を詰める。360px の画面まで収まる
      // 文字は見えなくするだけで残す。読み上げではボタンの名前になる
      '@media (max-width:420px){.pn-btn--collapse{padding:0 8px}.pn-btn--collapse>span:not(.pn-icon){position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}}',
      '@media (max-width:380px){.pn-bar{gap:4px}.pn-island{gap:4px}.pn-island .pn-check{padding:0 2px}}',
      '.pn-close{display:inline-flex;flex:none;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border-radius:999px;color:var(--pn-fg);cursor:pointer}',
      '.pn-close:hover{background:var(--pn-subtle)}',
      // ボタンは文字で分かるので、枠のコントラストには頼らない
      '.pn-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:0 12px;border:1px solid transparent;border-radius:calc(var(--pn-radius) - 2px);background:var(--pn-subtle);color:var(--pn-fg);font:inherit;font-weight:500;line-height:1;cursor:pointer;white-space:nowrap}',
      '.pn-btn:hover,.pn-btn[aria-expanded="true"]{background:var(--pn-subtle-hover)}',
      '.pn-btn--primary{background:var(--pn-primary);color:var(--pn-primary-fg)}',
      '.pn-btn--primary:hover{background:color-mix(in srgb,var(--pn-primary) 85%,#000)}',
      '.pn-btn--danger{background:var(--pn-bg);border-color:var(--pn-danger);color:var(--pn-danger)}',
      '.pn-btn--danger:hover{background:color-mix(in srgb,var(--pn-danger) 8%,#fff)}',
      '.pn-btn:disabled,.pn-btn[aria-disabled="true"]{opacity:.5;cursor:default}',
      // 読み上げにだけ使う欄。画面には出さない
      '.pn-sr{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
      '.pn-btn--icon{min-width:32px;padding:0 8px}',
      '.pn-island>.pn-notice{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      // エラーは、バーの外に小さな札で出す。バーの中に出すと、バーの幅が変わるため
      // バーが上の辺にあるときは下に、それ以外は上に出す
      '.pn-hint{position:absolute;left:0;bottom:calc(100% + 6px);max-width:calc(100vw - 24px);padding:4px 8px;border:1px solid var(--pn-border);border-radius:calc(var(--pn-radius) - 2px);background:var(--pn-bg);color:var(--pn-danger);box-shadow:0 4px 8px rgba(0,0,0,.1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.pn-bar[data-edge="top"] .pn-hint{bottom:auto;top:calc(100% + 6px)}',
      '.pn-hint:empty{display:none}',
      '.pn-check{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 6px;cursor:pointer;white-space:nowrap}',
      '.pn-check input{width:16px;height:16px;margin:0;accent-color:var(--pn-primary)}',
      '.pn-notice{padding:4px 8px;border:1px solid #fcd34d;border-radius:calc(var(--pn-radius) - 2px);background:#fffbeb;color:#92400e}',
      '.pn-error{margin:8px 0 0;color:var(--pn-danger)}',
      '.pn-error:empty{display:none}',
      '.pn-pop{position:absolute;z-index:2147483002;width:300px;max-width:calc(100vw - 16px);overflow:auto;padding:14px}',
      '.pn-pop:focus{outline:none}',
      '.pn-pop textarea,.pn-pop input[type="text"],.pn-pop select,.pn-settings input[type="text"]{display:block;width:100%;min-height:32px;margin:6px 0;padding:6px 8px;border:1px solid var(--pn-input);border-radius:calc(var(--pn-radius) - 2px);background:var(--pn-bg);color:var(--pn-fg);font:inherit}',
      '.pn-pop textarea{min-height:88px;resize:vertical}',
      '.pn-title{margin:0 0 4px;padding-right:32px;font-weight:600;font-size:14px}',
      '.pn-x{position:absolute;top:8px;right:8px;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:0;border-radius:999px;background:none;color:var(--pn-muted);cursor:pointer}',
      '.pn-x:hover{background:var(--pn-subtle);color:var(--pn-fg)}',
      '.pn-label{margin-top:10px;color:var(--pn-muted);font-size:12px;font-weight:500}',
      '.pn-sep{margin-top:12px;border-top:1px solid var(--pn-border)}',
      '.pn-seg{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}',
      // 選択中は塗りで示す。未選択との差は 3:1 以上
      '.pn-seg button{display:inline-flex;align-items:center;gap:4px;min-height:28px;padding:0 8px;border:0;border-radius:calc(var(--pn-radius) - 2px);background:var(--pn-subtle);color:var(--pn-fg);font:inherit;font-size:12px;cursor:pointer}',
      '.pn-seg button:hover{background:var(--pn-subtle-hover)}',
      '.pn-seg button[aria-pressed="true"]{background:var(--pn-primary);color:var(--pn-primary-fg)}',
      '.pn-seg .pn-icon svg{width:14px;height:14px}',
      '.pn-kind{display:inline-flex;align-items:center;gap:4px;margin-right:8px}',
      '.pn-stars{color:var(--pn-star);letter-spacing:1px}',
      '.pn-seg button[aria-pressed="true"] .pn-stars{color:inherit}',
      '.pn-meta{color:var(--pn-muted);font-size:12px}',
      '.pn-body{margin:10px 0;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.pn-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px}',
      '.pn-head{display:flex;flex-wrap:wrap;align-items:center;gap:4px}',
      // 閲覧の吹き出しの1行目。番号、種類、状態を並べる。右上の × と重ならないよう、右に余白を取る
      '.pn-headrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;min-height:32px;padding-right:32px;margin:-4px 0 10px}',
      // 番号は控えめにする。本文に目が向くように
      '.pn-headrow .pn-title{margin:0;padding:0;color:var(--pn-muted);font-size:13px;font-weight:400}',
      '.pn-headrow .pn-kind{margin:0}',
      // 本文は罫線で囲まず、文字の大きさと上下の余白で目が向くようにする
      '.pn-body--view{margin:0 0 8px;padding:6px 0 2px;font-size:15px;line-height:1.7}',
      '.pn-line{display:block;margin-top:2px}',
      '.pn-tag{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;color:#fff;font-size:12px;font-weight:500;margin-right:6px}',
      '.pn-tag .pn-icon svg{width:12px;height:12px;stroke-width:2.5}',
      '.pn-list{position:fixed;left:12px;bottom:64px;z-index:2147483001;width:340px;max-width:calc(100vw - 24px);max-height:60vh;overflow:auto;padding:4px}',
      '.pn-list ol{margin:0;padding:0;list-style:none}',
      '.pn-list li+li{border-top:1px solid var(--pn-border)}',
      '.pn-item{display:block;width:100%;padding:8px;border:0;border-radius:calc(var(--pn-radius) - 2px);background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}',
      '.pn-item:hover{background:var(--pn-subtle)}',
      '.pn-empty{margin:0;padding:10px;color:var(--pn-muted)}',
      // 起動ボタンは、バーと同じ高さと見た目にする。開いたり閉じたりしても、高さが変わらないように
      '.pn-launch{position:fixed;left:12px;bottom:12px;z-index:2147483001;height:46px;padding:0 16px;border:1px solid var(--pn-border);border-radius:var(--pn-radius);background:var(--pn-bg);box-shadow:0 8px 16px rgba(0,0,0,.12)}',
      '.pn-launch:hover{background:var(--pn-subtle)}',
      // バーを動かすつまみ。キーボードでは設定の中から位置を選ぶので、フォーカスは当てない
      '.pn-grip{display:inline-flex;align-items:center;justify-content:center;width:20px;min-height:32px;margin-right:-2px;border-radius:calc(var(--pn-radius) - 2px);color:var(--pn-muted);cursor:grab;touch-action:none}',
      '.pn-grip:hover{background:var(--pn-subtle)}',
      '.pn-bar.is-moving,.pn-bar.is-moving *{cursor:grabbing!important;user-select:none}',
      '.pn-settings{position:fixed;left:12px;bottom:64px;z-index:2147483001;width:300px;max-width:calc(100vw - 24px);overflow:auto;padding:14px}',
      '.pn-settings .pn-check{display:flex;padding:0}',
      '.pn-field{display:flex;align-items:center;gap:8px;margin:4px 0 0 22px}',
      '.pn-settings input.pn-key{display:inline-block;width:3em;margin:0;text-align:center;text-transform:uppercase}',
      // エラーの欄は、空でも高さを取っておく。文言が出ても、パネルの高さが変わらないように
      '.pn-field-error{min-height:18px;margin:2px 0 0 22px;color:var(--pn-danger);font-size:12px;line-height:18px}',
      '.pn-sub{margin:0 0 0 22px;color:var(--pn-muted);font-size:12px}',
      '.pn-pos{display:grid;grid-template-columns:repeat(3,max-content);gap:4px}',
      '.pn-pos button{justify-content:center;min-width:44px}',
      '.pn-foot{margin:12px 0 0;padding-top:8px;border-top:1px solid var(--pn-border);color:var(--pn-muted);font-size:12px}',
      '.pn-foot a{display:inline-flex;align-items:center;gap:4px;color:inherit;text-underline-offset:2px}',
      '.pn-foot a:hover{color:var(--pn-fg)}',
      '.pn-foot .pn-icon svg{width:12px;height:12px}',
      // 開閉する見出し。開いているときは矢印を上に向ける
      '.pn-disclosure{display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:10px;padding:4px 0;border:0;background:none;color:var(--pn-muted);font:inherit;font-size:12px;font-weight:500;cursor:pointer}',
      '.pn-disclosure:hover{color:var(--pn-fg)}',
      '.pn-disclosure .pn-icon svg{width:14px;height:14px;transition:transform .15s}',
      '.pn-disclosure[aria-expanded="true"] .pn-icon svg{transform:rotate(180deg)}',
      // 書いている間の仮のピン。押せないようにし、点線の縁で仮であることを示す
      '.pn-pin.is-draft{pointer-events:none;border-style:dashed}',
      '.pn-area.is-draft{border-style:dashed}',
    ].join('\n');
    document.head.appendChild(h('style', { 'data-asternote-style': '' }, [document.createTextNode(css)]));
  }

  function build() {
    injectStyle();
    layer = h('div', { class: 'pn-layer', 'data-asternote': '' });
    document.body.appendChild(layer);

    // キーボードで押したとき（click の detail が 0）は、置く位置を十字のカーソルで選べるようにする
    var addBtn = h('button', { type: 'button', class: 'pn-btn pn-btn--primary', onclick: function (e) { setPlacing(!state.placing, { keyboard: e.detail === 0 }); } }, label('plus', t('bar.add')));
    var listBtn = h('button', { type: 'button', class: 'pn-btn pn-btn--collapse', title: t('bar.list'), 'aria-expanded': 'false', onclick: toggleList }, label('list', t('bar.list')));
    // 完了したメモは、設定でチェックを入れたときだけ表示する。選んだ状態はブラウザに保存する
    state.showDone = ls.get(KEY + 'showDone') === '1';
    // 閉じるボタンは、操作の並びと分けて島の外に置く。アイコンだけなので、名前は aria-label で付ける
    var closeBtn = h('button', { type: 'button', class: 'pn-close', 'aria-label': t('bar.close'), title: t('bar.close'), onclick: function () { api.disable(); } }, [iconEl('x')]);
    // エラーは、変わったときに読み上げられるようにする
    var hint = h('span', { class: 'pn-hint', 'data-pn-hint': '', role: 'status' });
    // 置くモードの案内は、画面には出さず、読み上げだけで伝える
    var srHint = h('span', { class: 'pn-sr', role: 'status' });
    var notice = h('span', { class: 'pn-notice', 'data-pn-notice': '', role: 'status', hidden: '' });
    // 「範囲で指定」のチェックボックス。入れると、2つの角のクリックで範囲を指定する
    // ドラッグを使えない人のための代わりの操作なので、なくさない。WCAG 2.2 の 2.5.7
    // トグルボタンより、入っているかどうかが分かりやすいので、チェックボックスにする
    var modeBox = h('input', { type: 'checkbox' });
    modeBox.addEventListener('change', function () { setPlaceMode(modeBox.checked ? 'area' : 'point'); });
    var modeSeg = h('label', { class: 'pn-check pn-mode', title: t('bar.areaTitle'), hidden: '' }, [modeBox, document.createTextNode(t('bar.area'))]);
    // 設定はアイコンだけのボタン。名前は aria-label で付ける
    var settingsBtn = h('button', {
      type: 'button', class: 'pn-btn pn-btn--icon', 'aria-label': t('bar.settings'), title: t('bar.settings'),
      'aria-expanded': 'false', 'aria-controls': 'pn-settings', onclick: function () { toggleSettings(); },
    }, [iconEl('settings')]);
    // つまみはマウスとタッチ用。キーボードと読み上げでは、設定の中の位置の選択を使う
    var grip = h('span', { class: 'pn-grip', 'aria-hidden': 'true', title: t('bar.grip'), onpointerdown: onGripDown }, [iconEl('grip-vertical')]);
    var island = h('div', { class: 'pn-island' }, [grip, addBtn, modeSeg, listBtn, settingsBtn, hint, notice, srHint]);
    bar = h('div', { class: 'pn-bar', 'data-asternote': '', role: 'region', 'aria-label': t('bar.region'), hidden: '' }, [island, closeBtn]);
    bar.addBtn = addBtn;
    bar.listBtn = listBtn;
    bar.settingsBtn = settingsBtn;
    bar.modeSeg = modeSeg;
    bar.hint = hint;
    bar.srHint = srHint;
    bar.notice = notice;
    if (pendingNotice) setNotice(pendingNotice);
    document.body.appendChild(bar);

    if (config.ui !== 'none') {
      launcher = h('button', { type: 'button', class: 'pn-btn pn-launch', 'data-asternote': '', onclick: function () { api.toggle(); } }, label('logo', t('launcher')));
      document.body.appendChild(launcher);
    }

    document.addEventListener('pointerdown', onPlacePointerDown, true);
    document.addEventListener('pointerdown', onOutsidePointerDown, true);
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', function (e) {
      if (e.isComposing || e.keyCode === 229) return;
      // マウスで置き始めたあとに矢印キーを押したら、十字のカーソルを出してキーボードでも続けられるようにする
      // 置き方のボタンを押してフォーカスがカーソルから外れていても、矢印キーと Enter はカーソルに渡す
      // Alt や ⌘ と一緒の矢印キーは、ブラウザの操作（戻る など）なので止めない
      if (state.placing && /^Arrow/.test(e.key) && !e.altKey && !e.metaKey && !e.ctrlKey &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !e.target.isContentEditable) {
        e.preventDefault();
        if (!cursorEl) { showCursor(); return; }
        if (e.target !== cursorEl) { cursorEl.focus({ preventScroll: true }); onCursorKey(e); }
        return;
      }
      if (isShortcut(e)) {
        e.preventDefault();
        if (cancelGesture) cancelGesture(); // 範囲を引いている途中やピンのドラッグ中なら、先に取り消す
        onShortcut();
        return;
      }
      if (e.key !== 'Escape') return;
      if (cancelGesture) cancelGesture(); // 範囲を引いている途中やピンのドラッグ中なら、それを取り消す
      if (state.placing) setPlacing(false);
      else if (popover) requestClosePopover();
      else if (isOpen(settingsPanel)) closeSettings(true);
    });
    var reflow = debounce(updatePositions, 100);
    window.addEventListener('resize', reflow);
    window.addEventListener('resize', layoutBar);
    // バーや一覧の大きさが変わったら、置き直して、避ける高さを更新する。一覧の max-height は画面の高さで変わるが、
    // そのときも要素の大きさが変わるので、この監視で拾える。外さないこと
    if (window.ResizeObserver) {
      offsetObserver = new ResizeObserver(layoutBar);
      offsetObserver.observe(bar);
      if (launcher) offsetObserver.observe(launcher);
    }
    window.addEventListener('load', reflow);
    if (window.ResizeObserver) new ResizeObserver(reflow).observe(document.body);
    layoutBar();
    // 固定表示やスクロールする枠の中の要素にも追従するよう、スクロールのたびに位置を計算し直す
    var ticking = false;
    document.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; updatePositions(); });
    }, { capture: true, passive: true });
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  // 置くモードに入る、または出る。opts.move にピンを渡すと、そのピンの移動先を選ぶモードになる
  // opts.keyboard が true なら、十字のカーソルを出してフォーカスを移す
  // 移動するピンは、メモの id で覚える。途中で描き直されてもピンの要素は作り直されるので、決めるときに探し直す
  function setPlacing(on, opts) {
    opts = opts || {};
    if (on && !requestClosePopover()) return;
    var wasMoving = state.moveTarget;
    // カーソルを消すとフォーカスが body に外れる。カーソルにフォーカスがあったら、あとでバーの「戻る」に戻す
    var hadCursorFocus = !!cursorEl && document.activeElement === cursorEl;
    state.placing = on;
    state.moveTarget = on && opts.move ? opts.move : null;
    state.placeMode = 'point';
    clearCorner();
    hideCursor();
    document.documentElement.classList.toggle('pn-placing', on);
    // 置いている間の「戻る」は、目立たないアイコンだけのボタンにする。名前は aria-label で付ける
    var add = bar.addBtn;
    add.classList.toggle('pn-btn--primary', !on);
    add.classList.toggle('pn-btn--icon', on);
    add.textContent = '';
    if (on) {
      add.setAttribute('aria-label', t('bar.back'));
      add.title = t('bar.backTitle');
      add.appendChild(iconEl('arrow-left'));
    } else {
      add.removeAttribute('aria-label');
      add.removeAttribute('title');
      label('plus', t('bar.add')).forEach(function (el) { add.appendChild(el); });
    }
    // 置いている間は、置く操作に関係のない部品を隠す。一覧も閉じる
    bar.listBtn.hidden = on;
    bar.settingsBtn.hidden = on;
    bar.modeSeg.hidden = !on || !!state.moveTarget;
    if (on && listPanel && !listPanel.hidden) toggleList();
    if (on) closeSettings(false);
    setPlaceMode('point');
    if (on && opts.keyboard) showCursor();
    if (!on) {
      var active = document.activeElement;
      if (hadCursorFocus) bar.addBtn.focus({ preventScroll: true });
      // マウスで移動を始めて取り消したときは、動かそうとしたピンに戻す。吹き出しを閉じたときに外れているため
      else if (wasMoving && (!active || active === document.body)) restoreFocus(wasMoving);
    }
    updateBarVisibility();
  }

  function setPlaceMode(mode) {
    state.placeMode = mode;
    clearCorner();
    bar.modeSeg.firstChild.checked = mode === 'area';
    updateHint();
  }

  // 案内の文。今の置き方と段階に合わせる。キーボードで操作しているときは、キーの案内も足す
  // 画面には出さず、読み上げだけで伝える。画面の案内の欄は、前のエラーが残らないように空にする
  function updateHint() {
    bar.hint.textContent = '';
    bar.hint.title = '';
    if (!state.placing) { bar.srHint.textContent = ''; return; }
    var text = state.moveTarget ? t('hint.move')
      : state.placeMode === 'area' ? (state.corner ? t('hint.corner2') : t('hint.corner1'))
      : t('hint.point');
    if (cursorEl) text += t('hint.keys');
    bar.srHint.textContent = text;
  }

  // 位置を決める。クリック、ドラッグの終わり、キーボードの Enter のすべてがここを通る
  // rect はドラッグで引いた範囲。target は押した要素で、点のメモの基準にする
  function placeAt(cx, cy, target, rect) {
    if (state.moveTarget) {
      var id = state.moveTarget;
      var byKeyboard = !!cursorEl;
      setPlacing(false);
      var pin = pinFor(id);
      if (pin) movePinTo(pin, cx, cy);
      // キーボードで動かしたら、動かしたピンにフォーカスを戻す
      if (byKeyboard) restoreFocus(id);
      return;
    }
    var anchor;
    if (rect) {
      anchor = areaAnchor(rect.x1, rect.y1, rect.x2, rect.y2);
    } else if (state.placeMode === 'area') {
      // 1つ目の角はページ座標で覚える。2つ目を選ぶ間にスクロールしても、ずれないようにする
      if (!state.corner) {
        state.corner = { px: cx + window.scrollX, py: cy + window.scrollY };
        drawCorner(cx, cy);
        updateHint();
        return;
      }
      var c = cornerClient();
      // 2つの角が近すぎると、見えない範囲になる。2つ目の角を待ち続ける
      if (Math.hypot(cx - c.x, cy - c.y) < DRAG_THRESHOLD) return;
      anchor = areaAnchor(c.x, c.y, cx, cy);
    } else {
      anchor = pointAnchor(cx, cy, target);
    }
    setPlacing(false);
    openEditor(null, anchor);
  }

  // ピンを動かす。点のメモは押した位置へ、範囲のメモは大きさを保って左上を押した位置へ動かす
  function movePinTo(pin, cx, cy) {
    var pos = positionOf(pin.note, pin.anchorEl);
    var fields = pos.x2 != null
      ? areaAnchor(cx, cy, cx + (pos.x2 - pos.x), cy + (pos.y2 - pos.y))
      : pointAnchor(cx, cy);
    pin.note = Object.assign({}, pin.note, fields);
    state.notes = state.notes.map(function (n) { return n.id === pin.note.id ? pin.note : n; });
    pin.anchorEl = findAnchor(pin.note);
    updatePositions();
    store.update(pin.note.id, fields).then(refresh).catch(saveFailed);
  }

  // 範囲の1つ目の角の印と、2つ目を選ぶ間の仮の枠
  var cornerEl = null;
  function cornerClient() { return { x: state.corner.px - window.scrollX, y: state.corner.py - window.scrollY }; }
  function drawCorner(cx, cy) {
    if (!cornerEl) {
      cornerEl = h('div', { class: 'pn-draft', 'data-asternote': '' });
      document.body.appendChild(cornerEl);
    }
    var c = cornerClient();
    cornerEl.style.left = Math.min(c.x, cx) + 'px';
    cornerEl.style.top = Math.min(c.y, cy) + 'px';
    cornerEl.style.width = Math.abs(cx - c.x) + 'px';
    cornerEl.style.height = Math.abs(cy - c.y) + 'px';
  }
  function clearCorner() {
    state.corner = null;
    if (cornerEl) cornerEl.remove();
    cornerEl = null;
  }
  // 2つ目の角を選ぶ間は、マウスの位置まで仮の枠を引く。スクロールしたときに描き直せるよう、最後の位置を覚える
  var lastPointer = { x: 0, y: 0 };
  document.addEventListener('pointermove', function (e) {
    lastPointer = { x: e.clientX, y: e.clientY };
    if (state.corner && !cursorEl) drawCorner(e.clientX, e.clientY);
  }, true);

  // キーボードで置く位置を示す十字のカーソル。画面に固定し、矢印キーで動かす
  // role="application" にして、読み上げソフトが矢印キーを横取りしないようにする
  var cursorEl = null;
  var cursor = { x: 0, y: 0 };
  var CURSOR_STEP = 8;
  var CURSOR_STEP_LARGE = 40;
  function showCursor() {
    if (!cursorEl) {
      cursorEl = h('div', {
        class: 'pn-cursor', 'data-asternote': '', tabindex: '-1', role: 'application',
        'aria-label': t('cursor'),
      });
      cursorEl.addEventListener('keydown', onCursorKey);
      document.body.appendChild(cursorEl);
    }
    // 移動のときはピンの今の位置から、ほかは画面の中央から始める
    var movePin = state.moveTarget && pinFor(state.moveTarget);
    if (movePin) {
      var pos = positionOf(movePin.note, movePin.anchorEl);
      cursor = { x: pos.x - window.scrollX, y: pos.y - window.scrollY };
    } else {
      cursor = { x: Math.round(document.documentElement.clientWidth / 2), y: Math.round(window.innerHeight / 2) };
    }
    drawCursor();
    cursorEl.focus({ preventScroll: true });
    updateHint();
  }
  function hideCursor() {
    if (cursorEl) cursorEl.remove();
    cursorEl = null;
  }
  function drawCursor() {
    var vw = document.documentElement.clientWidth, vh = window.innerHeight;
    cursor.x = Math.min(Math.max(cursor.x, 0), vw - 1);
    cursor.y = Math.min(Math.max(cursor.y, 0), vh - 1);
    cursorEl.style.left = cursor.x + 'px';
    cursorEl.style.top = cursor.y + 'px';
    if (state.corner) drawCorner(cursor.x, cursor.y);
  }
  function onCursorKey(e) {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    var step = e.shiftKey ? CURSOR_STEP_LARGE : CURSOR_STEP;
    var d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) {
      e.preventDefault();
      cursor.x += d[0];
      cursor.y += d[1];
      drawCursor();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // 「メモを追加」で押した Enter を押し続けると、カーソルが出た直後に置いてしまう。押し続けの分は無視する
      if (e.repeat) return;
      placeAt(cursor.x, cursor.y, hitElement(cursor.x, cursor.y));
    }
  }

  var DRAG_THRESHOLD = 6;
  // 操作の直後に来る click を無視する。ページのリンクが動いたり、ピンの吹き出しが開いたりしないようにする
  // タッチの click は pointerup から遅れて届くので、時間で区切る。届いたらその場で解除する
  var swallowUntil = 0;
  var SWALLOW_MS = 600;
  function swallowNextClick() { swallowUntil = Date.now() + SWALLOW_MS; }
  function takeSwallowedClick() {
    if (Date.now() >= swallowUntil) return false;
    swallowUntil = 0;
    return true;
  }
  // 進行中の操作を取り消す関数。Esc や非表示のときに呼ぶ
  var cancelGesture = null;

  // メモを置く操作。6px 未満の動きなら点、それ以上なら四角の範囲にする
  function onPlacePointerDown(e) {
    if (!state.enabled || !state.placing || e.button !== 0 || isOwn(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    // 始点はページ座標で持つ。引いている途中にスクロールしても、始点がずれないようにする
    var start = { px: e.clientX + window.scrollX, py: e.clientY + window.scrollY, target: e.target };
    var last = { x: e.clientX, y: e.clientY };
    var draft = null;
    var startClient = function () { return { x: start.px - window.scrollX, y: start.py - window.scrollY }; };
    var drawDraft = function () {
      var s0 = startClient();
      draft.style.left = Math.min(s0.x, last.x) + 'px';
      draft.style.top = Math.min(s0.y, last.y) + 'px';
      draft.style.width = Math.abs(last.x - s0.x) + 'px';
      draft.style.height = Math.abs(last.y - s0.y) + 'px';
    };
    var move = function (ev) {
      last = { x: ev.clientX, y: ev.clientY };
      var s0 = startClient();
      if (!draft && Math.hypot(last.x - s0.x, last.y - s0.y) < DRAG_THRESHOLD) return;
      if (!draft) {
        draft = h('div', { class: 'pn-draft', 'data-asternote': '' });
        document.body.appendChild(draft);
      }
      drawDraft();
    };
    var onScroll = function () { if (draft) drawDraft(); };
    var cleanup = function () {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', end, true);
      document.removeEventListener('pointercancel', end, true);
      window.removeEventListener('scroll', onScroll, true);
      if (draft) draft.remove();
      cancelGesture = null;
    };
    var end = function (ev) {
      var drew = !!draft;
      cleanup();
      swallowNextClick();
      if (ev.type === 'pointercancel') return;
      var s0 = startClient();
      var target = start.target === document.documentElement ? document.body : start.target;
      // 移動では、離した位置を移動先にする。置くときは、引いた範囲か押した位置を使う
      if (state.moveTarget) placeAt(ev.clientX, ev.clientY, target);
      else if (drew) placeAt(s0.x, s0.y, target, { x1: s0.x, y1: s0.y, x2: ev.clientX, y2: ev.clientY });
      else placeAt(s0.x, s0.y, target);
    };
    cancelGesture = function () { cleanup(); swallowNextClick(); };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
    window.addEventListener('scroll', onScroll, true);
  }

  // 吹き出しの外側を押したら閉じる。ピンを押したときは、そのピンの吹き出しを開くので任せる
  // 書きかけの内容がある編集中の吹き出しは、うっかり消えないように閉じない
  function onOutsidePointerDown(e) {
    var t = e.target;
    // バーを押したときは、押し終わるまでバーを隠さない。吹き出しが閉じた拍子にバーが隠れると、押したボタンに届かないため
    if (bar.contains(t)) holdBar();
    // 設定は、バーと設定の外を押したら閉じる
    if (isOpen(settingsPanel) && !settingsPanel.contains(t) && !bar.contains(t)) closeSettings(false);
    if (!popover || state.placing) return;
    if (popover.contains(t) || (t.closest && t.closest('.pn-pin'))) return;
    requestClosePopover(KEEP_FOCUS);
  }

  // 置く操作のあいだと直後の click は、ページに渡さない
  function onDocClick(e) {
    if (isOwn(e.target)) return;
    if (!takeSwallowedClick() && !(state.enabled && state.placing)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function sorted() {
    return state.notes.slice().sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; });
  }

  // 表示するメモと、その番号。番号は完了も含めた作成順で振る。隠しても番号がずれないようにする
  function visibleNumbered() {
    return sorted()
      .map(function (note, i) { return { note: note, num: i + 1 }; })
      .filter(function (x) { return state.showDone || x.note.status !== 'done'; });
  }

  function renderPins() {
    if (!layer) return;
    // ドラッグ中に描き直すと、動かしているピンが消えてドラッグが途切れる。終わるまで待たせる
    if (state.dragging) { state.renderPending = true; return; }
    // 描き直すとピンの要素は作り直される。フォーカスがピンにあったら、同じメモのピンに戻す
    var focused = document.activeElement && document.activeElement.note && layer.contains(document.activeElement) ? document.activeElement.note.id : null;
    layer.textContent = '';
    if (!state.enabled) return;
    visibleNumbered().forEach(function (item) {
      var note = item.note;
      var num = item.num;
      var el = findAnchor(note);
      var pos = positionOf(note, el);
      var st = statusOf(note.status);
      var kind = kindOf(note.kind);
      var imp = importanceOf(note);
      var pin = h('button', {
        type: 'button',
        class: 'pn-pin' + (pos.lost ? ' is-lost' : ''),
        title: (pos.lost ? t('pin.lost') : '') + note.body,
        'aria-label': [t('pin.note', { n: num }), st.label, isMemo(kind) ? null : kind.label, isArea(note) ? t('pin.area') : null, imp ? t('importance.n', { n: imp }) : null]
          .filter(Boolean).join(t('sep')),
        'data-status': st.key,
        text: String(num),
        onclick: function (e) {
          e.stopPropagation();
          // ドラッグで動かした直後の click では開かない
          if (takeSwallowedClick()) return;
          // 置くモードの間にピンを押したら、吹き出しは開かず、その位置を置く場所にする
          if (state.placing) { placeAt(e.clientX, e.clientY, hitElement(e.clientX, e.clientY)); return; }
          openViewer(pin.note);
        },
      });
      // 「メモ」以外の種類は、番号の前にアイコンを出す
      // 状態のアイコンは番号の後ろに出す。色だけで状態を伝えないため
      if (!isMemo(kind)) pin.insertBefore(iconEl(kind.icon), pin.firstChild);
      if (st.icon) pin.appendChild(iconEl(st.icon));
      pin.note = note;
      pin.anchorEl = el;
      if (isArea(note)) {
        // 範囲の枠。ページの操作を妨げないよう、枠そのものはクリックを受けない
        pin.areaEl = h('div', { class: 'pn-area', 'data-asternote': '', 'data-status': st.key });
        layer.appendChild(pin.areaEl);
      }
      pin.addEventListener('pointerdown', function (e) { startPinDrag(e, pin); });
      movePin(pin, pos);
      layer.appendChild(pin);
    });
    renderDraft();
    if (focused) { var again = pinFor(focused); if (again) again.focus({ preventScroll: true }); }
    if (listPanel && !listPanel.hidden) renderList();
    movePopover();
  }

  // 新しいメモを書いている間は、置いた位置に仮のピンと範囲の枠を出す。吹き出しを閉じると消える
  // 読み上げでは吹き出しが位置を伝えるので、仮のピンは読ませない
  function renderDraft() {
    if (!popover || !popover.isNew || !popover.target) return;
    var draft = Object.assign({}, popover.target, { body: '' });
    var el = findAnchor(draft);
    var pin = h('span', { class: 'pn-pin is-draft', 'data-status': 'open', 'aria-hidden': 'true', text: String(state.notes.length + 1) });
    pin.note = draft;
    pin.anchorEl = el;
    if (isArea(draft)) {
      pin.areaEl = h('div', { class: 'pn-area is-draft', 'data-asternote': '', 'data-status': 'open' });
      layer.appendChild(pin.areaEl);
    }
    movePin(pin, positionOf(draft, el));
    layer.appendChild(pin);
  }

  function movePin(pin, pos) {
    pin.style.left = pos.x + 'px';
    pin.style.top = pos.y + 'px';
    pin.classList.toggle('is-lost', pos.lost);
    pin.title = (pos.lost ? t('pin.lost') : '') + pin.note.body;
    if (pin.areaEl && pos.x2 != null) {
      pin.areaEl.style.left = pos.x + 'px';
      pin.areaEl.style.top = pos.y + 'px';
      pin.areaEl.style.width = Math.max(0, pos.x2 - pos.x) + 'px';
      pin.areaEl.style.height = Math.max(0, pos.y2 - pos.y) + 'px';
      pin.areaEl.classList.toggle('is-lost', pos.lost);
    }
  }

  // ピンのドラッグ。範囲のメモでは範囲ごと動かす。離した位置で基準を求め直して保存する
  // 座標は画面座標で扱う。押した時点のピンの画面上の位置に、ポインターの移動量を足す。
  // 描くときと保存するときにだけ、そのときのスクロール量を足してページ座標に直す。途中でスクロールしてもずれない
  function startPinDrag(e, pin) {
    // 置くモードの間は、ピンを押してもドラッグしない。押した位置を置く場所にするため
    if (e.button !== 0 || state.placing) return;
    var start = { x: e.clientX, y: e.clientY };
    var page = positionOf(pin.note, pin.anchorEl);
    var sx = window.scrollX, sy = window.scrollY;
    var from = {
      x: page.x - sx, y: page.y - sy,
      x2: page.x2 != null ? page.x2 - sx : null, y2: page.y2 != null ? page.y2 - sy : null,
    };
    var dragging = false;
    var delta = { x: 0, y: 0 };
    pin.setPointerCapture(e.pointerId);
    var clientRect = function () {
      return {
        x: from.x + delta.x, y: from.y + delta.y,
        x2: from.x2 != null ? from.x2 + delta.x : null, y2: from.y2 != null ? from.y2 + delta.y : null,
      };
    };
    var draw = function () {
      var c = clientRect();
      movePin(pin, {
        x: c.x + window.scrollX, y: c.y + window.scrollY,
        x2: c.x2 != null ? c.x2 + window.scrollX : null, y2: c.y2 != null ? c.y2 + window.scrollY : null,
        lost: false,
      });
    };
    var move = function (ev) {
      delta = { x: ev.clientX - start.x, y: ev.clientY - start.y };
      if (!dragging && Math.hypot(delta.x, delta.y) < DRAG_THRESHOLD) return;
      if (!dragging) {
        // 書きかけの吹き出しがあれば、内容を守るためにドラッグしない
        if (!requestClosePopover()) { cleanup(); return; }
        dragging = true;
        state.dragging = true;
        pin.classList.add('is-dragging');
      }
      draw();
    };
    var onScroll = function () { if (dragging) draw(); };
    var cleanup = function () {
      pin.removeEventListener('pointermove', move);
      pin.removeEventListener('pointerup', end);
      pin.removeEventListener('pointercancel', end);
      window.removeEventListener('scroll', onScroll, true);
      pin.classList.remove('is-dragging');
      cancelGesture = null;
      // 待たせていた描き直しがあれば、ここで行う
      state.dragging = false;
      if (state.renderPending) { state.renderPending = false; renderPins(); }
    };
    var end = function (ev) {
      var moved = dragging;
      if (!moved) { cleanup(); return; }
      swallowNextClick(); // 続く click で内容を開かない
      if (ev.type === 'pointercancel') { cleanup(); updatePositions(); return; }
      var c = clientRect();
      var fields = c.x2 != null ? areaAnchor(c.x, c.y, c.x2, c.y2) : pointAnchor(c.x, c.y);
      // 保存を待たずに新しい位置を反映する。保存までの間に位置を計算し直しても、元の位置に戻らないように
      // 一覧の値も書き換えてから片付ける。待たせていた描き直しが、古い位置で描かないようにするため
      pin.note = Object.assign({}, pin.note, fields);
      state.notes = state.notes.map(function (n) { return n.id === pin.note.id ? pin.note : n; });
      cleanup();
      pin.anchorEl = findAnchor(pin.note);
      updatePositions();
      store.update(pin.note.id, fields).then(refresh).catch(saveFailed);
    };
    cancelGesture = function () {
      var moved = dragging;
      cleanup();
      if (moved) { swallowNextClick(); updatePositions(); }
    };
    pin.addEventListener('pointermove', move);
    pin.addEventListener('pointerup', end);
    pin.addEventListener('pointercancel', end);
    window.addEventListener('scroll', onScroll, true);
  }

  function updatePositions() {
    if (state.corner) {
      if (cursorEl) drawCursor();
      else drawCorner(lastPointer.x, lastPointer.y);
    }
    if (!layer || !state.enabled) return;
    Array.prototype.forEach.call(layer.children, function (pin) {
      if (!pin.note || pin.classList.contains('is-dragging')) return;
      if (!pin.anchorEl || !pin.anchorEl.isConnected) pin.anchorEl = findAnchor(pin.note);
      movePin(pin, positionOf(pin.note, pin.anchorEl));
    });
    movePopover();
  }

  // 開いている吹き出しを対象のピンの位置に合わせる。要素は開いたときに探したものを使い回す
  function movePopover() {
    if (!popover || !popover.target) return;
    if (popover.targetEl && !popover.targetEl.isConnected) popover.targetEl = findAnchor(popover.target);
    var pos = positionOf(popover.target, popover.targetEl);
    // 範囲のメモは、枠に重ならないように、範囲の下端を基準にする。上に出すときは、左上のピンの上に出す
    placePopover(pos.x, pos.y2 != null ? pos.y2 : pos.y, pos.y, pos.x2);
  }

  // 吹き出しは、ピンの下に置く。画面の下端やバーにかかるときは、ピンの上に置く
  // 上にも入らないときは、画面の上端にそろえる。画面の外に出ると、開いても見えないため
  // 高さの上限は、画面の上端からバーの上端までにする
  var PIN_HEIGHT = 24;
  // y は下に出すときの基準、upperY は上に出すときの基準。点のメモでは同じ値になる
  // x2 は範囲の右端。点のメモでは null
  // 上にも下にも入らないときは、ピンや範囲の横に出す。横にも入らないときは、画面の中に収める
  function placePopover(x, y, upperY, x2) {
    var root = document.documentElement;
    var minTop = window.scrollY + 8;
    // バーが上の辺にあるときは、その下から置く。下の辺のバーは、--asternote-offset で避ける
    if (prefs.edge === 'top' && bar && !bar.hidden) minTop = window.scrollY + bar.getBoundingClientRect().bottom + 8;
    var maxBottom = window.scrollY + root.clientHeight - (parseFloat(root.style.getPropertyValue('--asternote-offset')) || 0) - 8;
    // 空いている高さより高いときは、中をスクロールさせる
    popover.style.maxHeight = Math.max(120, maxBottom - minTop) + 'px';
    var w = popover.offsetWidth || 300;
    var h = popover.offsetHeight;
    var left = Math.min(Math.max(8 + window.scrollX, x + 12), window.scrollX + root.clientWidth - w - 8);
    var top = y + 8;
    if (top + h > maxBottom) {
      var above = upperY - PIN_HEIGHT - 8 - h;
      if (above >= minTop) {
        top = above;
      } else {
        top = Math.min(Math.max(minTop, upperY - PIN_HEIGHT), Math.max(minTop, maxBottom - h));
        var right = (x2 != null ? x2 : x + PIN_HEIGHT) + 12;
        var minLeft = window.scrollX + 8;
        var maxRight = window.scrollX + root.clientWidth - 8;
        if (right + w <= maxRight) left = right;
        else if (x - 12 - w >= minLeft) left = x - 12 - w;
      }
    }
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
  }

  // 吹き出しを必ず閉じる。保存やキャンセルのボタンなど、閉じてよいと決まっているときに使う
  // フォーカスが吹き出しの中にあったときだけ、開く前の場所に戻す
  // 外側をクリックして閉じたときは KEEP_FOCUS を渡す。押した場所を優先し、ピンの位置へスクロールさせない
  // ボタンの onclick に直接渡すと、引数はイベントになる。文字列と比べるので、戻す扱いになる
  var KEEP_FOCUS = 'keep-focus';
  function closePopover(mode) {
    var back = null;
    var wasNew = !!(popover && popover.isNew);
    if (popover && mode !== KEEP_FOCUS) {
      // 保存中にボタンを無効にすると、フォーカスは body に外れる。そのときも戻す
      var active = document.activeElement;
      if (!active || active === document.body || popover.contains(active)) back = popover.returnTo;
    }
    if (popover) {
      if (popoverObserver) popoverObserver.unobserve(popover);
      popover.remove();
    }
    popover = null;
    state.openId = null;
    // 仮のピンと枠だけを消す。全部を描き直すと、ドラッグ中のピンが消えてドラッグが途切れるため
    if (wasNew && layer) Array.prototype.forEach.call(layer.querySelectorAll('.is-draft'), function (el) { el.remove(); });
    updateBarVisibility();
    if (back) restoreFocus(back);
  }

  // 戻り先は要素か、メモの id。ピンは描き直すと別の要素になるので、id から探し直す
  // 完了にしてピンが隠れたときや、一覧が描き直されたときは、戻り先がなくなる。そのときはバーの「メモを追加」に戻す
  function restoreFocus(back) {
    var el = typeof back === 'string' ? pinFor(back) : back;
    if (!el || !el.isConnected) el = bar && !bar.hidden ? bar.addBtn : null;
    if (el && typeof el.focus === 'function') el.focus();
  }

  function pinFor(id) {
    if (!layer) return null;
    return Array.prototype.filter.call(layer.children, function (p) { return p.note && p.note.id === id; })[0] || null;
  }

  // 吹き出しを dialog として出す。開く前にフォーカスがあった場所を、閉じたときの戻り先にする
  // title は見出しの文字。要素の配列も渡せる。head を渡すと、見出しと同じ行に並べる
  function showPopover(children, title, returnTo, head) {
    var titleId = 'pn-title-' + (++popoverSeq);
    // 閉じるボタンは、バーと同じく × のアイコンだけにして右上に置く。編集中は「キャンセル」と同じ動きになる
    var close = h('button', { type: 'button', class: 'pn-x', 'aria-label': t('close'), title: t('close'), onclick: closePopover }, [iconEl('x')]);
    var heading = typeof title === 'string' ? h('h2', { class: 'pn-title', id: titleId, text: title }) : h('h2', { class: 'pn-title', id: titleId }, title);
    var top = head ? h('div', { class: 'pn-headrow' }, [heading].concat(head)) : heading;
    popover = h('div', { class: 'pn-pop', 'data-asternote': '', role: 'dialog', 'aria-labelledby': titleId, tabindex: '-1' },
      [top, close].concat(children));
    popover.returnTo = returnTo || (document.activeElement !== document.body ? document.activeElement : null);
    document.body.appendChild(popover);
    updateBarVisibility();
    // 中身が増えて高さが変わったら、置き直す。エラーや確認の文言が出て、画面の下にはみ出すことがあるため
    if (window.ResizeObserver) {
      if (!popoverObserver) popoverObserver = new ResizeObserver(function () { movePopover(); });
      popoverObserver.observe(popover);
    }
  }
  var popoverSeq = 0;
  var popoverObserver = null;

  // 吹き出しを閉じてよければ閉じる。書きかけの内容があるときは閉じずに false を返し、編集欄に案内を出す
  // 外側のクリック、Esc、ピンのドラッグ、別のピンやメモを開く操作はすべてこれを通す
  function requestClosePopover(mode) {
    if (!popover) return true;
    if (popover.isDirty && popover.isDirty()) {
      if (popover.warn) popover.warn();
      return false;
    }
    closePopover(mode);
    return true;
  }

  function openEditor(note, anchor) {
    if (!requestClosePopover()) return;
    // 上限は api.php と同じ。超えた分が黙って切られないように、入力の時点で止める
    var body = h('textarea', { placeholder: t('editor.bodyPlaceholder'), 'aria-label': t('editor.body'), maxlength: '2000', 'data-user-text': '' });
    body.value = note ? note.body : '';
    var author = h('input', { type: 'text', 'data-user-text': '', placeholder: ANONYMOUS, 'aria-label': t('editor.name'), autocomplete: 'name', maxlength: '40', value: (note && note.author) || ls.get('asternote:author') || '' });
    // 種類と重要度は、押して選ぶボタンの並び。選んでいるものは aria-pressed で示す
    var segment = function (label, options, current) {
      var group = h('div', { class: 'pn-seg', role: 'group', 'aria-label': label });
      group.value = current;
      options.forEach(function (o) {
        var btn = h('button', { type: 'button', 'aria-pressed': String(o.value === current), title: o.title || '' });
        if (o.label) btn.setAttribute('aria-label', o.label);
        if (o.icon) btn.appendChild(iconEl(o.icon));
        btn.appendChild(o.el || document.createTextNode(o.text));
        btn.addEventListener('click', function () {
          group.value = o.value;
          Array.prototype.forEach.call(group.children, function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        });
        group.appendChild(btn);
      });
      return group;
    };
    var kind = segment(t('editor.kind'), KINDS.map(function (k) { return { value: k.key, text: k.label, icon: k.icon }; }), kindOf(note && note.kind).key);
    var importance = segment(t('importance'), [0, 1, 2, 3].map(function (n) {
      // 星だけのボタンは、読み上げで「重要度 2」と読ませる
      var name = n ? t('importance.n', { n: n }) : t('importance.noneLabel');
      return { value: n, text: n ? stars(n) : t('importance.none'), label: name, title: name };
    }), importanceOf(note));
    // 保存と削除は同時に走らせない。どちらかの通信中は、もう一方も受け付けない
    // 無効は aria-disabled で示す。disabled にするとフォーカスが body に外れるため
    // 文字は変えない。幅が変わって隣のボタンがずれるため。進み具合は読み上げ用の欄で伝える
    var busy = false;
    var setBusy = function (on, message) {
      busy = on;
      [save, del].forEach(function (b) {
        if (!b) return;
        if (on) b.setAttribute('aria-disabled', 'true');
        else b.removeAttribute('aria-disabled');
      });
      progress.textContent = on ? message : '';
    };
    // 通信が終わったときに、別の吹き出しに切り替わっていたら閉じない
    var self = null;
    var closeSelf = function () { if (popover === self) closePopover(); };
    var save = h('button', {
      type: 'button', class: 'pn-btn pn-btn--primary', text: t('editor.save'), title: t('editor.saveTitle'),
      onclick: function () {
        if (busy) return;
        var text = body.value.trim();
        if (!text) { error.textContent = t('editor.empty'); body.focus(); return; }
        setBusy(true, t('editor.saving'));
        error.textContent = '';
        ls.set('asternote:author', author.value.trim());
        // 完了かどうかは閲覧の吹き出しで切り替える。新しいメモは api.php が未完了で作る
        var fields = { body: text, author: author.value.trim(), kind: kind.value, importance: importance.value };
        var p = note
          ? store.update(note.id, fields)
          : store.create(Object.assign({ page: pagePath(), title: document.title }, anchor, fields));
        p.then(function (saved) {
          if (!note && saved && saved.id) self.returnTo = saved.id;
          return refresh();
        }).then(closeSelf).catch(function (err) {
          // 書いた文章を失わないよう、吹き出しは閉じずに再送できる状態に戻す
          setBusy(false);
          error.textContent = t('error.saveFailed') + t('error.colon') + (err && err.message ? err.message : err);
          refresh();
        });
      },
    });
    var cancel = h('button', { type: 'button', class: 'pn-btn', text: t('editor.cancel'), onclick: closePopover });
    // 削除は、めったに使わないので編集の吹き出しに置く。ゴミ箱のアイコンだけにし、名前は aria-label で付ける
    // 1回目は「本当に削除？」と出すだけにし、2回目で消す。書きかけの内容があっても削除を優先する
    // 確認の状態は、フォーカスが外れたら解く。あとで誤って押したときに、確認なしで消えないようにする
    var setConfirm = function (on) {
      del.dataset.confirm = on ? '1' : '';
      var name = on ? t('editor.confirmDelete') : t('editor.delete');
      del.setAttribute('aria-label', name);
      del.title = name;
      if (on) del.appendChild(h('span', { text: name }));
      else if (del.lastChild.nodeName === 'SPAN' && !del.lastChild.classList.contains('pn-icon')) del.lastChild.remove();
    };
    var del = note ? h('button', {
      type: 'button', class: 'pn-btn pn-btn--danger pn-btn--icon', 'aria-label': t('editor.delete'), title: t('editor.delete'),
      onclick: function () {
        if (busy) return;
        if (del.dataset.confirm !== '1') { setConfirm(true); return; }
        setBusy(true, t('editor.deleting'));
        error.textContent = '';
        // 消したメモのピンには戻れないので、フォーカスはバーの「メモを追加」に戻す
        self.returnTo = bar.addBtn;
        store.remove(note.id).then(refresh).then(closeSelf).catch(function (err) {
          // 失敗したら吹き出しは閉じない。書きかけの内容を残し、理由を吹き出しの中に出す
          setBusy(false);
          setConfirm(false);
          self.returnTo = returnTo;
          error.textContent = t('error.deleteFailed') + t('error.colon') + (err && err.message ? err.message : err);
          refresh();
        });
      },
    }, [iconEl('trash-2')]) : null;
    if (del) del.addEventListener('blur', function () { if (!busy && del.dataset.confirm === '1') setConfirm(false); });
    // 新しいメモは、保存したらそのピンに、やめたら開く前の場所にフォーカスを戻す
    var returnTo = note ? note.id : null;
    var error = h('p', { class: 'pn-error', role: 'alert' });
    var progress = h('p', { class: 'pn-sr', role: 'status' });
    // ⌘ / Ctrl + Enter で保存する。日本語の変換中の Enter は無視する
    var saveByKey = function (e) {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      save.click();
    };

    var initialBody = body.value;
    var initialAuthor = author.value;
    var initialKind = kind.value;
    var initialImportance = importance.value;
    showPopover([
      h('div', { class: 'pn-label', text: t('editor.kind') }),
      kind,
      h('div', { class: 'pn-label', text: t('editor.body') }),
      body,
      h('div', { class: 'pn-label', text: t('importance') }),
      importance,
      // 名前はメモの中身ではないので、罫線で分けて保存の直前に置く
      h('div', { class: 'pn-sep' }, [h('div', { class: 'pn-label', text: t('editor.name') }), author]),
      error,
      progress,
      h('div', { class: 'pn-row' }, [save, cancel]),
      // 削除は最初から別の行に置く。確認の文字が出ても同じ行の中で伸びるだけで、吹き出しの高さが変わらない
      del ? h('div', { class: 'pn-row' }, [del]) : null,
    ], note ? t('editor.edit') : t('editor.new'), returnTo);
    self = popover;
    // 書きかけの内容があるかどうか。本文、名前、状態、種類、重要度のどれかが開いたときから変わっていれば書きかけとする
    popover.isDirty = function () {
      return body.value !== initialBody || author.value !== initialAuthor ||
        kind.value !== initialKind || importance.value !== initialImportance;
    };
    popover.warn = function () {
      error.textContent = t('editor.dirty');
      body.focus();
    };
    // 吹き出しのどこにフォーカスがあっても ⌘ / Ctrl + Enter で保存する。種類や重要度のボタンを押したあとでも効くように、
    // 捕捉段階で受け取り、ボタンの Enter による選択より先に処理する
    popover.addEventListener('keydown', saveByKey, true);
    popover.target = note || anchor;
    popover.isNew = !note;
    popover.targetEl = findAnchor(popover.target);
    if (popover.isNew) renderPins();
    movePopover();
    body.focus();
  }

  function openViewer(note, returnTo) {
    if (!requestClosePopover()) return;
    state.openId = note.id;
    var s = statusOf(note.status);
    var done = s.key === 'done';
    var toggleDone = h('button', {
      type: 'button', class: 'pn-btn' + (done ? '' : ' pn-btn--primary'),
      onclick: function () {
        if (toggleDone.disabled) return;
        toggleDone.disabled = true;
        // 通信の間にほかの吹き出しを開いていたら、それは閉じない。書きかけの内容を守るため
        store.update(note.id, { status: done ? 'open' : 'done' }).then(refresh).then(function () {
          if (popover === viewer) closePopover();
        }).catch(function (err) {
          toggleDone.disabled = false;
          saveFailed(err);
        });
      },
    }, done ? [h('span', { text: t('viewer.reopen') })] : label('check', t('viewer.done')));
    var edit = h('button', { type: 'button', class: 'pn-btn', onclick: function () { openEditor(note); } }, label('pencil', t('viewer.edit')));
    // ドラッグを使わずにピンを動かす。押したあと移動先をクリックする。キーボードでは十字のカーソルで選ぶ
    var move = h('button', {
      type: 'button', class: 'pn-btn',
      onclick: function (e) {
        if (!pinFor(note.id)) return;
        closePopover(KEEP_FOCUS);
        setPlacing(true, { move: note.id, keyboard: e.detail === 0 });
      },
    }, label('move', t('viewer.move')));
    var k = kindOf(note.kind);
    var kindLabel = h('span', { class: 'pn-kind' }, [iconEl(k.icon), document.createTextNode(k.label)]);
    var imp = importanceOf(note);
    var num = sorted().map(function (n) { return n.id; }).indexOf(note.id) + 1;
    // 見出しは「#5」と短く見せ、種類と状態を同じ行に並べる。読み上げでは「メモ 5」と読ませる
    // 本文は文字を大きくし、上下の罫線で区切って、目が向くようにする
    var title = num > 0
      ? [h('span', { 'aria-hidden': 'true', text: '#' + num }), h('span', { class: 'pn-sr', text: t('viewer.note', { n: num }) })]
      : t('viewer.noteNoNum');
    showPopover([
      h('p', { class: 'pn-body pn-body--view', 'data-user-text': '', text: note.body }),
      metaEl('div', note),
      h('div', { class: 'pn-row' }, [toggleDone, edit, move]),
    ], title, returnTo || note.id, [kindLabel, done ? statusTag(s) : null, imp ? starsEl(imp) : null]);
    var viewer = popover;
    popover.target = note;
    popover.targetEl = findAnchor(note);
    movePopover();
    // キーボードで開いたときに、読み上げとフォーカスが吹き出しに移るようにする
    popover.focus({ preventScroll: true });
  }

  // 完了かどうかのラベル。色に加えて、完了にはアイコンも付ける
  // 未完了は、メモが残っていればそうなので、文字では出さない。一覧では番号だけを出す
  // 読み上げでは状態が分かるように、見えない文字で「未完了」を足す
  function statusTag(s, prefix) {
    var tag = h('span', { class: 'pn-tag', 'data-status': s.key });
    if (s.icon) tag.appendChild(iconEl(s.icon));
    if (s.key === 'open') {
      tag.appendChild(document.createTextNode((prefix || '').trim()));
      tag.appendChild(h('span', { class: 'pn-sr', text: t('sep') + s.label }));
    } else {
      tag.appendChild(document.createTextNode((prefix || '') + s.label));
    }
    return tag;
  }

  function toggleList() {
    if (!listPanel) {
      listPanel = h('div', { class: 'pn-list', 'data-asternote': '', role: 'region', 'aria-label': t('list.region'), id: 'pn-list', hidden: '' });
      bar.listBtn.setAttribute('aria-controls', 'pn-list');
      document.body.appendChild(listPanel);
      if (offsetObserver) offsetObserver.observe(listPanel);
    }
    listPanel.hidden = !listPanel.hidden;
    bar.listBtn.setAttribute('aria-expanded', String(!listPanel.hidden));
    // 一覧と設定は同じ場所に開くので、同時には開かない
    if (!listPanel.hidden) { closeSettings(false); renderList(); }
    updateBarVisibility();
    layoutBar();
  }

  // 画面下端から、バーや一覧の上端までの高さ。左下に置くほかの部品がこの分だけ上に逃げられるようにする
  // 余白は含めない。使う側で足す。
  // 画面の高さから引き算すると、スマホで URL バーが出入りしたときにずれる。CSS の bottom と要素の高さから求める
  var offsetObserver = null;
  function updateOffset() {
    var style = document.documentElement.style;
    // 下の辺以外にバーがあるときは、左下の部品と重ならないので設定しない
    if (!state.enabled || !bar || bar.hidden || prefs.edge !== 'bottom') {
      style.removeProperty('--asternote-offset');
      return;
    }
    var reach = function (el) { return (parseFloat(getComputedStyle(el).bottom) || 0) + el.offsetHeight; };
    var offset = reach(bar);
    if (isOpen(listPanel)) offset = Math.max(offset, reach(listPanel));
    if (isOpen(settingsPanel)) offset = Math.max(offset, reach(settingsPanel));
    style.setProperty('--asternote-offset', Math.round(offset) + 'px');
  }

  // ---------- バーの位置と設定 ----------
  var EDGE_GAP = 12;
  var isOpen = function (el) { return !!el && !el.hidden; };

  // バーを出すかどうか。「バーを非表示」がオンのときは、操作の途中と、エラーを出している間だけ出す
  var barHeld = false;
  var errorUntil = 0;
  // 押し終わるまでバーを出しておく。click は pointerup のあとに届くので、そのあとで外す
  function holdBar() {
    if (barHeld) return;
    barHeld = true;
    var release = function () {
      document.removeEventListener('pointerup', release, true);
      document.removeEventListener('pointercancel', release, true);
      setTimeout(function () { barHeld = false; updateBarVisibility(); }, 0);
    };
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
  }
  function updateBarVisibility() {
    if (!bar) return;
    var show = state.enabled && (!prefs.hideBar || state.placing || !!popover || isOpen(listPanel) || isOpen(settingsPanel) ||
      barHeld || Date.now() < errorUntil);
    if (bar.hidden !== !show) {
      bar.hidden = !show;
      layoutBar();
    }
  }

  // バー、起動ボタン、一覧と設定を置き直し、避ける高さを更新する
  function layoutBar() {
    if (!bar) return;
    if (!bar.hidden) placeOnEdge(bar);
    if (launcher && !launcher.hidden) placeOnEdge(launcher);
    placePanel(listPanel);
    placePanel(settingsPanel);
    updateOffset();
  }

  // 要素を、設定した辺の位置に置く。辺の端に近い側から測る
  // 右寄りの要素を左から測ると、幅が増えたときに画面の外へはみ出すため
  function placeOnEdge(el) {
    var root = document.documentElement;
    var s = el.style;
    var horizontal = prefs.edge === 'top' || prefs.edge === 'bottom';
    var room = horizontal ? root.clientWidth - el.offsetWidth : root.clientHeight - el.offsetHeight;
    var range = Math.max(0, room - EDGE_GAP * 2);
    var near = prefs.t <= 0.5;
    var along = Math.round(EDGE_GAP + (near ? prefs.t : 1 - prefs.t) * range) + 'px';
    var across = EDGE_GAP + 'px';
    s.left = s.right = s.top = s.bottom = 'auto';
    el.dataset.edge = prefs.edge;
    if (horizontal) {
      s[near ? 'left' : 'right'] = along;
      s[prefs.edge] = across;
    } else {
      s[near ? 'top' : 'bottom'] = along;
      s[prefs.edge] = across;
    }
  }

  // 一覧と設定は、バーから画面の内側に向けて開く。入りきらない分は中をスクロールする
  function placePanel(panel) {
    if (!isOpen(panel) || bar.hidden) return;
    var root = document.documentElement;
    var vw = root.clientWidth;
    var vh = root.clientHeight;
    var r = bar.getBoundingClientRect();
    var s = panel.style;
    var w = panel.offsetWidth;
    // 一覧は長くなるので画面の 60% までにする。設定は短いので、空いている高さいっぱいまで使う
    var cap = function (px) { return panel === listPanel ? 'min(60vh, ' + px + 'px)' : px + 'px'; };
    var left = (r.left + r.right) / 2 < vw / 2 ? r.left : r.right - w;
    s.left = Math.round(Math.min(Math.max(EDGE_GAP, left), vw - w - EDGE_GAP)) + 'px';
    s.right = 'auto';
    if ((r.top + r.bottom) / 2 < vh / 2) {
      s.top = Math.round(r.bottom + 8) + 'px';
      s.bottom = 'auto';
      s.maxHeight = cap(Math.max(120, Math.round(vh - r.bottom - 8 - EDGE_GAP)));
    } else {
      // 下から測る。避ける高さを、CSS の bottom と要素の高さから求めるため
      s.bottom = Math.round(vh - r.top + 8) + 'px';
      s.top = 'auto';
      s.maxHeight = cap(Math.max(120, Math.round(r.top - 8 - EDGE_GAP)));
    }
  }

  // 画面上の四角から、いちばん近い辺と、辺に沿った割合を求める。端から 24px 以内なら角に寄せる
  var CORNER_SNAP = 24;
  function edgeFromRect(r) {
    var root = document.documentElement;
    var vw = root.clientWidth;
    var vh = root.clientHeight;
    var gaps = { left: r.left, right: vw - r.right, top: r.top, bottom: vh - r.bottom };
    // 横幅いっぱいに近いバーは、左右の辺との距離がいつも小さい。上か下の辺だけから選ぶ
    var candidates = r.width >= vw - (EDGE_GAP + CORNER_SNAP) * 2 ? ['top', 'bottom'] : EDGES;
    var edge = candidates.reduce(function (a, b) { return gaps[b] < gaps[a] ? b : a; });
    var horizontal = edge === 'top' || edge === 'bottom';
    var start = horizontal ? r.left : r.top;
    var range = (horizontal ? vw - r.width : vh - r.height) - EDGE_GAP * 2;
    var t = range > 0 ? (start - EDGE_GAP) / range : 0;
    if (range <= 0 || start - EDGE_GAP < CORNER_SNAP) t = 0;
    else if (range - (start - EDGE_GAP) < CORNER_SNAP) t = 1;
    t = Math.min(1, Math.max(0, t));
    // 左右の辺の端は、上か下の辺の角として持つ
    if (!horizontal && (t === 0 || t === 1)) {
      var x = edge === 'left' ? 0 : 1;
      edge = t === 0 ? 'top' : 'bottom';
      t = x;
    }
    return { edge: edge, t: t };
  }

  function setBarPosition(edge, t) {
    prefs.edge = edge;
    prefs.t = t;
    savePrefs();
    layoutBar();
    syncSettings();
  }

  // つまみのドラッグ。動かしている間は指に付いていき、離したらいちばん近い辺に吸い付く
  function onGripDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    var grip = e.currentTarget;
    var r = bar.getBoundingClientRect();
    var dx = e.clientX - r.left;
    var dy = e.clientY - r.top;
    var root = document.documentElement;
    try { grip.setPointerCapture(e.pointerId); } catch (err) { /* 捕捉できなくても動かせる */ }
    bar.classList.add('is-moving');
    var startX = e.clientX;
    var startY = e.clientY;
    var moved = false;
    var move = function (ev) {
      if (!moved && Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
      moved = true;
      var s = bar.style;
      s.right = s.bottom = 'auto';
      s.left = Math.round(Math.min(Math.max(0, ev.clientX - dx), root.clientWidth - bar.offsetWidth)) + 'px';
      s.top = Math.round(Math.min(Math.max(0, ev.clientY - dy), root.clientHeight - bar.offsetHeight)) + 'px';
      placePanel(listPanel);
      placePanel(settingsPanel);
    };
    var end = function (ev) {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', end);
      grip.removeEventListener('pointercancel', end);
      bar.classList.remove('is-moving');
      if (ev.type === 'pointercancel' || !moved) { layoutBar(); return; }
      var p = edgeFromRect(bar.getBoundingClientRect());
      setBarPosition(p.edge, p.t);
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }

  // ---------- キーボード操作 ----------
  // メモを開いているときだけ効く。閉じているときは、ページの操作の邪魔をしない
  // 入力中の文字や、ブラウザとページのショートカットも横取りしない
  function isShortcut(e) {
    if (!state.enabled || !prefs.key || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return false;
    if (!e.key || e.key.length !== 1 || e.key.toLowerCase() !== prefs.keyChar) return false;
    // Shadow DOM の中の入力欄では、e.target が外側の要素になる。実際に押された要素で確かめる
    var t = (e.composedPath && e.composedPath()[0]) || e.target;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return false;
    // 吹き出しや設定のボタンを操作している間も反応しない。押すと、開いているものが閉じてしまうため
    if (t && t.nodeType === 1 && ((popover && popover.contains(t)) || (settingsPanel && settingsPanel.contains(t)))) return false;
    return true;
  }

  function onShortcut() {
    setPlacing(!state.placing);
  }

  // ---------- 設定のパネル ----------
  var POSITIONS = [
    [t('pos.tl'), 'top', 0], [t('pos.t'), 'top', 0.5], [t('pos.tr'), 'top', 1],
    [t('pos.l'), 'left', 0.5], null, [t('pos.r'), 'right', 0.5],
    [t('pos.bl'), 'bottom', 0], [t('pos.b'), 'bottom', 0.5], [t('pos.br'), 'bottom', 1],
  ];

  function toggleSettings() {
    if (isOpen(settingsPanel)) closeSettings(true);
    else openSettings();
  }

  function openSettings() {
    if (!settingsPanel) buildSettings();
    if (isOpen(listPanel)) toggleList();
    settingsPanel.hidden = false;
    bar.settingsBtn.setAttribute('aria-expanded', 'true');
    syncSettings();
    if (offsetObserver) offsetObserver.observe(settingsPanel);
    layoutBar();
  }

  // focusBack が true なら、フォーカスを設定ボタンに戻す。バーが隠れるときは戻さない
  function closeSettings(focusBack) {
    if (!isOpen(settingsPanel)) return;
    var hadFocus = settingsPanel.contains(document.activeElement);
    settingsPanel.hidden = true;
    bar.settingsBtn.setAttribute('aria-expanded', 'false');
    if (offsetObserver) offsetObserver.unobserve(settingsPanel);
    updateBarVisibility();
    layoutBar();
    if ((focusBack || hadFocus) && !bar.hidden) {
      // 置くモードに入るときは、設定ボタンが隠れている。そのときは「戻る」に移す
      (bar.settingsBtn.hidden ? bar.addBtn : bar.settingsBtn).focus({ preventScroll: true });
    }
  }

  function buildSettings() {
    var close = h('button', { type: 'button', class: 'pn-x', 'aria-label': t('settings.close'), title: t('close'), onclick: function () { closeSettings(true); } }, [iconEl('x')]);
    var keyBox = h('input', { type: 'checkbox' });
    var doneBox = h('input', { type: 'checkbox' });
    var keyInput = h('input', { type: 'text', class: 'pn-key', maxlength: '1', 'aria-label': t('settings.key'), autocomplete: 'off', spellcheck: 'false' });
    var keyError = h('p', { class: 'pn-field-error', role: 'alert' });
    var hideBox = h('input', { type: 'checkbox' });
    var pos = h('div', { class: 'pn-seg pn-pos', role: 'group', 'aria-label': t('settings.pos') });
    POSITIONS.forEach(function (p) {
      if (!p) { pos.appendChild(h('span', {})); return; }
      pos.appendChild(h('button', {
        type: 'button', 'aria-pressed': 'false', 'data-edge': p[1], 'data-t': String(p[2]),
        onclick: function () { setBarPosition(p[1], p[2]); },
      }, [document.createTextNode(p[0])]));
    });
    var reset = h('button', { type: 'button', class: 'pn-btn', text: t('settings.reset'), onclick: function () { setBarPosition(DEFAULT_PREFS.edge, DEFAULT_PREFS.t); } });
    // バーの位置は、めったに変えないので畳んでおく
    var posBody = h('div', { id: 'pn-settings-pos', hidden: '' }, [pos, h('div', { class: 'pn-row' }, [reset])]);
    var posToggle = h('button', {
      type: 'button', class: 'pn-disclosure', 'aria-expanded': 'false', 'aria-controls': 'pn-settings-pos',
      onclick: function () {
        posBody.hidden = !posBody.hidden;
        posToggle.setAttribute('aria-expanded', String(!posBody.hidden));
      },
    }, [h('span', { text: t('settings.pos') }), iconEl('chevron-down')]);
    // 版の番号は、GitHub のリポジトリへのリンクにする。新しいタブで開くことを、アイコンと読み上げで示す
    var repo = h('a', { href: 'https://github.com/hgw/asternote', target: '_blank', rel: 'noopener noreferrer' }, [
      h('span', { class: 'pn-ver', text: 'Asternote v' + VERSION }),
      iconEl('external-link'),
      h('span', { class: 'pn-sr', text: t('newTab') }),
    ]);

    keyBox.addEventListener('change', function () {
      prefs.key = keyBox.checked;
      // キーをオフにすると、隠したバーを戻す手段がなくなる。隠すのもやめる
      if (!prefs.key) prefs.hideBar = false;
      savePrefs();
      syncSettings();
    });
    keyInput.addEventListener('input', function () {
      var v = keyInput.value.trim().toLowerCase();
      if (KEY_CHAR.test(v)) {
        prefs.keyChar = v;
        savePrefs();
        keyError.textContent = '';
      } else {
        keyError.textContent = v ? t('settings.keyInvalid') : t('settings.keyEmpty');
      }
    });
    // 正しくない値のまま離れたら、保存してある値に戻す
    keyInput.addEventListener('blur', function () {
      keyInput.value = prefs.keyChar;
      keyError.textContent = '';
    });
    doneBox.addEventListener('change', function () {
      state.showDone = doneBox.checked;
      ls.set(KEY + 'showDone', state.showDone ? '1' : '0');
      if (popover && popover.target && popover.target.status === 'done' && !state.showDone) requestClosePopover();
      renderPins();
    });
    hideBox.addEventListener('change', function () {
      prefs.hideBar = hideBox.checked;
      // 隠したバーはキーで出すので、キーもオンにする
      if (prefs.hideBar) prefs.key = true;
      savePrefs();
      syncSettings();
    });

    settingsPanel = h('div', { class: 'pn-settings', 'data-asternote': '', role: 'region', 'aria-labelledby': 'pn-settings-title', id: 'pn-settings', hidden: '' }, [
      h('h2', { class: 'pn-title', id: 'pn-settings-title', text: t('settings.title') }),
      close,
      h('label', { class: 'pn-check' }, [doneBox, document.createTextNode(t('settings.showDone'))]),
      h('label', { class: 'pn-check' }, [keyBox, document.createTextNode(t('settings.keyboard'))]),
      h('div', { class: 'pn-field' }, [h('span', { text: t('settings.key') }), keyInput]),
      keyError,
      h('label', { class: 'pn-check' }, [hideBox, document.createTextNode(t('settings.hideBar'))]),
      h('p', { class: 'pn-sub', text: t('settings.hideBarNote') }),
      posToggle,
      posBody,
      h('p', { class: 'pn-foot' }, [repo]),
    ]);
    settingsPanel.parts = { keyBox: keyBox, doneBox: doneBox, keyInput: keyInput, keyError: keyError, hideBox: hideBox, pos: pos };
    document.body.appendChild(settingsPanel);
  }

  // 設定の値を、パネルの表示にそろえる
  function syncSettings() {
    if (!settingsPanel) return;
    var p = settingsPanel.parts;
    p.keyBox.checked = prefs.key;
    p.doneBox.checked = state.showDone;
    // キーボード操作がオフのときは、キーの欄を使えないようにする
    p.keyInput.disabled = !prefs.key;
    if (document.activeElement !== p.keyInput) p.keyInput.value = prefs.keyChar;
    p.hideBox.checked = prefs.hideBar;
    Array.prototype.forEach.call(p.pos.querySelectorAll('button'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.edge === prefs.edge && Number(b.dataset.t) === prefs.t));
    });
  }

  function renderList() {
    listPanel.textContent = '';
    var items = visibleNumbered();
    if (!items.length) {
      var hidden = state.notes.length - items.length;
      var text = hidden ? t(hidden === 1 ? 'list.doneHidden1' : 'list.doneHidden', { n: hidden }) : t('list.empty');
      listPanel.appendChild(h('p', { class: 'pn-empty', text: text }));
      return;
    }
    listPanel.appendChild(h('ol', {}, items.map(function (item) {
      var n = item.note;
      var i = item.num - 1;
      var s = statusOf(n.status);
      // キーボードでも開けるように、項目の中身をボタンにする。ボタンの中に置けるのは span だけ
      var item = h('button', {
        type: 'button', class: 'pn-item',
        onclick: function () {
          var pos = positionOf(n);
          window.scrollTo({ top: Math.max(0, pos.y - 120), behavior: 'smooth' });
          openViewer(n, item);
        },
      }, [
        h('span', { class: 'pn-head' }, [
          statusTag(s, (i + 1) + ' '),
          isMemo(kindOf(n.kind)) ? null : h('span', { class: 'pn-kind' }, [iconEl(kindOf(n.kind).icon), h('span', { text: kindOf(n.kind).label })]),
          importanceOf(n) ? starsEl(importanceOf(n)) : null,
        ]),
        h('span', { class: 'pn-line', 'data-user-text': '', text: n.body.length > 60 ? n.body.slice(0, 60) + '…' : n.body }),
        metaEl('span', n, 'pn-line'),
      ]);
      return h('li', {}, [item]);
    })));
  }

  // 名前と日時の行。一覧ではボタンの中に置くので、要素の種類を選べるようにする
  function metaEl(tag, note, extra) {
    return h(tag, { class: 'pn-meta' + (extra ? ' ' + extra : '') }, [
      note.author ? h('span', { 'data-user-text': '', text: note.author }) : document.createTextNode(ANONYMOUS),
      document.createTextNode('｜'),
      timeEl(note.updatedAt || note.createdAt),
    ]);
  }

  // 1週間未満は「5分前」のように相対で、それより前は日付で書く。正確な日時は title で見られる
  // 相対の表示は、吹き出しや一覧を描いた時点で決める。開いたまま時間がたっても書き換えない
  var WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  function timeEl(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return h('span', {});
    return h('time', { datetime: d.toISOString(), title: formatDate(d, true), text: relativeDate(d, new Date()) });
  }

  function relativeDate(d, now) {
    var diff = now - d;
    // 端末の時計のずれで未来の日時になったときも「たった今」にする
    if (diff < 60 * 1000) return t('time.now');
    if (diff >= WEEK_MS) return formatDate(d, false);
    var min = Math.floor(diff / 60000);
    if (min < 60) return t('time.min', { n: min });
    var hours = Math.floor(min / 60);
    if (hours < 24) return t('time.hour', { n: hours });
    var days = Math.floor(hours / 24);
    return t(days === 1 ? 'time.day1' : 'time.day', { n: days });
  }

  function formatDate(d, withTime) {
    var p = function (n) { return String(n).padStart(2, '0'); };
    var date = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    return withTime ? date + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) : date;
  }

  // 「バーを非表示」がオンでも、エラーは 8 秒バーを出して見せる。札は省略されることがあるので、全文を title にも入れる
  var ERROR_MS = 8000;
  function showError(prefix, err) {
    var text = prefix + t('error.colon') + (err && err.message ? err.message : err);
    bar.hint.textContent = text;
    bar.hint.title = text;
    errorUntil = Date.now() + ERROR_MS;
    updateBarVisibility();
    setTimeout(updateBarVisibility, ERROR_MS + 50);
  }

  // 保存に失敗したら、一覧を読み直す。ほかの人が消したメモのピンが残り続けないようにする
  // 吹き出しは閉じない。失敗したのは前の操作で、今開いている吹き出しとは関係ないことがあるため
  function saveFailed(err) {
    refresh().then(function () { showError(t('error.saveFailed'), err); });
  }

  // 消えない通知。hint は操作の案内で上書きされるので、保存先や保存データの状態はこちらに出す
  // 退避の通知は、管理者が見るまで残す。一覧の読み込みで消すのは、壊れたデータの通知だけ
  var pendingNotice = '';
  var noticeKind = '';
  function setNotice(text, kind) {
    noticeKind = text ? (kind || '') : '';
    if (!bar) { pendingNotice = text; return; }
    bar.notice.textContent = text;
    bar.notice.title = text;
    bar.notice.hidden = !text;
  }

  // 読み込みが重なったら、最後に送ったものの結果だけを使う。古い一覧で新しいピンを消さないため
  var refreshSeq = 0;
  function refresh() {
    var seq = ++refreshSeq;
    return store.list(pagePath()).then(function (notes) {
      if (seq !== refreshSeq) return;
      state.notes = notes || [];
      renderPins();
    }).catch(function (err) {
      if (seq === refreshSeq) showError(t('error.loadFailed'), err);
    });
  }

  function notify() {
    listeners.forEach(function (fn) { try { fn(state.enabled); } catch (e) { /* 呼び出し側の失敗は無視 */ } });
  }

  // ---------- 公開 API ----------
  // build() の前に呼ばれた操作は、準備ができてから呼ばれた順に実行する
  var resolveReady;
  var ready = new Promise(function (resolve) { resolveReady = resolve; });
  var queued = false;
  var whenReady = function (name) {
    return function () {
      queued = true;
      return ready.then(function () { return api[name](); });
    };
  };
  var api = {
    // remember が false のときは選択として保存しない。data-default による初期表示で使う
    enable: function (remember) {
      if (!bar) return whenReady('enable')();
      state.enabled = true;
      if (remember !== false) ls.set(KEY + 'enabled', '1');
      if (launcher) launcher.hidden = true;
      updateBarVisibility();
      layoutBar();
      notify();
      return refresh();
    },
    disable: function () {
      if (!bar) return whenReady('disable')();
      state.enabled = false;
      ls.set(KEY + 'enabled', '0');
      if (cancelGesture) cancelGesture();
      setPlacing(false);
      closePopover(); // 非表示にするときは、書きかけでも閉じる
      if (listPanel) listPanel.hidden = true;
      bar.listBtn.setAttribute('aria-expanded', 'false');
      closeSettings(false);
      bar.hidden = true;
      if (launcher) launcher.hidden = false;
      layoutBar();
      renderPins();
      notify();
    },
    toggle: function () {
      if (!bar) return whenReady('toggle')();
      return state.enabled ? api.disable() : api.enable();
    },
    isEnabled: function () { return state.enabled; },
    onChange: function (fn) { listeners.push(fn); },
    config: config,
  };
  window.Asternote = api;

  function start() {
    build();
    // 準備前に呼ばれた操作があれば、保存してあった表示状態より優先する
    // 表示・非表示を選んだことがあればそれに従い、なければ data-default の指定に従う
    var saved = ls.get(KEY + 'enabled');
    // 初期表示によるオンは、本人の選択ではないので保存しない
    if (!queued && saved === '1') api.enable();
    else if (!queued && saved === null && config.defaultOn) api.enable(false);
    resolveReady();
    // 準備前の操作が済んでから ready を知らせる
    ready.then(function () { document.dispatchEvent(new CustomEvent('asternote:ready')); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
