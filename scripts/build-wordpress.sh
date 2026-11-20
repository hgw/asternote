#!/bin/sh
# WordPress のプラグインの zip を作る。dist/pin-notes-wordpress-<版>.zip ができる
# zip の中は pin-notes/ フォルダ1つ。プラグイン本体、pin-notes.js、api.php、LICENSE を入れる
set -eu
cd "$(dirname "$0")/.."

version=$(node -p "require('./package.json').version")
# プラグインのヘッダーと定数の版が package.json とずれていたら止める。古い版の番号で配らないため
for pattern in " * Version: $version" "define('PIN_NOTES_VERSION', '$version');"; do
  if ! grep -qF "$pattern" wordpress/pin-notes.php; then
    echo "build-wordpress: wordpress/pin-notes.php の版が package.json の $version と違います: $pattern" >&2
    exit 1
  fi
done

rm -rf dist/pin-notes
mkdir -p dist/pin-notes
cp wordpress/pin-notes.php pin-notes.js api.php LICENSE dist/pin-notes/
zip_path="dist/pin-notes-wordpress-$version.zip"
rm -f "$zip_path"
(cd dist && zip -qr "pin-notes-wordpress-$version.zip" pin-notes)
echo "build-wordpress: $zip_path"
