<?php
/**
 * Citizen Controller - Handles citizen-related operations
 */
class CitizenController {
    private $blockchain;
    private $securityManager;
    
    public function __construct() {
        $this->blockchain = new Blockchain();
        $this->securityManager = new SecurityManager(getDBConnection());
    }
    
    // Add citizen
    public function addCitizen($data, $clientIp) {
        // Check required fields
        if (!isset($data['nationalId']) || !isset($data['fullName']) || !isset($data['birthDate']) || !isset($data['address'])) {
            $this->securityManager->logFailedAttempt($clientIp, 'add_citizen', 'Missing required fields');
            return ['success' => false, 'message' => 'الرجاء إكمال جميع الحقول المطلوبة'];
        }
        
        // Sanitize data
        $citizenData = [
            'citizen_id'     => sanitizeInput($data['nationalId']),
            'full_name'      => sanitizeInput($data['fullName']),
            'birth_date'     => sanitizeInput($data['birthDate']),
            'gender'         => sanitizeInput($data['gender'] ?? ''),
            'marital_status' => sanitizeInput($data['maritalStatus'] ?? ''),
            'address'        => sanitizeInput($data['address']),
            'phone'          => sanitizeInput($data['phone'] ?? ''),
            'email'          => sanitizeInput($data['email'] ?? ''),
            'job'            => sanitizeInput($data['job'] ?? ''),
            'education'      => sanitizeInput($data['education'] ?? ''),
            'family_members' => sanitizeInput($data['familyMembers'] ?? ''),
            'religion'       => sanitizeInput($data['religion'] ?? ''),
            'blood_type'     => sanitizeInput($data['bloodType'] ?? ''),
            'nationality'    => sanitizeInput($data['nationality'] ?? ''),
            'housing_type'   => sanitizeInput($data['housingType'] ?? ''),
            'health_status'  => sanitizeInput($data['healthStatus'] ?? ''),
            'notes'          => sanitizeInput($data['notes'] ?? '')
        ];

        try {
            $userEmail = $data['admin_email'] ?? ($data['email'] ?? null);
            $response = $this->blockchain->addCitizen($citizenData, $userEmail);
            
            if ($response['success']) {
                $this->securityManager->resetFailedAttempts($clientIp, 'add_citizen');
            } else {
                $this->securityManager->logFailedAttempt($clientIp, 'add_citizen', $response['message']);
            }
            
            return $response;
        } catch (Exception $e) {
            $this->securityManager->logFailedAttempt($clientIp, 'add_citizen', $e->getMessage());
            logError("Error adding citizen: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في إضافة المواطن'];
        }
    }
    
    // Get citizen
    public function getCitizen($data, $clientIp) {
        // Check required fields
        if (!isset($data['nationalId'])) {
            $this->securityManager->logFailedAttempt($clientIp, 'get_citizen', 'Missing national ID');
            return ['success' => false, 'message' => 'الرجاء إدخال الرقم القومي للبحث'];
        }
        
        // Sanitize and validate national ID
        $nationalId = sanitizeInput($data['nationalId']);
        
        if (!validateNationalID($nationalId)) {
            $this->securityManager->logFailedAttempt($clientIp, 'get_citizen', 'Invalid national ID: ' . $nationalId);
            return ['success' => false, 'message' => 'الرقم القومي غير صحيح'];
        }
        
        try {
            $userEmail = $data['admin_email'] ?? ($data['email'] ?? null);
            $response = $this->blockchain->getCitizen($nationalId, $userEmail);
            
            if ($response['success']) {
                $this->securityManager->resetFailedAttempts($clientIp, 'get_citizen');
            } else {
                $this->securityManager->logFailedAttempt($clientIp, 'get_citizen', 'Search failed: ' . $nationalId);
            }
            
            return $response;
        } catch (Exception $e) {
            $this->securityManager->logFailedAttempt($clientIp, 'get_citizen', $e->getMessage());
            logError("Error getting citizen: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في البحث عن المواطن'];
        }
    }
    
    // Get system statistics
    public function getSystemStats() {
        try {
            $response = $this->blockchain->getSystemStats();
            return $response;
        } catch (Exception $e) {
            logError("Error getting system stats: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في جلب إحصائيات النظام'];
        }
    }
    
    // Verify chain
    public function verifyChain($data = [], $clientIp = '') {
        try {
            $userEmail = $data['admin_email'] ?? ($data['email'] ?? null);
            $response = $this->blockchain->verifyChain($userEmail);
            return $response;
        } catch (Exception $e) {
            logError("Error verifying chain: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في فحص السلسلة'];
        }
    }
    
    // Get blocks
    public function getBlocks($page) {
        if ($page < 1) $page = 1;
        
        try {
            $response = $this->blockchain->getBlocks($page);
            return $response;
        } catch (Exception $e) {
            logError("Error getting blocks: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في جلب البلوكات'];
        }
    }
    
    // Get transaction log
    public function getTransactionLog($limit) {
        try {
            $response = $this->blockchain->getTransactionLog($limit);
            return $response;
        } catch (Exception $e) {
            logError("Error getting transaction log: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في جلب سجل المعاملات'];
        }
    }

    // Get citizens list (admin)
    public function getCitizensList($data) {
        validateUserPermissions($data, 'supervisor');
        
        $page = isset($data['page']) ? max(1, (int)$data['page']) : 1;
        $limit = isset($data['limit']) ? max(1, min(100, (int)$data['limit'])) : 25;
        $offset = ($page - 1) * $limit;
        
        try {
            $pdo = getDBConnection();
            $stmt = $pdo->prepare("SELECT * FROM citizens_data ORDER BY created_at DESC LIMIT ? OFFSET ?");
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->bindValue(2, $offset, PDO::PARAM_INT);
            $stmt->execute();
            $rows = $stmt->fetchAll();
            
            $citizens = [];
            foreach ($rows as $row) {
                $decrypted = decryptCitizenData($row);
                $citizens[] = [
                    'id' => $row['id'],
                    'block_id' => $row['block_id'],
                    'citizen_id' => $decrypted['citizen_id'] ?? '',
                    'full_name' => $decrypted['full_name'] ?? '',
                    'birth_date' => $row['birth_date'] ?? null,
                    'gender' => $row['gender'] ?? '',
                    'marital_status' => $row['marital_status'] ?? '',
                    'address' => $decrypted['address'] ?? '',
                    'phone' => $decrypted['phone'] ?? '',
                    'email' => $decrypted['email'] ?? '',
                    'job' => $decrypted['job'] ?? '',
                    'education' => $decrypted['education'] ?? '',
                    'nationality' => $decrypted['nationality'] ?? '',
                    'housing_type' => $row['housing_type'] ?? '',
                    'health_status' => $decrypted['health_status'] ?? '',
                    'created_at' => $row['created_at'] ?? null
                ];
            }
            
            return ['success' => true, 'citizens' => $citizens, 'page' => $page, 'limit' => $limit];
        } catch (Exception $e) {
            logError("Error getting citizens list: " . $e->getMessage());
            return ['success' => false, 'message' => 'فشل في جلب قائمة المواطنين'];
        }
    }
}
?>