<?php
/**
 * Analytics Controller - Handles analytics and reporting operations
 */
class AnalyticsController {
    private $pdo;
    
    public function __construct() {
        $this->pdo = getDBConnection();
    }
    
    // Get admin logs
    public function getAdminLogs($data) {
        validateUserPermissions($data, 'supervisor');
        
        try {
            $stmt = $this->pdo->prepare("
                SELECT 
                    tl.operation_type,
                    tl.user_email,
                    u.full_name AS user_name,
                    tl.user_ip,
                    tl.operation_time,
                    tl.success,
                    tl.details
                FROM transaction_log tl
                LEFT JOIN users u ON u.email = tl.user_email
                ORDER BY tl.operation_time DESC 
                LIMIT 100
            ");
            $stmt->execute();
            $logs = $stmt->fetchAll();
            
            return ['success' => true, 'logs' => $logs];
        } catch (Exception $e) {
            logError("Error getting admin logs: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في جلب سجل العمليات'];
        }
    }
    
    // Search logs
    public function searchLogs($data) {
        validateUserPermissions($data, 'supervisor');
        
        if (!isset($data['search'])) {
            return ['success' => false, 'message' => 'مصطلح البحث مطلوب'];
        }
        
        try {
            $searchTerm = '%' . $data['search'] . '%';
            $stmt = $this->pdo->prepare("
                SELECT 
                    tl.operation_type,
                    tl.user_email,
                    u.full_name AS user_name,
                    tl.user_ip,
                    tl.operation_time,
                    tl.success,
                    tl.details
                FROM transaction_log tl
                LEFT JOIN users u ON u.email = tl.user_email
                WHERE tl.user_email LIKE ? OR tl.details LIKE ? OR tl.operation_type LIKE ? OR u.full_name LIKE ?
                ORDER BY tl.operation_time DESC 
                LIMIT 100
            ");
            $stmt->execute([$searchTerm, $searchTerm, $searchTerm, $searchTerm]);
            $logs = $stmt->fetchAll();
            
            return ['success' => true, 'logs' => $logs];
        } catch (Exception $e) {
            logError("Error searching logs: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في البحث في السجلات'];
        }
    }
    
    // Filter logs
    public function filterLogs($data) {
        validateUserPermissions($data, 'supervisor');
        
        if (!isset($data['filter'])) {
            return $this->getAdminLogs($data);
        }
        
        try {
            $filter = $data['filter'];
            $stmt = $this->pdo->prepare("
                SELECT 
                    tl.operation_type,
                    tl.user_email,
                    u.full_name AS user_name,
                    tl.user_ip,
                    tl.operation_time,
                    tl.success,
                    tl.details
                FROM transaction_log tl
                LEFT JOIN users u ON u.email = tl.user_email
                WHERE tl.operation_type = ?
                ORDER BY tl.operation_time DESC 
                LIMIT 100
            ");
            $stmt->execute([$filter]);
            $logs = $stmt->fetchAll();
            
            return ['success' => true, 'logs' => $logs];
        } catch (Exception $e) {
            logError("Error filtering logs: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في تصفية السجلات'];
        }
    }
    
    // Filter logs by date
    public function filterLogsByDate($data) {
        validateUserPermissions($data, 'supervisor');
        
        if (!isset($data['date'])) {
            return $this->getAdminLogs($data);
        }
        
        try {
            $date = $data['date'];
            $stmt = $this->pdo->prepare("
                SELECT 
                    tl.operation_type,
                    tl.user_email,
                    u.full_name AS user_name,
                    tl.user_ip,
                    tl.operation_time,
                    tl.success,
                    tl.details
                FROM transaction_log tl
                LEFT JOIN users u ON u.email = tl.user_email
                WHERE DATE(tl.operation_time) = ?
                ORDER BY tl.operation_time DESC 
                LIMIT 100
            ");
            $stmt->execute([$date]);
            $logs = $stmt->fetchAll();
            
            return ['success' => true, 'logs' => $logs];
        } catch (Exception $e) {
            logError("Error filtering logs by date: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في تصفية السجلات بالتاريخ'];
        }
    }
    
    // Export logs
    public function exportLogs($data) {
        validateUserPermissions($data, 'supervisor');
        
        try {
            $stmt = $this->pdo->prepare("
                SELECT 
                    tl.operation_type,
                    tl.user_email,
                    u.full_name AS user_name,
                    tl.user_ip,
                    tl.operation_time,
                    tl.success,
                    tl.details
                FROM transaction_log tl
                LEFT JOIN users u ON u.email = tl.user_email
                ORDER BY tl.operation_time DESC 
                LIMIT 1000
            ");
            $stmt->execute();
            $logs = $stmt->fetchAll();
            
            // Create CSV content (include Name column)
            $csvContent = "Operation Type,User Name,User Email,User IP,Operation Time,Success,Details\n";
            foreach ($logs as $log) {
                $csvContent .= sprintf(
                    "%s,%s,%s,%s,%s,%s,%s\n",
                    $log['operation_type'],
                    str_replace(["\n", "\r", ","], [" ", " ", ";"], ($log['user_name'] ?? '')),
                    $log['user_email'],
                    $log['user_ip'],
                    $log['operation_time'],
                    $log['success'] ? 'نجح' : 'فشل',
                    str_replace(["\n", "\r", ","], [" ", " ", ";"], ($log['details'] ?? ''))
                );
            }
            
            return ['success' => true, 'data' => $csvContent];
        } catch (Exception $e) {
            logError("Error exporting logs: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في تصدير السجلات'];
        }
    }
    
    // Create backup
    public function createBackup($data) {
        validateUserPermissions($data, 'admin');
        
        try {
            $backupTypes = [];
            if (isset($data['backup_citizens']) && $data['backup_citizens']) {
                $backupTypes[] = 'citizens';
            }
            if (isset($data['backup_employees']) && $data['backup_employees']) {
                $backupTypes[] = 'employees';
            }
            if (isset($data['backup_logs']) && $data['backup_logs']) {
                $backupTypes[] = 'logs';
            }
            if (isset($data['backup_blockchain']) && $data['backup_blockchain']) {
                $backupTypes[] = 'blockchain';
            }
            
            if (empty($backupTypes)) {
                return ['success' => false, 'message' => 'الرجاء اختيار نوع البيانات للنسخ الاحتياطي'];
            }
            
            // Prepare backup directory
            $backupDir = realpath(__DIR__ . '/../') . '/backups';
            if (!is_dir($backupDir)) {
                mkdir($backupDir, 0755, true);
            }
            
            $backupName = 'backup_' . date('Y-m-d_H-i-s') . '.sql';
            $backupPath = $backupDir . '/' . $backupName;
            $backupType = implode(',', $backupTypes);
            
            // Execute mysqldump for full database backup
            $host = escapeshellarg(DB_HOST);
            $db = escapeshellarg(DB_NAME);
            $user = escapeshellarg(DB_USER);
            $passPart = DB_PASS !== '' ? " -p" . escapeshellarg(DB_PASS) : '';
            $cmd = "mysqldump -h $host -u $user$passPart $db > " . escapeshellarg($backupPath);
            
            @exec($cmd, $output, $returnVar);
            
            if ($returnVar !== 0 || !file_exists($backupPath)) {
                // Fallback: write schema file content from database.sql if mysqldump not available
                $schemaFile = realpath(__DIR__ . '/../database.sql');
                if ($schemaFile && file_exists($schemaFile)) {
                    copy($schemaFile, $backupPath);
                } else {
                    throw new Exception('فشل في إنشاء نسخة القاعدة. تحقق من توفر mysqldump');
                }
            }
            
            $fileSize = file_exists($backupPath) ? filesize($backupPath) : 0;
            
            // Get admin user ID
            $adminUser = (new UserManager($this->pdo))->getUserByFirebaseUID($data['admin_uid']);
            $adminId = $adminUser ? $adminUser['id'] : 1;
            
            $stmt = $this->pdo->prepare("
                INSERT INTO backup_history (backup_name, backup_type, file_size, file_path, created_by, status) 
                VALUES (?, ?, ?, ?, ?, 'completed')
            ");
            $stmt->execute([$backupName, $backupType, (int)$fileSize, $backupPath, $adminId]);
            
            return ['success' => true, 'message' => 'تم إنشاء النسخة الاحتياطية بنجاح'];
        } catch (Exception $e) {
            logError("Error creating backup: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في إنشاء النسخة الاحتياطية'];
        }
    }
    
    // Get backup history
    public function getBackupHistory($data) {
        validateUserPermissions($data, 'supervisor');
        
        try {
            $stmt = $this->pdo->prepare("
                SELECT 
                    b.id,
                    b.backup_name,
                    b.backup_type,
                    b.file_size,
                    b.status,
                    b.created_at,
                    u.full_name as created_by_name
                FROM backup_history b
                LEFT JOIN users u ON b.created_by = u.id
                ORDER BY b.created_at DESC 
                LIMIT 50
            ");
            $stmt->execute();
            $backups = $stmt->fetchAll();
            
            // Format file sizes
            foreach ($backups as &$backup) {
                $backup['size'] = $this->formatFileSize($backup['file_size']);
                $backup['type'] = str_replace(',', ', ', $backup['backup_type']);
            }
            
            return ['success' => true, 'backups' => $backups];
        } catch (Exception $e) {
            logError("Error getting backup history: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في جلب تاريخ النسخ الاحتياطية'];
        }
    }
    
    // Delete backup
    public function deleteBackup($data) {
        validateUserPermissions($data, 'admin');
        
        if (!isset($data['backup_id'])) {
            return ['success' => false, 'message' => 'معرف النسخة الاحتياطية مطلوب'];
        }
        
        try {
            $stmt = $this->pdo->prepare("DELETE FROM backup_history WHERE id = ?");
            $result = $stmt->execute([$data['backup_id']]);
            
            if ($result && $stmt->rowCount() > 0) {
                return ['success' => true, 'message' => 'تم حذف النسخة الاحتياطية بنجاح'];
            } else {
                return ['success' => false, 'message' => 'النسخة الاحتياطية غير موجودة'];
            }
        } catch (Exception $e) {
            logError("Error deleting backup: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في حذف النسخة الاحتياطية'];
        }
    }

    // Download backup securely (returns base64 content)
    public function downloadBackup($data) {
        validateUserPermissions($data, 'admin');
        if (!isset($data['backup_id'])) {
            return ['success' => false, 'message' => 'معرف النسخة الاحتياطية مطلوب'];
        }
        try {
            $stmt = $this->pdo->prepare("SELECT backup_name, file_path FROM backup_history WHERE id = ?");
            $stmt->execute([$data['backup_id']]);
            $backup = $stmt->fetch();
            if (!$backup) {
                return ['success' => false, 'message' => 'النسخة الاحتياطية غير موجودة'];
            }
            $filePath = $backup['file_path'];
            if (!$filePath || !file_exists($filePath)) {
                return ['success' => false, 'message' => 'ملف النسخة الاحتياطية غير موجود على الخادم'];
            }
            $content = file_get_contents($filePath);
            return [
                'success' => true,
                'filename' => $backup['backup_name'],
                'data' => base64_encode($content)
            ];
        } catch (Exception $e) {
            logError('download_backup error: ' . $e->getMessage());
            return ['success' => false, 'message' => 'فشل تنزيل النسخة الاحتياطية'];
        }
    }
    
    // Helper function to format file size
    private function formatFileSize($bytes) {
        $units = ['B', 'KB', 'MB', 'GB'];
        $unit = 0;
        
        while ($bytes >= 1024 && $unit < count($units) - 1) {
            $bytes /= 1024;
            $unit++;
        }
        
        return round($bytes, 2) . ' ' . $units[$unit];
    }
}
?>