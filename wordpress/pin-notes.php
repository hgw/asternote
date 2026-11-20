<?php
/**
 * Plugin Name: pin-notes
 * Plugin URI: https://github.com/hgw/pin-notes
 * Description: プレビュー画面にピンと範囲でメモを残す。wp-config.php に PIN_NOTES_DATA_DIR を書いたときだけ動く。
 * Version: 0.7.0
 * Requires PHP: 7.4
 * License: MIT
 *
 * 設定は wp-config.php の定数で書く。
 *   define('PIN_NOTES_DATA_DIR', '/home/xxx/data/example.com/pin-notes'); // 必須。保存先。ドキュメントルートの外にする
 *   define('PIN_NOTES_PROJECT', 'myproject');   // 任意。メモの保存単位。省くと site
 *   define('PIN_NOTES_ALLOW_ANONYMOUS', true);  // 任意。Basic 認証の確認を外す
 *   define('PIN_NOTES_DEFAULT_ON', true);       // 任意。初めて開いた人にもメモを表示する
 *
 * PIN_NOTES_DATA_DIR がなければ何もしない。本番に入れてしまっても、script タグも API も出さない。
 * mu-plugins に置くときは、このフォルダを置いたうえで、読み込むだけのファイルを mu-plugins の直下に足す。
 */

if (!defined('ABSPATH')) {
    exit;
}

// 設定がない環境では何もしない。フックを1つも登録しない
// 通常のプラグインと mu-plugins の両方に置いて2回読み込まれたときも、2回目は何もしない
// 関数をファイルの一番外側に書くと、ここより前に定義されて二重定義のエラーになる。そのため条件の中に書く
if (defined('PIN_NOTES_DATA_DIR') && !defined('PIN_NOTES_VERSION')) {
    define('PIN_NOTES_VERSION', '0.7.0');
    define('PIN_NOTES_AJAX_ACTION', 'pin_notes');

    /** script タグと API で使う project 名。api.php と同じく、英小文字、数字、-、_ だけ */
    function pin_notes_project(): string
    {
        $project = defined('PIN_NOTES_PROJECT') ? (string) PIN_NOTES_PROJECT : 'site';
        return preg_match('/^[a-z0-9_-]{1,40}$/', $project) ? $project : 'site';
    }

    // 画面の下に script タグを出す。管理画面には出さない
    add_action('wp_footer', function () {
        $src = add_query_arg('ver', PIN_NOTES_VERSION, plugins_url('pin-notes.js', __FILE__));
        $endpoint = add_query_arg('action', PIN_NOTES_AJAX_ACTION, admin_url('admin-ajax.php'));
        printf(
            '<script src="%s" data-endpoint="%s" data-project="%s"%s defer></script>' . "\n",
            esc_url($src),
            esc_url($endpoint),
            esc_attr(pin_notes_project()),
            (defined('PIN_NOTES_DEFAULT_ON') && PIN_NOTES_DEFAULT_ON === true) ? ' data-default="on"' : ''
        );
    });

    // API は admin-ajax.php で受ける。WordPress を読み込んだ状態で動くので、wp-config.php の定数を使える
    // ログインしていない閲覧者も使えるよう、nopriv にも登録する。書き込みの制限は、サイト全体の Basic 認証に任せる
    function pin_notes_ajax(): void
    {
        if (!defined('PIN_NOTES_LIBRARY')) {
            define('PIN_NOTES_LIBRARY', true);
        }
        require_once __DIR__ . '/api.php';
        \PinNotes\handle([
            'data_dir' => (string) PIN_NOTES_DATA_DIR,
            'projects' => [pin_notes_project()],
            'allow_anonymous' => defined('PIN_NOTES_ALLOW_ANONYMOUS') && PIN_NOTES_ALLOW_ANONYMOUS === true,
        ]);
    }
    add_action('wp_ajax_' . PIN_NOTES_AJAX_ACTION, 'pin_notes_ajax');
    add_action('wp_ajax_nopriv_' . PIN_NOTES_AJAX_ACTION, 'pin_notes_ajax');
}
