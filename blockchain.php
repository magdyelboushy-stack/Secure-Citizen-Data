<?php
// تضمين ملف الإعدادات
require_once 'config.php';

// كلاس البلوك تشين الرئيسي - يحتوي على جميع وظائف النظام مع التشفير المحسن
class Blockchain {
    
    private $pdo;           // متغير للاتصال بقاعدة البيانات
    private $difficulty;    // صعوبة التعدين
    
    // الدالة البانية - تستدعى عند إنشاء كائن من الكلاس
    public function __construct() {
        $this->pdo = getDBConnection();                    // الحصول على اتصال قاعدة البيانات
        $this->difficulty = MINING_DIFFICULTY;             // تعيين صعوبة التعدين من الإعدادات
    }
    
    // دالة لإنشاء هاش SHA256 للبيانات
    private function calculateHash($data) {
        return hash(HASH_ALGORITHM, $data);                // إنشاء هاش باستخدام SHA256
    }
    
    // دالة للحصول على آخر بلوك في السلسلة
    private function getLastBlock() {
        try {
            // استعلام للحصول على آخر بلوك حسب الفهرس
            $stmt = $this->pdo->prepare("SELECT * FROM blocks ORDER BY block_index DESC LIMIT 1");
            $stmt->execute();                              // تنفيذ الاستعلام
            return $stmt->fetch();                         // إرجاع النتيجة
        } catch (PDOException $e) {
            logError("خطأ في الحصول على آخر بلوك: " . $e->getMessage());
            return false;
        }
    }
    
    // دالة لتعدين بلوك جديد (إيجاد nonce)
    private function mineBlock($block) {
        // إنشاء السلسلة المطلوبة من الأصفار
        $target = str_repeat('0', $this->difficulty);
        
        while (substr($block['block_hash'], 0, $this->difficulty) !== $target) {
            $block['nonce']++; // زيادة الـ nonce في كل محاولة
            
            // حساب الهاش الجديد
            $block['block_hash'] = $this->calculateHash(
                $block['block_index'] .
                $block['previous_hash'] .
                $block['timestamp'] .
                $block['data_hash'] .
                $block['nonce']
            );
        }
        
        return $block; // إرجاع البلوك بعد التعدين
    }
    
