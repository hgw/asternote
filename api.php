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
 * 保存先は同じディレクトリの pin-notes.config.php で指定する。
 *   <?php return ['data_dir' => '/path/outside/docroot'];
 */

declare(strict_types=1);

// PHP の警告を応答に出さない。警告にはサーバーのパスが入り、JSON も壊れる。失敗は戻り値で判定する
ini_set('display_errors', '0');
ini_set('log_errors', '1');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const STATUSES = ['open', 'decided', 'done'];
// 種類のキーと重要度の上限は pin-notes.js と export.mjs にも同じ値がある。変えるときは3か所をそろえる
const KINDS = ['memo', 'idea', 'fix', 'info', 'like'];
const MAX_IMPORTANCE = 3;

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

function config(): array
{
    $file = __DIR__ . '/pin-notes.config.php';
    $config = is_file($file) ? require $file : [];
    if (!is_array($config) || empty($config['data_dir'])) {
        respond(500, ['error' => 'data_dir が設定されていません']);
    }
    return $config;
}

function project_name($value): string
{
    if (!is_string($value) || !preg_match('/^[a-z0-9_-]{1,40}$/', $value)) {
        respond(400, ['error' => 'project が不正です']);
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
    $dir = rtrim(config()['data_dir'], '/');
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        respond(500, ['error' => '保存先を作れません']);
    }
    $path = "$dir/$project.json";
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

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

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

$input = json_decode((string) file_get_contents('php://input'), true);
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
