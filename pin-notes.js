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

  var STATUS = [
    { key: 'open', label: '未対応', color: '#e0662f' },
    { key: 'decided', label: '決定', color: '#2a6fdb' },
    { key: 'done', label: '対応済み', color: '#8a8a8a' },
  ];
  // key で探し、見つからなければ最初の要素を返す。状態と種類で共通に使う
  var byKey = function (list, key) {
    return list.filter(function (x) { return x.key === key; })[0] || list[0];
  };
  var statusOf = function (key) { return byKey(STATUS, key); };

  // メモの種類。ピンにアイコンで出す。「メモ」はふつうのメモで、アイコンは出さない
  // 種類のキーと重要度の上限は api.php と export.mjs にも同じ値がある。変えるときは3か所をそろえる
  // アイコンは固定の SVG 文字列。外部の素材に頼らず、このファイルだけで配れるようにする
  var svg = function (body) {
    return '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="currentColor">' + body + '</svg>';
  };
  var KINDS = [
    { key: 'memo', label: 'メモ', icon: svg('<path d="M5 4h14v12l-4 4H5z" opacity=".9"/>') },
    { key: 'idea', label: 'アイデア', icon: svg('<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z"/>') },
    { key: 'fix', label: '修正', icon: svg('<path d="M9 4.5a3 3 0 0 1 6 0V6H9zM5 9h14v1.5h-2.5V13H19v1.5h-2.6A4.5 4.5 0 0 1 13 18.8V11h-2v7.8a4.5 4.5 0 0 1-3.4-4.3H5V13h2.5v-2.5H5z"/>') },
    { key: 'info', label: '質問・情報', icon: svg('<path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1.3 8v8h2.6v-8zm1.3-4.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2z"/>') },
    { key: 'like', label: 'いいね', icon: svg('<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.5 1.1 4.6 2.6C12.1 6.1 13.6 5 15.6 5 19 5 21.1 8.4 19.6 11.8 17.5 16.4 12 21 12 21z"/>') },
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
  // 固定の SVG 文字列からアイコン要素を作る。利用者の入力は入らない
  // 解釈は種類ごとに1回だけにし、あとは複製して使う
  var iconCache = {};
  var iconEl = function (kind) {
    if (!iconCache[kind.key]) {
      var span = document.createElement('span');
      span.className = 'pn-icon';
      span.innerHTML = kind.icon;
      iconCache[kind.key] = span;
    }
    return iconCache[kind.key].cloneNode(true);
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
    var css = [
      '[data-pin-notes]{font:12px/1.5 system-ui,sans-serif;letter-spacing:0;color:#111}',
      // display を指定した要素でも hidden 属性で隠れるようにする。指定すると UA の display:none より優先されるため
      '[data-pin-notes][hidden],[data-pin-notes] [hidden]{display:none!important}',
      '.pn-layer{position:absolute;left:0;top:0;width:0;height:0;z-index:2147483000}',
      '.pn-pin{position:absolute;display:inline-flex;align-items:center;justify-content:center;gap:2px;min-width:24px;height:24px;margin:-24px 0 0 -2px;box-sizing:border-box;border:2px solid #fff;border-radius:12px 12px 12px 2px;color:#fff;font:700 11px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.35);padding:0 5px;touch-action:none;white-space:nowrap}',
      '.pn-icon{display:inline-flex;line-height:0}',
      '.pn-kind{display:inline-flex;align-items:center;gap:4px;margin-right:6px;color:#333}',
      '.pn-stars{color:#d29a00;letter-spacing:1px}',
      '.pn-seg{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0}',
      '.pn-seg button{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border:1px solid #bbb;background:#fff;color:#333;font:inherit;cursor:pointer}',
      '.pn-seg button[aria-pressed="true"]{border-color:#222;background:#222;color:#fff}',
      '.pn-label{margin-top:6px;color:#666;font-size:11px}',
      '.pn-pin.is-lost{opacity:.6;outline:2px dashed #e0662f}',
      '.pn-pin.is-dragging{cursor:grabbing;opacity:.85}',
      '.pn-area{position:absolute;box-sizing:border-box;border:2px solid;pointer-events:none}',
      '.pn-area.is-lost{border-style:dashed;opacity:.6}',
      '.pn-draft{position:fixed;z-index:2147483000;box-sizing:border-box;border:2px dashed #222;background:rgba(0,0,0,.06);pointer-events:none}',
      'html.pn-placing{touch-action:none;user-select:none}',
      '.pn-bar{position:fixed;left:12px;bottom:12px;z-index:2147483001;display:flex;gap:6px;align-items:center;padding:6px 8px;border:1px solid #222;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.15)}',
      '.pn-btn{padding:3px 10px;border:1px solid #222;background:#fff;color:#111;font:inherit;cursor:pointer}',
      '.pn-btn.is-on,.pn-btn--primary{background:#222;color:#fff}',
      '.pn-btn--danger{border-color:#b3261e;color:#b3261e}',
      '.pn-hint{color:#555}',
      '.pn-check{display:inline-flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap}',
      '.pn-error{margin:4px 0 0;color:#b3261e}',
      '.pn-error:empty{display:none}',
      '.pn-btn:disabled{opacity:.5;cursor:default}',
      '.pn-notice{padding:1px 6px;background:#fff4d6;color:#7a4b00;border:1px solid #e5c27a}',
      'html.pn-placing,html.pn-placing *{cursor:crosshair!important}',
      'html.pn-placing [data-pin-notes],html.pn-placing [data-pin-notes] *,html.pn-placing [data-pin-notes-ignore],html.pn-placing [data-pin-notes-ignore] *{cursor:auto!important}',
      'html.pn-placing [data-pin-notes] button,html.pn-placing [data-pin-notes-ignore] button,html.pn-placing [data-pin-notes-ignore] a{cursor:pointer!important}',
      '.pn-pop{position:absolute;z-index:2147483002;width:280px;padding:10px;border:1px solid #222;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.2)}',
      '.pn-pop textarea,.pn-pop input,.pn-pop select{width:100%;box-sizing:border-box;margin:4px 0;padding:4px 6px;border:1px solid #bbb;font:inherit}',
      '.pn-pop textarea{min-height:80px;resize:vertical}',
      '.pn-meta{color:#666;font-size:11px}',
      '.pn-body{white-space:pre-wrap;margin:6px 0}',
      '.pn-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center}',
      '.pn-list{position:fixed;left:12px;bottom:56px;z-index:2147483001;width:320px;max-height:60vh;overflow:auto;border:1px solid #222;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.15)}',
      '.pn-list ol{margin:0;padding:0;list-style:none}',
      '.pn-list li{padding:8px 10px;border-bottom:1px solid #eee;cursor:pointer}',
      '.pn-list li:hover{background:#f6f6f6}',
      '.pn-tag{display:inline-block;padding:0 6px;color:#fff;font-size:11px;margin-right:4px}',
      '.pn-launch{position:fixed;left:12px;bottom:12px;z-index:2147483001}',
    ].join('\n');
    document.head.appendChild(h('style', { 'data-pin-notes-style': '' }, [document.createTextNode(css)]));
  }

  function build() {
    injectStyle();
    layer = h('div', { class: 'pn-layer', 'data-pin-notes': '' });
    document.body.appendChild(layer);

    var addBtn = h('button', { type: 'button', class: 'pn-btn pn-btn--primary', text: '＋ メモを追加', onclick: function () { setPlacing(!state.placing); } });
    var listBtn = h('button', { type: 'button', class: 'pn-btn', text: '一覧', onclick: toggleList });
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
    var closeBtn = h('button', { type: 'button', class: 'pn-btn', text: '閉じる', 'aria-label': 'メモを閉じる', onclick: function () { api.disable(); } });
    var hint = h('span', { class: 'pn-hint', 'data-pn-hint': '' });
    var notice = h('span', { class: 'pn-notice', 'data-pn-notice': '', hidden: '' });
    bar = h('div', { class: 'pn-bar', 'data-pin-notes': '', hidden: '' }, [addBtn, listBtn, showDoneLabel, hint, notice, closeBtn]);
    bar.addBtn = addBtn;
    bar.hint = hint;
    bar.notice = notice;
    if (pendingNotice) setNotice(pendingNotice);
    document.body.appendChild(bar);

    if (config.ui !== 'none') {
      launcher = h('button', { type: 'button', class: 'pn-btn pn-launch', 'data-pin-notes': '', text: 'メモ', onclick: function () { api.toggle(); } });
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
    bar.addBtn.textContent = on ? 'やめる' : '＋ メモを追加';
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
      var color = statusOf(note.status).color;
      var kind = kindOf(note.kind);
      var imp = importanceOf(note);
      var pin = h('button', {
        type: 'button',
        class: 'pn-pin' + (pos.lost ? ' is-lost' : ''),
        title: (pos.lost ? '（元の要素が見つからない）' : '') + note.body,
        'aria-label': 'メモ ' + num + (isMemo(kind) ? '' : '、' + kind.label) + (isArea(note) ? '、範囲' : '') + (imp ? '、重要度 ' + imp : ''),
        text: String(num),
        onclick: function (e) {
          e.stopPropagation();
          // ドラッグで動かした直後の click では開かない
          if (takeSwallowedClick()) return;
          openViewer(pin.note);
        },
      });
      // 「メモ」以外の種類は、番号の前にアイコンを出す
      if (!isMemo(kind)) pin.insertBefore(iconEl(kind), pin.firstChild);
      pin.note = note;
      pin.anchorEl = el;
      pin.style.background = color;
      if (isArea(note)) {
        // 範囲の枠。ページの操作を妨げないよう、枠そのものはクリックを受けない
        pin.areaEl = h('div', { class: 'pn-area', 'data-pin-notes': '' });
        pin.areaEl.style.borderColor = color;
        pin.areaEl.style.background = color + '1a';
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
  function closePopover() {
    if (popover) popover.remove();
    popover = null;
    state.openId = null;
  }

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
    var body = h('textarea', { placeholder: '決まったこと、直したいこと' });
    body.value = note ? note.body : '';
    var author = h('input', { type: 'text', placeholder: '名前', value: (note && note.author) || ls.get('pin-notes:author') || '' });
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
        if (o.icon) btn.appendChild(iconEl(o.icon));
        btn.appendChild(document.createTextNode(o.text));
        btn.addEventListener('click', function () {
          group.value = o.value;
          Array.prototype.forEach.call(group.children, function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
        });
        group.appendChild(btn);
      });
      return group;
    };
    var kind = segment('種類', KINDS.map(function (k) { return { value: k.key, text: k.label, icon: k }; }), kindOf(note && note.kind).key);
    var importance = segment('重要度', [0, 1, 2, 3].map(function (n) {
      return { value: n, text: n ? stars(n) : 'なし', title: n ? '重要度 ' + n : '重要度の指定なし' };
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
        p.then(refresh).then(closePopover).catch(function (err) {
          // 書いた文章を失わないよう、吹き出しは閉じずに再送できる状態に戻す
          save.disabled = false;
          save.textContent = '保存';
          error.textContent = '保存できませんでした: ' + (err && err.message ? err.message : err);
          refresh();
        });
      },
    });
    var cancel = h('button', { type: 'button', class: 'pn-btn', text: 'キャンセル', onclick: closePopover });
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
    popover = h('div', { class: 'pn-pop', 'data-pin-notes': '' }, [
      h('div', { class: 'pn-meta', text: note ? 'メモを編集' : '新しいメモ' }),
      h('div', { class: 'pn-label', text: '種類' }),
      kind,
      body, author,
      h('div', { class: 'pn-label', text: '重要度' }),
      importance,
      h('div', { class: 'pn-label', text: '状態' }),
      status,
      error,
      h('div', { class: 'pn-row' }, [save, cancel]),
    ]);
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
    document.body.appendChild(popover);
    popover.target = note || anchor;
    popover.targetEl = findAnchor(popover.target);
    movePopover();
    body.focus();
  }

  function openViewer(note) {
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
    var edit = h('button', { type: 'button', class: 'pn-btn', text: '編集', onclick: function () { openEditor(note); } });
    var del = h('button', {
      type: 'button', class: 'pn-btn pn-btn--danger', text: '削除',
      onclick: function () {
        if (del.dataset.confirm !== '1') { del.dataset.confirm = '1'; del.textContent = 'もう一度押すと削除'; return; }
        if (del.disabled) return;
        del.disabled = true;
        store.remove(note.id).then(refresh).then(closePopover).catch(saveFailed);
      },
    });
    var close = h('button', { type: 'button', class: 'pn-btn', text: '閉じる', onclick: closePopover });
    var k = kindOf(note.kind);
    var kindLabel = h('span', { class: 'pn-kind' }, [iconEl(k), document.createTextNode(k.label)]);
    var imp = importanceOf(note);
    popover = h('div', { class: 'pn-pop', 'data-pin-notes': '' }, [
      h('div', {}, [
        kindLabel,
        h('span', { class: 'pn-tag', style: 'background:' + s.color, text: s.label }),
        imp ? h('span', { class: 'pn-stars', text: stars(imp), title: '重要度 ' + imp }) : null,
      ]),
      h('p', { class: 'pn-body', text: note.body }),
      h('div', { class: 'pn-meta', text: (note.author || '名前なし') + '｜' + formatDate(note.updatedAt || note.createdAt) }),
      h('div', { class: 'pn-row' }, [statusSel]),
      h('div', { class: 'pn-row' }, [edit, del, close]),
    ]);
    document.body.appendChild(popover);
    popover.target = note;
    popover.targetEl = findAnchor(note);
    movePopover();
  }

  function toggleList() {
    if (!listPanel) {
      listPanel = h('div', { class: 'pn-list', 'data-pin-notes': '', hidden: '' });
      document.body.appendChild(listPanel);
      if (offsetObserver) offsetObserver.observe(listPanel);
    }
    listPanel.hidden = !listPanel.hidden;
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
      listPanel.appendChild(h('p', { style: 'margin:0;padding:10px', text: text }));
      return;
    }
    listPanel.appendChild(h('ol', {}, items.map(function (item) {
      var n = item.note;
      var i = item.num - 1;
      var s = statusOf(n.status);
      return h('li', {
        onclick: function () {
          var pos = positionOf(n);
          window.scrollTo({ top: Math.max(0, pos.y - 120), behavior: 'smooth' });
          openViewer(n);
        },
      }, [
        h('span', { class: 'pn-tag', style: 'background:' + s.color, text: (i + 1) + ' ' + s.label }),
        isMemo(kindOf(n.kind)) ? null : h('span', { class: 'pn-kind', title: kindOf(n.kind).label }, [iconEl(kindOf(n.kind))]),
        importanceOf(n) ? h('span', { class: 'pn-stars', text: stars(importanceOf(n)) + ' ' }) : null,
        h('span', { text: n.body.length > 60 ? n.body.slice(0, 60) + '…' : n.body }),
        h('div', { class: 'pn-meta', text: (n.author || '名前なし') + '｜' + formatDate(n.updatedAt || n.createdAt) }),
      ]);
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
