<?php
/**
 * pin-notes の保存用 API。PHP 7.4 以降。
 *
 * GET  ?project=xxx[&page=/path/]   メモの一覧を返す。page を省くと全ページ分
 * POST {action:create, note:{...}}  メモを作る
 * POST {action:update, id, fields}  メモを更新する。fields に位置の値があれば位置も変える
 * POST {action:delete, id}          メモを削除する
 *
 * 書き込みの制限は、サーバー側の Basic 認証などに任せる。
 * Basic 認証を通っていないリクエストは断る。かけ忘れたまま動き続けないようにするため。
 * 直接開かれたときは、同じディレクトリの pin-notes.config.php の設定で動く。
 * ほかの PHP から使うときは、定数 PIN_NOTES_LIBRARY を定義してから読み込み、\PinNotes\handle($config) を呼ぶ。
 * WordPress のプラグインはこの方法で使う。関数と定数は名前空間 PinNotes に入れ、ほかのプラグインとぶつからないようにする。
 *   <?php return [
 *       'data_dir' => '/path/outside/docroot', // 必須。保存先。ドキュメントルートの外にする
 *       'projects' => ['myproject'],            // 必須。使える project 名の一覧
 *       'allow_anonymous' => false,             // 任意。true で Basic 認証の確認を外す
 *   ];
 */

declare(strict_types=1);

namespace PinNotes;

const STATUSES = ['open', 'decided', 'done'];
// 種類のキーと重要度の上限は pin-notes.js と export.mjs にも同じ値がある。変えるときは3か所をそろえる
const KINDS = ['memo', 'idea', 'fix', 'info', 'like'];
const MAX_IMPORTANCE = 3;
// 1つの project に保存できるメモの数。ディスクを埋められないようにする
const MAX_NOTES = 2000;
// POST の本文の上限。メモ1件は本文 2000 字と位置の値なので、これで十分に収まる
const MAX_REQUEST_BYTES = 65536;

/** 種類。知らない値は「メモ」にする */
function kind_value($value): string
{
    return in_array($value, KINDS, true) ? $value : 'memo';
}

/**
 * 重要度。0〜3 の整数に丸める。0 は指定なし。
 * 丸め方は pin-notes.js と export.mjs と同じ。数として読めない値は 0、小数は切り捨て、範囲外は端に寄せる
 */
function importance_value($value): int
{
    if (!is_numeric($value)) return 0;
    $n = (float) $value;
    if (!is_finite($n)) return 0;
    return (int) max(0, min(MAX_IMPORTANCE, floor($n < 0 ? ceil($n) : $n)));
}

function respond(int $code, array $data): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** 設定。handle() が最初に渡して検証し、以降はそれを返す */
function config(?array $set = null): array
{
    static $config = null;
    if ($set !== null) {
        if (empty($set['data_dir']) || !is_string($set['data_dir'])) {
            respond(500, ['error' => 'data_dir が設定されていません']);
        }
        // project 名を限らないと、名前を変えながら保存ファイルを際限なく作れる。設定がない、または形が違えば止める
        $projects = $set['projects'] ?? null;
        if (!is_array($projects) || !$projects || array_filter($projects, 'is_string') !== $projects) {
            respond(500, ['error' => 'projects を、project 名の配列で設定してください']);
        }
        $config = $set;
    }
    if ($config === null) respond(500, ['error' => '設定がありません']);
    return $config;
}

/** $path が $dir と同じか、その中にあるか。どちらも実在するパスで比べる */
function path_within(string $path, string $dir): bool
{
    $dir = rtrim($dir, '/');
    return $dir !== '' && ($path === $dir || strpos($path . '/', $dir . '/') === 0);
}

/**
 * 保存先のディレクトリを返す。なければ作る。
 * ドキュメントルートの中にあれば止める。保存データを URL で誰でも読めてしまうため。
 */