    // دالة لإضافة بلوك جديد إلى السلسلة
    private function addBlock($block) {
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO blocks (block_index, previous_hash, timestamp, data_hash, nonce, block_hash) 
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            return $stmt->execute([
                $block['block_index'],
                $block['previous_hash'],
                $block['timestamp'],
                $block['data_hash'],
                $block['nonce'],
                $block['block_hash']
            ]);
        } catch (PDOException $e) {
            logError("خطأ في إضافة بلوك جديد: " . $e->getMessage());
            return false;
        }
    }
    
    // دالة لإضافة مواطن جديد إلى البلوك تشين مع التشفير
    public function addCitizen($citizenData, $userEmail = null) {
        global $error_messages, $success_messages;

        try {
            // تحقق من صحة الرقم القومي
            if (!validateNationalID($citizenData['citizen_id'])) {
                return ['success' => false, 'message' => $error_messages['invalid_id']];
            }

            // إنشاء هاش للبحث بالرقم القومي قبل التشفير
            $searchHash = createSearchHash($citizenData['citizen_id']);
            
            // تحقق من عدم وجود الرقم القومي مسبقًا باستخدام search_hash
            $checkStmt = $this->pdo->prepare("SELECT id FROM citizens_data WHERE search_hash = ?");
            $checkStmt->execute([$searchHash]);
            if ($checkStmt->fetch()) {
                return ['success' => false, 'message' => $error_messages['duplicate_id']];
            }

            // تشفير البيانات الحساسة
            $encryptedData = encryptCitizenData($citizenData);
            
            // تجهيز بيانات البلوك باستخدام البيانات المشفرة
            $lastBlock = $this->getLastBlock();
            $lastBlockHash = $lastBlock ? $lastBlock['block_hash'] : '0';
            $nextBlockIndex = $lastBlock ? $lastBlock['block_index'] + 1 : 1;
            $dataHash = $this->calculateHash(json_encode($encryptedData));
            
            $newBlock = [
                'block_index'   => $nextBlockIndex,
                'previous_hash' => $lastBlockHash,
                'timestamp'     => time(),
                'data_hash'     => $dataHash,
                'nonce'         => 0,
                'block_hash'    => ''
            ];
            
            $minedBlock = $this->mineBlock($newBlock);

            // إضافة البلوك
            if (!$this->addBlock($minedBlock)) {
                return ['success' => false, 'message' => 'فشل في إضافة البلوك إلى السلسلة.'];
            }
            
            $newBlockId = $this->pdo->lastInsertId();

            // إضافة بيانات المواطن المشفرة
            $citizenStmt = $this->pdo->prepare("
                INSERT INTO citizens_data (
                    block_id, citizen_id, full_name, birth_date, gender, marital_status,
                    address, phone, email, job, education, family_members, religion,
                    blood_type, nationality, housing_type, health_status, notes, search_hash
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            ");

            $citizenStmt->execute([
                $newBlockId,
                $encryptedData['citizen_id'],
                $encryptedData['full_name'],
                $citizenData['birth_date'], // تاريخ الميلاد غير مشفر للاستعلامات
                $citizenData['gender'] ?? '', // النوع غير مشفر
                $citizenData['marital_status'] ?? '', // الحالة الاجتماعية غير مشفرة
                $encryptedData['address'],
                $encryptedData['phone'] ?? '',
                $encryptedData['email'] ?? '',
                $encryptedData['job'] ?? '',
                $encryptedData['education'] ?? '',
                $citizenData['family_members'] ?? '', // عدد أفراد الأسرة غير مشفر
                $encryptedData['religion'] ?? '',
                $encryptedData['blood_type'] ?? '',
                $encryptedData['nationality'] ?? '',
                $citizenData['housing_type'] ?? '', // نوع السكن غير مشفر
                $encryptedData['health_status'] ?? '',
                $encryptedData['notes'] ?? '',
                $searchHash
            ]);

            // تسجيل العملية في سجل المعاملات
                            $this->logTransaction('INSERT', $searchHash, $newBlockId, $_SERVER['REMOTE_ADDR'] ?? 'unknown', true, null, $userEmail);

            return ['success' => true, 'message' => $success_messages['data_added']];

        } catch (Exception $e) {
            logError("خطأ في إضافة المواطن: " . $e->getMessage());
            return ['success' => false, 'message' => $error_messages['database_error']];
        }
    }
    
    // دالة للحصول على بيانات مواطن بالرقم القومي مع فك التشفير
    public function getCitizen($nationalId, $userEmail = null) {
        global $error_messages;
        try {
            // إنشاء هاش البحث
            $searchHash = createSearchHash($nationalId);
            
            $stmt = $this->pdo->prepare("
                SELECT c.*, b.timestamp as block_timestamp
                FROM citizens_data c
                JOIN blocks b ON c.block_id = b.id
                WHERE c.search_hash = ?
            ");
            $stmt->execute([$searchHash]);
            $citizen = $stmt->fetch();
            
            if ($citizen) {
                // فك تشفير البيانات الحساسة قبل الإرجاع
                $decryptedCitizen = decryptCitizenData($citizen);
                
                // تسجيل عملية البحث
                $this->logTransaction('SEARCH', $searchHash, $citizen['block_id'], $_SERVER['REMOTE_ADDR'] ?? 'unknown', true, null, $userEmail);
                
                return ['success' => true, 'data' => $decryptedCitizen];
            } else {
                return ['success' => false, 'message' => $error_messages['data_not_found']];
            }
        } catch (Exception $e) {
            logError("خطأ في البحث عن المواطن: " . $e->getMessage());
            return ['success' => false, 'message' => $error_messages['database_error']];
        }
    }

    // دالة للحصول على البلوكات لصفحة معينة
    public function getBlocks($page, $limit = 10) {
        global $error_messages;
        try {
            $offset = ($page - 1) * $limit;
            
            $stmt = $this->pdo->prepare("SELECT * FROM blocks ORDER BY block_index DESC LIMIT ? OFFSET ?");
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->bindValue(2, $offset, PDO::PARAM_INT);
            $stmt->execute();
            $blocks = $stmt->fetchAll();
            
            // التحقق من وجود صفحات تالية
            $totalBlocksStmt = $this->pdo->query("SELECT COUNT(*) FROM blocks");
            $totalBlocks = $totalBlocksStmt->fetchColumn();
            $hasNextPage = ($page * $limit) < $totalBlocks;
            
            return [
                'success' => true,
                'blocks' => $blocks,
                'has_next_page' => $hasNextPage
            ];
        } catch (PDOException $e) {
            logError("خطأ في جلب البلوكات: " . $e->getMessage());
            return ['success' => false, 'message' => $error_messages['database_error']];
        }
    }
    
    // دالة للتحقق من سلامة السلسلة
    public function verifyChain($userEmail = null) {
        global $error_messages;
        try {
            $stmt = $this->pdo->query("SELECT * FROM blocks ORDER BY block_index ASC");
            $blocks = $stmt->fetchAll();
            
            // تسجيل عملية التحقق
            $this->logTransaction('VERIFY', null, null, $_SERVER['REMOTE_ADDR'] ?? 'unknown', true, null, $userEmail);
            
            for ($i = 1; $i < count($blocks); $i++) {
                $currentBlock = $blocks[$i];
                $previousBlock = $blocks[$i - 1];
                
                // إعادة حساب الهاش للتحقق من سلامته
                $recalculatedHash = $this->calculateHash(
                    $currentBlock['block_index'] .
                    $previousBlock['block_hash'] .
                    $currentBlock['timestamp'] .
                    $currentBlock['data_hash'] .
                    $currentBlock['nonce']
                );
                
                // التحقق من أن الهاش الحالي يطابق الهاش المُعاد حسابه
                if ($recalculatedHash !== $currentBlock['block_hash']) {
                    return ['success' => false, 'message' => "خطأ في البلوك رقم {$currentBlock['block_index']}: الهاش غير صحيح."];
                }
                
                // التحقق من أن الهاش السابق صحيح
                if ($previousBlock['block_hash'] !== $currentBlock['previous_hash']) {
                    return ['success' => false, 'message' => "خطأ في البلوك رقم {$currentBlock['block_index']}: الهاش السابق غير صحيح."];
                }
            }
            
            return ['success' => true, 'message' => 'سلسلة البلوك تشين سليمة وآمنة.'];
            
        } catch (PDOException $e) {
            logError("خطأ في التحقق من السلسلة: " . $e->getMessage());
            return ['success' => false, 'message' => $error_messages['database_error']];
        }
    }
    
    // دالة للحصول على إحصائيات النظام
    public function getSystemStats() {
        global $error_messages;
        try {
            $blocksStmt = $this->pdo->query("SELECT COUNT(*) FROM blocks");
            $totalBlocks = $blocksStmt->fetchColumn();
            
            $citizensStmt = $this->pdo->query("SELECT COUNT(*) FROM citizens_data");
            $totalCitizens = $citizensStmt->fetchColumn();
            
            // عمليات اليوم من سجل المعاملات
            $todayStmt = $this->pdo->query("SELECT COUNT(*) FROM transaction_log WHERE DATE(operation_time) = CURDATE()");
            $todayOperations = $todayStmt->fetchColumn();
            
            $lastBlock = $this->getLastBlock();
            
            // التحقق من حالة السلسلة
            $chainStatus = $this->verifyChain();
            
            return [
                'success' => true,
                'stats' => [
                    'total_blocks' => $totalBlocks,
                    'total_citizens' => $totalCitizens,
                    'today_operations' => $todayOperations,
                    'last_block_hash' => $lastBlock['block_hash'] ?? 'N/A',
                    'chain_verified' => $chainStatus['success']
                ]
            ];
            
        } catch (PDOException $e) {
            logError("خطأ في الحصول على الإحصائيات: " . $e->getMessage());
            return ['success' => false, 'message' => $error_messages['database_error']];
        }
    }
    
    // دالة لتسجيل المعاملات في سجل العمليات
    private function logTransaction($operationType, $citizenSearchHash = null, $blockId = null, $userIp = null, $success = true, $details = null, $userEmail = null) {
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO transaction_log (operation_type, citizen_search_hash, block_id, user_ip, user_email, success, details) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$operationType, $citizenSearchHash, $blockId, $userIp, $userEmail, $success, $details]);
        } catch (PDOException $e) {
            logError("خطأ في تسجيل المعاملة: " . $e->getMessage());
        }
    }
    
    // دالة للحصول على سجل العمليات (للمراجعة الأمنية)
    public function getTransactionLog($limit = 100) {
        try {
            $stmt = $this->pdo->prepare("
                SELECT tl.operation_type, tl.operation_time, tl.user_ip, tl.user_email, u.full_name AS user_name, tl.success, tl.details 
                FROM transaction_log tl
                LEFT JOIN users u ON u.email = tl.user_email
                ORDER BY tl.operation_time DESC 
                LIMIT ?
            ");
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->execute();
            
            return [
                'success' => true,
                'logs' => $stmt->fetchAll()
            ];
        } catch (PDOException $e) {
            logError("خطأ في جلب سجل المعاملات: " . $e->getMessage());
            return ['success' => false, 'message' => 'خطأ في جلب سجل المعاملات'];
        }
    }
}
?>