#!/usr/bin/env node
// asternote.js と api.php を公開ディレクトリに複製する。依存なし。Node 18 以降。
//
// 使い方:
//   asternote-copy public/asternote [--config asternote.config.php]
//
// --config を付けると、設定ファイルも同じ場所に複製する。
// 設定ファイルには保存先のパスが入る。公開リポジトリの案件では、設定ファイルを git に入れないこと。
// 開発サーバーは PHP を動かさず、公開ディレクトリのファイルを文字のまま返す。--config は本番用のビルドでだけ付ける。
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const usage = '使い方: asternote-copy <複製先のディレクトリ> [--config <設定ファイル>]';
const argv = process.argv.slice(2);
let dest = null;
let config = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--help' || argv[i] === '-h') {
    console.log(usage);
    process.exit(0);
  }
  // 知らないオプションを複製先と取り違えて、- で始まる名前のフォルダーを作らないようにする
  if (argv[i].startsWith('-') && argv[i] !== '--config') {
    console.error(`asternote-copy: 知らないオプションです: ${argv[i]}`);
    console.error(usage);
    process.exit(1);
  }
  if (argv[i] === '--config') {
    config = argv[++i];
    if (!config) {
      console.error(usage);
      process.exit(1);
    }
  } else if (!dest) {
    dest = argv[i];
  } else {
    console.error(usage);
    process.exit(1);
  }
}
if (!dest) {
  console.error(usage);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const files = [
  [join(here, 'asternote.js'), 'asternote.js'],
  [join(here, 'api.php'), 'api.php'],
];
if (config) files.push([resolve(config), 'asternote.config.php']);

await mkdir(dest, { recursive: true });
for (const [src, name] of files) {
  await copyFile(src, join(dest, name));
  console.log(`asternote: ${join(dest, name)}`);
}