function data_dir(): string
{
    $dir = rtrim(config()['data_dir'], '/');
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        respond(500, ['error' => '保存先を作れません']);
    }
    $real = realpath($dir);
    if ($real === false) {
        respond(500, ['error' => '保存先を確かめられません']);
    }
    // api.php の置き場所は公開ディレクトリの中にある。DOCUMENT_ROOT が取れない環境でも、ここで止められる
    $roots = [__DIR__];
    $docroot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    if ($docroot !== false) $roots[] = $docroot;
    foreach ($roots as $root) {
        if (path_within($real, $root)) {
            respond(500, ['error' => '保存先がドキュメントルートの中にあります。外に移してください']);
        }
    }
    return $real;
}

/**
 * Basic 認証を通ったリクエストかを確かめる。
 * 認証のかけ忘れに気づけるように、通っていなければ止める。
 * CGI で動くレンタルサーバーでは REMOTE_USER、mod_rewrite を経ると REDIRECT_REMOTE_USER に入る。
 * どちらも、サーバーが ID とパスワードを確かめたあとにだけ入る。
 * PHP_AUTH_USER は使わない。サーバーが確かめていなくても、送られた Authorization ヘッダーから PHP が作るため。
 */
function require_auth(): void
{
    if ((config()['allow_anonymous'] ?? false) === true) return;
    foreach (['REMOTE_USER', 'REDIRECT_REMOTE_USER'] as $key) {
        if (!empty($_SERVER[$key])) return;
    }
    respond(403, ['error' => 'Basic 認証の情報が届いていません。サイトに Basic 認証をかけてください。認証なしで使う場合は、設定に allow_anonymous を書いてください']);
}

function project_name($value): string
{
    if (!is_string($value) || !preg_match('/^[a-z0-9_-]{1,40}$/', $value)) {
        respond(400, ['error' => 'project が不正です']);
    }
    // 設定にない名前では、保存ファイルを作らせない
    if (!in_array($value, config()['projects'], true)) {
        respond(404, ['error' => 'project が見つかりません']);
    }
    return $value;
}

function text($value, int $max): string
{
    if (!is_string($value)) return '';
    $value = trim(str_replace("\r\n", "\n", $value));
    return mb_substr($value, 0, $max);
}

/** 有限の数だけを受け付ける。INF や NAN は json_encode を失敗させるので 0 にする */
function num($value): float
{
    if (!is_numeric($value)) return 0.0;
    $n = (float) $value;
    return is_finite($n) ? $n : 0.0;
}

/**
 * 位置の値を検証して整える。作成と、ピンを動かしたときの更新で使う。
 * rx2 と ry2 があれば範囲のメモ、なければ点のメモとして扱う。
 */
function position_fields(array $src): array
{
    // 途中で切ったセレクターは別の要素を指しうる。長すぎるときは body 基準の座標に任せる
    // 上限は pin-notes.js の MAX_SELECTOR と同じ値にする。セレクターは ASCII だけなので文字数の数え方は一致する
    $selector = $src['selector'] ?? null;
    $area = is_numeric($src['rx2'] ?? null) && is_numeric($src['ry2'] ?? null);
    return [
        'selector' => (is_string($selector) && $selector !== '' && mb_strlen($selector) <= 500) ? $selector : 'body',
        'rx' => num($src['rx'] ?? 0),
        'ry' => num($src['ry'] ?? 0),
        'px' => num($src['px'] ?? 0),
        'py' => num($src['py'] ?? 0),
        'rx2' => $area ? num($src['rx2']) : null,
        'ry2' => $area ? num($src['ry2']) : null,
        'px2' => $area ? num($src['px2'] ?? 0) : null,
        'py2' => $area ? num($src['py2'] ?? 0) : null,
        'vw' => (int) num($src['vw'] ?? 0),
    ];
}

const POSITION_KEYS = ['selector', 'rx', 'ry', 'px', 'py', 'rx2', 'ry2', 'px2', 'py2', 'vw'];

/**
 * ロックを取ってメモの配列を読み書きする。
 * $fn は ['return' => 返す値] を返す。保存するときは 'save' => 新しい配列 も含める。
 * $write が false のときは共有ロックで読むだけにする。
 * $recover が true のとき（メモの作成）だけ、壊れた保存データを退避して空から続ける。
 */
