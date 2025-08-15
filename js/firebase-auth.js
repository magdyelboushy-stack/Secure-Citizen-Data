/**
 * Firebase Authentication with Firestore Role-Based Access Control
 * This file handles all Firebase authentication and role management
 */

// Firebase configuration (read from global variables if provided)
const firebaseConfig = {
    apiKey: window.FIREBASE_API_KEY || '',
    authDomain: window.FIREBASE_AUTH_DOMAIN || '',
    projectId: window.FIREBASE_PROJECT_ID || '',
    storageBucket: window.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: window.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: window.FIREBASE_APP_ID || ''
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Secondary app for admin operations that should not affect primary auth state
let secondaryApp = null;
function getSecondaryApp() {
    if (!secondaryApp) {
        const name = 'SecondaryApp';
        secondaryApp = firebase.apps.find(a => a.name === name) || firebase.initializeApp(firebaseConfig, name);
    }
    return secondaryApp;
}

async function createUserWithSecondaryApp(email, password, name, role = 'employee') {
    try {
        const app = getSecondaryApp();
        const secondaryAuth = app.auth();
        const secondaryDb = app.firestore();

        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await secondaryDb.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: null,
            status: 'active'
        });

        // Keep primary session intact (do not switch). Optionally sign out secondary auth.
        await secondaryAuth.signOut().catch(() => {});

        return { success: true, uid: user.uid, email: user.email, name: name, role: role };
    } catch (error) {
        console.error('Error creating user with secondary app:', error);
        return { success: false, error: error.message };
    }
}

// Global variables
let currentUser = null;
let currentUserRole = null;

/**
 * Create a new user in Firebase Auth and Firestore
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @param {string} name - User's full name
 * @param {string} role - User's role (admin, supervisor, employee)
 * @returns {Promise} - Promise that resolves with user data
 */
