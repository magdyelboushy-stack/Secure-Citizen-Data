

// System settings
const CONFIG = {
    API_BASE_URL: 'api.php',
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
};

// Global variables - renamed to avoid conflicts with firebase-auth.js
let currentPage = 1;
let isLoading = false;
let authModal; // Reference to the Bootstrap modal instance
let appCurrentUser = null; // Renamed from currentUser to avoid conflict
let appUserRole = null; // Renamed from userRole to avoid conflict

document.addEventListener('DOMContentLoaded', function () {
    initializeSystem();
    setupEventListeners();
    // Initialize Bootstrap modal
    const authModalElement = document.getElementById('authModal');
    if (authModalElement) {
        authModal = new bootstrap.Modal(authModalElement);
    }
});

// System initialization function
function initializeSystem() {
    console.log('Citizen Blockchain System Initialized');
    setupFormValidation();
    
    // Test API connectivity
    testAPI().then(apiWorking => {
        if (apiWorking) {
            // Set up automatic stats update every 30 seconds
            setInterval(updateStats, 30000);
        }
    });
    
    setupFirebaseAuth(); // Initialize Firebase Auth listener
}

// Function to set up event listeners
function setupEventListeners() {
    const addForm = document.getElementById('addCitizenForm');
    if (addForm) {
        addForm.addEventListener('submit', handleAddCitizen);
    }
    const searchForm = document.getElementById('searchCitizenForm');
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearchCitizen);
    }
    const verifyBtn = document.getElementById('verifyChainBtn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', handleVerifyChain);
    }
    const prevBtn = document.getElementById('prevPageBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            currentPage--;
            loadBlocks(currentPage);
        });
    }
    const nextBtn = document.getElementById('nextPageBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            currentPage++;
            loadBlocks(currentPage);
        });
    }

    // Auth modal buttons
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', (event) => {
            event.preventDefault();
            handleLogin(event); // Default action for form submission
        });
    }
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    
    const toggleAuthModalBtn = document.getElementById('toggleAuthModalBtn');
    if (toggleAuthModalBtn) {
        toggleAuthModalBtn.addEventListener('click', () => {
            if (authModal) {
                authModal.show();
            }
        });
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// Function to show messages to the user
function showMessage(message, type = 'info') {
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) return;

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    messagesArea.appendChild(alertDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Function to toggle loading indicator
function toggleLoading(show) {
    const loading = document.getElementById('loadingIndicator');
    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
    isLoading = show;
}

// Function to test API connectivity
async function testAPI() {
    try {
        console.log('Testing API connectivity...');
        const response = await makeRequest('get_stats');
        console.log('API test successful:', response);
        return true;
    } catch (error) {
        console.error('API test failed:', error);
        showMessage('فشل في الاتصال بالخادم: ' + error.message, 'danger');
        return false;
    }
}

// Function to make API requests with retry mechanism
async function makeRequest(action, data = {}, retries = CONFIG.MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(CONFIG.API_BASE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    ...data,
                    admin_uid: appCurrentUser?.uid,
                    admin_email: appCurrentUser?.email
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseText = await response.text();
            
            // Try to parse as JSON
            try {
                const result = JSON.parse(responseText);
                return result;
            } catch (parseError) {
                console.error('Failed to parse JSON response:', responseText);
                throw new Error(`Invalid JSON response: ${responseText}`);
            }
        } catch (error) {
            console.error(`API request failed (attempt ${attempt}/${retries}):`, error);
            
            if (attempt === retries) {
                throw error;
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
        }
    }
}

// Function to load dashboard data
async function loadDashboardData() {
    try {
        await updateStats();
        await loadBlocks(currentPage);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showMessage('فشل في تحميل بيانات لوحة التحكم', 'danger');
    }
}

// Function to update system statistics
async function updateStats() {
    try {
        const response = await makeRequest('get_stats');
        if (response.success) {
            const stats = response.stats;
            
            const totalBlocksEl = document.getElementById('totalBlocks');
            const totalCitizensEl = document.getElementById('totalCitizens');
            const todayOperationsEl = document.getElementById('todayOperations');
            
            if (totalBlocksEl) totalBlocksEl.textContent = stats.total_blocks || 0;
            if (totalCitizensEl) totalCitizensEl.textContent = stats.total_citizens || 0;
            if (todayOperationsEl) todayOperationsEl.textContent = stats.today_operations || 0;
            
            const chainStatusElement = document.getElementById('chainStatus');
            if (chainStatusElement) {
                chainStatusElement.textContent = stats.chain_verified ? 'سليم' : 'مشكوك فيه';
                chainStatusElement.className = `badge ${stats.chain_verified ? 'bg-success' : 'bg-danger'}`;
            }
            
            const lastBlockHashElement = document.getElementById('lastBlockHash');
            if (lastBlockHashElement) {
                lastBlockHashElement.textContent = stats.last_block_hash || 'N/A';
            }
        }
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Function to handle adding a new citizen
async function handleAddCitizen(event) {
    event.preventDefault();
    
    // Check if user is authenticated and has permission
    if (!appCurrentUser) {
        showMessage('الرجاء تسجيل الدخول أولاً', 'warning');
        if (authModal) {
            authModal.show();
        }
        return;
    }
    
    // Check user role permissions
    if (!hasPermission(appUserRole, 'employee')) {
        showMessage('غير مصرح لك بإضافة مواطنين', 'danger');
        return;
    }

    const form = event.target;
    if (!form.checkValidity()) {
        event.stopPropagation();
        form.classList.add('was-validated');
        return;
    }

    toggleLoading(true);

    try {
        const formData = {
            nationalId: document.getElementById('nationalId')?.value || '',
            fullName: document.getElementById('fullName')?.value || '',
            birthDate: document.getElementById('birthDate')?.value || '',
            gender: document.getElementById('gender')?.value || '',
            maritalStatus: document.getElementById('maritalStatus')?.value || '',
            address: document.getElementById('address')?.value || '',
            phone: document.getElementById('phone')?.value || '',
            email: document.getElementById('email')?.value || '',
            job: document.getElementById('job')?.value || '',
            education: document.getElementById('education')?.value || '',
            familyMembers: document.getElementById('familyMembers')?.value || '',
            religion: document.getElementById('religion')?.value || '',
            bloodType: document.getElementById('bloodType')?.value || '',
            nationality: document.getElementById('nationality')?.value || '',
            housingType: document.getElementById('housingType')?.value || '',
            healthStatus: document.getElementById('healthStatus')?.value || '',
            notes: document.getElementById('notes')?.value || ''
        };

        const response = await makeRequest('add_citizen', formData);

        if (response.success) {
            showMessage(response.message, 'success');
            form.reset();
            form.classList.remove('was-validated');
            await updateStats();
        } else {
            showMessage(response.message, 'danger');
        }
    } catch (error) {
        console.error('Error adding citizen:', error);
        showMessage('فشل في إضافة المواطن', 'danger');
    } finally {
        toggleLoading(false);
    }
}

// Function to handle searching for a citizen
async function handleSearchCitizen(event) {
    event.preventDefault();
    
    // Check if user is authenticated and has permission
    if (!appCurrentUser) {
        showMessage('الرجاء تسجيل الدخول أولاً', 'warning');
        if (authModal) {
            authModal.show();
        }
        return;
    }
    
    // Check user role permissions
    if (!hasPermission(appUserRole, 'employee')) {
        showMessage('غير مصرح لك بالبحث عن المواطنين', 'danger');
        return;
    }

    const form = event.target;
    if (!form.checkValidity()) {
        event.stopPropagation();
        form.classList.add('was-validated');
        return;
    }

    toggleLoading(true);

    try {
        const nationalId = document.getElementById('searchNationalId')?.value || '';
        const response = await makeRequest('get_citizen', { nationalId: nationalId });

        const resultsContainer = document.getElementById('searchResults');
        
        if (response.success && resultsContainer) {
            const citizen = response.data;
            resultsContainer.innerHTML = `
                <div class="alert alert-success">
                    <h5>تم العثور على البيانات:</h5>
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>الاسم:</strong> ${citizen.full_name || ''}</p>
                            <p><strong>الرقم القومي:</strong> ${citizen.citizen_id || ''}</p>
                            <p><strong>تاريخ الميلاد:</strong> ${citizen.birth_date || ''}</p>
                            <p><strong>النوع:</strong> ${citizen.gender || ''}</p>
                            <p><strong>العنوان:</strong> ${citizen.address || ''}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>الهاتف:</strong> ${citizen.phone || 'غير محدد'}</p>
                            <p><strong>البريد الإلكتروني:</strong> ${citizen.email || 'غير محدد'}</p>
                            <p><strong>المهنة:</strong> ${citizen.job || 'غير محدد'}</p>
                            <p><strong>المؤهل الدراسي:</strong> ${citizen.education || 'غير محدد'}</p>
                            <p><strong>الحالة الاجتماعية:</strong> ${citizen.marital_status || 'غير محدد'}</p>
                        </div>
                    </div>
                </div>
            `;
        } else if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="alert alert-warning">
                    <h5>لم يتم العثور على البيانات</h5>
                    <p>${response.message || 'لم يتم العثور على المواطن'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error searching citizen:', error);
        showMessage('فشل في البحث عن المواطن', 'danger');
    } finally {
        toggleLoading(false);
    }
}

// Function to handle chain verification
async function handleVerifyChain() {
    // Check if user is authenticated and has permission
    if (!appCurrentUser) {
        showMessage('الرجاء تسجيل الدخول أولاً', 'warning');
        if (authModal) {
            authModal.show();
        }
        return;
    }
    
    // Check user role permissions
    if (!hasPermission(appUserRole, 'supervisor')) {
        showMessage('غير مصرح لك بفحص السلسلة', 'danger');
        return;
    }

    toggleLoading(true);

    try {
        const response = await makeRequest('verify_chain');
        const resultsContainer = document.getElementById('verificationResults');
        
        if (resultsContainer) {
            if (response.success) {
                resultsContainer.innerHTML = `
                    <div class="alert alert-success">
                        <h5>نتيجة الفحص:</h5>
                        <p>${response.message}</p>
                    </div>
                `;
            } else {
                resultsContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <h5>نتيجة الفحص:</h5>
                        <p>${response.message}</p>
                    </div>
                `;
            }
            
            resultsContainer.style.display = 'block';
        }
    } catch (error) {
        console.error('Error verifying chain:', error);
        showMessage('فشل في فحص السلسلة', 'danger');
    } finally {
        toggleLoading(false);
    }
}

// Function to load blocks with pagination
async function loadBlocks(page) {
    // Check if user is authenticated and has permission
    if (!appCurrentUser) {
        showMessage('الرجاء تسجيل الدخول أولاً', 'warning');
        if (authModal) {
            authModal.show();
        }
        return;
    }
    
    // Check user role permissions
    if (!hasPermission(appUserRole, 'supervisor')) {
        showMessage('غير مصرح لك بعرض البلوكات', 'danger');
        return;
    }

    toggleLoading(true);

    try {
        const response = await makeRequest('get_blocks', { page: page });
        
        if (response.success) {
            const blocksContainer = document.getElementById('blocksContainer');
            if (blocksContainer) {
                blocksContainer.innerHTML = '';

                response.blocks.forEach(block => {
                    const blockElement = document.createElement('div');
                    blockElement.className = 'list-group-item block-card';
                    blockElement.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-1">البلوك رقم ${block.block_index}</h6>
                                <small class="text-muted">الهاش: ${block.block_hash}</small>
                            </div>
                            <small class="text-muted">${new Date(block.timestamp * 1000).toLocaleString('ar-EG')}</small>
                        </div>
                    `;
                    blocksContainer.appendChild(blockElement);
                });
            }

            // Update pagination buttons
            const prevBtn = document.getElementById('prevPageBtn');
            const nextBtn = document.getElementById('nextPageBtn');
            
            if (prevBtn) prevBtn.style.display = page > 1 ? 'block' : 'none';
            if (nextBtn) nextBtn.style.display = response.has_next_page ? 'block' : 'none';
        }
    } catch (error) {
        console.error('Error loading blocks:', error);
        showMessage('فشل في تحميل البلوكات', 'danger');
    } finally {
        toggleLoading(false);
    }
}

// Function to set up form validation
function setupFormValidation() {
    const forms = document.querySelectorAll('.needs-validation');
    forms.forEach(form => {
        form.addEventListener('submit', event => {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        }, false);
    });
}

// Function to set up Firebase authentication
function setupFirebaseAuth() {
    console.log('Setting up Firebase authentication...');
    
    if (window.FirebaseAuth) {
        console.log('FirebaseAuth is available');
        // Initialize auth UI first
        updateAuthUI(false);
        
        window.FirebaseAuth.onAuthStateChanged(async (authState) => {
            console.log('Auth state changed:', authState);
            if (authState.user) {
                appCurrentUser = authState.user;
                appUserRole = authState.role;
                console.log('User authenticated:', authState.user.email, 'Role:', authState.role);
                
                // Show role-specific welcome message
                const welcomeMessage = window.FirebaseAuth.getWelcomeMessage(authState.role);
                showMessage(welcomeMessage, 'success');
                
                // Enable/disable features based on role
                updateUIForRole(authState.role);
                
                updateAuthUI(true, authState.user.email);
                
                // Show main content now that user is authenticated
                const mainContent = document.getElementById('mainContent');
                if (mainContent) {
                    mainContent.style.display = 'block';
                }
                
                // Load initial data
                await loadDashboardData();
            } else {
                appCurrentUser = null;
                appUserRole = null;
                console.log('User signed out');
                updateAuthUI(false);
                
                // Hide main content when user is not authenticated
                const mainContent = document.getElementById('mainContent');
                if (mainContent) {
                    mainContent.style.display = 'none';
                }
            }
        });
    } else {
        console.error('FirebaseAuth not loaded - checking if Firebase is available...');
        if (typeof firebase !== 'undefined') {
            console.log('Firebase is available but FirebaseAuth module is not loaded');
        } else {
            console.error('Firebase is not available');
        }
        // Still initialize auth UI even if FirebaseAuth is not loaded
        updateAuthUI(false);
    }
}

// Function to check if user has permission for a specific role
function hasPermission(userRole, requiredRole) {
    const roleHierarchy = {
        'admin': 3,
        'supervisor': 2,
        'employee': 1
    };
    
    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
}

// Function to update UI based on user role
function updateUIForRole(role) {
    const addCitizenCard = document.getElementById('addCitizenCard');
    const searchCitizenCard = document.getElementById('searchCitizenCard');
    const verifyChainCard = document.getElementById('verifyChainCard');
    const viewBlocksCard = document.getElementById('viewBlocksCard');
    const adminPanelBtn = document.getElementById('adminPanelBtn');
    
    // Function to get or create overlay
    function getOrCreateOverlay(card, cardId) {
        if (!card) return null;
        
        let overlay = card.querySelector('.disabled-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'disabled-overlay';
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                color: white;
                z-index: 10;
                border-radius: 0.375rem;
            `;
            card.style.position = 'relative';
            card.appendChild(overlay);
        }
        return overlay;
    }
    
    // Reset all overlays first
    [addCitizenCard, searchCitizenCard, verifyChainCard, viewBlocksCard].forEach(card => {
        const overlay = card?.querySelector('.disabled-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    });
    
    // Show admin panel button only for admin and supervisor
    if (adminPanelBtn) {
        if (role === 'admin' || role === 'supervisor') {
            adminPanelBtn.style.display = 'inline-block';
        } else {
            adminPanelBtn.style.display = 'none';
        }
    }
    
    // Role-based access control
    switch (role) {
        case 'admin':
            // Admin has full access to everything
            console.log('Admin access granted - full permissions');
            break;
            
        case 'supervisor':
            // Supervisor has access to most features but limited admin functions
            console.log('Supervisor access granted - limited admin permissions');
            break;
            
        case 'employee':
            // Employee has basic access to add and search citizens
            console.log('Employee access granted - basic permissions');
            
            // Disable advanced features for employees
            const verifyOverlay = getOrCreateOverlay(verifyChainCard, 'verifyChainCard');
            if (verifyOverlay) {
                verifyOverlay.style.display = 'flex';
                verifyOverlay.innerHTML = '<span>غير متاح للموظفين</span>';
            }
            
            const viewBlocksOverlay = getOrCreateOverlay(viewBlocksCard, 'viewBlocksCard');
            if (viewBlocksOverlay) {
                viewBlocksOverlay.style.display = 'flex';
                viewBlocksOverlay.innerHTML = '<span>غير متاح للموظفين</span>';
            }
            break;
            
        default:
            // No access for unknown roles
            console.log('No access granted - invalid role');
            showMessage('غير مصرح لك بالوصول للنظام', 'danger');
            
            // Disable all features
            [addCitizenCard, searchCitizenCard, verifyChainCard, viewBlocksCard].forEach((card, index) => {
                const cardNames = ['addCitizenCard', 'searchCitizenCard', 'verifyChainCard', 'viewBlocksCard'];
                const overlay = getOrCreateOverlay(card, cardNames[index]);
                if (overlay) {
                    overlay.style.display = 'flex';
                    overlay.innerHTML = '<span>غير مصرح بالوصول</span>';
                }
            });
            break;
    }
}

// Function to update authentication UI
function updateAuthUI(isAuthenticated, userEmail = '') {
    const authStatus = document.getElementById('authStatus');

    if (authStatus) {
        if (isAuthenticated) {
            authStatus.innerHTML = `
                <span class="badge bg-success">مسجل الدخول: ${userEmail}</span>
                <button class="btn btn-sm btn-outline-danger ms-2" id="logoutBtn">تسجيل الخروج</button>
                <button class="btn btn-sm btn-outline-warning ms-2" id="adminPanelBtn" onclick="window.open('admin/', '_blank')" style="display:none;">
                    <i class="fas fa-cog me-1"></i>لوحة التحكم
                </button>
                
            `;
            
            // Re-attach event listeners for the new buttons
            const newLogoutBtn = document.getElementById('logoutBtn');
            if (newLogoutBtn) {
                newLogoutBtn.addEventListener('click', handleLogout);
            }
        } else {
            authStatus.innerHTML = `
                <span class="badge bg-secondary">غير مسجل الدخول</span>
                <button class="btn btn-sm btn-outline-light ms-2" id="toggleAuthModalBtn">تسجيل الدخول</button>
                
                
            `;
            
            // Re-attach event listener for the login button
            const newToggleBtn = document.getElementById('toggleAuthModalBtn');
            if (newToggleBtn) {
                newToggleBtn.addEventListener('click', () => {
                    if (authModal) {
                        authModal.show();
                    }
                });
            }
        }
    }
}



// Function to handle login
async function handleLogin(event) {
    event.preventDefault();
    
    const emailEl = document.getElementById('authEmail');
    const passwordEl = document.getElementById('authPassword');
    
    const email = emailEl?.value || '';
    const password = passwordEl?.value || '';

    if (!email || !password) {
        showMessage('الرجاء إدخال البريد الإلكتروني وكلمة المرور', 'warning');
        return;
    }

    toggleLoading(true);

    try {
        if (window.FirebaseAuth) {
            const result = await window.FirebaseAuth.loginUser(email, password);
            
            if (result.success) {
                showMessage('تم تسجيل الدخول بنجاح', 'success');
                if (authModal) {
                    authModal.hide();
                }
            } else {
                showMessage(result.error, 'danger');
            }
        } else {
            showMessage('نظام المصادقة غير متاح', 'danger');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('فشل في تسجيل الدخول', 'danger');
    } finally {
        toggleLoading(false);
    }
}

// Function to handle logout
async function handleLogout() {
    try {
        if (window.FirebaseAuth) {
            await window.FirebaseAuth.logoutUser();
            appCurrentUser = null;
            appUserRole = null;
            showMessage('تم تسجيل الخروج بنجاح', 'info');
            
            // Clear forms
            const authForm = document.getElementById('authForm');
            if (authForm) authForm.reset();
            
            // Update UI
            updateAuthUI(false);
            
            // Hide main content
            const mainContent = document.getElementById('mainContent');
            if (mainContent) {
                mainContent.style.display = 'none';
            }
        } else {
            showMessage('نظام المصادقة غير متاح', 'danger');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showMessage('فشل في تسجيل الخروج', 'danger');
    }
}

console.log('Main application loaded successfully');