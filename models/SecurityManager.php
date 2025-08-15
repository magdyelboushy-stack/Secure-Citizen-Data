<?php
/**
 * Security Manager - Handles security operations and logging
 */
class SecurityManager {
    private $pdo;
    private $maxAttempts = 5;
    private $blockDuration = 300; // 5 minutes
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    
    // Check if IP is blocked
    public function isBlocked($ip) {
        try {
            $stmt = $this->pdo->prepare("
                SELECT blocked_until 
                FROM security_log 
                WHERE user_ip = ? AND blocked_until > NOW()
            ");
            $stmt->execute([$ip]);
            return $stmt->fetch() !== false;
        } catch (PDOException $e) {
            logError("Error checking IP block status: " . $e->getMessage());
            return false;
        }
    }
    
    // Log failed attempt
    public function logFailedAttempt($ip, $action, $details = '') {
        try {
            // Check for existing record
            $stmt = $this->pdo->prepare("
                SELECT id, failed_attempts 
                FROM security_log 
                WHERE user_ip = ? AND attempted_action = ?
            ");
            $stmt->execute([$ip, $action]);
            $existing = $stmt->fetch();
            
            if ($existing) {
                $newAttempts = $existing['failed_attempts'] + 1;
                $blockedUntil = null;
                
                if ($newAttempts >= $this->maxAttempts) {
                    $blockedUntil = date('Y-m-d H:i:s', time() + $this->blockDuration);
                }
                
                $updateStmt = $this->pdo->prepare("
                    UPDATE security_log 
                    SET failed_attempts = ?, last_attempt = NOW(), blocked_until = ?, details = ?
                    WHERE id = ?
                ");
                $updateStmt->execute([$newAttempts, $blockedUntil, $details, $existing['id']]);
            } else {
                $insertStmt = $this->pdo->prepare("
                    INSERT INTO security_log (user_ip, attempted_action, failed_attempts, details) 
                    VALUES (?, ?, 1, ?)
                ");
                $insertStmt->execute([$ip, $action, $details]);
            }
        } catch (PDOException $e) {
            logError("Error logging failed attempt: " . $e->getMessage());
        }
    }
    
    // Reset failed attempts after successful operation
    public function resetFailedAttempts($ip, $action) {
        try {
            $stmt = $this->pdo->prepare("
                DELETE FROM security_log 
                WHERE user_ip = ? AND attempted_action = ?
            ");
            $stmt->execute([$ip, $action]);
        } catch (PDOException $e) {
            logError("Error resetting failed attempts: " . $e->getMessage());
        }
    }
    
    // Get security statistics
    public function getSecurityStats() {
        try {
            $stats = [];
            
            // Total logins
            $stmt = $this->pdo->prepare("SELECT COUNT(*) as total FROM login_history WHERE success = 1");
            $stmt->execute();
            $stats['total_logins'] = $stmt->fetch()['total'];
            
            // Failed logins
            $stmt = $this->pdo->prepare("SELECT COUNT(*) as total FROM login_history WHERE success = 0");
            $stmt->execute();
            $stats['failed_logins'] = $stmt->fetch()['total'];
            
            // Blocked IPs
            $stmt = $this->pdo->prepare("SELECT COUNT(DISTINCT user_ip) as total FROM security_log WHERE blocked_until > NOW()");
            $stmt->execute();
            $stats['blocked_ips'] = $stmt->fetch()['total'];
            
            // Calculate security score (simplified)
            $totalAttempts = $stats['total_logins'] + $stats['failed_logins'];
            if ($totalAttempts > 0) {
                $successRate = ($stats['total_logins'] / $totalAttempts) * 100;
                $stats['security_score'] = round($successRate) . '%';
            } else {
                $stats['security_score'] = '100%';
            }
            
            return $stats;
        } catch (PDOException $e) {
            logError("Error getting security stats: " . $e->getMessage());
            return [
                'total_logins' => 0,
                'failed_logins' => 0,
                'blocked_ips' => 0,
                'security_score' => '85%'
            ];
        }
    }
}
?>
