<?php
/**
 * User Controller - Handles user management operations
 */
class UserController {
    private $pdo;
    private $userManager;
    
    public function __construct() {
        $this->pdo = getDBConnection();
        $this->userManager = new UserManager($this->pdo);
    }
    
    // Add employee
    public function addEmployee($data, $clientIp) {
        validateUserPermissions($data, 'admin');
        
        if (!isset($data['uid']) || !isset($data['name']) || !isset($data['email']) || !isset($data['role'])) {
            return ['success' => false, 'message' => 'الرجاء إكمال جميع البيانات المطلوبة'];
        }
        
        try {
            $result = $this->userManager->addUser($data['uid'], $data['email'], $data['name'], $data['role']);
            
            if ($result) {
                return ['success' => true, 'message' => 'تم إضافة الموظف بنجاح'];
            } else {
                return ['success' => false, 'message' => 'فشل في إضافة الموظف'];
            }
        } catch (Exception $e) {
            logError("Error adding employee: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في إضافة الموظف'];
        }
    }
    
    // Get employees
    public function getEmployees($data) {
        validateUserPermissions($data, 'supervisor');
        
        try {
            $employees = $this->userManager->getAllUsers();
            return ['success' => true, 'employees' => $employees];
        } catch (Exception $e) {
            logError("Error getting employees: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في جلب قائمة الموظفين'];
        }
    }
    
    // Edit employee
    public function editEmployee($data) {
        validateUserPermissions($data, 'admin');
        
        if (!isset($data['id']) || !isset($data['name']) || !isset($data['email']) || !isset($data['role'])) {
            return ['success' => false, 'message' => 'الرجاء إكمال جميع البيانات المطلوبة'];
        }
        
        try {
            $updateData = [
                'email' => $data['email'],
                'full_name' => $data['name'],
                'role' => $data['role'],
                'status' => $data['status'] ?? 'active'
            ];
            
            $result = $this->userManager->updateUser($data['id'], $updateData);
            
            if ($result) {
                return ['success' => true, 'message' => 'تم تحديث بيانات الموظف بنجاح'];
            } else {
                return ['success' => false, 'message' => 'فشل في تحديث بيانات الموظف'];
            }
        } catch (Exception $e) {
            logError("Error editing employee: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في تحديث بيانات الموظف'];
        }
    }
    
    // Delete employee
    public function deleteEmployee($data) {
        validateUserPermissions($data, 'admin');
        
        if (!isset($data['uid'])) {
            return ['success' => false, 'message' => 'معرف المستخدم مطلوب'];
        }
        
        try {
            $result = $this->userManager->deleteUser($data['uid']);
            
            if ($result) {
                return ['success' => true, 'message' => 'تم حذف الموظف بنجاح'];
            } else {
                return ['success' => false, 'message' => 'فشل في حذف الموظف'];
            }
        } catch (Exception $e) {
            logError("Error deleting employee: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في حذف الموظف'];
        }
    }
    
    // Check user permissions
    public function checkUserPermissions($data) {
        if (!isset($data['firebase_uid'])) {
            return ['success' => false, 'message' => 'معرف المستخدم مطلوب', 'has_access' => false];
        }
        
        try {
            $user = $this->userManager->getUserByFirebaseUID($data['firebase_uid']);
            
            // If not found by UID, try to locate by email and sync UID
            if (!$user && isset($data['email']) && !empty($data['email'])) {
                $stmt = $this->pdo->prepare("SELECT * FROM users WHERE email = ? AND status = 'active'");
                $stmt->execute([$data['email']]);
                $byEmail = $stmt->fetch();
                if ($byEmail) {
                    // Update stored firebase_uid to the new UID from Firebase
                    $this->userManager->updateUser($byEmail['firebase_uid'], ['email' => $byEmail['email']]); // no-op to reuse updateUser signature
                    $updateStmt = $this->pdo->prepare("UPDATE users SET firebase_uid = ? WHERE id = ?");
                    $updateStmt->execute([$data['firebase_uid'], $byEmail['id']]);
                    $user = $this->userManager->getUserByFirebaseUID($data['firebase_uid']);
                }
            }
            
            if (!$user) {
                return ['success' => false, 'message' => 'المستخدم غير موجود في النظام', 'has_access' => false];
            } else {
                $hasAccess = $this->userManager->hasPermission($user['role'], 'employee');
                return [
                    'success' => true, 
                    'user' => $user,
                    'has_access' => $hasAccess,
                    'role' => $user['role']
                ];
            }
        } catch (Exception $e) {
            logError("Error checking user permissions: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في التحقق من صلاحيات المستخدم', 'has_access' => false];
        }
    }
    
    // Log user login
    public function logUserLogin($data, $clientIp) {
        if (!isset($data['firebase_uid']) || !isset($data['email'])) {
            return ['success' => false, 'message' => 'بيانات المستخدم مطلوبة'];
        }
        
        try {
            $user = $this->userManager->getUserByFirebaseUID($data['firebase_uid']);
            $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';
            
            if ($user) {
                $this->userManager->logLogin($user['id'], $data['firebase_uid'], $data['email'], $clientIp, $userAgent, true);
                return ['success' => true, 'message' => 'تم تسجيل تسجيل الدخول بنجاح'];
            } else {
                $this->userManager->logLogin(0, $data['firebase_uid'], $data['email'], $clientIp, $userAgent, false, 'User not found in system');
                return ['success' => false, 'message' => 'المستخدم غير موجود في النظام'];
            }
        } catch (Exception $e) {
            logError("Error logging user login: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في تسجيل تسجيل الدخول'];
        }
    }
    
    // Get single employee
    public function getEmployee($data) {
        validateUserPermissions($data, 'supervisor');
        
        if (!isset($data['uid'])) {
            return ['success' => false, 'message' => 'معرف المستخدم مطلوب'];
        }
        
        try {
            $user = $this->userManager->getUserByFirebaseUID($data['uid']);
            
            if ($user) {
                // Normalize keys to match getAllUsers output
                $normalized = [
                    'uid' => $user['firebase_uid'] ?? ($user['uid'] ?? ''),
                    'email' => $user['email'] ?? '',
                    'name' => $user['full_name'] ?? ($user['name'] ?? ''),
                    'role' => $user['role'] ?? 'employee',
                    'status' => $user['status'] ?? 'active',
                    'created_at' => $user['created_at'] ?? null,
                    'last_login' => $user['last_login'] ?? null
                ];
                return ['success' => true, 'employee' => $normalized];
            } else {
                return ['success' => false, 'message' => 'الموظف غير موجود'];
            }
        } catch (Exception $e) {
            logError("Error getting employee: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في جلب بيانات الموظف'];
        }
    }
}
?>