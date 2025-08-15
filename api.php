<?php
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// لا تعرض الأخطاء في الاستجابة
ini_set('display_errors', 0);
error_reporting(0);

require_once 'config.php';
require_once 'blockchain.php';

// Include all models
require_once 'models/SecurityManager.php';
require_once 'models/UserManager.php';

// Include all controllers
require_once 'controllers/CitizenController.php';
require_once 'controllers/UserController.php';
require_once 'controllers/AdminController.php';
require_once 'controllers/SecurityController.php';
require_once 'controllers/AnalyticsController.php';

// Include utilities
require_once 'utils/Security.php';

// التحقق من طريقة الطلب
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// الحصول على عنوان IP الحقيقي
$clientIp = getRealIpAddr();

// التحقق من Rate Limiting
if (!checkRateLimit($clientIp, 'api_request')) {
    http_response_code(429);
    echo json_encode(['error' => 'Too many requests. Please try again later.']);
    exit;
}

// قراءة البيانات المرسلة
$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON data']);
    exit;
}

// التحقق من وجود action
if (!isset($data['action'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Action is required']);
    exit;
}

try {
    // تهيئة SecurityManager
    $securityManager = new SecurityManager(getDBConnection());
    
    // التحقق من حظر IP
    if ($securityManager->isBlocked($clientIp)) {
        http_response_code(403);
        echo json_encode(['error' => 'Access denied. Your IP is temporarily blocked.']);
        exit;
    }
    
    // تهيئة جميع Controllers
    $citizenController = new CitizenController();
    $userController = new UserController();
    $adminController = new AdminController();
    $securityController = new SecurityController();
    $analyticsController = new AnalyticsController();
    
    // توجيه الطلب إلى Controller المناسب
    switch ($data['action']) {
        // Citizen Actions
        case 'add_citizen':
            $result = $citizenController->addCitizen($data, $clientIp);
            break;
            
        case 'get_citizen':
            $result = $citizenController->getCitizen($data, $clientIp);
            break;
            
        case 'get_stats':
        case 'get_system_stats':
            $result = $citizenController->getSystemStats();
            break;
            
        case 'verify_chain':
            $result = $citizenController->verifyChain();
            break;
            
        case 'get_blocks':
            $page = isset($data['page']) ? (int)$data['page'] : 1;
            $result = $citizenController->getBlocks($page);
            break;
            
        case 'get_transaction_log':
            $limit = isset($data['limit']) ? (int)$data['limit'] : 50;
            $result = $citizenController->getTransactionLog($limit);
            break;
        
        case 'get_citizens':
            $result = $citizenController->getCitizensList($data);
            break;
            
        // User Management Actions
        case 'add_employee':
            $result = $userController->addEmployee($data, $clientIp);
            break;
            
        case 'get_employees':
            $result = $userController->getEmployees($data);
            break;
            
        case 'edit_employee':
            $result = $userController->editEmployee($data);
            break;
            
        case 'delete_employee':
            $result = $userController->deleteEmployee($data);
            break;
            
        case 'check_user_permissions':
            $result = $userController->checkUserPermissions($data);
            break;
            
        case 'log_user_login':
            $result = $userController->logUserLogin($data, $clientIp);
            break;
            
        case 'get_employee':
            $result = $userController->getEmployee($data);
            break;
            
        // Admin Actions
        case 'get_dashboard_stats':
            $result = $adminController->getDashboardStats($data);
            break;
            
        case 'get_analytics':
            $result = $adminController->getAnalytics($data);
            break;
            
        case 'get_settings':
            $result = $adminController->getSettings();
            break;
            
        case 'save_system_settings':
            $result = $adminController->saveSystemSettings($data);
            break;
            
        case 'update_admin_profile':
            $result = $adminController->updateAdminProfile($data);
            break;
            
        // Security Actions
        case 'get_security_status':
            $result = $securityController->getSecurityStatus($data);
            break;
            
        case 'verify_chain_admin':
            $result = $securityController->verifyChain($data);
            break;
            
        case 'save_security_settings':
            $result = $securityController->saveSecuritySettings($data);
            break;
            
        case 'emergency_lockdown':
            $result = $securityController->emergencyLockdown($data);
            break;
            
        case 'emergency_reset':
            $result = $securityController->emergencyReset($data);
            break;
            
        // Analytics Actions
        case 'get_admin_logs':
            $result = $analyticsController->getAdminLogs($data);
            break;
            
        case 'search_logs':
            $result = $analyticsController->searchLogs($data);
            break;
            
        case 'filter_logs':
            $result = $analyticsController->filterLogs($data);
            break;
            
        case 'filter_logs_by_date':
            $result = $analyticsController->filterLogsByDate($data);
            break;
            
        case 'export_logs':
            $result = $analyticsController->exportLogs($data);
            break;
            
        case 'create_backup':
            $result = $analyticsController->createBackup($data);
            break;
            
        case 'get_backup_history':
            $result = $analyticsController->getBackupHistory($data);
            break;
            
        case 'delete_backup':
            $result = $analyticsController->deleteBackup($data);
            break;

        case 'download_backup':
            $result = $analyticsController->downloadBackup($data);
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Unknown action: ' . $data['action']]);
            exit;
    }
    
    // إعادة تعيين المحاولات الفاشلة في حالة النجاح
    $securityManager->resetFailedAttempts($clientIp, $data['action']);
    
    // إرجاع النتيجة
    echo json_encode($result);
    
} catch (Exception $e) {
    // تسجيل المحاولة الفاشلة
    if (isset($securityManager)) {
        $securityManager->logFailedAttempt($clientIp, $data['action'], $e->getMessage());
    }
    
    // إرجاع خطأ
    handleApiError($e->getMessage());
}

exit;
?>