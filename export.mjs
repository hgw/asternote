#!/usr/bin/env node
// pin-notes のメモを取得し、Markdown に書き出す。依存なし。Node 18 以降。
//
// 使い方:
//   PIN_NOTES_AUTH="user:pass" node export.mjs \
//     --endpoint https://example.com/pin-notes/api.php \
//     --project myproject \
//     --out docs/notes.md
//
// PIN_NOTES_AUTH は Basic 認証が必要なときだけ指定する。
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const { endpoint, project, out = 'notes.md' } = args;
if (!endpoint || !project) {
  console.error('使い方: node export.mjs --endpoint <URL> --project <名前> [--out <ファイル>]');
  process.exit(1);
}

const headers = {};
if (process.env.PIN_NOTES_AUTH) {
  headers.Authorization = `Basic ${Buffer.from(process.env.PIN_NOTES_AUTH).toString('base64')}`;
}

const res = await fetch(`${endpoint}?project=${encodeURIComponent(project)}`, { headers });
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
const site = new URL(endpoint).origin;
// UI と同じく、実行環境の時刻で日付を書く。UTC のまま切ると日本時間の朝に日付がずれる
const pad = (n) => String(n).padStart(2, '0');
const day = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
// 改行をそのまま書くと、見出しや状態の項目を偽装できる。どの項目も1行にまとめる
const oneLine = (s) => String(s ?? '').replace(/\s*[\r\n]+\s*/g, ' / ');

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
  const title = oneLine(list.find((n) => n.title)?.title ?? '');
  lines.push(`## ${oneLine(page)}`, '');
  if (title) lines.push(`${title}｜${site}${oneLine(page)}`, '');
  for (const [label, match] of STATUS) {
    const items = list.filter(match);
    if (!items.length) continue;
    lines.push(`### ${label}`, '');
    for (const n of items) {
      const meta = [oneLine(n.author) || ANONYMOUS, day(n.updatedAt || n.createdAt)].filter(Boolean).join('、');
      const area = n.rx2 != null && n.ry2 != null ? '［範囲］' : '';
      // 自分のキーだけを見る。constructor などの組み込みの名前を種類として拾わないように
      const kind = Object.hasOwn(KINDS, n.kind) && n.kind !== 'memo' ? `［${KINDS[n.kind]}］` : '';
      const imp = importanceOf(n.importance);
      const star = imp ? `${'★'.repeat(imp)} ` : '';
      lines.push(`- ${area}${kind}${star}${oneLine(n.body)}（${meta}）`);
    }
    lines.push('');
  }
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, lines.join('\n'));
console.log(`${notes.length}件を書き出しました: ${out}`);
