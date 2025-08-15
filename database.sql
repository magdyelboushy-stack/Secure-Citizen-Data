CREATE TABLE IF NOT EXISTS blocks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    block_index INT NOT NULL,
    previous_hash VARCHAR(64) NOT NULL,
    timestamp BIGINT NOT NULL,
    data_hash VARCHAR(64) NOT NULL,
    nonce INT NOT NULL DEFAULT 0,
    block_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_block_index (block_index),
    INDEX idx_block_hash (block_hash)
);

CREATE TABLE IF NOT EXISTS citizens_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    block_id INT NOT NULL,
    citizen_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    job TEXT,
    education TEXT,
    religion TEXT,
    blood_type TEXT,
    nationality TEXT,
    health_status TEXT,
    notes TEXT,
    birth_date DATE,
    gender ENUM('ذكر', 'أنثى', ''),
    marital_status ENUM('أعزب', 'متزوج', 'مطلق', 'أرمل', ''),
    family_members INT,
    housing_type ENUM('تمليك', 'إيجار', 'بدون سكن', ''),
    search_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (block_id) REFERENCES blocks(id),
    INDEX idx_search_hash (search_hash),
    INDEX idx_birth_date (birth_date),
    INDEX idx_gender (gender)
);

CREATE TABLE IF NOT EXISTS transaction_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operation_type ENUM('INSERT', 'UPDATE', 'DELETE', 'VERIFY', 'SEARCH', 'LOGIN', 'LOGOUT') NOT NULL,
    citizen_search_hash VARCHAR(64),
    block_id INT,
    user_ip VARCHAR(45),
    user_email VARCHAR(255),
    operation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT TRUE,
    details TEXT,
    INDEX idx_operation_type (operation_type),
    INDEX idx_operation_time (operation_time),
    INDEX idx_citizen_search_hash (citizen_search_hash),
    INDEX idx_user_email (user_email)
);

CREATE TABLE IF NOT EXISTS security_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_ip VARCHAR(45) NOT NULL,
    attempted_action VARCHAR(100),
    failed_attempts INT DEFAULT 1,
    last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_until TIMESTAMP NULL,
    details TEXT,
    INDEX idx_user_ip (user_ip),
    INDEX idx_last_attempt (last_attempt)
);

-- جدول إدارة المستخدمين والصلاحيات
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'supervisor', 'employee') NOT NULL DEFAULT 'employee',
    status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_firebase_uid (firebase_uid),
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_status (status)
);

-- جدول سجل تسجيلات الدخول
CREATE TABLE IF NOT EXISTS login_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    firebase_uid VARCHAR(128) NOT NULL,
    email VARCHAR(255) NOT NULL,
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logout_time TIMESTAMP NULL,
    user_ip VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE,
    failure_reason VARCHAR(255) NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_id (user_id),
    INDEX idx_login_time (login_time),
    INDEX idx_success (success)
);

-- جدول إعدادات النظام
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    setting_type ENUM('string', 'integer', 'boolean', 'json') NOT NULL DEFAULT 'string',
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_setting_key (setting_key)
);

-- جدول النسخ الاحتياطية
CREATE TABLE IF NOT EXISTS backup_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    backup_name VARCHAR(255) NOT NULL,
    backup_type ENUM('full', 'citizens', 'employees', 'logs', 'blockchain') NOT NULL,
    file_size BIGINT NOT NULL,
    file_path VARCHAR(500),
    created_by INT NOT NULL,
    status ENUM('completed', 'failed', 'in_progress') NOT NULL DEFAULT 'in_progress',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_backup_type (backup_type),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- إدراج الإعدادات الافتراضية للنظام
INSERT INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
('system_name', 'نظام خزينة بيانات المواطنين', 'string', 'اسم النظام'),
('admin_email', 'admin@citizens.gov', 'string', 'بريد الإدارة'),
('session_timeout', '30', 'integer', 'مهلة الجلسة بالدقائق'),
('max_login_attempts', '5', 'integer', 'الحد الأقصى لمحاولات تسجيل الدخول'),
('enable_two_factor', '1', 'boolean', 'تفعيل المصادقة الثنائية'),
('enable_ip_blocking', '1', 'boolean', 'حظر عناوين IP المشبوهة'),
('enable_audit_log', '1', 'boolean', 'تفعيل سجل التدقيق'),
('enable_auto_backup', '0', 'boolean', 'النسخ الاحتياطي التلقائي'),
('mining_difficulty', '4', 'integer', 'صعوبة التعدين'),
('encryption_method', 'AES-256-CBC', 'string', 'طريقة التشفير')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- إنشاء البلوك الأول (Genesis Block)
INSERT INTO blocks (block_index, previous_hash, timestamp, data_hash, nonce, block_hash)
VALUES (
    0,
    '0',
    UNIX_TIMESTAMP(),
    SHA2('Genesis Block - Secure Citizens Blockchain System', 256),
    0,
    SHA2(CONCAT('0', '0', UNIX_TIMESTAMP(), SHA2('Genesis Block - Secure Citizens Blockchain System', 256), '0'), 256)
) ON DUPLICATE KEY UPDATE block_index=block_index;

-- إدراج مدير النظام الافتراضي (يمكن تغييره لاحقاً)
INSERT INTO users (firebase_uid, email, full_name, role, status) VALUES
('default_admin_uid', 'admin@citizens.gov', 'مدير النظام', 'admin', 'active')
ON DUPLICATE KEY UPDATE email = VALUES(email);


