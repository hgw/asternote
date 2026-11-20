/*!
 * pin-notes
 * プレビュー画面にピンを立ててメモを残すツール。依存なし。
 *
 * 使い方:
 *   <script src="/pin-notes/pin-notes.js"
 *           data-endpoint="/pin-notes/api.php"
 *           data-project="myproject" defer></script>
 *
 * data-endpoint を省略すると、ブラウザの localStorage に保存する（手元での確認用）。
 * data-endpoint があれば常に api.php に保存する。失敗してもエラーを出すだけで、保存先は切り替えない。
 * data-ui="none" にすると、起動ボタンを出さない。window.PinNotes の API で操作する。
 * data-default="on" にすると、初めて開いた人にもメモを表示する。表示・非表示を選んだあとは、その選択を優先する。
 * メモは、クリックで点、ドラッグで四角の範囲として残せる。打ったピンはドラッグで動かせる。
 * 対応済みのメモは、バーの「対応済みも表示」にチェックを入れたときだけ表示する。
 * data-pin-notes-ignore 属性を付けた要素の中では、メモを置くクリックを横取りしない。
 * 表示中は html に --pin-notes-offset を設定する。値は画面下端からバーや一覧の上端までの高さで、余白は含まない。
 * 左下に置くほかの部品は、この値に余白を足した分だけ上に逃げれば重ならない。
 * 色と角丸は、html などに CSS 変数 --pin-notes-primary などを書くと上書きできる。一覧は injectStyle() にある。
 *
 * MIT License. https://github.com/hgw/pin-notes
 *
 * アイコンは Lucide v1.76.0 の SVG を使っている。https://lucide.dev
 * plus、x、trash-2、check は Feather 由来で MIT License、ほかは ISC License。
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

  var script = document.currentScript;
  var config = {
    endpoint: (script && script.dataset.endpoint) || '',
    project: (script && script.dataset.project) || 'default',
    ui: (script && script.dataset.ui) || 'button',
    defaultOn: !!(script && script.dataset.default === 'on'),
  };

  // 状態の色は CSS の [data-status] で付ける。色だけに頼らないよう、未対応以外はピンにアイコンも出す
  var STATUS = [
    { key: 'open', label: '未対応', icon: null },
    { key: 'decided', label: '決定', icon: 'check' },
    { key: 'done', label: '対応済み', icon: 'check-check' },
  ];
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
    'list': '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>',
    'pencil': '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    'trash-2': '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'check': '<path d="M20 6 9 17l-5-5"/>',
    'check-check': '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
    'sticky-note': '<path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/><path d="M15 3v5a1 1 0 0 0 1 1h5"/>',
    'lightbulb': '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    'wrench': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
    'circle-help': '<circle cx="12" cy="12" r="10"/><path d="M9 9.5a3 2.5 0 016 0c0 2-2 2-3 3.5"/><path d="M12 17h.01"/>',
    'heart': '<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>',
  };
  var KINDS = [
    { key: 'memo', label: 'メモ', icon: 'sticky-note' },
    { key: 'idea', label: 'アイデア', icon: 'lightbulb' },
    { key: 'fix', label: '修正', icon: 'wrench' },
    { key: 'info', label: '質問・情報', icon: 'circle-help' },
    { key: 'like', label: 'いいね', icon: 'heart' },
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
    return h('span', { class: 'pn-stars', role: 'img', 'aria-label': '重要度 ' + n, text: stars(n) });
  };
  // 固定の SVG 文字列からアイコン要素を作る。利用者の入力は入らない
  // 解釈はアイコンごとに1回だけにし、あとは複製して使う。読み上げでは無視させる
  var iconCache = {};
  var iconEl = function (name) {
    if (!iconCache[name]) {
      var span = document.createElement('span');
      span.className = 'pn-icon';
      span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
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
  var KEY = 'pin-notes:' + config.project + ':';

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
        headers: { 'Content-Type': 'application/json', 'X-Pin-Notes': '1' },
        body: JSON.stringify(Object.assign({ project: config.project }, payload)),
      }).then(parse);
    };
    var fail = function (res, message) {
      var err = new Error(message || 'サーバーの応答が不正です（' + res.status + '）');
      err.status = res.status;
      return err;
    };
    // WAF のエラーページや認証切れなど、JSON として読めない応答はステータス付きのエラーにする
    function parse(res) {
      if ((res.headers.get('Content-Type') || '').indexOf('application/json') === -1) return Promise.reject(fail(res));
      return res.json().catch(function () { throw fail(res); }).then(function (data) {
        if (!res.ok) throw fail(res, data && data.error);
        var warning = res.headers.get('X-Pin-Notes-Warning');
        if (warning === 'corrupt-data') {
          setNotice('保存データが壊れているため、空として表示しています。管理者に連絡してください', 'corrupt');
        } else if (warning === 'recovered-from-corrupt-data') {
          setNotice('壊れた保存データを退避して、新しく保存しました。管理者に連絡してください', 'recovered');
        }
        return { data: data, warning: warning };
      });
    }
    return {
      list: function (page) {
        var q = '?project=' + encodeURIComponent(config.project) + '&page=' + encodeURIComponent(page);
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
    var write = function (notes) { ls.set(KEY + 'notes', JSON.stringify(notes)); };
    var now = function () { return new Date().toISOString(); };
    return {
      list: function (page) {
        return Promise.resolve(read().filter(function (n) { return n.page === page; }));
      },
      create: function (note) {
        var n = Object.assign({}, note, { id: Math.random().toString(16).slice(2, 14), createdAt: now(), updatedAt: now() });
        var all = read(); all.push(n); write(all);
        return Promise.resolve(n);
      },
      update: function (id, fields) {
        var all = read(); var found = null;
        all.forEach(function (n) { if (n.id === id) { Object.assign(n, fields, { updatedAt: now() }); found = n; } });
        if (!found) return Promise.reject(new Error('メモが見つかりません'));
        write(all);
        return Promise.resolve(found);
      },
      remove: function (id) {
        var all = read();
        var rest = all.filter(function (n) { return n.id !== id; });
        if (rest.length === all.length) return Promise.reject(new Error('メモが見つかりません'));
        write(rest);
        return Promise.resolve({ ok: true });
      },
    };
  }

  // ---------- 位置の記録と復元 ----------
  var isOwn = function (el) { return el && el.closest && el.closest('[data-pin-notes], [data-pin-notes-ignore]'); };

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

  // 画面上の点にあるページの要素を返す。ツール自身の UI と、data-pin-notes-ignore の中は飛ばす
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
  var layer, bar, popover, listPanel, launcher;
  var listeners = [];

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }

  function injectStyle() {
    // 色と角丸。導入先は --pin-notes-* で上書きできる。初期値は WCAG 2.2 AA を満たす
    // 文字は背景に対して 4.5:1 以上、入力欄の枠とフォーカスリングは 3:1 以上。変えるときもこの比を保つ
    var vars = [
      ['fg', '#09090b'], ['muted', '#52525b'], ['bg', '#fff'], ['subtle', '#f4f4f5'], ['subtle-hover', '#e4e4e7'],
      ['border', '#e4e4e7'], ['input', '#71717a'], ['primary', '#18181b'], ['primary-fg', '#fafafa'], ['ring', '#18181b'],
      ['danger', '#b91c1c'], ['open', '#c2410c'], ['decided', '#1d4ed8'], ['done', '#52525b'], ['star', '#b45309'], ['radius', '8px'],
    ].map(function (v) { return '--pn-' + v[0] + ':var(--pin-notes-' + v[0] + ',' + v[1] + ')'; }).join(';');
    var css = [
      '[data-pin-notes]{' + vars + ';font:13px/1.5 system-ui,sans-serif;letter-spacing:0;text-transform:none;color:var(--pn-fg);box-sizing:border-box}',
      '[data-pin-notes] *,[data-pin-notes] *::before,[data-pin-notes] *::after{box-sizing:border-box}',
      // display を指定した要素でも hidden 属性で隠れるようにする。指定すると UA の display:none より優先されるため
      '[data-pin-notes][hidden],[data-pin-notes] [hidden]{display:none!important}',
      // ピンのフォーカスリングは白の縁を挟み、どの背景でも見えるようにする
      '[data-pin-notes] :focus-visible,.pn-pin:focus-visible{outline:2px solid var(--pn-ring);outline-offset:2px}',
      '.pn-pin:focus-visible{outline:none;box-shadow:0 0 0 2px #fff,0 0 0 4px var(--pn-ring)}',
      '.pn-icon{display:inline-flex;flex:none;line-height:0}',
      '.pn-icon svg{width:16px;height:16px}',
      '.pn-layer{position:absolute;left:0;top:0;width:0;height:0;z-index:2147483000}',
      // ピンは押せる大きさの基準に合わせて 24px 以上にする
      '.pn-pin{position:absolute;display:inline-flex;align-items:center;justify-content:center;gap:2px;min-width:24px;height:24px;margin:-24px 0 0 -2px;padding:0 6px;border:2px solid #fff;border-radius:12px 12px 12px 3px;color:#fff;font:600 12px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.4);touch-action:none;white-space:nowrap}',
      '.pn-pin .pn-icon svg{width:12px;height:12px;stroke-width:2.5}',
      STATUS.map(function (x) { var a = '[data-status="' + x.key + '"]'; return '[data-pin-notes] ' + a + ',[data-pin-notes]' + a + '{--pn-c:var(--pn-' + x.key + ')}'; }).join(''),
      '.pn-pin,.pn-tag{background:var(--pn-c)}',
      '.pn-area{background:color-mix(in srgb,var(--pn-c) 10%,transparent)}',
      '.pn-pin.is-lost{opacity:.7;outline:2px dashed var(--pn-open);outline-offset:1px}',
      '.pn-pin.is-dragging{cursor:grabbing;opacity:.85}',
      '.pn-area{position:absolute;border:2px solid var(--pn-c);border-radius:4px;pointer-events:none}',
      '.pn-area.is-lost{border-style:dashed;opacity:.6}',
      '.pn-draft{position:fixed;z-index:2147483000;border:2px dashed var(--pn-primary);border-radius:4px;background:rgba(24,24,27,.06);pointer-events:none}',
      'html.pn-placing{touch-action:none;user-select:none}',
      'html.pn-placing,html.pn-placing *{cursor:crosshair!important}',
      'html.pn-placing [data-pin-notes],html.pn-placing [data-pin-notes] *,html.pn-placing [data-pin-notes-ignore],html.pn-placing [data-pin-notes-ignore] *{cursor:auto!important}',
      'html.pn-placing [data-pin-notes] button,html.pn-placing [data-pin-notes-ignore] button,html.pn-placing [data-pin-notes-ignore] a{cursor:pointer!important}',
      // 浮いている面の枠は飾りなので薄くてよい
      '.pn-bar,.pn-pop,.pn-list{border:1px solid var(--pn-border);border-radius:var(--pn-radius);background:var(--pn-bg);box-shadow:0 8px 16px rgba(0,0,0,.12)}',
      '.pn-bar{position:fixed;left:12px;bottom:12px;z-index:2147483001;display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:calc(100vw - 24px);padding:6px}',
      // ボタンは文字で分かるので、枠のコントラストには頼らない
      '.pn-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:32px;padding:0 12px;border:1px solid transparent;border-radius:calc(var(--pn-radius) - 2px);background:var(--pn-subtle);color:var(--pn-fg);font:inherit;font-weight:500;line-height:1;cursor:pointer;white-space:nowrap}',
      '.pn-btn:hover{background:var(--pn-subtle-hover)}',
      '.pn-btn.is-on,.pn-btn--primary{background:var(--pn-primary);color:var(--pn-primary-fg)}',
      '.pn-btn.is-on:hover,.pn-btn--primary:hover{background:color-mix(in srgb,var(--pn-primary) 88%,#fff)}',
      '.pn-btn--danger{background:var(--pn-bg);border-color:var(--pn-danger);color:var(--pn-danger)}',
      '.pn-btn--danger:hover{background:color-mix(in srgb,var(--pn-danger) 8%,#fff)}',
      '.pn-btn:disabled{opacity:.5;cursor:default}',
      '.pn-hint{color:var(--pn-muted)}',
      '.pn-hint:empty{display:none}',
      '.pn-check{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 6px;cursor:pointer;white-space:nowrap}',
      '.pn-check input{width:16px;height:16px;margin:0;accent-color:var(--pn-primary)}',
      '.pn-notice{padding:4px 8px;border:1px solid #fcd34d;border-radius:calc(var(--pn-radius) - 2px);background:#fffbeb;color:#92400e}',
      '.pn-error{margin:8px 0 0;color:var(--pn-danger)}',
      '.pn-error:empty{display:none}',
      '.pn-pop{position:absolute;z-index:2147483002;width:300px;max-width:calc(100vw - 16px);padding:14px}',
      '.pn-pop:focus{outline:none}',
      '.pn-pop textarea,.pn-pop input[type="text"],.pn-pop select{display:block;width:100%;min-height:32px;margin:6px 0;padding:6px 8px;border:1px solid var(--pn-input);border-radius:calc(var(--pn-radius) - 2px);background:var(--pn-bg);color:var(--pn-fg);font:inherit}',
      '.pn-pop textarea{min-height:88px;resize:vertical}',
      '.pn-title{margin:0 0 4px;font-weight:600;font-size:14px}',
      '.pn-label{margin-top:10px;color:var(--pn-muted);font-size:12px;font-weight:500}',
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
      '.pn-line{display:block;margin-top:2px}',
      '.pn-tag{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;color:#fff;font-size:12px;font-weight:500;margin-right:6px}',
      '.pn-tag .pn-icon svg{width:12px;height:12px;stroke-width:2.5}',
      '.pn-list{position:fixed;left:12px;bottom:64px;z-index:2147483001;width:340px;max-width:calc(100vw - 24px);max-height:60vh;overflow:auto;padding:4px}',
      '.pn-list ol{margin:0;padding:0;list-style:none}',
      '.pn-list li+li{border-top:1px solid var(--pn-border)}',
      '.pn-item{display:block;width:100%;padding:8px;border:0;border-radius:calc(var(--pn-radius) - 2px);background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}',
      '.pn-item:hover{background:var(--pn-subtle)}',
      '.pn-empty{margin:0;padding:10px;color:var(--pn-muted)}',
      '.pn-launch{position:fixed;left:12px;bottom:12px;z-index:2147483001;box-shadow:0 4px 8px rgba(0,0,0,.15)}',
    ].join('\n');
    document.head.appendChild(h('style', { 'data-pin-notes-style': '' }, [document.createTextNode(css)]));
  }

  function build() {
    injectStyle();
    layer = h('div', { class: 'pn-layer', 'data-pin-notes': '' });
    document.body.appendChild(layer);

    var addBtn = h('button', { type: 'button', class: 'pn-btn pn-btn--primary', onclick: function () { setPlacing(!state.placing); } }, label('plus', 'メモを追加'));
    var listBtn = h('button', { type: 'button', class: 'pn-btn', 'aria-expanded': 'false', onclick: toggleList }, label('list', '一覧'));
    // 対応済みのメモは、チェックを入れたときだけ表示する。選んだ状態はブラウザに保存する
    state.showDone = ls.get(KEY + 'showDone') === '1';
    var showDoneBox = h('input', { type: 'checkbox' });
    showDoneBox.checked = state.showDone;
    showDoneBox.addEventListener('change', function () {
      state.showDone = showDoneBox.checked;
      ls.set(KEY + 'showDone', state.showDone ? '1' : '0');
      if (popover && popover.target && popover.target.status === 'done' && !state.showDone) requestClosePopover();
      renderPins();
    });
    var showDoneLabel = h('label', { class: 'pn-check' }, [showDoneBox, document.createTextNode('対応済みも表示')]);
    var closeBtn = h('button', { type: 'button', class: 'pn-btn', 'aria-label': 'メモを閉じる', onclick: function () { api.disable(); } }, label('x', '閉じる'));
    // 案内とエラーは、変わったときに読み上げられるようにする
    var hint = h('span', { class: 'pn-hint', 'data-pn-hint': '', role: 'status' });
    var notice = h('span', { class: 'pn-notice', 'data-pn-notice': '', role: 'status', hidden: '' });
    bar = h('div', { class: 'pn-bar', 'data-pin-notes': '', role: 'region', 'aria-label': 'メモ', hidden: '' }, [addBtn, listBtn, showDoneLabel, hint, notice, closeBtn]);
    bar.addBtn = addBtn;
    bar.listBtn = listBtn;
    bar.hint = hint;
    bar.notice = notice;
    if (pendingNotice) setNotice(pendingNotice);
    document.body.appendChild(bar);

    if (config.ui !== 'none') {
      launcher = h('button', { type: 'button', class: 'pn-btn pn-launch', 'data-pin-notes': '', onclick: function () { api.toggle(); } }, label('sticky-note', 'メモ'));
      document.body.appendChild(launcher);
    }

    document.addEventListener('pointerdown', onPlacePointerDown, true);
    document.addEventListener('pointerdown', onOutsidePointerDown, true);
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || e.isComposing || e.keyCode === 229) return;
      if (cancelGesture) cancelGesture(); // 範囲を引いている途中やピンのドラッグ中なら、それを取り消す
      if (state.placing) setPlacing(false);
      else requestClosePopover();
    });
    var reflow = debounce(updatePositions, 100);
    window.addEventListener('resize', reflow);
    // バーや一覧の大きさが変わったら、避ける高さを更新する。一覧の max-height は画面の高さで変わるが、
    // そのときも要素の大きさが変わるので、この監視で拾える。外さないこと
    if (window.ResizeObserver) {
      offsetObserver = new ResizeObserver(updateOffset);
      offsetObserver.observe(bar);
    }
    window.addEventListener('load', reflow);
    if (window.ResizeObserver) new ResizeObserver(reflow).observe(document.body);
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

  function setPlacing(on) {
    if (on && !requestClosePopover()) return;
    state.placing = on;
    document.documentElement.classList.toggle('pn-placing', on);
    bar.addBtn.classList.toggle('is-on', on);
    bar.addBtn.textContent = '';
    label(on ? 'x' : 'plus', on ? 'やめる' : 'メモを追加').forEach(function (el) { bar.addBtn.appendChild(el); });
    bar.hint.textContent = on ? 'クリックで点、ドラッグで範囲を指示' : '';
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
        draft = h('div', { class: 'pn-draft', 'data-pin-notes': '' });
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
      var anchor;
      if (drew) {
        anchor = areaAnchor(s0.x, s0.y, ev.clientX, ev.clientY);
      } else {
        var target = start.target === document.documentElement ? document.body : start.target;
        anchor = pointAnchor(s0.x, s0.y, target);
      }
      setPlacing(false);
      openEditor(null, anchor);
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
    if (!popover || state.placing) return;
    var t = e.target;
    if (popover.contains(t) || (t.closest && t.closest('.pn-pin'))) return;
    requestClosePopover();
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

  // 表示するメモと、その番号。番号は対応済みも含めた作成順で振る。隠しても番号がずれないようにする
  function visibleNumbered() {
    return sorted()
      .map(function (note, i) { return { note: note, num: i + 1 }; })
      .filter(function (x) { return state.showDone || x.note.status !== 'done'; });
  }

  function renderPins() {
    if (!layer) return;
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
        title: (pos.lost ? '（元の要素が見つからない）' : '') + note.body,
        'aria-label': 'メモ ' + num + '、' + st.label + (isMemo(kind) ? '' : '、' + kind.label) + (isArea(note) ? '、範囲' : '') + (imp ? '、重要度 ' + imp : ''),
        'data-status': st.key,
        text: String(num),
        onclick: function (e) {
          e.stopPropagation();
          // ドラッグで動かした直後の click では開かない
          if (takeSwallowedClick()) return;
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
        pin.areaEl = h('div', { class: 'pn-area', 'data-pin-notes': '', 'data-status': st.key });
        layer.appendChild(pin.areaEl);
      }
      pin.addEventListener('pointerdown', function (e) { startPinDrag(e, pin); });
      movePin(pin, pos);
      layer.appendChild(pin);
    });
    if (listPanel && !listPanel.hidden) renderList();
    movePopover();
  }

  function movePin(pin, pos) {
    pin.style.left = pos.x + 'px';
    pin.style.top = pos.y + 'px';
    pin.classList.toggle('is-lost', pos.lost);
    pin.title = (pos.lost ? '（元の要素が見つからない）' : '') + pin.note.body;
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
    if (e.button !== 0) return;
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
    };
    var end = function (ev) {
      var moved = dragging;
      cleanup();
      if (!moved) return;
      swallowNextClick(); // 続く click で内容を開かない
      if (ev.type === 'pointercancel') { updatePositions(); return; }
      var c = clientRect();
      var fields = c.x2 != null ? areaAnchor(c.x, c.y, c.x2, c.y2) : pointAnchor(c.x, c.y);
      // 保存を待たずに新しい位置を反映する。保存までの間に位置を計算し直しても、元の位置に戻らないように
      pin.note = Object.assign({}, pin.note, fields);
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
    placePopover(pos.x, pos.y);
  }

  function placePopover(x, y) {
    var w = 280;
    var left = Math.min(Math.max(8 + window.scrollX, x + 12), window.scrollX + document.documentElement.clientWidth - w - 8);
    popover.style.left = left + 'px';
    popover.style.top = y + 8 + 'px';
  }

  // 吹き出しを必ず閉じる。保存やキャンセルのボタンなど、閉じてよいと決まっているときに使う
  // フォーカスが吹き出しの中にあったときだけ、開く前の場所に戻す。外側をクリックして閉じたときは、押した場所を優先する
  function closePopover() {
    var back = null;
    if (popover) {
      // 保存中にボタンを無効にすると、フォーカスは body に外れる。そのときも戻す
      var active = document.activeElement;
      if (!active || active === document.body || popover.contains(active)) back = popover.returnTo;
      popover.remove();
    }
    popover = null;
    state.openId = null;
    if (back) restoreFocus(back);
  }

  // 戻り先は要素か、メモの id。ピンは描き直すと別の要素になるので、id から探し直す
  function restoreFocus(back) {
    var el = typeof back === 'string' ? pinFor(back) : back;
    if (el && el.isConnected && typeof el.focus === 'function') el.focus();
  }

  function pinFor(id) {
    if (!layer) return null;
    return Array.prototype.filter.call(layer.children, function (p) { return p.note && p.note.id === id; })[0] || null;
  }

  // 吹き出しを dialog として出す。開く前にフォーカスがあった場所を、閉じたときの戻り先にする
  function showPopover(children, title, returnTo) {
    var titleId = 'pn-title-' + (++popoverSeq);
    popover = h('div', { class: 'pn-pop', 'data-pin-notes': '', role: 'dialog', 'aria-labelledby': titleId, tabindex: '-1' },
      [h('h2', { class: 'pn-title', id: titleId, text: title })].concat(children));
    popover.returnTo = returnTo || (document.activeElement !== document.body ? document.activeElement : null);
    document.body.appendChild(popover);
  }
  var popoverSeq = 0;

  // 吹き出しを閉じてよければ閉じる。書きかけの内容があるときは閉じずに false を返し、編集欄に案内を出す
  // 外側のクリック、Esc、ピンのドラッグ、別のピンやメモを開く操作はすべてこれを通す
  function requestClosePopover() {
    if (!popover) return true;
    if (popover.isDirty && popover.isDirty()) {
      if (popover.warn) popover.warn();
      return false;
    }
    closePopover();
    return true;
  }

  function openEditor(note, anchor) {
    if (!requestClosePopover()) return;
    var body = h('textarea', { placeholder: '決まったこと、直したいこと', 'aria-label': '本文' });
    body.value = note ? note.body : '';
    var author = h('input', { type: 'text', placeholder: '名前', 'aria-label': '名前', autocomplete: 'name', value: (note && note.author) || ls.get('pin-notes:author') || '' });
    var status = h('select', { 'aria-label': '状態' }, STATUS.map(function (s) {
      var o = h('option', { value: s.key, text: s.label });
      if ((note ? note.status : 'open') === s.key) o.selected = true;
      return o;
    }));
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
    var kind = segment('種類', KINDS.map(function (k) { return { value: k.key, text: k.label, icon: k.icon }; }), kindOf(note && note.kind).key);
    var importance = segment('重要度', [0, 1, 2, 3].map(function (n) {
      // 星だけのボタンは、読み上げで「重要度 2」と読ませる
      return { value: n, text: n ? stars(n) : 'なし', label: n ? '重要度 ' + n : '重要度の指定なし', title: n ? '重要度 ' + n : '重要度の指定なし' };
    }), importanceOf(note));
    var save = h('button', {
      type: 'button', class: 'pn-btn pn-btn--primary', text: '保存', title: '⌘ / Ctrl + Enter でも保存できる',
      onclick: function () {
        var text = body.value.trim();
        if (!text) { body.focus(); return; }
        if (save.disabled) return;
        save.disabled = true;
        save.textContent = '保存中…';
        error.textContent = '';
        ls.set('pin-notes:author', author.value.trim());
        var fields = { body: text, author: author.value.trim(), status: status.value, kind: kind.value, importance: importance.value };
        var p = note
          ? store.update(note.id, fields)
          : store.create(Object.assign({ page: pagePath(), title: document.title }, anchor, fields));
        p.then(function (saved) {
          if (!note && saved && saved.id) popover.returnTo = saved.id;
          return refresh();
        }).then(closePopover).catch(function (err) {
          // 書いた文章を失わないよう、吹き出しは閉じずに再送できる状態に戻す
          save.disabled = false;
          save.textContent = '保存';
          error.textContent = '保存できませんでした: ' + (err && err.message ? err.message : err);
          refresh();
        });
      },
    });
    var cancel = h('button', { type: 'button', class: 'pn-btn', text: 'キャンセル', onclick: closePopover });
    // 新しいメモは、保存したらそのピンに、やめたら開く前の場所にフォーカスを戻す
    var returnTo = note ? note.id : null;
    var error = h('p', { class: 'pn-error', role: 'alert' });
    // ⌘ / Ctrl + Enter で保存する。日本語の変換中の Enter は無視する
    var saveByKey = function (e) {
      if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      save.click();
    };

    var initialBody = body.value;
    var initialAuthor = author.value;
    var initialStatus = status.value;
    var initialKind = kind.value;
    var initialImportance = importance.value;
    showPopover([
      h('div', { class: 'pn-label', text: '種類' }),
      kind,
      body, author,
      h('div', { class: 'pn-label', text: '重要度' }),
      importance,
      h('div', { class: 'pn-label', text: '状態' }),
      status,
      error,
      h('div', { class: 'pn-row' }, [save, cancel]),
    ], note ? 'メモを編集' : '新しいメモ', returnTo);
    // 書きかけの内容があるかどうか。本文、名前、状態、種類、重要度のどれかが開いたときから変わっていれば書きかけとする
    popover.isDirty = function () {
      return body.value !== initialBody || author.value !== initialAuthor || status.value !== initialStatus ||
        kind.value !== initialKind || importance.value !== initialImportance;
    };
    popover.warn = function () {
      error.textContent = '書きかけの内容があります。保存するか、キャンセルしてください';
      body.focus();
    };
    // 吹き出しのどこにフォーカスがあっても ⌘ / Ctrl + Enter で保存する。種類や重要度のボタンを押したあとでも効くように、
    // 捕捉段階で受け取り、ボタンの Enter による選択より先に処理する
    popover.addEventListener('keydown', saveByKey, true);
    popover.target = note || anchor;
    popover.targetEl = findAnchor(popover.target);
    movePopover();
    body.focus();
  }

  function openViewer(note, returnTo) {
    if (!requestClosePopover()) return;
    state.openId = note.id;
    var s = statusOf(note.status);
    var statusSel = h('select', { 'aria-label': '状態' }, STATUS.map(function (x) {
      var o = h('option', { value: x.key, text: x.label });
      if (x.key === note.status) o.selected = true;
      return o;
    }));
    statusSel.addEventListener('change', function () {
      statusSel.disabled = true;
      store.update(note.id, { status: statusSel.value }).then(refresh).then(closePopover).catch(saveFailed);
    });
    var edit = h('button', { type: 'button', class: 'pn-btn', onclick: function () { openEditor(note); } }, label('pencil', '編集'));
    var del = h('button', {
      type: 'button', class: 'pn-btn pn-btn--danger',
      onclick: function () {
        if (del.dataset.confirm !== '1') { del.dataset.confirm = '1'; del.lastChild.textContent = 'もう一度押すと削除'; return; }
        if (del.disabled) return;
        del.disabled = true;
        store.remove(note.id).then(refresh).then(closePopover).catch(saveFailed);
      },
    }, label('trash-2', '削除'));
    var close = h('button', { type: 'button', class: 'pn-btn', onclick: closePopover }, label('x', '閉じる'));
    var k = kindOf(note.kind);
    var kindLabel = h('span', { class: 'pn-kind' }, [iconEl(k.icon), document.createTextNode(k.label)]);
    var imp = importanceOf(note);
    var num = sorted().map(function (n) { return n.id; }).indexOf(note.id) + 1;
    showPopover([
      h('div', { class: 'pn-head' }, [
        kindLabel,
        statusTag(s),
        imp ? starsEl(imp) : null,
      ]),
      h('p', { class: 'pn-body', text: note.body }),
      h('div', { class: 'pn-meta', text: (note.author || '名前なし') + '｜' + formatDate(note.updatedAt || note.createdAt) }),
      h('div', { class: 'pn-row' }, [statusSel]),
      h('div', { class: 'pn-row' }, [edit, del, close]),
    ], num > 0 ? 'メモ ' + num : 'メモ', returnTo || note.id);
    popover.target = note;
    popover.targetEl = findAnchor(note);
    movePopover();
    // キーボードで開いたときに、読み上げとフォーカスが吹き出しに移るようにする
    popover.focus({ preventScroll: true });
  }

  // 状態のラベル。色に加えて、未対応以外はアイコンも付ける
  function statusTag(s, prefix) {
    var tag = h('span', { class: 'pn-tag', 'data-status': s.key });
    if (s.icon) tag.appendChild(iconEl(s.icon));
    tag.appendChild(document.createTextNode((prefix || '') + s.label));
    return tag;
  }

  function toggleList() {
    if (!listPanel) {
      listPanel = h('div', { class: 'pn-list', 'data-pin-notes': '', role: 'region', 'aria-label': 'メモの一覧', id: 'pn-list', hidden: '' });
      bar.listBtn.setAttribute('aria-controls', 'pn-list');
      document.body.appendChild(listPanel);
      if (offsetObserver) offsetObserver.observe(listPanel);
    }
    listPanel.hidden = !listPanel.hidden;
    bar.listBtn.setAttribute('aria-expanded', String(!listPanel.hidden));
    if (!listPanel.hidden) renderList();
    updateOffset();
  }

  // 画面下端から、バーや一覧の上端までの高さ。左下に置くほかの部品がこの分だけ上に逃げられるようにする
  // 余白は含めない。使う側で足す。
  // 画面の高さから引き算すると、スマホで URL バーが出入りしたときにずれる。CSS の bottom と要素の高さから求める
  var offsetObserver = null;
  function updateOffset() {
    var style = document.documentElement.style;
    if (!state.enabled || !bar || bar.hidden) {
      style.removeProperty('--pin-notes-offset');
      return;
    }
    var reach = function (el) { return (parseFloat(getComputedStyle(el).bottom) || 0) + el.offsetHeight; };
    var offset = reach(bar);
    if (listPanel && !listPanel.hidden) offset = Math.max(offset, reach(listPanel));
    style.setProperty('--pin-notes-offset', Math.round(offset) + 'px');
  }

  function renderList() {
    listPanel.textContent = '';
    var items = visibleNumbered();
    if (!items.length) {
      var hidden = state.notes.length - items.length;
      var text = hidden ? '対応済みのメモが ' + hidden + ' 件あります。「対応済みも表示」で見られます。' : 'このページのメモはまだありません。';
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
        h('span', { class: 'pn-line', text: n.body.length > 60 ? n.body.slice(0, 60) + '…' : n.body }),
        h('span', { class: 'pn-meta pn-line', text: (n.author || '名前なし') + '｜' + formatDate(n.updatedAt || n.createdAt) }),
      ]);
      return h('li', {}, [item]);
    })));
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function showError(prefix, err) {
    bar.hint.textContent = prefix + ': ' + (err && err.message ? err.message : err);
  }

  // 保存に失敗したら、一覧を読み直す。ほかの人が消したメモのピンが残り続けないようにする
  function saveFailed(err) {
    closePopover();
    refresh().then(function () { showError('保存できませんでした', err); });
  }

  // 消えない通知。hint は操作の案内で上書きされるので、保存先や保存データの状態はこちらに出す
  // 退避の通知は、管理者が見るまで残す。一覧の読み込みで消すのは、壊れたデータの通知だけ
  var pendingNotice = '';
  var noticeKind = '';
  function setNotice(text, kind) {
    noticeKind = text ? (kind || '') : '';
    if (!bar) { pendingNotice = text; return; }
    bar.notice.textContent = text;
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
      if (seq === refreshSeq) showError('読み込めませんでした', err);
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
      bar.hidden = false;
      if (launcher) launcher.hidden = true;
      updateOffset();
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
      bar.hidden = true;
      if (launcher) launcher.hidden = false;
      updateOffset();
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
  window.PinNotes = api;

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
    ready.then(function () { document.dispatchEvent(new CustomEvent('pin-notes:ready')); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
