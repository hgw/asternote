#!/usr/bin/env node
// Asternote のメモを取得し、Markdown に書き出す。依存なし。Node 18 以降。
//
// 使い方:
//   ASTERNOTE_AUTH="user:pass" asternote-export \
//     --endpoint https://example.com/asternote/api.php \
//     --project myproject \
//     --out docs/notes.md
//
// ASTERNOTE_AUTH は Basic 認証が必要なときだけ指定する。
// --lang en で、英語の見出しと項目名で書き出す。省くと日本語にする。
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// 引数は1つずつ読む。オプションの値に -h が来ても、使い方の表示と取り違えない
// 知らないオプションは断る。書き間違いを黙って無視すると、思わぬ場所に書き出すため
// 使い方とエラーは、言語を読む前に出ることがあるので、英語と日本語の両方で書く
const usage = [
  'Usage: asternote-export --endpoint <URL> --project <name> [--out <file>] [--site <URL>] [--lang ja|en]',
  '使い方: asternote-export --endpoint <URL> --project <名前> [--out <ファイル>] [--site <URL>] [--lang ja|en]',
].join('\n');
const KNOWN = ['endpoint', 'project', 'out', 'site', 'lang'];
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--help' || a === '-h') {
    console.log(usage);
    process.exit(0);
  }
  const key = a.startsWith('--') ? a.slice(2) : null;
  if (!key || !KNOWN.includes(key) || argv[i + 1] === undefined) {
    console.error(key && KNOWN.includes(key) ? `asternote-export: ${a} needs a value / ${a} に値がありません` : `asternote-export: unknown argument / 知らない引数です: ${a}`);
    console.error(usage);
    process.exit(1);
  }
  args[key] = argv[++i];
}
const { endpoint, project, out = 'notes.md', lang = 'ja' } = args;
if (!endpoint || !project || !['ja', 'en'].includes(lang)) {
  console.error(usage);
  process.exit(1);
}

// 書き出しの文言。asternote.js の辞書と同じ言葉を使う
const M = {
  ja: {
    fetchFailed: '取得できませんでした', warning: 'サーバーの保存データに問題があるため、書き出しを中止しました',
    kinds: { memo: 'メモ', idea: 'アイデア', fix: '修正', info: '質問・情報', like: 'いいね' },
    open: '未完了', done: '完了', anonymous: 'ななしさん', area: '範囲',
    title: '画面メモ', fetched: '取得', count: '件数',
    about: 'プレビュー画面に残したメモを、ページ別に書き出したもの。このファイルは自動生成なので、直接編集しない。',
    tag: (s) => `［${s}］`, meta: (s) => `（${s}）`, sep: '、', titleSep: '｜', label: (k, v) => `${k}: ${v}`,
    written: (n, f) => `${n}件を書き出しました: ${f}`,
  },
  en: {
    fetchFailed: 'Could not fetch the notes', warning: 'Export stopped because the saved data on the server has a problem',
    kinds: { memo: 'Note', idea: 'Idea', fix: 'Fix', info: 'Question', like: 'Like' },
    open: 'Open', done: 'Done', anonymous: 'Anonymous', area: 'Area',
    title: 'Screen notes', fetched: 'Fetched', count: 'Notes',
    about: 'Notes left on preview pages, grouped by page. This file is generated, so do not edit it by hand.',
    tag: (s) => `[${s}] `, meta: (s) => ` (${s})`, sep: ', ', titleSep: ' | ', label: (k, v) => `${k}: ${v}`,
    written: (n, f) => `Wrote ${n} note${n === 1 ? '' : 's'}: ${f}`,
  },
}[lang];

const headers = {};
if (process.env.ASTERNOTE_AUTH) {
  headers.Authorization = `Basic ${Buffer.from(process.env.ASTERNOTE_AUTH).toString('base64')}`;
}

