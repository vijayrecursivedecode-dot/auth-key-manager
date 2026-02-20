<?php
// =======================================================================
// LK TRANSLATOR API (Standalone)
// Compatible with: LKTEAM APK Protocol (Base64/XOR/RSA)
// Backend: Existing "keys_code" Database
// Game: Hardcoded to 'PUBG'
// =======================================================================

header('Content-Type: text/plain');
error_reporting(0); // Supress errors to keep response clean

// 1. CONFIGURATION & DATABASE
// =======================================================================
require_once 'conn.php'; // Ensure this file establishes connection as $conn

// Path to your Private Key (Must match the Public Key in the APK)
$PRIVATE_KEY_PATH = 'power_private.pem'; 

// Hardcode Game Name
$TARGET_GAME = 'ROOT'; 

// Load Private Key
$pk_content = file_get_contents($PRIVATE_KEY_PATH);
if (!$pk_content) {
    die("Server Error: power_private.pem is missing.");
}
$lkPrivateKey = openssl_get_privatekey($pk_content);

// =======================================================================
// 2. MAIN LOGIC
// =======================================================================

// A. Receive & Decrypt Request
if (isset($_POST['tokserver_hk'])) {
    
    // 1. Decode Base64 Envelope
    $env = json_decode(base64_decode($_POST['tokserver_hk']), true);
    
    if (isset($env['Dados_hk'])) {
        // 2. RSA Decrypt the inner data
        $encrypted_data = base64_decode($env['Dados_hk']);
        $decrypted_json = "";
        
        if (openssl_private_decrypt($encrypted_data, $decrypted_json, $lkPrivateKey, OPENSSL_PKCS1_PADDING)) {
            $req = json_decode($decrypted_json, true);
            
            $user_key = $req['User_hk'] ?? ''; // The License Key
            $serial   = $req['Uid_hk']  ?? ''; // The HWID
            $req_tok  = $env['Tok_hk']  ?? "NATIVE_DRM";
            
            // Process the login
            processLogin($conn, $user_key, $serial, $req_tok, $lkPrivateKey, $TARGET_GAME);
            
        } else {
            die("Security Error: Decryption Failed");
        }
    } else {
        die("Invalid Request Format");
    }
} else {
    // If opened in browser without POST data
    echo "Made By Powercheatsowner
Telegram: @Powercheatsowner";
}

// =======================================================================
// 3. PROCESSING FUNCTION
// =======================================================================