async function createUser(email, password, name, role = 'employee') {
    try {
        // Create user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Add user data to Firestore
        await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: null,
            status: 'active'
        });
        
        console.log('User created successfully:', user.uid);
        return {
            success: true,
            uid: user.uid,
            email: user.email,
            name: name,
            role: role
        };
        
    } catch (error) {
        console.error('Error creating user:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Login user and check their role
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise} - Promise that resolves with login result 
 */
async function loginUser(email, password) {
    try {
        // Sign in with Firebase Auth
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Get user data from Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            // User exists in Auth but not in Firestore
            await auth.signOut();
            return {
                success: false,
                error: 'User profile not found in database. Please contact administrator.'
            };
        }
        
        const userData = userDoc.data();
        
        // Check if user is active
        if (userData.status !== 'active') {
            await auth.signOut();
            return {
                success: false,
                error: 'Your account is disabled. Please contact administrator.'
            };
        }
        
        // Update last login time
        await db.collection('users').doc(user.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Set current user data
        currentUser = user;
        currentUserRole = userData.role;
        
        return {
            success: true,
            user: {
                uid: user.uid,
                email: user.email,
                name: userData.name,
                role: userData.role
            }
        };
        
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'Email not found';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'Account has been disabled';
                break;
        }
        
        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * Check if current user has admin access
 * @returns {boolean} - True if user is admin, false otherwise
 */
function isAdmin() {
    return currentUserRole === 'admin';
}

/**
 * Check if current user has supervisor access
 * @returns {boolean} - True if user is supervisor or admin, false otherwise
 */
function isSupervisor() {
    return currentUserRole === 'supervisor' || currentUserRole === 'admin';
}

/**
 * Check if current user has employee access
 * @returns {boolean} - True if user has any role, false otherwise
 */
function isEmployee() {
    return currentUserRole === 'employee' || currentUserRole === 'supervisor' || currentUserRole === 'admin';
}

/**
 * Get current user's role
 * @returns {string|null} - User's role or null if not logged in
 */
function getCurrentUserRole() {
    return currentUserRole;
}

/**
 * Get current user data
 * @returns {object|null} - Current user data or null if not logged in
 */
function getCurrentUser() {
    return currentUser;
}

/**
 * Logout current user
 * @returns {Promise} - Promise that resolves when logout is complete
 */
async function logoutUser() {
    try {
        await auth.signOut();
        currentUser = null;
        currentUserRole = null;
        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update user role in Firestore
 * @param {string} uid - User's UID
 * @param {string} newRole - New role to assign
 * @returns {Promise} - Promise that resolves with update result
 */
async function updateUserRole(uid, newRole) {
    try {
        await db.collection('users').doc(uid).update({
            role: newRole,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error updating user role:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update user status in Firestore
 * @param {string} uid - User's UID
 * @param {string} status - New status (active, inactive, suspended)
 * @returns {Promise} - Promise that resolves with update result
 */
async function updateUserStatus(uid, status) {
    try {
        await db.collection('users').doc(uid).update({
            status: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error updating user status:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get all users from Firestore (admin only)
 * @returns {Promise} - Promise that resolves with users array
 */
async function getAllUsers() {
    try {
        const snapshot = await db.collection('users').get();
        const users = [];
        
        snapshot.forEach(doc => {
            users.push({
                uid: doc.id,
                ...doc.data()
            });
        });
        
        return { success: true, users: users };
    } catch (error) {
        console.error('Error getting users:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete user from Firebase Auth and Firestore
 * @param {string} uid - User's UID
 * @returns {Promise} - Promise that resolves with delete result
 */
async function deleteUser(uid) {
    try {
        // Delete from Firestore first
        await db.collection('users').doc(uid).delete();
        
        // Note: Deleting from Firebase Auth requires admin SDK
        // For client-side, we can only delete the current user
        if (currentUser && currentUser.uid === uid) {
            await currentUser.delete();
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error deleting user:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Check admin access and redirect if not allowed
 * @param {string} redirectUrl - URL to redirect to if not admin
 */
function checkAdminAccess(redirectUrl = '/') {
    if (!currentUser) {
        alert('Please login first');
        window.location.href = redirectUrl;
        return false;
    }
    
    if (!isAdmin()) {
        alert('You are not allowed to enter. Admin access required.');
        window.location.href = redirectUrl;
        return false;
    }
    
    return true;
}

/**
 * Check supervisor access and redirect if not allowed
 * @param {string} redirectUrl - URL to redirect to if not supervisor
 */
function checkSupervisorAccess(redirectUrl = '/') {
    if (!currentUser) {
        alert('Please login first');
        window.location.href = redirectUrl;
        return false;
    }
    
    if (!isSupervisor()) {
        alert('You are not allowed to enter. Supervisor access required.');
        window.location.href = redirectUrl;
        return false;
    }
    
    return true;
}

/**
 * Check employee access and redirect if not allowed
 * @param {string} redirectUrl - URL to redirect to if not employee
 */
function checkEmployeeAccess(redirectUrl = '/') {
    if (!currentUser) {
        alert('Please login first');
        window.location.href = redirectUrl;
        return false;
    }
    
    if (!isEmployee()) {
        alert('You are not allowed to enter. Employee access required.');
        window.location.href = redirectUrl;
        return false;
    }
    
    return true;
}

/**
 * Listen for authentication state changes
 * @param {function} callback - Function to call when auth state changes
 */
function onAuthStateChanged(callback) {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // User is signed in
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    currentUser = user;
                    currentUserRole = userData.role;
                    callback({ user: user, role: userData.role, data: userData });
                } else {
                    // User exists in Auth but not in Firestore
                    await auth.signOut();
                    callback({ user: null, role: null, error: 'User profile not found' });
                }
            } catch (error) {
                console.error('Error getting user data:', error);
                await auth.signOut();
                callback({ user: null, role: null, error: error.message });
            }
        } else {
            // User is signed out
            currentUser = null;
            currentUserRole = null;
            callback({ user: null, role: null });
        }
    });
}

/**
 * Initialize authentication system
 * @param {function} onLogin - Function to call when user logs in
 * @param {function} onLogout - Function to call when user logs out
 */
function initAuth(onLogin = null, onLogout = null) {
    onAuthStateChanged((authState) => {
        if (authState.user) {
            console.log('User logged in:', authState.user.email, 'Role:', authState.role);
            if (onLogin) onLogin(authState);
        } else {
            console.log('User logged out');
            if (onLogout) onLogout();
        }
    });
}

/**
 * Show role-based welcome message
 * @param {string} role - User's role
 * @returns {string} - Welcome message
 */
function getWelcomeMessage(role) {
    switch (role) {
        case 'admin':
            return 'مرحباً بك في النظام، لديك صلاحيات كاملة';
        case 'supervisor':
            return 'مرحباً بك في النظام، لديك صلاحيات إشرافية';
        case 'employee':
            return 'مرحباً بك في النظام، يمكنك إضافة وبحث بيانات المواطنين';
        default:
            return 'مرحباً بك في النظام';
    }
}

/**
 * Get role display name
 * @param {string} role - User's role
 * @returns {string} - Display name for role
 */
function getRoleDisplayName(role) {
    switch (role) {
        case 'admin':
            return 'مدير النظام';
        case 'supervisor':
            return 'مشرف';
        case 'employee':
            return 'موظف';
        default:
            return 'غير محدد';
    }
}

/**
 * Get role badge class for UI
 * @param {string} role - User's role
 * @returns {string} - Bootstrap badge class
 */
function getRoleBadgeClass(role) {
    switch (role) {
        case 'admin':
            return 'badge-danger';
        case 'supervisor':
            return 'badge-warning';
        case 'employee':
            return 'badge-info';
        default:
            return 'badge-secondary';
    }
}

// Helper for admin panel: create Firebase user and return UID
async function createUserReturnUid(email, password, name, role = 'employee') {
    const result = await createUser(email, password, name, role);
    if (result.success) {
        return { success: true, uid: result.uid };
    }
    return result;
}

// Export functions for use in other files
window.FirebaseAuth = {
    createUser,
    createUserReturnUid,
    createUserWithSecondaryApp,
    loginUser,
    logoutUser,
    isAdmin,
    isSupervisor,
    isEmployee,
    getCurrentUserRole,
    getCurrentUser,
    updateUserRole,
    updateUserStatus,
    getAllUsers,
    deleteUser,
    checkAdminAccess,
    checkSupervisorAccess,
    checkEmployeeAccess,
    onAuthStateChanged,
    initAuth,
    getWelcomeMessage,
    getRoleDisplayName,
    getRoleBadgeClass,
};


