/**
 * Admin Panel with Firebase Authentication
 * This file handles admin panel functionality with Firebase Auth and Firestore
 */

// Global variables
let currentAdmin = null;
let adminRole = null;
let dashboardLoaded = false; // منع التكرار

/**
 * Initialize admin panel
 */
function initAdminPanel() {
    console.log('Initializing Admin Panel...');
    
    // Check if user is logged in and has admin access
    if (window.FirebaseAuth) {
        window.FirebaseAuth.onAuthStateChanged((authState) => {
            console.log('Auth state changed:', authState);
            if (authState.user && authState.role === 'admin') {
                // Admin is logged in
                currentAdmin = authState.user;
                adminRole = authState.role;
                console.log('Current admin set:', currentAdmin);
                console.log('Admin UID:', currentAdmin.uid);
                showAdminContent();
                
                // Ensure currentAdmin is properly set before loading dashboard
                if (currentAdmin && currentAdmin.uid) {
                    console.log('Admin properly set, loading dashboard...');
                    // Add a small delay to ensure everything is set
                    setTimeout(() => {
                        loadAdminDashboard();
                    }, 100);
                } else {
                    console.error('Admin not properly set, cannot load dashboard');
                }
                console.log('Admin logged in:', authState.user.email);
            } else if (authState.user && authState.role) {
                // User is logged in but not admin
                console.log('User logged in but not admin. Role:', authState.role);
                hideAdminContent();
                showLoginModal();
            } else {
                // Not logged in
                hideAdminContent();
                showLoginModal();
                console.log('No user logged in');
            }
        });
    } else {
        console.error('FirebaseAuth not loaded');
        showLoginModal();
    }
}

/**
 * Show admin content
 */
function showAdminContent() {
    const adminContent = document.getElementById('adminContent');
    if (adminContent) {
        adminContent.style.display = 'block';
    }
    
    // Update admin name
    const adminName = document.getElementById('adminName');
    if (adminName && currentAdmin) {
        adminName.textContent = currentAdmin.email;
    }
}

/**
 * Hide admin content
 */
function hideAdminContent() {
    const adminContent = document.getElementById('adminContent');
    if (adminContent) {
        adminContent.style.display = 'none';
    }
}

/**
 * Show login modal
 */
function showLoginModal() {
    const modal = new bootstrap.Modal(document.getElementById('adminLoginModal'));
    modal.show();
}

/**
 * Handle admin login
 */