function with_notes(string $project, callable $fn, bool $write, bool $recover = false)
{
    $dir = data_dir();
    $path = "$dir/$project.json";
    // 読むだけで、まだ保存データがなければ空を返す。ロックファイルも作らない
    // 存在しない project 名を次々に読ませて、ファイルを増やされないようにするため
    if (!$write && !is_file($path)) {
        return $fn([])['return'];
    }
    $lock = @fopen("$path.lock", 'c');
    if (!$lock || !flock($lock, $write ? LOCK_EX : LOCK_SH)) {
        respond(500, ['error' => 'ロックを取れません']);
    }

    $notes = [];
    $recovered = false;
    if (is_file($path)) {
        $raw = @file_get_contents($path);
        // 読み取り自体の失敗は一時的な I/O エラーかもしれない。データは壊れていないので触らない
        if ($raw === false) {
            respond(500, ['error' => '保存データを読み込めませんでした']);
        }
        $notes = json_decode($raw, true);
        if (!is_array($notes)) {
            // 中身が壊れている。読むだけのときは空として返し、警告ヘッダーで知らせる
            if (!$write) {
                header('X-Pin-Notes-Warning: corrupt-data');
                return $fn([])['return'];
            }
            // 更新や削除では、対象のメモが見つからないまま退避すると黙って全件が消える。理由を返して止める
            if (!$recover) {
                respond(409, ['error' => '保存データが壊れています。管理者に連絡してください']);
            }
            // 作成のときは、消さずに別名で退避して空から続ける。中身は手で戻せる
            if (!@rename($path, $path . '.corrupt-' . gmdate('YmdHis'))) {
                respond(500, ['error' => '保存データを退避できませんでした']);
            }
            $recovered = true;
            $notes = [];
        }
    }

    $result = $fn($notes);
    if ($write && array_key_exists('save', $result)) {
        $json = json_encode(array_values($result['save']), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        $tmp = "$path.tmp";
        if ($json === false || @file_put_contents($tmp, $json) !== strlen($json) || !@rename($tmp, $path)) {
            @unlink($tmp);
            respond(500, ['error' => '保存できませんでした']);
        }
        // 退避したことは、新しいファイルの保存に成功してから知らせる
        if ($recovered) header('X-Pin-Notes-Warning: recovered-from-corrupt-data');
    }
    flock($lock, LOCK_UN);
    fclose($lock);
    return $result['return'];
}

/**
 * リクエストを1件処理して応答を返す。最後に必ず exit する。
 * $config は pin-notes.config.php と同じ形の配列。
 */
function handle($config): void
{
    // PHP の警告を応答に出さない。警告にはサーバーのパスが入り、JSON も壊れる。失敗は戻り値で判定する
    ini_set('display_errors', '0');
    ini_set('log_errors', '1');

    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');

    config(is_array($config) ? $config : []);

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    require_auth();

    if ($method === 'GET') {
        $project = project_name($_GET['project'] ?? '');
        $page = isset($_GET['page']) ? text($_GET['page'], 300) : null;
        $notes = with_notes($project, function (array $notes) use ($page) {
            return ['return' => array_values(array_filter($notes, function ($n) use ($page) {
                return $page === null || ($n['page'] ?? '') === $page;
            }))];
        }, false);
        respond(200, ['notes' => $notes]);
    }

    if ($method !== 'POST') {
        respond(405, ['error' => 'GET か POST だけを受け付けます']);
    }

    // 別サイトからの書き込みを防ぐ。独自ヘッダーはブラウザが勝手に付けられない
    if (($_SERVER['HTTP_X_PIN_NOTES'] ?? '') !== '1') {
        respond(403, ['error' => 'ヘッダーがありません']);
    }

    // 大きすぎる本文は読み切る前に断る。Content-Length は偽れるので、読んだ長さでも確かめる
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > MAX_REQUEST_BYTES) {
        respond(413, ['error' => 'リクエストが大きすぎます']);
    }
    $raw = (string) file_get_contents('php://input', false, null, 0, MAX_REQUEST_BYTES + 1);
    if (strlen($raw) > MAX_REQUEST_BYTES) {
        respond(413, ['error' => 'リクエストが大きすぎます']);
    }
    $input = json_decode($raw, true);
    if (!is_array($input)) {
        respond(400, ['error' => 'JSON が不正です']);
    }
    $project = project_name($input['project'] ?? '');
    $action = $input['action'] ?? '';
    $now = gmdate('Y-m-d\TH:i:s\Z');

    if ($action === 'create') {
        $src = is_array($input['note'] ?? null) ? $input['note'] : [];
        $body = text($src['body'] ?? '', 2000);
        if ($body === '') respond(400, ['error' => '本文が空です']);
        $note = [
            'id' => bin2hex(random_bytes(6)),
            'page' => text($src['page'] ?? '/', 300),
            'title' => text($src['title'] ?? '', 200),
        ] + position_fields($src) + [
            'body' => $body,
            'author' => text($src['author'] ?? '', 40),
            'status' => in_array($src['status'] ?? '', STATUSES, true) ? $src['status'] : 'open',
            'kind' => kind_value($src['kind'] ?? 'memo'),
            'importance' => importance_value($src['importance'] ?? 0),
            'createdAt' => $now,
            'updatedAt' => $now,
        ];
        with_notes($project, function (array $notes) use ($note) {
            if (count($notes) >= MAX_NOTES) {
                respond(409, ['error' => 'メモの数が上限の ' . MAX_NOTES . ' 件に達しています']);
            }
            $notes[] = $note;
            return ['save' => $notes, 'return' => $note];
        }, true, true);
        respond(200, ['note' => $note]);
    }

    if ($action === 'update' || $action === 'delete') {
        $id = text($input['id'] ?? '', 40);
        $fields = is_array($input['fields'] ?? null) ? $input['fields'] : [];
        $found = with_notes($project, function (array $notes) use ($action, $id, $fields, $now) {
            $found = null;
            foreach ($notes as $i => $n) {
                if (($n['id'] ?? '') !== $id) continue;
                if ($action === 'delete') {
                    unset($notes[$i]);
                    $found = $n;
                    break;
                }
                if (array_key_exists('body', $fields)) {
                    $body = text($fields['body'], 2000);
                    if ($body !== '') $n['body'] = $body;
                }
                if (array_key_exists('author', $fields)) $n['author'] = text($fields['author'], 40);
                if (in_array($fields['status'] ?? '', STATUSES, true)) $n['status'] = $fields['status'];
                if (array_key_exists('kind', $fields)) $n['kind'] = kind_value($fields['kind']);
                if (array_key_exists('importance', $fields)) $n['importance'] = importance_value($fields['importance']);
                // 位置の値が1つでもあれば、ピンを動かしたとみなして位置を更新する
                // 送られなかった値は今の値を引き継ぐ。一部だけ送られても、ほかの値が初期値に戻らないように
                if (array_intersect(POSITION_KEYS, array_keys($fields))) {
                    $current = array_intersect_key($n, array_flip(POSITION_KEYS));
                    $n = array_merge($n, position_fields(array_merge($current, $fields)));
                }
                $n['updatedAt'] = $now;
                $notes[$i] = $n;
                $found = $n;
                break;
            }
            // 見つからなければ書き直さない
            return $found === null ? ['return' => null] : ['save' => $notes, 'return' => $found];
        }, true);
        if ($found === null) respond(404, ['error' => 'メモが見つかりません']);
        respond(200, $action === 'delete' ? ['ok' => true] : ['note' => $found]);
    }

    respond(400, ['error' => 'action が不正です']);
}

// 直接開かれたときだけ、隣の設定ファイルで動く。ライブラリとして読み込まれたときは関数の定義だけにする
// WordPress のプラグインの中に置かれたものは、直接開かれても 404 だけを返す。導入していることを知らせないため
if (!\defined('PIN_NOTES_LIBRARY') && \is_file(__DIR__ . '/pin-notes.php')) {
    \http_response_code(404);
    exit;
}
if (!\defined('PIN_NOTES_LIBRARY')) {
    $file = __DIR__ . '/pin-notes.config.php';
    handle(is_file($file) ? (require $file) : []);
}
