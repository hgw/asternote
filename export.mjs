#!/usr/bin/env node
// pin-notes のメモを取得し、Markdown に書き出す。依存なし。Node 18 以降。
//
// 使い方:
//   PIN_NOTES_AUTH="user:pass" pin-notes-export \
//     --endpoint https://example.com/pin-notes/api.php \
//     --project myproject \
//     --out docs/notes.md
//
// PIN_NOTES_AUTH は Basic 認証が必要なときだけ指定する。
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

// 引数は1つずつ読む。オプションの値に -h が来ても、使い方の表示と取り違えない
// 知らないオプションは断る。書き間違いを黙って無視すると、思わぬ場所に書き出すため
const usage = '使い方: pin-notes-export --endpoint <URL> --project <名前> [--out <ファイル>] [--site <URL>]';
const KNOWN = ['endpoint', 'project', 'out', 'site'];
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
    console.error(key && KNOWN.includes(key) ? `pin-notes-export: ${a} に値がありません` : `pin-notes-export: 知らない引数です: ${a}`);
    console.error(usage);
    process.exit(1);
  }
  args[key] = argv[++i];
}
const { endpoint, project, out = 'notes.md' } = args;
if (!endpoint || !project) {
  console.error(usage);
  process.exit(1);
}

const headers = {};
if (process.env.PIN_NOTES_AUTH) {
  headers.Authorization = `Basic ${Buffer.from(process.env.PIN_NOTES_AUTH).toString('base64')}`;
}

// WordPress の admin-ajax.php?action=pin_notes のように、URL にすでに ? があれば & でつなぐ
const res = await fetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}project=${encodeURIComponent(project)}`, { headers });
if (!res.ok) {
  console.error(`取得できませんでした: ${res.status} ${res.statusText}`);
  process.exit(1);
}
// 保存データが壊れていると、API は空の一覧を返す。そのまま書くと既存の notes.md の内容が消えるので止める
if (res.headers.get('X-Pin-Notes-Warning')) {
  console.error(`サーバーの保存データに問題があるため、書き出しを中止しました: ${res.headers.get('X-Pin-Notes-Warning')}`);
  process.exit(1);
}
const { notes } = await res.json();

// 種類の表示名と重要度の上限。pin-notes.js と api.php にも同じ値がある。変えるときは3か所をそろえる
// 「メモ」は書き出しでは付けない
const KINDS = { memo: 'メモ', idea: 'アイデア', fix: '修正', info: '質問・情報', like: 'いいね' };
const MAX_IMPORTANCE = 3;
// 丸め方は pin-notes.js と api.php と同じ。数として読めない値は 0、小数は切り捨て、範囲外は端に寄せる
const importanceOf = (v) => {
  if ((typeof v !== 'number' && typeof v !== 'string') || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(MAX_IMPORTANCE, Math.max(0, Math.trunc(n))) : 0;
};

// メモは未完了か完了のどちらか。status が done なら完了、それ以外は未完了。v0.3.0 までの decided も未完了になる
const STATUS = [
  ['未完了', (n) => n.status !== 'done'],
  ['完了', (n) => n.status === 'done'],
];
const ANONYMOUS = 'ななしさん';
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
  '# 画面メモ',
  '',
  `取得: ${day(new Date())}`,
  `件数: ${notes.length}`,
  '',
  'プレビュー画面に残したメモを、ページ別に書き出したもの。このファイルは自動生成なので、直接編集しない。',
  '',
];

for (const [page, list] of [...byPage].sort(([a], [b]) => a.localeCompare(b))) {
  const title = text(list.find((n) => n.title)?.title ?? '');
  lines.push(`## ${text(page)}`, '');
  if (title) lines.push(`${title}｜${url(site + page)}`, '');
  for (const [label, match] of STATUS) {
    const items = list.filter(match);
    if (!items.length) continue;
    lines.push(`### ${label}`, '');
    for (const n of items) {
      const meta = [text(n.author) || ANONYMOUS, day(n.updatedAt || n.createdAt)].filter(Boolean).join('、');
      const area = n.rx2 != null && n.ry2 != null ? '［範囲］' : '';
      // 自分のキーだけを見る。constructor などの組み込みの名前を種類として拾わないように
      const kind = Object.hasOwn(KINDS, n.kind) && n.kind !== 'memo' ? `［${KINDS[n.kind]}］` : '';
      const imp = importanceOf(n.importance);
      const star = imp ? `${'★'.repeat(imp)} ` : '';
      lines.push(`- ${area}${kind}${star}${text(n.body)}（${meta}）`);
    }
    lines.push('');
  }
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, lines.join('\n'));
console.log(`${notes.length}件を書き出しました: ${out}`);
