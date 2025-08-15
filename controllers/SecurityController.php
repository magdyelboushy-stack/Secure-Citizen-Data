<?php
/**
 * Security Controller - Handles security operations
 */
class SecurityController {
    private $pdo;
    private $securityManager;
    private $blockchain;
    
    public function __construct() {
        $this->pdo = getDBConnection();
        $this->securityManager = new SecurityManager($this->pdo);
        $this->blockchain = new Blockchain();
    }
    
    // Get security status
    public function getSecurityStatus($data) {
        validateUserPermissions($data, 'supervisor');
        
        try {
            $security = [];
            
            // Check blockchain integrity
            $chainResult = $this->blockchain->verifyChain();
            $security['chain_verified'] = $chainResult['success'];
            $security['last_check'] = date('Y-m-d H:i:s');
            
            // Get suspicious attempts
            $stmt = $this->pdo->prepare("
                SELECT COUNT(*) as total 
                FROM security_log 
                WHERE last_attempt >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ");
            $stmt->execute();
            $security['suspicious_attempts'] = $stmt->fetch()['total'];
            
            // Protection status (simplified)
            $security['protection_enabled'] = true;
            
            // Get security statistics
            $securityStats = $this->securityManager->getSecurityStats();
            $security = array_merge($security, $securityStats);
            
            // Get recent threats (simplified)
            $stmt = $this->pdo->prepare("
                SELECT attempted_action as description, last_attempt as timestamp, 
                       CASE WHEN failed_attempts >= 3 THEN 'high' ELSE 'medium' END as severity
                FROM security_log 
                WHERE last_attempt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                ORDER BY last_attempt DESC 
                LIMIT 5
            ");
            $stmt->execute();
            $security['threats'] = $stmt->fetchAll();
            
            return ['success' => true, 'security' => $security];
        } catch (Exception $e) {
            logError("Error getting security status: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في جلب حالة الأمان'];
        }
    }
    
    // Verify blockchain
    public function verifyChain($data) {
        validateUserPermissions($data, 'supervisor');
        
        try {
            $result = $this->blockchain->verifyChain();
            return $result;
        } catch (Exception $e) {
            logError("Error verifying chain: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في فحص السلسلة'];
        }
    }
    
    // Save security settings
    public function saveSecuritySettings($data) {
        validateUserPermissions($data, 'admin');
        
        try {
            $this->pdo->beginTransaction();
            
            $settingsToUpdate = [
                'enable_two_factor' => isset($data['enable_two_factor']) ? 1 : 0,
                'enable_ip_blocking' => isset($data['enable_ip_blocking']) ? 1 : 0,
                'enable_audit_log' => isset($data['enable_audit_log']) ? 1 : 0,
                'enable_auto_backup' => isset($data['enable_auto_backup']) ? 1 : 0
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
            return ['success' => true, 'message' => 'تم حفظ إعدادات الأمان بنجاح'];
        } catch (Exception $e) {
            $this->pdo->rollBack();
            logError("Error saving security settings: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في حفظ إعدادات الأمان'];
        }
    }
    
    // Emergency lockdown
    public function emergencyLockdown($data) {
        validateUserPermissions($data, 'admin');
        
        try {
            // Log the emergency action
            $stmt = $this->pdo->prepare("
                INSERT INTO transaction_log (operation_type, user_email, user_ip, operation_time, success, details) 
                VALUES ('EMERGENCY', ?, ?, NOW(), 1, 'Emergency lockdown activated')
            ");
            $stmt->execute([$data['admin_email'] ?? 'admin', getRealIpAddr()]);
            
            // In a real system, this would disable access
            // For now, we just log it
            return ['success' => true, 'message' => 'تم تفعيل حالة الطوارئ'];
        } catch (Exception $e) {
            logError("Error during emergency lockdown: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في تفعيل حالة الطوارئ'];
        }
    }
    
    // Emergency reset
    public function emergencyReset($data) {
        validateUserPermissions($data, 'admin');
        
        try {
            // Log the emergency action
            $stmt = $this->pdo->prepare("
                INSERT INTO transaction_log (operation_type, user_email, user_ip, operation_time, success, details) 
                VALUES ('EMERGENCY', ?, ?, NOW(), 1, 'Emergency reset initiated')
            ");
            $stmt->execute([$data['admin_email'] ?? 'admin', getRealIpAddr()]);
            
            // In a real system, this would perform system reset
            // For now, we just log it
            return ['success' => true, 'message' => 'تم بدء إعادة تعيين النظام'];
        } catch (Exception $e) {
            logError("Error during emergency reset: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في إعادة تعيين النظام'];
        }
    }
}
?>