// WordPress の admin-ajax.php?action=asternote のように、URL にすでに ? があれば & でつなぐ
const res = await fetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}project=${encodeURIComponent(project)}`, { headers });
if (!res.ok) {
  console.error(`${M.fetchFailed}: ${res.status} ${res.statusText}`);
  process.exit(1);
}
// 保存データが壊れていると、API は空の一覧を返す。そのまま書くと既存の notes.md の内容が消えるので止める
if (res.headers.get('X-Asternote-Warning')) {
  console.error(`${M.warning}: ${res.headers.get('X-Asternote-Warning')}`);
  process.exit(1);
}
const { notes } = await res.json();

// 種類の表示名と重要度の上限。asternote.js と api.php にも同じ値がある。変えるときは3か所をそろえる
// 「メモ」は書き出しでは付けない
const KINDS = M.kinds;
const MAX_IMPORTANCE = 3;
// 丸め方は asternote.js と api.php と同じ。数として読めない値は 0、小数は切り捨て、範囲外は端に寄せる
const importanceOf = (v) => {
  if ((typeof v !== 'number' && typeof v !== 'string') || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(MAX_IMPORTANCE, Math.max(0, Math.trunc(n))) : 0;
};

// メモは未完了か完了のどちらか。status が done なら完了、それ以外は未完了。v0.3.0 までの decided も未完了になる
const STATUS = [
  [M.open, (n) => n.status !== 'done'],
  [M.done, (n) => n.status === 'done'],
];
const ANONYMOUS = M.anonymous;
// ページへのリンクに使うサイトの URL。省くと API と同じ場所にする
// WordPress で管理画面と表のサイトのホストが違うときは、--site に表のサイトを渡す
const site = new URL(args.site || endpoint).origin;
// UI と同じく、実行環境の時刻で日付を書く。UTC のまま切ると日本時間の朝に日付がずれる
const pad = (n) => String(n).padStart(2, '0');
const day = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// 改行をそのまま書くと、見出しや状態の項目を偽装できる。どの項目も1行にまとめる
const oneLine = (s) => String(s ?? '').replace(/\s*[\r\n]+\s*/g, ' / ');
// メモの文字は Markdown や HTML として解釈させない。<!-- で後ろのメモが隠れたり、リンクや画像が埋め込まれたりするのを防ぐ
// & < > は文字参照に、Markdown の記号はバックスラッシュで打ち消す
const text = (s) => oneLine(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/[\\`*_[\]()#|~!]/g, '\\$&');
// URL は <> で囲んだ自動リンクにする。囲みを壊す文字と空白だけを、パーセント符号に直す
const url = (s) => `<${oneLine(s).replace(/[<>\s`]/g, (c) => encodeURIComponent(c))}>`;

const byPage = new Map();
for (const n of notes.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
  if (!byPage.has(n.page)) byPage.set(n.page, []);
  byPage.get(n.page).push(n);
}

const lines = [
  `# ${M.title}`,
  '',
  M.label(M.fetched, day(new Date())),
  M.label(M.count, notes.length),
  '',
  M.about,
  '',
];

for (const [page, list] of [...byPage].sort(([a], [b]) => a.localeCompare(b))) {
  const title = text(list.find((n) => n.title)?.title ?? '');
  lines.push(`## ${text(page)}`, '');
  if (title) lines.push(`${title}${M.titleSep}${url(site + page)}`, '');
  for (const [label, match] of STATUS) {
    const items = list.filter(match);
    if (!items.length) continue;
    lines.push(`### ${label}`, '');
    for (const n of items) {
      const meta = [text(n.author) || ANONYMOUS, day(n.updatedAt || n.createdAt)].filter(Boolean).join(M.sep);
      const area = n.rx2 != null && n.ry2 != null ? M.tag(M.area) : '';
      // 自分のキーだけを見る。constructor などの組み込みの名前を種類として拾わないように
      const kind = Object.hasOwn(KINDS, n.kind) && n.kind !== 'memo' ? M.tag(KINDS[n.kind]) : '';
      const imp = importanceOf(n.importance);
      const star = imp ? `${'★'.repeat(imp)} ` : '';
      lines.push(`- ${area}${kind}${star}${text(n.body)}${M.meta(meta)}`);
    }
    lines.push('');
  }
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, lines.join('\n'));
console.log(M.written(notes.length, out));
