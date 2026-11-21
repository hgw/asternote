#!/bin/sh
# WordPress のプラグインの zip を作る。dist/asternote-wordpress-<版>.zip ができる
# zip の中は asternote/ フォルダ1つ。プラグイン本体、asternote.js、api.php、LICENSE を入れる
set -eu
cd "$(dirname "$0")/.."

version=$(node -p "require('./package.json').version")
# プラグインのヘッダーと定数の版が package.json とずれていたら止める。古い版の番号で配らないため
for pattern in " * Version: $version" "define('ASTERNOTE_VERSION', '$version');"; do
  if ! grep -qF "$pattern" wordpress/asternote.php; then
    echo "build-wordpress: wordpress/asternote.php の版が package.json の $version と違います: $pattern" >&2
    exit 1
  fi
done
# 設定のパネルに出す版の番号も確かめる
if ! grep -qF "var VERSION = '$version';" asternote.js; then
  echo "build-wordpress: asternote.js の VERSION が package.json の $version と違います" >&2
  exit 1
fi

rm -rf dist/asternote
mkdir -p dist/asternote
cp wordpress/asternote.php asternote.js api.php LICENSE dist/asternote/
zip_path="dist/asternote-wordpress-$version.zip"
rm -f "$zip_path"
(cd dist && zip -qr "asternote-wordpress-$version.zip" asternote)
echo "build-wordpress: $zip_path"