async function handleAdminLogin() {
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    if (!email || !password) {
        showMessage('الرجاء إدخال البريد الإلكتروني وكلمة المرور', 'warning');
        return;
    }

    toggleLoading(true);

    try {
        const result = await window.FirebaseAuth.loginUser(email, password);
        console.log('Login result:', result);
        
        if (result.success) {
            if (result.user.role === 'admin') {
                showMessage('تم تسجيل الدخول بنجاح', 'success');
                hideLoginModal();
                // Don't call loadAdminDashboard here - let the auth state change handle it
            } else {
                showMessage('غير مصرح لك بالوصول للوحة التحكم. مطلوب صلاحيات مدير النظام.', 'danger');
                await window.FirebaseAuth.logoutUser();
            }
        } else {
            showMessage(result.error, 'danger');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('فشل في تسجيل الدخول', 'danger');
    } finally {
        toggleLoading(false);
    }
}

/**
 * Handle admin logout
 */
async function handleAdminLogout() {
    try {
        await window.FirebaseAuth.logoutUser();
        currentAdmin = null;
        adminRole = null;
        dashboardLoaded = false; // Reset the flag
        hideAdminContent();
        showMessage('تم تسجيل الخروج بنجاح', 'info');
    } catch (error) {
        console.error('Logout error:', error);
        showMessage('فشل في تسجيل الخروج', 'danger');
    }
}

/**
 * Add new employee
 */
async function handleAddEmployee() {
    const name = document.getElementById('employeeName').value;
    const email = document.getElementById('employeeEmail').value;
    const password = document.getElementById('employeePassword').value;
    const role = document.getElementById('employeeRole').value;

    if (!name || !email || !password || !role) {
        showMessage('الرجاء إكمال جميع الحقول', 'warning');
        return;
    }

    toggleLoading(true);

    try {
        // 1) Create the user in Firebase Auth + Firestore
        const createResult = await window.FirebaseAuth.createUserWithSecondaryApp(email, password, name, role);
        if (!createResult.success) {
            showMessage(createResult.error || 'فشل في إنشاء المستخدم على Firebase', 'danger');
            return;
        }

        // 2) Register the user in PHP backend so it appears in employees table
        const registerResult = await makeRequest('add_employee', {
            uid: createResult.uid || createResult.user?.uid || email,
            name: name,
            email: email,
            role: role
        });

        if (registerResult.success) {
            showMessage('تم إضافة الموظف بنجاح', 'success');
            hideAddEmployeeModal();
            loadEmployees();
        } else {
            showMessage(registerResult.message || 'تم إنشاء المستخدم على Firebase ولكن فشل تسجيله في النظام', 'warning');
        }
    } catch (error) {
        console.error('Add employee error:', error);
        showMessage('فشل في إضافة الموظف', 'danger');
    } finally {
        toggleLoading(false);
    }
}

/**
 * Load employees list
 */
async function loadEmployees() {
    try {
        const result = await makeRequest('get_employees');
        if (result.success) {
            updateEmployeesTable(result.employees);
        } else {
            console.warn('فشل تحميل قائمة الموظفين:', result.message);
            showMessage('فشل في تحميل قائمة الموظفين: ' + result.message, 'warning');
        }
    } catch (error) {
        console.error('Error loading employees:', error);
        showMessage('فشل في تحميل قائمة الموظفين', 'error');
    }
}

/**
 * Update employees table
 */
function updateEmployeesTable(employees) {
    const tbody = document.getElementById('employeesTable');
    if (!tbody) return;

    tbody.innerHTML = employees.map(employee => `
        <tr>
            <td>${employee.name || 'غير محدد'}</td>
            <td>${employee.email}</td>
            <td>
                <span class="badge badge-${getRoleBadge(employee.role)}">
                    ${getRoleLabel(employee.role)}
                </span>
            </td>
            <td>${employee.created_at ? formatDate(new Date(employee.created_at)) : 'غير محدد'}</td>
            <td>${employee.last_login ? formatDate(new Date(employee.last_login)) : 'لم يسجل دخول'}</td>
            <td>
                <span class="badge badge-${employee.status === 'active' ? 'success' : 'danger'}">
                    ${employee.status === 'active' ? 'نشط' : 'معطل'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-custom btn-info-custom me-2" onclick="editEmployee('${employee.uid}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-custom btn-danger-custom" onclick="deleteEmployee('${employee.uid}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Edit employee
 */
async function editEmployee(uid) {
    try {
        // Get user data from Firestore
        const userDoc = await firebase.firestore().collection('users').doc(uid).get();
        if (userDoc.exists) {
            const employee = userDoc.data();
            
            document.getElementById('editEmployeeId').value = uid;
            document.getElementById('editEmployeeName').value = employee.name || '';
            document.getElementById('editEmployeeEmail').value = employee.email || '';
            document.getElementById('editEmployeeRole').value = employee.role || 'employee';
            document.getElementById('editEmployeeStatus').value = employee.status || 'active';
            
            const modal = new bootstrap.Modal(document.getElementById('editEmployeeModal'));
            modal.show();
        }
    } catch (error) {
        console.error('Error loading employee data:', error);
        showMessage('فشل في تحميل بيانات الموظف', 'danger');
    }
}

/**
 * Handle edit employee
 */
async function handleEditEmployee() {
    const uid = document.getElementById('editEmployeeId').value;
    const name = document.getElementById('editEmployeeName').value;
    const email = document.getElementById('editEmployeeEmail').value;
    const role = document.getElementById('editEmployeeRole').value;
    const status = document.getElementById('editEmployeeStatus').value;

    if (!name || !email || !role || !status) {
        showMessage('الرجاء إكمال جميع الحقول', 'warning');
        return;
    }

    toggleLoading(true);

    try {
        // Update user data in Firestore
        await firebase.firestore().collection('users').doc(uid).update({
            name: name,
            email: email,
            role: role,
            status: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Also update in backend database so admin list reflects changes
        const result = await makeRequest('edit_employee', {
            id: uid,
            name: name,
            email: email,
            role: role,
            status: status
        });
        
        if (!result.success) {
            console.warn('Backend edit_employee failed:', result.message);
        }

        showMessage('تم تحديث بيانات الموظف بنجاح', 'success');
        hideEditEmployeeModal();
        loadEmployees();
    } catch (error) {
        console.error('Edit employee error:', error);
        showMessage('فشل في تحديث بيانات الموظف', 'danger');
    } finally {
        toggleLoading(false);
    }
}

/**
 * Delete employee
 */
async function deleteEmployee(uid) {
    if (!confirm('هل أنت متأكد من حذف هذا الموظف؟')) {
        return;
    }

    try {
        const result = await window.FirebaseAuth.deleteUser(uid);
        if (result.success) {
            // Also soft-delete in backend (MySQL) so admin list stays in sync
            try {
                const backendResult = await makeRequest('delete_employee', { uid });
                if (!backendResult.success) {
                    console.warn('Backend delete_employee failed:', backendResult.message);
                    showMessage('تم حذف الموظف من Firestore لكن فشل حذف السجل من قاعدة البيانات: ' + (backendResult.message || ''), 'warning');
                } else {
                    showMessage('تم حذف الموظف بنجاح', 'success');
                }
            } catch (backendError) {
                console.error('Error calling backend delete_employee:', backendError);
                showMessage('تم حذف الموظف من Firestore لكن حدث خطأ أثناء مزامنة قاعدة البيانات', 'warning');
            }

            // Reload list from backend (reflects MySQL state)
            loadEmployees();
        } else {
            showMessage(result.error, 'danger');
        }
    } catch (error) {
        console.error('Error deleting employee:', error);
        showMessage('فشل في حذف الموظف', 'danger');
    }
}

/**
 * Load admin dashboard data
 */
async function loadAdminDashboard() {
    console.log("جارٍ تحميل لوحة التحكم...");
    console.log("Current admin in loadAdminDashboard:", currentAdmin);
    console.log("Current admin UID in loadAdminDashboard:", currentAdmin?.uid);
    console.log("Dashboard loaded flag:", dashboardLoaded);
    
    if (!currentAdmin?.uid) {
        console.error("No admin UID available in loadAdminDashboard");
        return;
    }
    
    // Only load analytics and statistics if not already loaded
    if (!dashboardLoaded) {
        dashboardLoaded = true;
        await loadAnalytics();
        await loadStatistics();
    } else {
        console.log("Dashboard already loaded, skipping analytics and statistics");
    }
}

/**
 * Load statistics
 */
async function loadStatistics() {
    const result = await makeRequest('get_dashboard_stats');

    if (result.success) {
        const stats = result.data;
        document.getElementById('totalCitizens').textContent = stats.totalCitizens || 0;
        document.getElementById('totalEmployees').textContent = stats.totalEmployees || 0;
        document.getElementById('totalBlocks').textContent = stats.totalBlocks || 0;
        document.getElementById('todayOperations').textContent = stats.todayOperations || 0;
    } else {
        console.warn('فشل تحميل الإحصائيات:', result.message);
    }
}
/**
 * Make API request
 */
async function makeRequest(action, data = {}) {
    try {
        console.log('makeRequest called with action:', action);
        console.log('currentAdmin:', currentAdmin);
        console.log('currentAdmin?.uid:', currentAdmin?.uid);
        
        if (!currentAdmin?.uid) {
            console.error('No admin user found in makeRequest');
            console.error('currentAdmin:', currentAdmin);
            return { success: false, message: 'لم يتم العثور على مستخدم مدير' };
        }

        const requestBody = {
            action: action,
            ...data,
            admin: true,
            admin_uid: currentAdmin.uid,
            admin_email: currentAdmin.email
        };
        
        console.log('Making API request:', action);
        console.log('Request body:', requestBody);
        console.log('Current admin UID:', currentAdmin.uid);

        const response = await fetch('../api.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            console.error('API response not ok:', response.status, response.statusText);
            return { success: false, message: `خطأ في الخادم: ${response.status}` };
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('API request error:', error);
        return { success: false, message: 'فشل في الاتصال بالخادم' };
    }
}

/**
 * Load analytics
 */
async function loadAnalytics() {
    try {
        const result = await makeRequest('get_analytics');

        if (result.success) {
            console.log('تم تحميل التحليلات بنجاح:', result.analytics);
            createCharts(result.analytics);
            updateDetailedStats(result.analytics);
        } else {
            console.warn('فشل تحميل التحليلات:', result.message);
            showMessage('فشل في تحميل التحليلات: ' + result.message, 'warning');
        }
    } catch (error) {
        console.error('Error in loadAnalytics:', error);
        showMessage('فشل في تحميل التحليلات', 'error');
    }
}

/**
 * Create charts for analytics
 */
function createCharts(analytics) {
    // Gender distribution chart
    if (analytics.gender_distribution) {
        createGenderChart(analytics.gender_distribution);
    }

    // Age distribution chart
    if (analytics.age_distribution) {
        createAgeChart(analytics.age_distribution);
    }

    // Education distribution chart
    if (analytics.education_distribution) {
        createEducationChart(analytics.education_distribution);
    }

    // Housing type chart
    if (analytics.housing_distribution) {
        createHousingChart(analytics.housing_distribution);
    }
}

/**
 * Create gender chart
 */
function createGenderChart(data) {
    const ctx = document.getElementById('genderChart');
    if (!ctx) return;

    if (window.genderChart) {
        window.genderChart.destroy();
    }

    window.genderChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['ذكر', 'أنثى'],
            datasets: [{
                data: [data.ذكر || 0, data.أنثى || 0],
                backgroundColor: ['#3498db', '#e74c3c'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#fff',
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

/**
 * Create age chart
 */
function createAgeChart(data) {
    const ctx = document.getElementById('ageChart');
    if (!ctx) return;

    if (window.ageChart) {
        window.ageChart.destroy();
    }

    const labels = Object.keys(data);
    const values = Object.values(data);

    window.ageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'عدد المواطنين',
                data: values,
                backgroundColor: 'rgba(52, 152, 219, 0.8)',
                borderColor: '#3498db',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#fff'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#fff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#fff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

/**
 * Create education chart
 */
function createEducationChart(data) {
    const ctx = document.getElementById('educationChart');
    if (!ctx) return;

    if (window.educationChart) {
        window.educationChart.destroy();
    }

    const labels = Object.keys(data);
    const values = Object.values(data);

    window.educationChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#3498db', '#e74c3c', '#2ecc71', '#f39c12',
                    '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#fff',
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

/**
 * Create housing chart
 */
function createHousingChart(data) {
    const ctx = document.getElementById('housingChart');
    if (!ctx) return;

    if (window.housingChart) {
        window.housingChart.destroy();
    }

    const labels = Object.keys(data);
    const values = Object.values(data);

    window.housingChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#3498db', '#e74c3c', '#2ecc71'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#fff',
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

/**
 * Update detailed stats
 */
function updateDetailedStats(analytics) {
    const tbody = document.getElementById('detailedStats');
    if (!tbody) return;

    const stats = [
        { label: 'إجمالي المواطنين', value: analytics.total_citizens || 0, percentage: '100%' },
        { label: 'الذكور', value: analytics.gender_distribution?.ذكر || 0, percentage: calculatePercentage(analytics.gender_distribution?.ذكر, analytics.total_citizens) },
        { label: 'الإناث', value: analytics.gender_distribution?.أنثى || 0, percentage: calculatePercentage(analytics.gender_distribution?.أنثى, analytics.total_citizens) },
        { label: 'متوسط العمر', value: analytics.average_age || 0, percentage: '-' },
        { label: 'أعلى فئة عمرية', value: analytics.most_common_age || 0, percentage: '-' },
        { label: 'المواطنين المتزوجين', value: analytics.married_count || 0, percentage: calculatePercentage(analytics.married_count, analytics.total_citizens) }
    ];

    tbody.innerHTML = stats.map(stat => `
        <tr>
            <td>${stat.label}</td>
            <td>${stat.value}</td>
            <td>${stat.percentage}</td>
        </tr>
    `).join('');
}

/**
 * Calculate percentage
 */
function calculatePercentage(value, total) {
    if (!total || total === 0) return '0%';
    return Math.round((value / total) * 100) + '%';
}

/**
 * Format date
 */
function formatDate(date) {
    if (!date) return '-';
    return date.toLocaleString('ar-EG');
}

/**
 * Show message
 */
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

/**
 * Toggle loading indicator
 */
function toggleLoading(show) {
    const loading = document.getElementById('loadingIndicator');
    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
}

/**
 * Hide login modal
 */
function hideLoginModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('adminLoginModal'));
    if (modal) {
        modal.hide();
    }
}

/**
 * Hide add employee modal
 */
function hideAddEmployeeModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('addEmployeeModal'));
    if (modal) {
        modal.hide();
    }
    document.getElementById('addEmployeeForm').reset();
}

/**
 * Hide edit employee modal
 */
function hideEditEmployeeModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('editEmployeeModal'));
    if (modal) {
        modal.hide();
    }
}

/**
 * Backup handlers
 */
async function createBackup() {
    try {
        const backupCitizens = document.getElementById('backupCitizens')?.checked || false;
        const backupEmployees = document.getElementById('backupEmployees')?.checked || false;
        const backupLogs = document.getElementById('backupLogs')?.checked || false;
        const backupBlockchain = document.getElementById('backupBlockchain')?.checked || false;

        toggleLoading(true);
        const result = await makeRequest('create_backup', {
            backup_citizens: backupCitizens,
            backup_employees: backupEmployees,
            backup_logs: backupLogs,
            backup_blockchain: backupBlockchain
        });
        toggleLoading(false);

        if (result.success) {
            showMessage(result.message || 'تم إنشاء النسخة الاحتياطية بنجاح', 'success');
            await loadBackupHistory();
        } else {
            showMessage(result.message || 'فشل في إنشاء النسخة الاحتياطية', 'danger');
        }
    } catch (error) {
        toggleLoading(false);
        console.error('Error creating backup:', error);
        showMessage('فشل في إنشاء النسخة الاحتياطية', 'danger');
    }
}

function wireBackupButtons() {
    document.getElementById('backupDataBtn')?.addEventListener('click', createBackup);
    document.getElementById('createBackupBtn')?.addEventListener('click', createBackup);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Admin login form
    document.getElementById('adminLoginForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAdminLogin();
    });

    // Logout button
    document.getElementById('adminLogoutBtn')?.addEventListener('click', () => {
        handleAdminLogout();
    });

    // Add employee form
    document.getElementById('addEmployeeForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleAddEmployee();
    });

    // Edit employee form
    document.getElementById('editEmployeeForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleEditEmployee();
    });

    // Backup buttons
    wireBackupButtons();

    // Tab change events
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', (e) => {
            handleTabChange(e.target.id);
        });
    });
}

/**
 * Handle tab change
 */
function handleTabChange(tabId) {
    switch (tabId) {
        case 'analytics-tab':
            loadAnalytics();
            break;
        case 'employees-tab':
            loadEmployees();
            break;
        case 'logs-tab':
            loadLogs();
            break;
        case 'security-tab':
            loadSecurityStatus();
            break;
        case 'backup-tab':
            loadBackupHistory();
            break;
        case 'settings-tab':
            loadSettings();
            break;
        case 'citizens-tab':
            loadCitizens();
            break;
    }
}

/**
 * Load logs
 */
async function loadLogs() {
    try {
        const result = await makeRequest('get_admin_logs');
        if (result.success) {
            updateLogsTable(result.logs);
        } else {
            console.warn('فشل تحميل السجلات:', result.message);
            showMessage('فشل في تحميل السجلات: ' + result.message, 'warning');
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        showMessage('فشل في تحميل السجلات', 'error');
    }
}

/**
 * Update logs table
 */
function updateLogsTable(logs) {
    const tbody = document.getElementById('logsTable');
    if (!tbody) return;

    tbody.innerHTML = logs.map(log => `
        <tr>
            <td>${formatDate(new Date(log.operation_time))}</td>
            <td>
                <span class="badge badge-${getLogTypeBadge(log.operation_type)}">
                    ${getLogTypeLabel(log.operation_type)}
                </span>
            </td>
            <td>${(log.user_name ? log.user_name + ' (' + (log.user_email || '') + ')' : (log.user_email || 'غير محدد'))}</td>
            <td>${log.user_ip || 'غير محدد'}</td>
            <td>${log.details || '-'}</td>
            <td>
                <span class="badge badge-${log.success ? 'success' : 'danger'}">
                    ${log.success ? 'نجح' : 'فشل'}
                </span>
            </td>
        </tr>
    `).join('');
}

/**
 * Get log type badge
 */
function getLogTypeBadge(type) {
    const badges = {
        'INSERT': 'success',
        'SEARCH': 'info',
        'VERIFY': 'warning',
        'LOGIN': 'primary',
        'LOGOUT': 'secondary'
    };
    return badges[type] || 'secondary';
}

/**
 * Get role badge
 */
function getRoleBadge(role) {
    const badges = {
        'admin': 'danger',
        'supervisor': 'warning',
        'employee': 'info',
        'viewer': 'secondary'
    };
    return badges[role] || 'secondary';
}

/**
 * Get role label
 */
function getRoleLabel(role) {
    const labels = {
        'admin': 'مدير',
        'supervisor': 'مشرف',
        'employee': 'موظف',
        'viewer': 'مشاهد'
    };
    return labels[role] || role;
}

/**
 * Get log type label
 */
function getLogTypeLabel(type) {
    const labels = {
        'INSERT': 'إضافة مواطن',
        'SEARCH': 'بحث',
        'VERIFY': 'تحقق',
        'LOGIN': 'تسجيل دخول',
        'LOGOUT': 'تسجيل خروج'
    };
    return labels[type] || type;
}

/**
 * Load security status
 */
async function loadSecurityStatus() {
    try {
        const result = await makeRequest('get_security_status');
        if (result.success) {
            updateSecurityStatus(result.security);
        } else {
            console.warn('فشل تحميل حالة الأمان:', result.message);
            showMessage('فشل في تحميل حالة الأمان: ' + result.message, 'warning');
        }
    } catch (error) {
        console.error('Error loading security status:', error);
        showMessage('فشل في تحميل حالة الأمان', 'error');
    }
}

/**
 * Update security status
 */
function updateSecurityStatus(security) {
    const chainStatus = document.getElementById('chainStatus');
    const lastCheck = document.getElementById('lastCheck');
    const suspiciousAttempts = document.getElementById('suspiciousAttempts');
    const protectionStatus = document.getElementById('protectionStatus');

    if (chainStatus) {
        chainStatus.textContent = security.chain_verified ? 'سليم' : 'مشكوك فيه';
        chainStatus.className = `status-value ${security.chain_verified ? 'success' : 'danger'}`;
    }

    if (lastCheck) {
        lastCheck.textContent = security.last_check ? formatDate(new Date(security.last_check)) : '-';
    }

    if (suspiciousAttempts) {
        suspiciousAttempts.textContent = security.suspicious_attempts || 0;
    }

    if (protectionStatus) {
        protectionStatus.textContent = security.protection_enabled ? 'مفعلة' : 'معطلة';
        protectionStatus.className = `status-value ${security.protection_enabled ? 'success' : 'danger'}`;
    }

    // Update security stats
    document.getElementById('totalLogins').textContent = security.total_logins || 0;
    document.getElementById('failedLogins').textContent = security.failed_logins || 0;
    document.getElementById('blockedIPs').textContent = security.blocked_ips || 0;
    document.getElementById('securityScore').textContent = security.security_score || '85%';
}

/**
 * Load backup history
 */
async function loadBackupHistory() {
    try {
        const result = await makeRequest('get_backup_history');
        if (result.success) {
            updateBackupHistoryTable(result.backups);
        } else {
            console.warn('فشل تحميل سجل النسخ الاحتياطية:', result.message);
            showMessage('فشل في تحميل سجل النسخ الاحتياطية: ' + result.message, 'warning');
        }
    } catch (error) {
        console.error('Error loading backup history:', error);
        showMessage('فشل في تحميل سجل النسخ الاحتياطية', 'error');
    }
}

/**
 * Update backup history table
 */
function updateBackupHistoryTable(backups) {
    const tbody = document.getElementById('backupHistoryTable');
    if (!tbody) return;

    tbody.innerHTML = backups.map(backup => `
        <tr>
            <td>${formatDate(new Date(backup.created_at))}</td>
            <td>${backup.file_size || 'غير محدد'}</td>
            <td>${backup.backup_type || 'غير محدد'}</td>
            <td>
                <span class="badge badge-${backup.status === 'completed' ? 'success' : 'warning'}">
                    ${backup.status === 'completed' ? 'مكتمل' : 'قيد المعالجة'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-custom btn-info-custom me-2" onclick="downloadBackup('${backup.id}')">
                    <i class="fas fa-download"></i>
                </button>
                <button class="btn btn-sm btn-custom btn-danger-custom" onclick="deleteBackup('${backup.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Load settings
 */
async function loadSettings() {
    try {
        const result = await makeRequest('get_settings');
        if (result.success) {
            updateSettingsForm(result.settings);
        } else {
            console.warn('فشل تحميل الإعدادات:', result.message);
            showMessage('فشل في تحميل الإعدادات: ' + result.message, 'warning');
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        showMessage('فشل في تحميل الإعدادات', 'error');
    }
}

/**
 * Update settings form
 */
function updateSettingsForm(settings) {
    if (settings.system_name) {
        document.getElementById('systemName').value = settings.system_name;
    }
    if (settings.admin_email) {
        document.getElementById('adminEmail').value = settings.admin_email;
    }
    if (settings.session_timeout) {
        document.getElementById('sessionTimeout').value = settings.session_timeout;
    }
    if (settings.max_login_attempts) {
        document.getElementById('maxLoginAttempts').value = settings.max_login_attempts;
    }
    if (settings.enable_two_factor !== undefined) {
        document.getElementById('enableTwoFactor').checked = settings.enable_two_factor;
    }
    if (settings.enable_ip_blocking !== undefined) {
        document.getElementById('enableIPBlocking').checked = settings.enable_ip_blocking;
    }
    if (settings.enable_audit_log !== undefined) {
        document.getElementById('enableAuditLog').checked = settings.enable_audit_log;
    }
    if (settings.enable_auto_backup !== undefined) {
        document.getElementById('enableAutoBackup').checked = settings.enable_auto_backup;
    }
}

/**
 * Load citizens
 */
async function loadCitizens(page = 1) {
    try {
        const result = await makeRequest('get_citizens', { page });
        if (result.success) {
            updateCitizensTable(result.citizens || []);
        }
    } catch (error) {
        console.error('Error loading citizens:', error);
        showMessage('فشل في تحميل بيانات المواطنين', 'warning');
    }
}

/**
 * Update citizens table
 */
function updateCitizensTable(citizens) {
    const tbody = document.getElementById('citizensTable');
    if (!tbody) return;
    tbody.innerHTML = citizens.map(c => `
        <tr>
            <td>${c.citizen_id}</td>
            <td>${c.full_name}</td>
            <td>${c.birth_date || '-'}</td>
            <td>${c.gender || '-'}</td>
            <td>${c.address || '-'}</td>
            <td>${c.phone || '-'}</td>
            <td>${c.email || '-'}</td>
        </tr>
    `).join('');
}

function downloadBackup(id) {
    (async () => {
        try {
            toggleLoading(true);
            const result = await makeRequest('download_backup', { backup_id: id });
            if (result.success && result.data && result.filename) {
                const byteCharacters = atob(result.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/sql' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = result.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                showMessage('تم تنزيل النسخة الاحتياطية', 'success');
            } else {
                showMessage(result.message || 'فشل في تنزيل النسخة الاحتياطية', 'danger');
            }
        } catch (e) {
            console.error('downloadBackup error:', e);
            showMessage('فشل في تنزيل النسخة الاحتياطية', 'danger');
        } finally {
            toggleLoading(false);
        }
    })();
}

function deleteBackup(id) {
    (async () => {
        if (!confirm('هل أنت متأكد من حذف هذه النسخة الاحتياطية؟')) return;
        try {
            toggleLoading(true);
            const result = await makeRequest('delete_backup', { backup_id: id });
            if (result.success) {
                showMessage('تم حذف النسخة الاحتياطية بنجاح', 'success');
                await loadBackupHistory();
            } else {
                showMessage(result.message || 'فشل في حذف النسخة الاحتياطية', 'danger');
            }
        } catch (e) {
            console.error('deleteBackup error:', e);
            showMessage('فشل في حذف النسخة الاحتياطية', 'danger');
        } finally {
            toggleLoading(false);
        }
    })();
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initAdminPanel();
});

// Export functions for global use
window.AdminPanel = {
    handleAdminLogin,
    handleAdminLogout,
    handleAddEmployee,
    handleEditEmployee,
    editEmployee,
    deleteEmployee,
    loadEmployees,
    loadAdminDashboard,
    showMessage,
    toggleLoading,
    downloadBackup,
    deleteBackup
};