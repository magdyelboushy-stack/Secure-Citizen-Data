<?php
// ملف الإعدادات الرئيسي للنظام - يحتوي على معلومات الاتصال بقاعدة البيانات

// إعدادات قاعدة البيانات
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');          // عنوان الخادم
define('DB_NAME', getenv('DB_NAME') ?: 'citizens_blockchain'); // اسم قاعدة البيانات
define('DB_USER', getenv('DB_USER') ?: 'root');               // اسم المستخدم
define('DB_PASS', getenv('DB_PASS') ?: '');                   // كلمة المرور
define('DB_CHARSET', 'utf8mb4');         // ترميز قاعدة البيانات لدعم النصوص العربية

// إعدادات الأمان والتشفير المحسنة
define('ENCRYPTION_KEY', getenv('ENCRYPTION_KEY') ?: 'MySecretKey2024@#$%Advanced!SecureBlockchain'); // مفتاح التشفير الرئيسي
define('ENCRYPTION_METHOD', 'AES-256-CBC'); // طريقة التشفير
define('HASH_ALGORITHM', 'sha256');      // خوارزمية الهاش المستخدمة في البلوك تشين
define('MINING_DIFFICULTY', (int)(getenv('MINING_DIFFICULTY') ?: 4));          // صعوبة التعدين (عدد الأصفار في بداية الهاش)


// تفعيل عرض الأخطاء للتطوير
error_reporting(0); // إيقاف عرض الأخطاء في الإنتاج
ini_set('display_errors', 0); // عدم عرض الأخطاء على الشاشة

// إعدادات الجلسة للأمان
ini_set('session.cookie_httponly', 1); // منع الوصول للكوكيز من JavaScript
ini_set('session.use_strict_mode', 1); // استخدام الوضع الصارم للجلسات

// بدء الجلسة بشكل آمن
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// دالة للاتصال بقاعدة البيانات باستخدام PDO
function getDBConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
        ];
        
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $e) {
        logError("خطأ في الاتصال بقاعدة البيانات: " . $e->getMessage());
        throw $e; // إعادة رمي الاستثناء ليتم التعامل معه لاحقاً
    }
}

// دالة تشفير البيانات الحساسة
function encryptSensitiveData($data) {
    if (empty($data)) {
        return '';
    }
    
    $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length(ENCRYPTION_METHOD));
    $encrypted = openssl_encrypt($data, ENCRYPTION_METHOD, ENCRYPTION_KEY, 0, $iv);
    
    // دمج IV مع البيانات المشفرة وترميزها بـ base64
    return base64_encode($iv . $encrypted);
}

// دالة فك تشفير البيانات الحساسة
function decryptSensitiveData($encryptedData) {
    if (empty($encryptedData)) {
        return '';
    }
    
    try {
        $data = base64_decode($encryptedData);
        $ivLength = openssl_cipher_iv_length(ENCRYPTION_METHOD);
        $iv = substr($data, 0, $ivLength);
        $encrypted = substr($data, $ivLength);
        
        $decrypted = openssl_decrypt($encrypted, ENCRYPTION_METHOD, ENCRYPTION_KEY, 0, $iv);
        return $decrypted !== false ? $decrypted : '';
    } catch (Exception $e) {
        logError("خطأ في فك التشفير: " . $e->getMessage());
        return '';
    }
}

// دالة إنشاء هاش للبحث (للبحث بدون كشف البيانات الأصلية)
function createSearchHash($data) {
    return hash('sha256', ENCRYPTION_KEY . strtolower(trim($data)));
}

// دالة لتشفير مجموعة من البيانات
function encryptCitizenData($citizenData) {
    $sensitiveFields = [
        'citizen_id', 'full_name', 'address', 'phone', 'email', 
        'job', 'education', 'religion', 'blood_type', 'nationality',
        'health_status', 'notes'
    ];
    
    $encryptedData = $citizenData;
    
    foreach ($sensitiveFields as $field) {
        if (isset($citizenData[$field]) && !empty($citizenData[$field])) {
            $encryptedData[$field] = encryptSensitiveData($citizenData[$field]);
        }
    }
    
    // إنشاء هاش للبحث بالرقم القومي
    if (isset($citizenData['citizen_id'])) {
        $encryptedData['search_hash'] = createSearchHash($citizenData['citizen_id']);
    }
    
    return $encryptedData;
}

// دالة لفك تشفير مجموعة من البيانات
function decryptCitizenData($encryptedData) {
    $sensitiveFields = [
        'citizen_id', 'full_name', 'address', 'phone', 'email', 
        'job', 'education', 'religion', 'blood_type', 'nationality',
        'health_status', 'notes'
    ];
    
    $decryptedData = $encryptedData;
    
    foreach ($sensitiveFields as $field) {
        if (isset($encryptedData[$field]) && !empty($encryptedData[$field])) {
            $decryptedData[$field] = decryptSensitiveData($encryptedData[$field]);
        }
    }
    
    return $decryptedData;
}

// دالة لتسجيل الأخطاء في ملف
function logError($message, $file = 'error.log') {
    $timestamp = date('Y-m-d H:i:s');
    $errorMessage = "[$timestamp] $message\n";
    file_put_contents($file, $errorMessage, FILE_APPEND | LOCK_EX);
}

// دالة للتحقق من صحة البيانات المدخلة
function sanitizeInput($input) {
    if (is_array($input)) {
        return array_map('sanitizeInput', $input);
    }
    $input = trim($input);
    $input = stripslashes($input);
    $input = htmlspecialchars($input, ENT_QUOTES, 'UTF-8');
    return $input;
}

// دالة للتحقق من صحة الرقم القومي المصري
function validateNationalID($id) {
    if (!preg_match('/^\d{14}$/', $id)) {
        return false;
    }
    
    $century = substr($id, 0, 1);
    $year = substr($id, 1, 2);
    $month = substr($id, 3, 2);
    $day = substr($id, 5, 2);
    
    $fullYear = ($century == '2' ? '19' : '20') . $year;
    if (!checkdate($month, $day, $fullYear)) {
        return false;
    }
    
    return true;
}

// رسائل النظام المختلفة
$success_messages = [
    'data_added' => 'تم إضافة بيانات المواطن بنجاح وتشفيرها بأمان',
    'data_updated' => 'تم تحديث البيانات بنجاح',
    'data_deleted' => 'تم حذف البيانات بنجاح',
    'chain_verified' => 'سلسلة البلوك تشين سليمة وآمنة.'
];

$error_messages = [
    'invalid_id' => 'الرقم القومي غير صحيح',
    'duplicate_id' => 'الرقم القومي موجود مسبقاً',
    'data_not_found' => 'البيانات غير موجودة',
    'database_error' => 'خطأ في قاعدة البيانات',
    'api_error' => 'خطأ في معالجة طلب API.',
    'encryption_error' => 'خطأ في عملية التشفير'
];
?>