const allowedEmail = "3mk_ali@gmail.com";

// التحقق من تسجيل الدخول
document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    
    if (email === allowedEmail) {
        // حفظ حالة تسجيل الدخول في localStorage
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userEmail', email);
        
        // توجيه المستخدم إلى الصفحة الرئيسية
        window.location.href = 'index.html';
    } else {
        alert('البريد الإلكتروني غير مسموح به. يرجى استخدام البريد الصحيح.');
    }
});

// التحقق من المصادقة عند تحميل الصفحة
function checkAuthentication() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const userEmail = localStorage.getItem('userEmail');
    
    // إذا لم يكن مسجلاً الدخول أو البريد غير مسموح به، توجيه إلى صفحة تسجيل الدخول
    if (!isAuthenticated || userEmail !== allowedEmail) {
        // تجنب حلقة التوجيه إذا كنا بالفعل في صفحة تسجيل الدخول
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
    }
}

// تنفيذ التحقق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    if (!window.location.pathname.includes('login.html')) {
        checkAuthentication();
    }
    
    // إضافة وظيفة تسجيل الخروج
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('userEmail');
            window.location.href = 'login.html';
        });
    }
});

// تصدير الدالة للاستخدام في ملفات أخرى
window.checkAuthentication = checkAuthentication;