function processLogin($conn, $uKey, $sDev, $token, $privKey, $gameName) {
    
    // --- CHECK 1: MAINTENANCE MODE ---
    $sqlMt = "SELECT * FROM onoff WHERE id=1";
    $resMt = mysqli_query($conn, $sqlMt);
    $mtRow = mysqli_fetch_assoc($resMt);

    if ($mtRow && $mtRow['status'] == 'on') {
        $msg = $mtRow['myinput'] ?? "Server is in Maintenance";
        sendLkResponse(["msg" => $msg, "user" => $uKey], false, $token, $privKey);
    }

    // --- CHECK 2: INPUT VALIDATION ---
    if (empty($uKey) || empty($sDev)) {
        sendLkResponse(["msg" => "Invalid Parameters", "user" => $uKey], false, $token, $privKey);
    }

    // --- CHECK 3: FIND KEY (Force Game = PUBG) ---
    // We sanitize inputs to prevent SQL Injection since we are using raw mysqli
    $safeKey  = mysqli_real_escape_string($conn, $uKey);
    $safeGame = mysqli_real_escape_string($conn, $gameName);
    
    $sqlKey = "SELECT * FROM keys_code WHERE user_key='$safeKey' AND game='$safeGame' LIMIT 1";
    $resKey = mysqli_query($conn, $sqlKey);
    $keyData = mysqli_fetch_assoc($resKey);

    if (!$keyData) {
        sendLkResponse(["msg" => "Key Not Found or Wrong Game", "user" => $uKey], false, $token, $privKey);
    }

    // --- CHECK 4: KEY STATUS (Banned/Locked) ---
    if ($keyData['status'] != 1) {
        sendLkResponse(["msg" => "KEY BANNED / LOCKED", "user" => $uKey], false, $token, $privKey);
    }

    // --- CHECK 5: DEVICE (HWID) ---
    $current_devices = $keyData['devices'];
    $max_devices     = $keyData['max_devices'];
    
    // Check if device logic allows connection
    $deviceUpdate = handleDevices($sDev, $current_devices, $max_devices);
    
    if ($deviceUpdate === false) {
        sendLkResponse(["msg" => "MAX DEVICES REACHED", "user" => $uKey], false, $token, $privKey);
    }

    // Update DB with new device string if it changed
    if ($deviceUpdate !== $current_devices) {
        $safeDevs = mysqli_real_escape_string($conn, $deviceUpdate);
        mysqli_query($conn, "UPDATE keys_code SET devices='$safeDevs' WHERE id_keys='{$keyData['id_keys']}'");
    }

    // --- CHECK 6: EXPIRATION ---
    $now = time();
    $db_expire = $keyData['expired_date']; // Assuming format 'Y-m-d H:i:s' or similar

    if (empty($db_expire)) {
        // First login: Set Expiration
        $durationHours = $keyData['duration']; // e.g., 24
        $newExpDate = date('Y-m-d H:i:s', strtotime("+$durationHours hours"));
        
        mysqli_query($conn, "UPDATE keys_code SET expired_date='$newExpDate' WHERE id_keys='{$keyData['id_keys']}'");
    } else {
        // Check existing expiration
        if (strtotime($db_expire) < $now) {
            sendLkResponse(["msg" => "KEY EXPIRED", "user" => $uKey], false, $token, $privKey);
        }
    }

    // --- SUCCESS ---
    sendLkResponse(["msg" => "Login Success", "user" => $uKey], true, $token, $privKey);
}

// =======================================================================
// 4. HELPER FUNCTIONS
// =======================================================================

/**
 * Logic to check and add HWID
 * Returns: New device string (if allowed), or FALSE (if max reached)
 */
function handleDevices($serial, $dbDevicesString, $max) {
    $devicesArr = array_filter(explode(',', $dbDevicesString)); // Split by comma, remove empty
    
    if (in_array($serial, $devicesArr)) {
        // Device already exists, allow it.
        return $dbDevicesString; 
    }
    
    if (count($devicesArr) < $max) {
        // Add new device
        $devicesArr[] = $serial;
        return implode(',', $devicesArr);
    }
    
    // Max reached and not in list
    return false;
}

/**
 * Generates the encrypted response for LKTEAM App
 */
function sendLkResponse($data, $isSuccess, $origTok, $privKey) {
    
    // 1. JSON Payload
    $res = [
        "ConnectSt_hk"  => $isSuccess ? "HasBeenSucceeded" : "Failed",
        "Logged_UserHK" => $data['user'] ?? "",
        "Logged_TokHK"  => $origTok,
        "MessageFromSv" => $data['msg'] ?? "",
        "piddaemon"     => "1",
        "Status_hk"     => $isSuccess ? "1" : "0", // 1 = Active, 0 = Error
        "time"          => (string)time()
    ];

    $jsonStr = json_encode($res, JSON_UNESCAPED_SLASHES);

    // 2. Sign (SHA256 with Private Key)
    $signature = '';
    openssl_sign($jsonStr, $signature, $privKey, OPENSSL_ALGO_SHA256);

    // 3. Create Hash for XOR
    $hash = hash('sha256', $jsonStr);

    // 4. XOR Encryption
    $encrypted = "";
    $jLen = strlen($jsonStr);
    $hLen = strlen($hash);
    for ($i = 0; $i < $jLen; $i++) {
        $encrypted .= $jsonStr[$i] ^ $hash[$i % $hLen];
    }

    // 5. Final Wrapper
    $finalResponse = [
        "Dados_hk" => base64_encode($encrypted),
        "Hash_hk"  => $hash,
        "Sign_hk"  => base64_encode($signature)
    ];

    // 6. Output Base64
    die(base64_encode(json_encode($finalResponse)));
}
?>