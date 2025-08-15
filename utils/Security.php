<?php
/**
 * Security utility functions
 */

// Function to handle API errors
function handleApiError($message, $code = 500) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message, 'error' => $message]);
    exit;
}

// Function to check rate limiting
function checkRateLimit($ip, $action = 'general') {
    // Max 100 requests per hour per IP
    $maxRequests = 100;
    $timeWindow = 3600; // One hour
    
    $cacheFile = "rate_limit_" . md5($ip . $action) . ".tmp";
    $now = time();
    
    if (file_exists($cacheFile)) {
        $data = json_decode(file_get_contents($cacheFile), true);
        
        // Clean old requests
        $data['requests'] = array_filter($data['requests'], function($timestamp) use ($now, $timeWindow) {
            return ($now - $timestamp) < $timeWindow;
        });
        
        if (count($data['requests']) >= $maxRequests) {
            return false;
        }
        
        $data['requests'][] = $now;
    } else {
        $data = ['requests' => [$now]];
    }
    
    file_put_contents($cacheFile, json_encode($data));
    return true;
}

// Get real IP address
function getRealIpAddr() {
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        return $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        return $_SERVER['HTTP_X_FORWARDED_FOR'];
    } else {
        return $_SERVER['REMOTE_ADDR'];
    }
}

// Validate user permissions
function validateUserPermissions($data, $requiredRole = 'employee') {
    $adminUid = $data['admin_uid'] ?? '';
    $adminEmail = $data['admin_email'] ?? ($data['email'] ?? '');

    try {
        $pdo = getDBConnection();

        $user = null;

        // 1) Try by UID if provided
        if (!empty($adminUid)) {
            $stmt = $pdo->prepare("SELECT * FROM users WHERE firebase_uid = ? AND status = 'active'");
            $stmt->execute([$adminUid]);
            $user = $stmt->fetch();
        }

        // 2) If not found, try by email
        if (!$user && !empty($adminEmail)) {
            $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? AND status = 'active'");
            $stmt->execute([$adminEmail]);
            $byEmail = $stmt->fetch();

            if ($byEmail) {
                // If caller provided adminUid and it differs from stored, sync it
                if (!empty($adminUid) && $byEmail['firebase_uid'] !== $adminUid) {
                    $upd = $pdo->prepare("UPDATE users SET firebase_uid = ? WHERE id = ?");
                    $upd->execute([$adminUid, $byEmail['id']]);
                    $user = array_merge($byEmail, ['firebase_uid' => $adminUid]);
                } else {
                    $user = $byEmail;
                    $adminUid = $byEmail['firebase_uid'];
                }
            }
        }

        if ($user && isset($user['role'])) {
            // Role hierarchy check
            $roleHierarchy = [ 'admin' => 3, 'supervisor' => 2, 'employee' => 1 ];
            $userLevel = $roleHierarchy[$user['role']] ?? 0;
            $requiredLevel = $roleHierarchy[$requiredRole] ?? 0;

            if ($userLevel >= $requiredLevel) {
                return true;
            }
        }
    } catch (Exception $e) {
        // Swallow and deny below
    }

    http_response_code(403);
    echo json_encode(['error' => 'Access denied']);
    exit;
}
?>