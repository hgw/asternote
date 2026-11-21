<?php
/**
 * Plugin Name: Asternote
 * Plugin URI: https://github.com/hgw/asternote
 * Description: プレビュー画面にピンと範囲でメモを残す。wp-config.php に ASTERNOTE_DATA_DIR を書いたときだけ動く。
 * Version: 0.8.4
 * Requires PHP: 7.4
 * License: MIT
 *
 * 設定は wp-config.php の定数で書く。
 *   define('ASTERNOTE_DATA_DIR', '/home/xxx/data/example.com/asternote'); // 必須。保存先。ドキュメントルートの外にする
 *   define('ASTERNOTE_PROJECT', 'myproject');   // 任意。メモの保存単位。英小文字、数字、-、_ で40字まで。省くと site
 *   define('ASTERNOTE_ALLOW_ANONYMOUS', true);  // 任意。Basic 認証の確認を外す
 *   define('ASTERNOTE_DEFAULT_ON', true);       // 任意。初めて開いた人にもメモを表示する
 *
 * ASTERNOTE_DATA_DIR がない、または空なら何もしない。本番に入れてしまっても、script タグも API も出さない。
 * ASTERNOTE_PROJECT の形が違うときも何もせず、PHP のエラーログに理由を書く。
 * mu-plugins に置くときは、このフォルダを置いたうえで、読み込むだけのファイルを mu-plugins の直下に足す。
 */

if (!defined('ABSPATH')) {
    exit;
}

// 設定がない環境では何もしない。フックを1つも登録しない
// 通常のプラグインと mu-plugins の両方に置いて2回読み込まれたときも、2回目は何もしない
// 関数をファイルの一番外側に書くと、ここより前に定義されて二重定義のエラーになる。そのため条件の中に書く
// project 名は api.php と同じく、英小文字、数字、-、_ で40字まで。形が違えば、黙って別の名前に置き換えずに止める
// 置き換えると、書き出しで設定した名前を指定したときに見つからず、メモが消えたように見えるため
$asternote_ok = defined('ASTERNOTE_DATA_DIR') && is_string(ASTERNOTE_DATA_DIR) && ASTERNOTE_DATA_DIR !== '' && !defined('ASTERNOTE_VERSION');
if ($asternote_ok && defined('ASTERNOTE_PROJECT') && !(is_string(ASTERNOTE_PROJECT) && preg_match('/^[a-z0-9_-]{1,40}$/', ASTERNOTE_PROJECT))) {
    // サーバーのエラーログは日本語を読める形で残さないことがあるので、英語で書く
    error_log('asternote: ASTERNOTE_PROJECT must be 1-40 characters of a-z, 0-9, - or _. The plugin is disabled.');
    $asternote_ok = false;
}
if ($asternote_ok) {
    define('ASTERNOTE_VERSION', '0.8.4');
    define('ASTERNOTE_AJAX_ACTION', 'asternote');

    /** script タグと API で使う project 名。形は上で確かめてある */
    function asternote_project(): string
    {
        return defined('ASTERNOTE_PROJECT') ? ASTERNOTE_PROJECT : 'site';
    }

    /** 真偽の定数。true のほか、1 や 'true' も有効として扱う。書き方の違いで黙って無視しないため */
    function asternote_flag(string $name): bool
    {
        return defined($name) && filter_var(constant($name), FILTER_VALIDATE_BOOLEAN);
    }

    // 画面の下に script タグを出す。管理画面には出さない
    add_action('wp_footer', function () {
        $src = add_query_arg('ver', ASTERNOTE_VERSION, plugins_url('asternote.js', __FILE__));
        // 相対 URL にして、表のサイトと同じ場所に送る。管理画面だけ https や別のホストのとき、別サイト扱いで保存できなくなるため
        $endpoint = add_query_arg('action', ASTERNOTE_AJAX_ACTION, admin_url('admin-ajax.php', 'relative'));
        printf(
            '<script src="%s" data-endpoint="%s" data-project="%s"%s defer></script>' . "\n",
            esc_url($src),
            esc_url($endpoint),
            esc_attr(asternote_project()),
            asternote_flag('ASTERNOTE_DEFAULT_ON') ? ' data-default="on"' : ''
        );
    });

    // API は admin-ajax.php で受ける。WordPress を読み込んだ状態で動くので、wp-config.php の定数を使える
    // ログインしていない閲覧者も使えるよう、nopriv にも登録する。書き込みの制限は、サイト全体の Basic 認証に任せる
    function asternote_ajax(): void
    {
        if (!defined('ASTERNOTE_LIBRARY')) {
            define('ASTERNOTE_LIBRARY', true);
        }
        require_once __DIR__ . '/api.php';
        // WordPress は $_GET の値に \ を足している。ページのパスの ' などで、保存した値と一致しなくなるので戻す
        $_GET = wp_unslash($_GET);
        \Asternote\handle([
            'data_dir' => (string) ASTERNOTE_DATA_DIR,
            'projects' => [asternote_project()],
            'allow_anonymous' => asternote_flag('ASTERNOTE_ALLOW_ANONYMOUS'),
        ]);
    }
    add_action('wp_ajax_' . ASTERNOTE_AJAX_ACTION, 'asternote_ajax');
    add_action('wp_ajax_nopriv_' . ASTERNOTE_AJAX_ACTION, 'asternote_ajax');
}
unset($asternote_ok);
