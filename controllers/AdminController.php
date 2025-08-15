<?php
/**
 * Admin Controller - Handles admin-specific operations
 */
class AdminController {
    private $pdo;
    private $userManager;
    private $securityManager;
    
    public function __construct() {
        $this->pdo = getDBConnection();
        $this->userManager = new UserManager($this->pdo);
        $this->securityManager = new SecurityManager($this->pdo);
    }
    
    // Get dashboard statistics
    public function getDashboardStats($data) {
        validateUserPermissions($data, 'supervisor');
        
        try {
            $stats = [];
            
            // Total citizens
            $stmt = $this->pdo->prepare("SELECT COUNT(*) as total FROM citizens_data");
            $stmt->execute();
            $stats['totalCitizens'] = $stmt->fetch()['total'];
            
            // Total employees
            $stmt = $this->pdo->prepare("SELECT COUNT(*) as total FROM users");
            $stmt->execute();
            $stats['totalEmployees'] = $stmt->fetch()['total'];
            
            // Total blocks
            $stmt = $this->pdo->prepare("SELECT COUNT(*) as total FROM blocks");
            $stmt->execute();
            $stats['totalBlocks'] = $stmt->fetch()['total'];
            
            // Today's operations
            $stmt = $this->pdo->prepare("
                SELECT COUNT(*) as total FROM transaction_log 
                WHERE DATE(operation_time) = CURDATE()
            ");
            $stmt->execute();
            $stats['todayOperations'] = $stmt->fetch()['total'];
            
            $result = ['success' => true, 'data' => $stats];
            return $result;
        } catch (Exception $e) {
            logError("Error getting dashboard stats: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في جلب الإحصائيات'];
        }
    }
    
    // Get analytics data
    public function getAnalytics($data) {
        validateUserPermissions($data, 'supervisor');
        
        try {
            $analytics = [];
            
            // Gender distribution (values already stored in citizens_data.gender)
            $stmt = $this->pdo->prepare("
                SELECT gender, COUNT(*) as count 
                FROM citizens_data 
                WHERE gender IN ('ذكر', 'أنثى') 
                GROUP BY gender
            ");
            $stmt->execute();
            $genderData = $stmt->fetchAll();
            
            $analytics['gender_distribution'] = [
                'ذكر' => 0,
                'أنثى' => 0
            ];
            foreach ($genderData as $row) {
                $analytics['gender_distribution'][$row['gender']] = (int)$row['count'];
            }
            
            // Age distribution using birth_date
            $stmt = $this->pdo->prepare("
                SELECT 
                    CASE 
                        WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) < 18 THEN 'أقل من 18'
                        WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 18 AND 30 THEN '18-30'
                        WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 31 AND 50 THEN '31-50'
                        WHEN TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) BETWEEN 51 AND 65 THEN '51-65'
                        ELSE 'أكثر من 65'
                    END as age_group,
                    COUNT(*) as count
                FROM citizens_data 
                WHERE birth_date IS NOT NULL AND birth_date <> ''
                GROUP BY age_group
            ");
            $stmt->execute();
            $ageData = $stmt->fetchAll();
            $analytics['age_distribution'] = [];
            foreach ($ageData as $row) {
                $analytics['age_distribution'][$row['age_group']] = (int)$row['count'];
            }
            
            // Education distribution
            $stmt = $this->pdo->prepare("
                SELECT education, COUNT(*) as count 
                FROM citizens_data 
                WHERE education IS NOT NULL AND education != ''
                GROUP BY education
                ORDER BY count DESC
                LIMIT 10
            ");
            $stmt->execute();
            $educationData = $stmt->fetchAll();
            $analytics['education_distribution'] = [];
            foreach ($educationData as $row) {
                $analytics['education_distribution'][$row['education']] = (int)$row['count'];
            }
            
            // Housing distribution
            $stmt = $this->pdo->prepare("
                SELECT housing_type, COUNT(*) as count 
                FROM citizens_data 
                WHERE housing_type IS NOT NULL AND housing_type != ''
                GROUP BY housing_type
            ");
            $stmt->execute();
            $housingData = $stmt->fetchAll();
            $analytics['housing_distribution'] = [];
            foreach ($housingData as $row) {
                $analytics['housing_distribution'][$row['housing_type']] = (int)$row['count'];
            }
            
            // Total citizens
            $stmt = $this->pdo->prepare("SELECT COUNT(*) as total FROM citizens_data");
            $stmt->execute();
            $analytics['total_citizens'] = (int)($stmt->fetch()['total'] ?? 0);
            
            $result = ['success' => true, 'analytics' => $analytics];
            return $result;
        } catch (Exception $e) {
            logError("Error getting analytics: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في جلب التحليلات'];
        }
    }
    
    // Get system settings
    public function getSettings() {
        try {
            $stmt = $this->pdo->prepare("SELECT setting_key, setting_value, setting_type FROM system_settings");
            $stmt->execute();
            $settings = $stmt->fetchAll();
            
            $formattedSettings = [];
            foreach ($settings as $setting) {
                $value = $setting['setting_value'];
                if ($setting['setting_type'] === 'boolean') {
                    $value = (bool)$value;
                } elseif ($setting['setting_type'] === 'integer') {
                    $value = (int)$value;
                }
                $formattedSettings[$setting['setting_key']] = $value;
            }
            
            return ['success' => true, 'settings' => $formattedSettings];
        } catch (Exception $e) {
            logError("Error getting settings: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في جلب الإعدادات'];
        }
    }
    
    // Save system settings
    public function saveSystemSettings($data) {
        validateUserPermissions($data, 'admin');
        
        try {
            $this->pdo->beginTransaction();
            
            $settingsToUpdate = [
                'system_name' => $data['system_name'] ?? '',
                'admin_email' => $data['admin_email'] ?? '',
                'session_timeout' => $data['session_timeout'] ?? 30,
                'max_login_attempts' => $data['max_login_attempts'] ?? 5
            ];
            
            foreach ($settingsToUpdate as $key => $value) {
                $stmt = $this->pdo->prepare("
                    UPDATE system_settings 
                    SET setting_value = ?, updated_at = NOW() 
                    WHERE setting_key = ?
                ");
                $stmt->execute([$value, $key]);
            }
            
            $this->pdo->commit();
            return ['success' => true, 'message' => 'تم حفظ الإعدادات بنجاح'];
        } catch (Exception $e) {
            $this->pdo->rollBack();
            logError("Error saving system settings: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في حفظ الإعدادات'];
        }
    }
    
    // Update admin profile
    public function updateAdminProfile($data) {
        validateUserPermissions($data, 'admin');
        
        try {
            $user = $this->userManager->getUserByFirebaseUID($data['admin_uid']);
            if (!$user) {
                return ['success' => false, 'message' => 'المستخدم غير موجود'];
            }
            
            $updateData = [];
            if (isset($data['name'])) {
                $updateData['full_name'] = $data['name'];
            }
            
            if (!empty($updateData)) {
                $result = $this->userManager->updateUser($data['admin_uid'], $updateData);
                if ($result) {
                    return ['success' => true, 'message' => 'تم تحديث الملف الشخصي بنجاح'];
                }
            }
            
            return ['success' => false, 'message' => 'فشل في تحديث الملف الشخصي'];
        } catch (Exception $e) {
            logError("Error updating admin profile: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في تحديث الملف الشخصي'];
        }
    }
}
?>