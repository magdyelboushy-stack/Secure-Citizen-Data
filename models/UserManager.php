<?php
/**
 * User Manager - Handles user operations and role management
 */
class UserManager {
    private $pdo;
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    
    // Get user by Firebase UID
    public function getUserByFirebaseUID($firebaseUID) {
        try {
            $stmt = $this->pdo->prepare("
                SELECT * FROM users 
                WHERE firebase_uid = ? AND status = 'active'
            ");
            $stmt->execute([$firebaseUID]);
            return $stmt->fetch();
        } catch (PDOException $e) {
            logError("Error finding user: " . $e->getMessage());
            return false;
        }
    }
    
    // Add new user
    public function addUser($firebaseUID, $email, $fullName, $role = 'employee') {
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO users (firebase_uid, email, full_name, role, status) 
                VALUES (?, ?, ?, ?, 'active')
            ");
            $stmt->execute([$firebaseUID, $email, $fullName, $role]);
            return $this->pdo->lastInsertId();
        } catch (PDOException $e) {
            logError("Error adding user: " . $e->getMessage());
            return false;
        }
    }
    
    // Update user data
    public function updateUser($firebaseUID, $data) {
        try {
            $fields = [];
            $values = [];
            
            foreach ($data as $key => $value) {
                if (in_array($key, ['email', 'full_name', 'role', 'status'])) {
                    $fields[] = "$key = ?";
                    $values[] = $value;
                }
            }
            
            if (empty($fields)) {
                return false;
            }
            
            $values[] = $firebaseUID;
            $sql = "UPDATE users SET " . implode(', ', $fields) . " WHERE firebase_uid = ?";
            $stmt = $this->pdo->prepare($sql);
            return $stmt->execute($values);
        } catch (PDOException $e) {
            logError("Error updating user: " . $e->getMessage());
            return false;
        }
    }
    
    // Delete user (soft delete -> set status to inactive)
    public function deleteUser($firebaseUID) {
        try {
            $stmt = $this->pdo->prepare("UPDATE users SET status = 'inactive' WHERE firebase_uid = ?");
            return $stmt->execute([$firebaseUID]);
        } catch (PDOException $e) {
            logError("Error deleting user: " . $e->getMessage());
            return false;
        }
    }
    
    // Get all users (only active)
    public function getAllUsers() {
        try {
            $stmt = $this->pdo->prepare("
                SELECT id, firebase_uid as uid, email, full_name as name, role, status, created_at, last_login 
                FROM users 
                WHERE status = 'active'
                ORDER BY created_at DESC
            ");
            $stmt->execute();
            return $stmt->fetchAll();
        } catch (PDOException $e) {
            logError("Error getting users: " . $e->getMessage());
            return [];
        }
    }
    
    // Log user login
    public function logLogin($userID, $firebaseUID, $email, $userIP, $userAgent, $success = true, $failureReason = null) {
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO login_history (user_id, firebase_uid, email, user_ip, user_agent, success, failure_reason) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$userID, $firebaseUID, $email, $userIP, $userAgent, $success, $failureReason]);
            
            if ($success) {
                // Update last login
                $updateStmt = $this->pdo->prepare("
                    UPDATE users SET last_login = NOW() WHERE id = ?
                ");
                $updateStmt->execute([$userID]);
            }
            
            return true;
        } catch (PDOException $e) {
            logError("Error logging login: " . $e->getMessage());
            return false;
        }
    }
    
    // Check permissions
    public function hasPermission($userRole, $requiredRole) {
        $roleHierarchy = [
            'admin' => 3,
            'supervisor' => 2,
            'employee' => 1
        ];
        
        $userLevel = $roleHierarchy[$userRole] ?? 0;
        $requiredLevel = $roleHierarchy[$requiredRole] ?? 0;
        
        return $userLevel >= $requiredLevel;
    }
}
?>