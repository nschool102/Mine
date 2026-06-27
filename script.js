// =========================================================================
// CẤU HÌNH APP
// =========================================================================
const CONFIG = {
    googleSheetId: '19Tsmkh53nPAqhTYy2DU5dSfYXJRAwyc9VI0VaeM3LMw',
    apiEndpoint: 'https://script.google.com/macros/s/AKfycbxC72RzXFo9yG8iP9FRgyjY7sYhH_ffHxR1qkK0u5GbwFnmODsZ0E2_M_Hl38328S3T/exec'
};

const CATEGORIES = {
    thu: {
        "Lương": ["Lương tháng", "Bổ sung lương", "Ứng lương", "Trực lễ tết", "Công tác phí", "Hoàn thuế"],
        "Thưởng": ["Bất thường", "Bổ sung thưởng", "Thưởng lễ tết", "Thưởng năm", "Thưởng quí"],
        "Phụ cấp": ["Mĩ phẩm", "Vệ sinh viên"],
        "Phúc lợi": ["HSG", "Phụ nữ", "Sinh nhật", "Thiếu nhi"],
        "Thu khác": ["Bảo hiểm refund"],
        "Bất thường": ["Tặng cho", "Trúng số"],
        "CON CỢP": ["Lương tháng", "Bổ sung lương", "Bổ sung thưởng"]
    },
    chi: {
        "Chi khác": ["Từ thiện", "Biếu tặng", "Dịch vụ công"],
        "Chi tiêu thiết yếu": ["Đi chợ, siêu thị", "Điện", "Nước", "Internet", "Xăng", "Tiền tiêu vặt", "Điện thoại", "Transportation"],
        "Đầu tư, tiết kiệm": ["Vàng", "Tiền mặt", "USDT", "Cho mượn"],
        "Giải trí": ["Cafe", "Coi phim", "Du lịch", "Nhà hàng"],
        "Giáo dục": ["Học phí", "Học thêm", "Quĩ lớp", "Lệ phí"],
        "Mua sắm": ["Đồ ăn, thức uống", "Đồ chơi", "Đồ gia dụng", "Mĩ phẩm", "Phụ kiện", "Quần áo", "Sách, Văn phòng phẩm", "Thực phẩm chức năng"],
        "Y tế": ["Khám, chữa bệnh", "Thuốc"]
    }
};

const PALETTE = ["#4CAF50", "#8BC34A", "#2196F3", "#E91E63", "#9C27B0", "#F44336", "#FF9800", "#FFEB3B"];

// Theme mặc định: Vàng (#FFC107) + Dark Mode bật sẵn
const DEFAULT_THEME_COLOR = "#FFC107";
const DEFAULT_DARK_MODE = true;

let db;
let charts = {};
let localFamilyData = [];
let localReminderData = [];
let isSyncing = false;
let notificationCheckInterval = null;

// =========================================================================
// HÀM CHUYỂN ĐỔI SENTENCE CASE
// =========================================================================
function toSentenceCase(str) {
    if (!str || typeof str !== 'string') return str || '';
    if (str.trim() === '') return str;
    if (str === str.toUpperCase()) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
} // end function toSentenceCase

// =========================================================================
// THÔNG BÁO ĐẨY (PUSH NOTIFICATION)
// =========================================================================
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("Trình duyệt không hỗ trợ Notification");
        return;
    }
    
    if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("Đã được cấp quyền thông báo");
                registerServiceWorker();
            } else {
                console.log("Từ chối quyền thông báo");
            }
        });
    } else if (Notification.permission === "granted") {
        registerServiceWorker();
    }
} // end function requestNotificationPermission

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                console.log('Service Worker đăng ký thành công:', reg);
            })
            .catch(err => {
                console.log('Lỗi đăng ký Service Worker:', err);
            });
    }
} // end function registerServiceWorker

function triggerPushNotification(title, body) {
    if (!("Notification" in window)) {
        console.log("Trình duyệt không hỗ trợ Notification");
        return;
    }
    
    if (Notification.permission === "granted") {
        try {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title: title,
                    body: body,
                    icon: 'icon.png'
                });
            } else {
                new Notification(title, {
                    body: body,
                    icon: 'icon.png',
                    vibrate: [200, 100, 200]
                });
            }
        } catch(e) {
            console.log("Lỗi gửi thông báo:", e);
            try {
                new Notification(title, { body: body });
            } catch(e2) {
                console.log("Không thể gửi thông báo:", e2);
            }
        }
    } else {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                triggerPushNotification(title, body);
            }
        });
    }
} // end function triggerPushNotification
// end THÔNG BÁO ĐẨY

// =========================================================================
// THÔNG TIN ỨNG DỤNG - TỰ ĐỘNG CẬP NHẬT
// =========================================================================
async function loadAppInfoFromManifest() {
    try {
        const response = await fetch('/manifest.json');
        if (!response.ok) {
            throw new Error('Không tìm thấy manifest.json');
        }
        const manifest = await response.json();
        return {
            version: manifest.version || '1.0.0',
            name: manifest.name || 'TÔI - Quản lý tài chính',
            shortName: manifest.short_name || 'TÔI'
        };
    } catch (error) {
        console.log('Không thể tải manifest.json:', error.message);
        return {
            version: '1.0.0',
            name: 'TÔI - Quản lý tài chính',
            shortName: 'TÔI'
        };
    }
} // end function loadAppInfoFromManifest

function getBuildTime() {
    const scripts = document.getElementsByTagName('script');
    let buildTime = new Date();
    for (let script of scripts) {
        if (script.src && script.src.includes('script.js')) {
            const urlParams = new URLSearchParams(script.src.split('?')[1] || '');
            const timestamp = urlParams.get('v');
            if (timestamp) {
                buildTime = new Date(parseInt(timestamp));
            } else {
                buildTime = new Date();
            }
            break;
        }
    }
    return buildTime;
} // end function getBuildTime

function formatBuildTime(date) {
    if (!date || isNaN(date.getTime())) {
        return '--/--/---- --:--:--';
    }
    return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
} // end function formatBuildTime

let APP_CONFIG = {
    version: '1.0.0',
    name: 'TÔI - Quản lý tài chính',
    shortName: 'TÔI',
    buildDate: formatBuildTime(new Date())
};

async function initAppConfig() {
    const manifestInfo = await loadAppInfoFromManifest();
    APP_CONFIG.version = manifestInfo.version;
    APP_CONFIG.name = manifestInfo.name;
    APP_CONFIG.shortName = manifestInfo.shortName;
    const buildTime = getBuildTime();
    APP_CONFIG.buildDate = formatBuildTime(buildTime);
    updateAppInfo();
    console.log('✅ App config initialized:', APP_CONFIG);
} // end function initAppConfig

function openAppInfoModal() {
    const modal = document.getElementById('appInfoModal');
    if (modal) {
        modal.style.display = 'flex';
        updateAppInfo();
    }
} // end function openAppInfoModal

function closeAppInfoModal() {
    const modal = document.getElementById('appInfoModal');
    if (modal) {
        modal.style.display = 'none';
    }
} // end function closeAppInfoModal

function updateAppInfo() {
    const versionEl = document.getElementById('app-version');
    const buildDateEl = document.getElementById('app-build-date');
    const lastSyncEl = document.getElementById('app-last-sync');
    const totalTxEl = document.getElementById('app-total-transactions');
    const totalRemEl = document.getElementById('app-total-reminders');
    const totalFamilyEl = document.getElementById('app-total-family');
    const versionMiniEl = document.getElementById('app-version-mini');
    
    if (versionEl) versionEl.textContent = APP_CONFIG.version;
    if (versionMiniEl) versionMiniEl.textContent = APP_CONFIG.version;
    if (buildDateEl) buildDateEl.textContent = APP_CONFIG.buildDate;
    
    if (lastSyncEl) {
        const lastSyncTime = localStorage.getItem('lastSyncTime');
        if (lastSyncTime) {
            lastSyncEl.textContent = lastSyncTime;
        } else {
            lastSyncEl.textContent = 'Chưa đồng bộ';
        }
    }
    
    if (db && totalTxEl) {
        const tx = db.transaction('transactions', 'readonly');
        const store = tx.objectStore('transactions');
        const countRequest = store.count();
        countRequest.onsuccess = function(e) {
            totalTxEl.textContent = e.target.result || 0;
        };
        countRequest.onerror = function() {
            totalTxEl.textContent = '0';
        };
    }
    
    if (db && totalRemEl) {
        const tx = db.transaction('reminders', 'readonly');
        const store = tx.objectStore('reminders');
        const countRequest = store.count();
        countRequest.onsuccess = function(e) {
            totalRemEl.textContent = e.target.result || 0;
        };
        countRequest.onerror = function() {
            totalRemEl.textContent = '0';
        };
    }
    
    if (totalFamilyEl) {
        totalFamilyEl.textContent = localFamilyData ? localFamilyData.length : 0;
    }
} // end function updateAppInfo

function updateLastSyncTime() {
    const now = new Date();
    const timeString = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    localStorage.setItem('lastSyncTime', timeString);
    const lastSyncEl = document.getElementById('app-last-sync');
    if (lastSyncEl) {
        lastSyncEl.textContent = timeString;
    }
} // end function updateLastSyncTime
// end THÔNG TIN ỨNG DỤNG

// =========================================================================
// CẬP NHẬT TỔNG THU/CHI TRONG THÁNG - TAB THU/CHI
// =========================================================================
function updateSummaryTotals() {
    getAllTransactions(data => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        let totalThu = 0;
        let totalChi = 0;
        
        data.forEach(t => {
            const tDate = new Date(t.timestamp);
            if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
                if (t.amount > 0) {
                    totalThu += t.amount;
                } else {
                    totalChi += Math.abs(t.amount);
                }
            }
        });
        
        const thuEl = document.getElementById('total-thu-month');
        if (thuEl) {
            thuEl.textContent = formatVND(totalThu);
        }
        
        const chiEl = document.getElementById('total-chi-month');
        if (chiEl) {
            chiEl.textContent = formatVND(totalChi);
        }
    });
} // end function updateSummaryTotals
// end CẬP NHẬT TỔNG THU/CHI TRONG THÁNG

// =========================================================================
// KHỞI TẠO INDEXEDDB
// =========================================================================
function initDB() {
    const request = indexedDB.open("FamilyFinancePWA", 4);
    request.onupgradeneeded = function(e) {
        db = e.target.result;
        if (!db.objectStoreNames.contains("transactions")) {
            db.createObjectStore("transactions", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("settings")) {
            db.createObjectStore("settings", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("reminders")) {
            db.createObjectStore("reminders", { keyPath: "id", autoIncrement: true });
        }
    };
    request.onsuccess = function(e) {
        db = e.target.result;
        cleanupCorruptedReminders(() => {
            loadInitialSettings();
            requestNotificationPermission();
            startDailyReminderCheck();
        });
    };
    request.onerror = function(e) {
        console.error("Lỗi mở IndexedDB:", e.target.error);
    };
} // end function initDB
// end KHỞI TẠO INDEXEDDB

// =========================================================================
// KHỞI TẠO DOM EVENTS
// =========================================================================
function setupEventListeners() {
    document.getElementById("main-nav-tabs").addEventListener("click", function(e) {
        const btn = e.target.closest(".tab-btn");
        if (btn) {
            const tabName = btn.getAttribute("data-tab");
            switchTab(tabName);
        }
    });

    document.getElementById("chi-type").addEventListener("change", () => updateSubtypes('chi'));
    document.getElementById("thu-type").addEventListener("change", () => updateSubtypes('thu'));

    document.getElementById("form-chi").addEventListener("submit", (e) => saveTransaction(e, 'chi'));
    document.getElementById("form-thu").addEventListener("submit", (e) => saveTransaction(e, 'thu'));
    document.getElementById("form-nhachen").addEventListener("submit", (e) => saveReminder(e));

    document.getElementById("chi-amount").addEventListener("input", (e) => formatCurrency(e.target));
    document.getElementById("thu-amount").addEventListener("input", (e) => formatCurrency(e.target));

    document.getElementById("chi-top-period").addEventListener("change", () => renderTopExpenses());
    document.getElementById("sec4-period").addEventListener("change", () => renderSection4());

    document.getElementById("rem-frequency").addEventListener("change", toggleCustomReminderFields);

    document.getElementById("btn-verify-family").addEventListener("click", verifyFamilyAuth);

    document.getElementById("darkModeToggle").addEventListener("change", (e) => toggleDarkMode(e.target.checked));
    document.getElementById("setting-color").addEventListener("change", applyTheme);
    document.getElementById("btn-sync-data").addEventListener("click", syncAllDataFromSheet);
    document.getElementById("btn-reset-app").addEventListener("click", resetAppCompletely);

    document.getElementById("scrollTopBtn").addEventListener("click", scrollToTop);

    // ============================================================
    // FAMILY MODAL - ĐÓNG BẰNG NÚT X, CLICK OUTSIDE, ESC
    // ============================================================
    const btnCloseFamily = document.getElementById("btn-close-modal-family");
    if (btnCloseFamily) {
        btnCloseFamily.addEventListener("click", closeModal);
    }

    const familyModal = document.getElementById("familyModal");
    if (familyModal) {
        familyModal.addEventListener("click", function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    }

    // ============================================================
    // APP INFO MODAL - MỞ, ĐÓNG, LÀM MỚI
    // ============================================================
    const btnAppInfo = document.getElementById("btn-app-info");
    if (btnAppInfo) {
        btnAppInfo.addEventListener("click", openAppInfoModal);
    }

    const btnCloseAppInfo = document.getElementById("btn-close-app-info");
    if (btnCloseAppInfo) {
        btnCloseAppInfo.addEventListener("click", closeAppInfoModal);
    }

    const appInfoModal = document.getElementById("appInfoModal");
    if (appInfoModal) {
        appInfoModal.addEventListener("click", function(e) {
            if (e.target === this) {
                closeAppInfoModal();
            }
        });
    }

    const btnRefreshAppInfo = document.getElementById("btn-refresh-app-info");
    if (btnRefreshAppInfo) {
        btnRefreshAppInfo.addEventListener("click", function() {
            updateAppInfo();
            this.textContent = "✅ Đã làm mới!";
            setTimeout(() => {
                this.textContent = "🔄 Làm mới";
            }, 1500);
        });
    }

    // ============================================================
    // ĐÓNG MODAL BẰNG PHÍM ESC
    // ============================================================
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
            const familyModal = document.getElementById("familyModal");
            if (familyModal && familyModal.style.display === "flex") {
                closeModal();
            }
            const appInfoModal = document.getElementById("appInfoModal");
            if (appInfoModal && appInfoModal.style.display === "flex") {
                closeAppInfoModal();
            }
        }
    });
} // end function setupEventListeners
// end KHỞI TẠO DOM EVENTS

// =========================================================================
// ĐIỀU HƯỚNG TABS
// =========================================================================
function switchTab(tabName) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.classList.add("active");

    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add("active");

    if (tabName === 'chi' || tabName === 'thongke') {
        renderChartsAndStats();
    }
    if (tabName === 'family') {
        checkFamilyTabAccess();
    }
    if (tabName === 'nhachen') {
        generateRemindersInterface();
    }
} // end function switchTab
// end ĐIỀU HƯỚNG TABS

// =========================================================================
// HÀM TIỆN ÍCH
// =========================================================================
function formatCurrency(input) {
    let value = input.value.replace(/[^0-9.]/g, "");
    let parts = value.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    input.value = parts.join(".");
} // end function formatCurrency

function parseCurrency(str) {
    return str ? parseFloat(str.replace(/,/g, "")) : 0;
} // end function parseCurrency

function formatVND(num) {
    return num.toLocaleString('en-US') + " đ";
} // end function formatVND

function updateSubtypes(mode) {
    const typeSelect = document.getElementById(`${mode}-type`);
    const subtypeSelect = document.getElementById(`${mode}-subtype`);
    if (!typeSelect || !subtypeSelect) return;

    const selectedType = typeSelect.value;
    subtypeSelect.innerHTML = "";

    if (CATEGORIES[mode] && CATEGORIES[mode][selectedType]) {
        CATEGORIES[mode][selectedType].forEach(sub => {
            let opt = document.createElement("option");
            opt.value = sub;
            opt.textContent = sub;
            subtypeSelect.appendChild(opt);
        });
    }
} // end function updateSubtypes

function initFormOptions() {
    ['chi', 'thu'].forEach(mode => {
        const typeSelect = document.getElementById(`${mode}-type`);
        if (!typeSelect) return;

        typeSelect.innerHTML = "";
        Object.keys(CATEGORIES[mode]).forEach(type => {
            let opt = document.createElement("option");
            opt.value = type;
            opt.textContent = type;
            typeSelect.appendChild(opt);
        });
        updateSubtypes(mode);

        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        const dateInput = document.getElementById(`${mode}-date`);
        if (dateInput) dateInput.value = now.toISOString().slice(0, 16);
    });
    initReminderDateOptions();
    initColorSettings();
} // end function initFormOptions

function initColorSettings() {
    const sColor = document.getElementById("setting-color");
    if (!sColor || sColor.children.length > 0) return;

    const textNames = ["Xanh Lá", "Xanh Bơ", "Xanh Dương", "Hồng", "Tím", "Đỏ", "Cam", "Vàng"];
    PALETTE.forEach((hex, i) => {
        let opt = document.createElement("option");
        opt.value = hex;
        opt.textContent = textNames[i];
        sColor.appendChild(opt);
    });
} // end function initColorSettings

function toggleCustomReminderFields() {
    const freq = document.getElementById("rem-frequency").value;
    const customBox = document.getElementById("custom-reminder-fields");
    if (customBox) {
        customBox.style.display = (freq === "CUSTOM") ? "block" : "none";
    }
} // end function toggleCustomReminderFields

function initReminderDateOptions() {
    const dSel = document.getElementById("rem-day");
    const mSel = document.getElementById("rem-month");
    const ySel = document.getElementById("rem-year");
    if (!dSel || !mSel || !ySel) return;

    dSel.innerHTML = "";
    mSel.innerHTML = "";
    ySel.innerHTML = "";

    for (let i = 1; i <= 31; i++) {
        dSel.innerHTML += `<option value="${i}">${String(i).padStart(2,'0')}</option>`;
    }
    for (let i = 1; i <= 12; i++) {
        mSel.innerHTML += `<option value="${i}">Tháng ${String(i).padStart(2,'0')}</option>`;
    }

    const currYear = new Date().getFullYear();
    for (let i = currYear; i <= currYear + 5; i++) {
        ySel.innerHTML += `<option value="${i}">Năm ${i}</option>`;
    }

    const today = new Date();
    dSel.value = today.getDate();
    mSel.value = today.getMonth() + 1;
    ySel.value = today.getFullYear();
} // end function initReminderDateOptions
// end HÀM TIỆN ÍCH

// =========================================================================
// XỬ LÝ GIAO DỊCH (TRANSACTIONS) - TAB THU / CHI
// =========================================================================
function saveTransaction(event, mode) {
    event.preventDefault();

    const type = document.getElementById(`${mode}-type`).value;
    const subtype = document.getElementById(`${mode}-subtype`).value;
    let amount = parseCurrency(document.getElementById(`${mode}-amount`).value);
    const dateVal = document.getElementById(`${mode}-date`).value;
    const note = document.getElementById(`${mode}-note`).value;

    if (mode === 'chi') amount = -Math.abs(amount);
    if (mode === 'thu') amount = Math.abs(amount);

    const formattedNote = toSentenceCase(note);

    const transaction = {
        timestamp: dateVal ? new Date(dateVal).toISOString() : new Date().toISOString(),
        type: type,
        subtype: subtype,
        amount: amount,
        note: formattedNote,
        synced: 0
    };

    const tx = db.transaction("transactions", "readwrite");
    tx.objectStore("transactions").add(transaction);
    tx.oncomplete = function() {
        alert("Đã lưu giao dịch cục bộ!");
        document.getElementById(`form-${mode}`).reset();
        initFormOptions();
        renderChartsAndStats();
        syncToGoogleSheets();
    };
    tx.onerror = function(e) {
        alert("Lỗi lưu giao dịch: " + e.target.error);
    };
} // end function saveTransaction

function getAllTransactions(callback) {
    if (!db) {
        callback([]);
        return;
    }
    const tx = db.transaction("transactions", "readonly");
    const store = tx.objectStore("transactions");
    const request = store.getAll();
    request.onsuccess = function(e) {
        callback(e.target.result || []);
    };
    request.onerror = function(e) {
        console.error("Lỗi đọc transactions:", e.target.error);
        callback([]);
    };
} // end function getAllTransactions

function syncToGoogleSheets() {
    if (!navigator.onLine || isSyncing || !CONFIG.apiEndpoint) return;

    getAllTransactions(transactions => {
        const unsynced = transactions.filter(t => t.synced === 0);
        if (unsynced.length === 0) return;

        isSyncing = true;
        fetch(CONFIG.apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'syncTransactions',
                data: unsynced.map(t => ({
                    timestamp: t.timestamp,
                    type: t.type,
                    subtype: t.subtype,
                    amount: t.amount,
                    note: t.note
                }))
            })
        })
        .then(res => res.json())
        .then(resData => {
            if (resData.status === "success") {
                const tx = db.transaction("transactions", "readwrite");
                const store = tx.objectStore("transactions");
                unsynced.forEach(t => {
                    t.synced = 1;
                    store.put(t);
                });
                renderChartsAndStats();
            }
            isSyncing = false;
        })
        .catch(() => {
            isSyncing = false;
        });
    });
} // end function syncToGoogleSheets
// end XỬ LÝ GIAO DỊCH (TRANSACTIONS)

// =========================================================================
// ĐỒ THỊ & THỐNG KÊ - TAB CHI / THỐNG KÊ
// =========================================================================
function renderPieChart(canvasId, labels, dataset, customColors = null) {
    if (charts[canvasId]) {
        charts[canvasId].destroy();
        delete charts[canvasId];
    }

    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    let total = dataset.reduce((a, b) => a + Math.abs(b), 0);
    let defaultColors = ['#4CAF50', '#F44336', '#FF9800', '#2196F3', '#9C27B0', '#E91E63'];
    let colors = customColors || defaultColors;

    charts[canvasId] = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: dataset,
                backgroundColor: colors
            }]
        },
        plugins: [ChartDataLabels],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 13, weight: 'bold' },
                        padding: 12,
                        generateLabels: function(chart) {
                            const original = Chart.overrides.pie.plugins.legend.labels.generateLabels(chart);
                            const bgColors = chart.data.datasets[0].backgroundColor;
                            original.forEach((item, i) => {
                                item.fontColor = getReadableLegendColor(bgColors[i]);
                                item.strokeStyle = bgColors[i];
                            });
                            return original;
                        }
                    }
                },
                datalabels: {
                    color: function(ctx) {
                        let c = ctx.dataset.backgroundColor[ctx.dataIndex];
                        return (c === '#FFEB3B' || c === '#8BC34A') ? '#111111' : '#ffffff';
                    },
                    font: { weight: 'bold', size: 12 },
                    anchor: 'center',
                    align: 'center',
                    formatter: function(value) {
                        if (total > 0 && (Math.abs(value) / total * 100) > 3) {
                            return (Math.abs(value) / total * 100).toFixed(1) + "%";
                        }
                        return '';
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return ctx.label + ": " + Math.abs(ctx.raw).toLocaleString() +
                                   " (" + (total > 0 ? (Math.abs(ctx.raw) / total * 100).toFixed(1) + "%" : "0%") + ")";
                        }
                    }
                }
            }
        }
    });
} // end function renderPieChart

function getReadableLegendColor(hexColor) {
    return hexColor || (document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#333333');
} // end function getReadableLegendColor

function renderChartsAndStats() {
    getAllTransactions(data => {
        let totalThu = 0, totalChi = 0, sum_Tiger = 0, sum_Mine = 0;
        let catCurrentMonth = { "Tổng": 0, "Ăn uống": 0, "Đồ chơi": 0, "Mỹ phẩm": 0, "Quần áo": 0 };
        let catPrevMonth = { "Tổng": 0, "Ăn uống": 0, "Đồ chơi": 0, "Mỹ phẩm": 0, "Quần áo": 0 };

        const now = new Date();
        const cM = now.getMonth();
        const cY = now.getFullYear();
        let pM = cM - 1;
        let pY = cY;
        if (pM < 0) { pM = 11; pY--; }

        let sortedData = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        let expList = sortedData.filter(t => t.amount < 0).slice(0, 20);
        let incList = sortedData.filter(t => t.amount > 0).slice(0, 20);

        const expContainer = document.getElementById("expense-history-container");
        if (expList.length && expContainer) {
            let htmlChi = `<table class="history-table"><tbody>`;
            expList.forEach(t => {
                let dStr = new Date(t.timestamp).toLocaleDateString('vi-VN');
                let contentStr = `${t.subtype} ${t.note ? `<br><small style="opacity:0.7;"><i>📝 ${t.note}</i></small>` : ''}`;
                htmlChi += `<tr><td>${dStr}</td><td>${t.type}</td><td>${contentStr}</td><td class="amount-col" style="color:var(--danger-color);">${formatVND(Math.abs(t.amount))}</td></tr>`;
            });
            htmlChi += `</tbody></table>`;
            expContainer.innerHTML = htmlChi;
        } else if (expContainer) {
            expContainer.innerHTML = "Chưa có khoản chi nào.";
        }

        const incContainer = document.getElementById("income-history-container");
        if (incList.length && incContainer) {
            let htmlThu = `<table class="history-table"><tbody>`;
            incList.forEach(t => {
                let dStr = new Date(t.timestamp).toLocaleDateString('vi-VN');
                let contentStr = `${t.subtype} ${t.note ? `<br><small style="opacity:0.7;"><i>📝 ${t.note}</i></small>` : ''}`;
                htmlThu += `<tr><td>${dStr}</td><td>${t.type}</td><td>${contentStr}</td><td class="amount-col" style="color:var(--success-color);">${formatVND(t.amount)}</td></tr>`;
            });
            htmlThu += `</tbody></table>`;
            incContainer.innerHTML = htmlThu;
        } else if (incContainer) {
            incContainer.innerHTML = "Chưa có khoản thu nào.";
        }

        data.forEach(t => {
            const tDate = new Date(t.timestamp);
            const amt = t.amount;

            if (amt > 0) {
                totalThu += amt;
                if (t.type === "CON CỢP") sum_Tiger += amt;
                if (t.type === "Lương" || t.type === "Thưởng") sum_Mine += amt;
            } else {
                totalChi += Math.abs(amt);
                let absAmt = Math.abs(amt);

                if (tDate.getFullYear() === cY && tDate.getMonth() === cM) {
                    catCurrentMonth["Tổng"] += absAmt;
                    if (t.subtype === "Đi chợ, siêu thị" || t.type === "Giải trí") {
                        catCurrentMonth["Ăn uống"] += absAmt;
                    }
                    if (t.subtype === "Đồ chơi") catCurrentMonth["Đồ chơi"] += absAmt;
                    if (t.subtype === "Mỹ phẩm") catCurrentMonth["Mỹ phẩm"] += absAmt;
                    if (t.subtype === "Quần áo") catCurrentMonth["Quần áo"] += absAmt;
                } else if (tDate.getFullYear() === pY && tDate.getMonth() === pM) {
                    catPrevMonth["Tổng"] += absAmt;
                    if (t.subtype === "Đi chợ, siêu thị" || t.type === "Giải trí") {
                        catPrevMonth["Ăn uống"] += absAmt;
                    }
                    if (t.subtype === "Đồ chơi") catPrevMonth["Đồ chơi"] += absAmt;
                    if (t.subtype === "Mỹ phẩm") catPrevMonth["Mỹ phẩm"] += absAmt;
                    if (t.subtype === "Quần áo") catPrevMonth["Quần áo"] += absAmt;
                }
            }
        });

        const alertDiv = document.getElementById("section1-alerts");
        if (alertDiv) {
            alertDiv.innerHTML = "";
            let hasAlert = false;
            Object.keys(catCurrentMonth).forEach(cat => {
                let cur = catCurrentMonth[cat];
                let prev = catPrevMonth[cat];
                if (prev > 0 && cur > prev) {
                    hasAlert = true;
                    alertDiv.innerHTML += `<div class="alert-box">Hạng mục <strong>${cat}</strong> chi vượt <strong>${((cur - prev) / prev * 100).toFixed(1)}%</strong> so với tháng trước!</div>`;
                }
            });
            if (!hasAlert) {
                alertDiv.innerHTML = "<p style='color:green;'>An toàn! Không có hạng mục nào chi vượt tháng trước.</p>";
            }
        }

        document.getElementById("sec2-thu").textContent = formatVND(totalThu);
        document.getElementById("sec2-chi").textContent = formatVND(totalChi);
        document.getElementById("sec2-remain").textContent = formatVND(totalThu - totalChi);
        renderPieChart('chart-sec2-pie', ['Tổng Thu', 'Tổng Chi'], [totalThu, totalChi]);

        document.getElementById("sec3-Mine").textContent = formatVND(sum_Mine);
        document.getElementById("sec3-Tiger").textContent = formatVND(sum_Tiger);
        renderPieChart('chart-sec3-pie', ['MÌNH', 'CON CỢP'], [sum_Mine, sum_Tiger], ['#8BC34A', '#E91E63']);

        renderSection4(data);
        renderPieChart('chart-chi-overview', ['Tổng Thu', 'Tổng Chi'], [totalThu, totalChi]);
        renderTopExpenses();
        
        // Cập nhật tổng thu/chi trong tháng
        updateSummaryTotals();
    });
} // end function renderChartsAndStats

function renderTopExpenses() {
    const periodSelect = document.getElementById("chi-top-period");
    if (!periodSelect) return;

    const period = periodSelect.value;
    const now = new Date();

    getAllTransactions(data => {
        let filtered = data.filter(t => t.amount < 0).filter(t => {
            let d = new Date(t.timestamp);
            if (period === 'week') {
                return (now - d) <= 7 * 24 * 60 * 60 * 1000;
            }
            if (period === 'month') {
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }
            if (period === 'year') {
                return d.getFullYear() === now.getFullYear();
            }
            return true;
        });

        let groupedData = {};
        filtered.forEach(t => {
            let groupKey = `${t.type} (${t.subtype})`;
            if (!groupedData[groupKey]) groupedData[groupKey] = 0;
            groupedData[groupKey] += Math.abs(t.amount);
        });

        let sortedGroups = Object.keys(groupedData).map(key => {
            return { category: key, totalAmount: groupedData[key] };
        }).sort((a, b) => b.totalAmount - a.totalAmount);

        const container = document.getElementById("top-expenses-list");
        if (!container) return;

        if (sortedGroups.length === 0) {
            container.innerHTML = "<p>Không có dữ liệu chi tiêu.</p>";
            return;
        }

        let html = '';
        sortedGroups.slice(0, 5).forEach((g, i) => {
            let parts = g.category.match(/^(.*?)\s*\((.*?)\)$/);
            let type = parts ? parts[1] : g.category;
            let subtype = parts ? parts[2] : '--';

            html += `<div class="stat-row" style="display: grid; grid-template-columns: 30px 1fr 1fr 100px; gap: 8px; padding: 10px 4px; align-items: center;">
                <span style="font-weight: bold; color: var(--text-color); opacity: 0.5;">${i+1}</span>
                <span style="font-weight: 600; color: var(--theme-color);">${type}</span>
                <span style="color: var(--text-color); opacity: 0.7; font-size: 0.9rem;">${subtype}</span>
                <span style="font-weight: bold; color: var(--danger-color); text-align: right;">${formatVND(g.totalAmount)}</span>
            </div>`;
        });
        container.innerHTML = html;
    });
} // end function renderTopExpenses

function renderSection4(allData) {
    const periodSelect = document.getElementById("sec4-period");
    if (!periodSelect) return;

    const period = periodSelect.value;
    const run = data => {
        const now = new Date();
        let currentBalance = 0;
        let totalThu = 0;
        let fullChi = 0;
        let investmentSavings = 0;

        data.forEach(t => {
            let d = new Date(t.timestamp);
            currentBalance += t.amount;

            let isMatch = false;
            if (period === 'month') {
                isMatch = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            } else {
                isMatch = d.getFullYear() === now.getFullYear();
            }

            if (isMatch) {
                if (t.amount > 0) {
                    totalThu += t.amount;
                } else {
                    if (t.type === "Đầu tư, tiết kiệm") {
                        investmentSavings += Math.abs(t.amount);
                    } else {
                        fullChi += Math.abs(t.amount);
                    }
                }
            }
        });

        document.getElementById("sec4-balance").textContent = formatVND(currentBalance);
        document.getElementById("sec4-thu").textContent = formatVND(totalThu);
        document.getElementById("sec4-net-chi").textContent = formatVND(fullChi);
        document.getElementById("sec4-savings").textContent = formatVND(investmentSavings);
        renderPieChart('chart-sec4-pie', ['Tổng Thu', 'Tổng Chi Thực Tế', 'Tiết Kiệm'],
                       [totalThu, fullChi, investmentSavings], ['#4CAF50', '#F44336', '#FFEB3B']);
    };

    if (allData) {
        run(allData);
    } else {
        getAllTransactions(run);
    }
} // end function renderSection4
// end ĐỒ THỊ & THỐNG KÊ

// =========================================================================
// FAMILY - BẢO MẬT & HIỂN THỊ - TAB FAMILY
// =========================================================================
function checkFamilyTabAccess() {
    const isUnlocked = localStorage.getItem("family_unlocked") === "true";
    const authView = document.getElementById("family-auth-view");
    const mainView = document.getElementById("family-main-view");

    if (!authView || !mainView) return;

    if (isUnlocked) {
        authView.style.display = "none";
        mainView.style.display = "block";
        generateFamilyInterface();
    } else {
        authView.style.display = "block";
        mainView.style.display = "none";
    }
} // end function checkFamilyTabAccess

function verifyFamilyAuth() {
    const inputPass = document.getElementById("family-password").value;
    if (!inputPass.trim()) {
        alert("Vui lòng nhập mật khẩu!");
        return;
    }

    fetch(`${CONFIG.apiEndpoint}?action=checkResetPassword&password=${encodeURIComponent(inputPass.trim())}`)
        .then(res => res.json())
        .then(res => {
            if (res.status === "success" && res.match === true) {
                localStorage.setItem("family_unlocked", "true");
                checkFamilyTabAccess();
            } else {
                alert("Mật khẩu không khớp!");
            }
        })
        .catch(() => {
            alert("Không thể kết nối xác thực!");
        });
} // end function verifyFamilyAuth

function generateFamilyInterface() {
    const container = document.getElementById("family-buttons-container");
    if (!container) return;

    if (localFamilyData && localFamilyData.length > 0) {
        renderFamilyGrid(localFamilyData);
        return;
    }

    container.innerHTML = "<p style='color: #aaa; text-align: center;'>🔄 Đang tải dữ liệu...</p>";
    fetch(`${CONFIG.apiEndpoint}?action=getFamilyData`)
        .then(res => res.json())
        .then(res => {
            if (res.status === "success" && res.data) {
                localFamilyData = res.data;
                if (db) {
                    db.transaction("settings", "readwrite")
                      .objectStore("settings")
                      .put({ key: "family_data", value: res.data });
                }
                renderFamilyGrid(res.data);
            } else {
                container.innerHTML = "<p style='color: #aaa; text-align: center;'>📭 Chưa có dữ liệu.</p>";
            }
        })
        .catch(() => {
            container.innerHTML = "<p style='color: #f44336; text-align: center;'>❌ Lỗi kết nối!</p>";
        });
} // end function generateFamilyInterface

function renderFamilyGrid(members) {
    const container = document.getElementById("family-buttons-container");
    if (!container) return;

    container.innerHTML = "";

    let validMembers = 0;
    members.forEach(m => {
        const displayName = m.nickname && m.nickname !== "-" ? m.nickname : (m.fullname || "Thành viên");
        if (displayName.toUpperCase() === "NICKNAME") return;

        validMembers++;
        let btn = document.createElement("button");
        btn.className = "member-btn";
        btn.textContent = displayName;
        btn.onclick = () => showFamilyModal(m);
        container.appendChild(btn);
    });

    const totalFamilyEl = document.getElementById('app-total-family');
    if (totalFamilyEl) {
        totalFamilyEl.textContent = validMembers;
    }
} // end function renderFamilyGrid

function showFamilyModal(m) {
    const fields = [
        { l: "Biệt danh", v: m.nickname || "-" },
        { l: "Họ tên", v: m.fullname || "-" },
        { l: "Ngày sinh", v: m.dob || "-" },
        { l: "Nơi sinh", v: m.noisinh || "-" },
        { l: "Địa chỉ", v: m.diachi || "-" },
        { l: "CCCD: Số", v: m.cccd?.so || "-" },
        { l: "CCCD: Ngày cấp", v: m.cccd?.ngaycap || "-" },
        { l: "CCCD: Ngày hết hạn", v: m.cccd?.ngayhethan || "-" },
        { l: "CCCD: Nơi cấp", v: m.cccd?.noicap || "-" },
        { l: "Hộ chiếu: Số", v: m.hochieu?.so || "-" },
        { l: "Hộ chiếu: Ngày cấp", v: m.hochieu?.ngaycap || "-" },
        { l: "Hộ chiếu: Ngày hết hạn", v: m.hochieu?.ngayhethan || "-" },
        { l: "Hộ chiếu: Nơi cấp", v: m.hochieu?.noicap || "-" },
        { l: "Thẻ BHYT", v: m.bhyt || "-" },
        { l: "Mã số BHXH", v: m.bhxh || "-" },
        { l: "Mã số thuế", v: m.masothue || "-" },
        { l: "LLTP: Số", v: m.lltp?.so || "-" },
        { l: "LLTP: Ngày cấp", v: m.lltp?.ngaycap || "-" },
        { l: "LLTP: Nơi cấp", v: m.lltp?.noicap || "-" }
    ];

    const detailsDiv = document.getElementById("modal-member-details");
    if (!detailsDiv) return;

    detailsDiv.innerHTML = "";
    let fullBlockText = "";
    let lastGroup = "";

    fields.forEach(f => {
        fullBlockText += `${f.l}: ${f.v}\n`;
        let currentGroup = "";
        let cleanLabel = f.l;

        if (f.l.startsWith("CCCD:")) {
            currentGroup = "CCCD";
            cleanLabel = f.l.replace("CCCD:", "").trim();
        } else if (f.l.startsWith("Hộ chiếu:")) {
            currentGroup = "Hộ chiếu";
            cleanLabel = f.l.replace("Hộ chiếu:", "").trim();
        } else if (f.l.startsWith("LLTP:")) {
            currentGroup = "Lí lịch tư pháp";
            cleanLabel = f.l.replace("LLTP:", "").trim();
        }

        if (currentGroup && currentGroup !== lastGroup) {
            let groupHeader = document.createElement("div");
            groupHeader.style = "margin-top:18px; margin-bottom:4px; padding:6px 8px; font-size:1.1rem; font-weight:bold; color:var(--theme-color); border-bottom:1px dashed var(--border-color);";
            groupHeader.textContent = currentGroup;
            detailsDiv.appendChild(groupHeader);
            lastGroup = currentGroup;
        }

        let row = document.createElement("div");
        row.className = "info-row";
        if (currentGroup) {
            row.innerHTML = `<div class="info-label" style="padding-left:15px; font-size:0.9rem;">- ${cleanLabel}</div><div class="info-value" style="padding-left:25px; font-weight:500;">${f.v}</div>`;
        } else {
            if (!currentGroup) lastGroup = "";
            row.innerHTML = `<div class="info-label">${f.l}</div><div class="info-value">${f.v}</div>`;
        }

        row.onclick = () => {
            if (f.v !== "-") {
                navigator.clipboard.writeText(f.v).then(() => {
                    alert(`Đã copy: ${f.v}`);
                }).catch(() => {
                    const textArea = document.createElement('textarea');
                    textArea.value = f.v;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    alert(`Đã copy: ${f.v}`);
                });
            }
        };
        detailsDiv.appendChild(row);
    });

    document.getElementById("btn-copy-all").onclick = () => {
        navigator.clipboard.writeText(fullBlockText).then(() => {
            alert("Đã copy toàn bộ thông tin lí lịch!");
        }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = fullBlockText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert("Đã copy toàn bộ thông tin lí lịch!");
        });
    };

    const modal = document.getElementById("familyModal");
    if (modal) {
        modal.style.display = "flex";
    }
} // end function showFamilyModal

function closeModal() {
    const modal = document.getElementById("familyModal");
    if (modal) {
        modal.style.display = "none";
    }
} // end function closeModal
// end FAMILY - BẢO MẬT & HIỂN THỊ

// =========================================================================
// NHẮC HẸN - TAB NHẮC HẸN
// =========================================================================
const VALID_REMINDER_FREQUENCIES = ["ONCE", "DAILY", "WEEKLY", "MONTHLY", "CUSTOM"];

function cleanupCorruptedReminders(callback) {
    if (!db || !db.objectStoreNames.contains("reminders")) {
        if (callback) callback();
        return;
    }

    const tx = db.transaction("reminders", "readwrite");
    const store = tx.objectStore("reminders");
    const request = store.getAll();

    request.onsuccess = function(e) {
        const list = e.target.result || [];
        let removedCount = 0;

        list.forEach(r => {
            if (isCorruptedReminder(r)) {
                store.delete(r.id);
                removedCount++;
            }
        });

        tx.oncomplete = function() {
            if (removedCount > 0) {
                console.log(`Đã tự động xóa ${removedCount} reminder bị hỏng.`);
            }
            if (callback) callback();
        };
        tx.onerror = function() {
            if (callback) callback();
        };
    };

    request.onerror = function(e) {
        console.error("Lỗi đọc reminders khi dọn dẹp:", e.target.error);
        if (callback) callback();
    };
} // end function cleanupCorruptedReminders

function isCorruptedReminder(r) {
    if (!r || typeof r !== 'object') return true;
    if (!r.content || typeof r.content !== 'string' || !r.content.trim()) return true;
    if (!VALID_REMINDER_FREQUENCIES.includes(r.frequency)) return true;
    if (!isValidDateOnlyString(r.startDate)) return true;
    if (r.nextReminderDate && !isValidDateOnlyString(r.nextReminderDate)) return true;
    return false;
} // end function isCorruptedReminder

function isValidDateOnlyString(str) {
    if (!str || typeof str !== 'string') return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const d = new Date(str);
    return !isNaN(d.getTime());
} // end function isValidDateOnlyString

function computeNextReminderDate(fromDateStr, frequency, everyValue, everyUnit) {
    const d = new Date(fromDateStr);
    d.setHours(0, 0, 0, 0);

    if (frequency === "DAILY") {
        d.setDate(d.getDate() + 1);
    } else if (frequency === "WEEKLY") {
        d.setDate(d.getDate() + 7);
    } else if (frequency === "MONTHLY") {
        d.setMonth(d.getMonth() + 1);
    } else if (frequency === "CUSTOM") {
        const n = parseInt(everyValue) || 1;
        if (everyUnit === "DAYS") d.setDate(d.getDate() + n);
        else if (everyUnit === "WEEKS") d.setDate(d.getDate() + (n * 7));
        else if (everyUnit === "MONTHS") d.setMonth(d.getMonth() + n);
    } else {
        return null;
    }

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
} // end function computeNextReminderDate

function saveReminder(event) {
    event.preventDefault();

    const content = document.getElementById("rem-content").value.trim();
    const day = document.getElementById("rem-day").value;
    const month = document.getElementById("rem-month").value;
    const year = document.getElementById("rem-year").value;
    const frequency = document.getElementById("rem-frequency").value;
    const everyVal = document.getElementById("rem-every-val").value;
    const everyUnit = document.getElementById("rem-every-unit").value;

    if (!content) {
        alert("Vui lòng nhập nội dung nhắc hẹn!");
        return;
    }

    if (frequency === "CUSTOM" && (!everyVal || parseInt(everyVal) < 1)) {
        alert("Vui lòng nhập số lượng hợp lệ cho tần suất tùy chỉnh!");
        return;
    }

    const formattedContent = toSentenceCase(content);
    const startDateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

    const reminderItem = {
        content: formattedContent,
        startDate: startDateStr,
        frequency: frequency,
        everyValue: frequency === "CUSTOM" ? parseInt(everyVal) : null,
        everyUnit: frequency === "CUSTOM" ? everyUnit : null,
        nextReminderDate: startDateStr,
        lastTriggeredAt: "",
        synced: 0,
        status: "ENABLED"
    };

    console.log("Lưu reminder:", reminderItem);

    const tx = db.transaction("reminders", "readwrite");
    const store = tx.objectStore("reminders");
    const request = store.add(reminderItem);

    request.onsuccess = function(e) {
        console.log("Reminder đã lưu với id:", e.target.result);
        alert("Đã thêm nhắc hẹn cục bộ!");
        document.getElementById("form-nhachen").reset();
        toggleCustomReminderFields();
        initReminderDateOptions();
        generateRemindersInterface();
        syncRemindersToSheet();
    };

    request.onerror = function(e) {
        console.error("Lỗi lưu reminder:", e.target.error);
        alert("Lỗi lưu nhắc hẹn: " + e.target.error);
    };
} // end function saveReminder

function generateRemindersInterface() {
    const container = document.getElementById("reminder-list-container");
    if (!container) return;

    if (!db) {
        container.innerHTML = "Lỗi cơ sở dữ liệu.";
        return;
    }

    const tx = db.transaction("reminders", "readonly");
    const store = tx.objectStore("reminders");
    const request = store.getAll();

    request.onsuccess = function(e) {
        const list = e.target.result || [];
        localReminderData = list;
        renderRemindersList(list);
        checkAndTriggerReminders(list);
    };
    request.onerror = function(e) {
        container.innerHTML = "Lỗi đọc dữ liệu nhắc hẹn.";
        console.error("Lỗi đọc reminders:", e.target.error);
    };
} // end function generateRemindersInterface

function renderRemindersList(list) {
    const container = document.getElementById("reminder-list-container");
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = "<p style='color: #aaa; text-align: center;'>📭 Chưa có lịch nhắc hẹn nào.</p>";
        return;
    }

    const sortedList = [...list].sort((a, b) => {
        const aDate = a.nextReminderDate || a.startDate;
        const bDate = b.nextReminderDate || b.startDate;
        if (aDate < bDate) return -1;
        if (aDate > bDate) return 1;
        return 0;
    });

    let html = `<table class="history-table"><thead><tr><th>Nội dung</th><th>Ngày nhắc tiếp theo</th><th>Tần suất</th><th>Trạng thái</th></tr></thead><tbody>`;

    sortedList.forEach(r => {
        let freqText = formatFrequencyLabel(r);

        let displayDateSource = r.nextReminderDate || r.startDate;
        let displayDate = displayDateSource;
        if (displayDateSource) {
            let parts = displayDateSource.split("-");
            if (parts.length === 3) {
                displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
        }

        let statusColor = r.status === "ENABLED" ? "var(--success-color)" : "var(--danger-color)";
        let statusText = r.status === "ENABLED" ? "✅ Hoạt động" : "⛔ Tắt";

        const today = new Date();
        today.setHours(0,0,0,0);
        const remDate = new Date(displayDateSource);
        remDate.setHours(0,0,0,0);
        let isPast = remDate < today && r.frequency === "ONCE";

        html += `<tr style="${isPast ? 'opacity:0.5;' : ''}">
            <td style="font-weight:600; color:var(--theme-color);">${r.content}</td>
            <td>${displayDate} ${isPast ? '<span style="color:#999;font-size:0.8rem;">(đã qua)</span>' : ''}</td>
            <td><small class="theme-bg" style="padding:2px 6px; border-radius:4px; font-size:0.75rem;">${freqText}</small></td>
            <td style="color:${statusColor}; font-size:0.85rem;">${statusText}</td>
        </tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
} // end function renderRemindersList

function formatFrequencyLabel(r) {
    const freqMap = {
        'ONCE': 'Một lần',
        'DAILY': 'Hàng ngày',
        'WEEKLY': 'Hàng tuần',
        'MONTHLY': 'Hàng tháng'
    };
    if (r.frequency === "CUSTOM") {
        const unitMap = { 'DAYS': 'Ngày', 'WEEKS': 'Tuần', 'MONTHS': 'Tháng' };
        const unitText = unitMap[r.everyUnit] || r.everyUnit || '';
        return `Mỗi ${r.everyValue || 1} ${unitText}`;
    }
    return freqMap[r.frequency] || r.frequency || "ONCE";
} // end function formatFrequencyLabel

function checkAndTriggerReminders(reminders) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = formatDateOnly(today);
    const tomorrowStr = formatDateOnly(tomorrow);

    let hasChanges = false;

    reminders.forEach(r => {
        if (r.status === "DISABLED") return;

        const targetDateStr = r.nextReminderDate || r.startDate;
        if (!targetDateStr) return;

        const targetDate = new Date(targetDateStr);
        targetDate.setHours(0,0,0,0);

        if (r.frequency === "ONCE" && targetDate < today) return;

        const alreadyTriggeredToday = r.lastTriggeredAt && r.lastTriggeredAt.slice(0, 10) === todayStr;

        if (targetDateStr === tomorrowStr) {
            triggerPushNotification("🔔 NHẮC TRƯỚC 1 NGÀY", `Ngày mai bạn có hẹn: ${r.content}`);
        }

        if (targetDateStr === todayStr && !alreadyTriggeredToday) {
            triggerPushNotification("⏰ HÔM NAY CÓ HẸN", r.content);

            r.lastTriggeredAt = new Date().toISOString();
            r.synced = 0;
            hasChanges = true;

            if (r.frequency === "ONCE") {
                r.status = "DISABLED";
            } else {
                const nextDate = computeNextReminderDate(todayStr, r.frequency, r.everyValue, r.everyUnit);
                if (nextDate) r.nextReminderDate = nextDate;
            }

            updateReminderInDB(r);
        }
    });

    if (hasChanges) {
        renderRemindersList(reminders);
    }
} // end function checkAndTriggerReminders

function formatDateOnly(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
} // end function formatDateOnly

function updateReminderInDB(reminderItem) {
    if (!db || !reminderItem.id) return;
    const tx = db.transaction("reminders", "readwrite");
    tx.objectStore("reminders").put(reminderItem);
    tx.oncomplete = function() {
        syncRemindersToSheet();
    };
} // end function updateReminderInDB

function startDailyReminderCheck() {
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
    }

    notificationCheckInterval = setInterval(() => {
        if (db) {
            const tx = db.transaction("reminders", "readonly");
            const store = tx.objectStore("reminders");
            const request = store.getAll();
            request.onsuccess = function(e) {
                const list = e.target.result || [];
                checkAndTriggerReminders(list);
            };
        }
    }, 30 * 60 * 1000);

    setTimeout(() => {
        generateRemindersInterface();
    }, 3000);
} // end function startDailyReminderCheck
// end NHẮC HẸN

// =========================================================================
// ĐỒNG BỘ NHẮC HẸN LÊN GOOGLE SHEET (REMINDERS)
// =========================================================================
function syncRemindersToSheet() {
    if (!navigator.onLine || !CONFIG.apiEndpoint) {
        console.log("Không thể sync: offline hoặc không có endpoint");
        return;
    }

    if (!db) {
        console.log("Chưa có database");
        return;
    }

    const tx = db.transaction("reminders", "readonly");
    const store = tx.objectStore("reminders");
    const request = store.getAll();

    request.onsuccess = function(e) {
        const list = e.target.result || [];
        const unsynced = list.filter(r => r.synced === 0);

        console.log("Số lượng reminder chưa sync:", unsynced.length);

        if (unsynced.length === 0) return;

        const dataToSend = unsynced.map(r => ({
            content: r.content || "",
            frequency: encodeFrequencyForSheet(r),
            startDate: r.startDate || "",
            status: r.status || "ENABLED",
            nextReminderDate: r.nextReminderDate || r.startDate || "",
            lastTriggeredAt: r.lastTriggeredAt || ""
        }));

        console.log("Dữ liệu gửi lên server:", JSON.stringify(dataToSend));

        fetch(CONFIG.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify({
                action: 'syncReminders',
                data: dataToSend
            })
        })
        .then(res => {
            console.log("Response status:", res.status);
            return res.json();
        })
        .then(resData => {
            console.log("Response data:", resData);
            if (resData.status === "success") {
                const tx2 = db.transaction("reminders", "readwrite");
                const store2 = tx2.objectStore("reminders");
                unsynced.forEach(r => {
                    r.synced = 1;
                    store2.put(r);
                });
                console.log("Đã đánh dấu reminders đã sync");
            } else {
                console.error("Lỗi sync reminders:", resData.message);
            }
        })
        .catch(err => {
            console.error("Lỗi fetch syncReminders:", err);
        });
    };

    request.onerror = function(e) {
        console.error("Lỗi đọc reminders từ IndexedDB:", e.target.error);
    };
} // end function syncRemindersToSheet

function encodeFrequencyForSheet(r) {
    if (r.frequency === "CUSTOM") {
        return `CUSTOM:${r.everyValue || 1}:${r.everyUnit || 'DAYS'}`;
    }
    return r.frequency || "ONCE";
} // end function encodeFrequencyForSheet

function decodeFrequencyFromSheet(rawFrequency) {
    if (rawFrequency && rawFrequency.toString().startsWith("CUSTOM:")) {
        const parts = rawFrequency.toString().split(":");
        return {
            frequency: "CUSTOM",
            everyValue: parseInt(parts[1]) || 1,
            everyUnit: parts[2] || "DAYS"
        };
    }
    return { frequency: rawFrequency || "ONCE", everyValue: null, everyUnit: null };
} // end function decodeFrequencyFromSheet
// end ĐỒNG BỘ NHẮC HẸN LÊN GOOGLE SHEET

// =========================================================================
// CÀI ĐẶT GIAO DIỆN (THEMES) - TAB SETTINGS
// =========================================================================
function toggleDarkMode(enable) {
    document.documentElement.setAttribute('data-theme', enable ? 'dark' : 'light');
    localStorage.setItem('darkMode', enable ? 'true' : 'false');

    const colorInput = document.getElementById("setting-color");
    if (colorInput) {
        const slider = document.querySelector('.slider');
        if (slider) {
            slider.style.backgroundColor = enable ? colorInput.value : '#ccc';
        }
    }
} // end function toggleDarkMode

function applyTheme() {
    const themeColor = document.getElementById("setting-color")?.value || DEFAULT_THEME_COLOR;
    const root = document.documentElement;
    root.style.setProperty('--theme-color', themeColor.toLowerCase());
    root.classList.toggle("theme-yellow", /yellow|#ffc107|#ffeb3b/i.test(themeColor));

    let r = parseInt(themeColor.slice(1,3), 16);
    let g = parseInt(themeColor.slice(3,5), 16);
    let b = parseInt(themeColor.slice(5,7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    root.style.setProperty('--text-on-theme', brightness > 150 ? '#111111' : '#ffffff');

    localStorage.setItem('themeColor', themeColor);
} // end function applyTheme

function loadTheme() {
    const savedDark = localStorage.getItem('darkMode');
    const isDark = savedDark !== null ? savedDark === 'true' : DEFAULT_DARK_MODE;

    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.checked = isDark;

    let savedColor = localStorage.getItem('themeColor') || DEFAULT_THEME_COLOR;
    const colorSelect = document.getElementById("setting-color");
    if (colorSelect) {
        colorSelect.value = savedColor;
    }
    applyTheme();
} // end function loadTheme
// end CÀI ĐẶT GIAO DIỆN (THEMES)

// =========================================================================
// ĐỒNG BỘ TOÀN DIỆN - TAB SETTINGS
// =========================================================================
function syncAllDataFromSheet() {
    if (!navigator.onLine) {
        alert("Thiết bị đang ngoại tuyến! Vui lòng kết nối mạng để đồng bộ.");
        return;
    }

    const syncBtn = document.getElementById("btn-sync-data");
    const originalText = syncBtn.innerHTML;
    syncBtn.disabled = true;
    syncBtn.innerHTML = "⏳ Đang đồng bộ...";
    syncBtn.style.opacity = "0.7";

    getAllTransactions(localTransactions => {
        const unsyncedTx = localTransactions.filter(t => t.synced === 0);

        const pushTransactions = () => new Promise(resolve => {
            if (unsyncedTx.length === 0 || !CONFIG.apiEndpoint) {
                resolve();
                return;
            }
            fetch(CONFIG.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'syncTransactions',
                    data: unsyncedTx.map(t => ({
                        timestamp: t.timestamp,
                        type: t.type,
                        subtype: t.subtype,
                        amount: t.amount,
                        note: t.note
                    }))
                })
            })
            .then(res => res.json())
            .then(resData => {
                if (resData.status === "success") {
                    const tx = db.transaction("transactions", "readwrite");
                    const store = tx.objectStore("transactions");
                    unsyncedTx.forEach(t => {
                        t.synced = 1;
                        store.put(t);
                    });
                }
                resolve();
            })
            .catch(() => resolve());
        });

        const pushReminders = () => new Promise(resolve => {
            const tx = db.transaction("reminders", "readonly");
            const store = tx.objectStore("reminders");
            const req = store.getAll();
            req.onsuccess = function(e) {
                const list = e.target.result || [];
                const unsyncedRem = list.filter(r => r.synced === 0);
                if (unsyncedRem.length === 0 || !CONFIG.apiEndpoint) {
                    resolve();
                    return;
                }
                fetch(CONFIG.apiEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'syncReminders',
                        data: unsyncedRem.map(r => ({
                            content: r.content || "",
                            frequency: encodeFrequencyForSheet(r),
                            startDate: r.startDate || "",
                            status: r.status || "ENABLED",
                            nextReminderDate: r.nextReminderDate || r.startDate || "",
                            lastTriggeredAt: r.lastTriggeredAt || ""
                        }))
                    })
                })
                .then(res => res.json())
                .then(resData => {
                    if (resData.status === "success") {
                        const tx2 = db.transaction("reminders", "readwrite");
                        const store2 = tx2.objectStore("reminders");
                        unsyncedRem.forEach(r => {
                            r.synced = 1;
                            store2.put(r);
                        });
                    }
                    resolve();
                })
                .catch(() => resolve());
            };
            req.onerror = () => resolve();
        });

        const downloadData = () => {
            fetch(`${CONFIG.apiEndpoint}?action=getAllAppData`)
                .then(res => res.json())
                .then(resData => {
                    if (resData.status === "success" && resData.data) {
                        const serverFamily = resData.data.family || [];
                        const serverTransactions = resData.data.transactions || [];
                        const serverReminders = resData.data.reminders || [];

                        localFamilyData = serverFamily;
                        if (db) {
                            db.transaction("settings", "readwrite")
                              .objectStore("settings")
                              .put({ key: "family_data", value: serverFamily });
                        }

                        if (db && serverTransactions.length > 0) {
                            const tx = db.transaction("transactions", "readwrite");
                            const store = tx.objectStore("transactions");
                            serverTransactions.forEach(sTx => {
                                const isDuplicate = localTransactions.some(lTx =>
                                    lTx.timestamp === sTx.timestamp &&
                                    parseFloat(lTx.amount) === parseFloat(sTx.amount) &&
                                    lTx.subtype === sTx.subtype
                                );
                                if (!isDuplicate) {
                                    sTx.synced = 1;
                                    store.add(sTx);
                                }
                            });
                        }

                        if (db && serverReminders.length > 0) {
                            const tx = db.transaction("reminders", "readwrite");
                            const store = tx.objectStore("reminders");

                            const getExisting = store.getAll();
                            getExisting.onsuccess = function(e) {
                                const existingList = e.target.result || [];

                                serverReminders.forEach(sRem => {
                                    const isDuplicate = existingList.some(lRem =>
                                        lRem.startDate === sRem.startDate &&
                                        lRem.content === sRem.content
                                    );
                                    if (!isDuplicate) {
                                        const decoded = decodeFrequencyFromSheet(sRem.frequency);
                                        store.add({
                                            content: sRem.content,
                                            startDate: sRem.startDate,
                                            frequency: decoded.frequency,
                                            everyValue: decoded.everyValue,
                                            everyUnit: decoded.everyUnit,
                                            status: sRem.status || "ENABLED",
                                            nextReminderDate: sRem.nextReminderDate || sRem.startDate,
                                            lastTriggeredAt: sRem.lastTriggeredAt || "",
                                            synced: 1
                                        });
                                    }
                                });
                            };
                        }

                        updateLastSyncTime();

                        const now = new Date();
                        const timeString = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        const statusEl = document.getElementById("sync-status");
                        if (statusEl) statusEl.innerHTML = `Last sync: ${timeString}`;
                        if (db) {
                            db.transaction("settings", "readwrite")
                              .objectStore("settings")
                              .put({ key: "last_sync_time", value: timeString });
                        }

                        alert("✅ Đồng bộ thành công!");
                    } else {
                        alert("⚠️ Đồng bộ xong nhưng định dạng dữ liệu không đúng.");
                    }
                })
                .catch(err => {
                    console.error("Sync error:", err);
                    alert("❌ Lỗi kết nối! Không thể tải dữ liệu từ Google Sheet xuống.");
                })
                .finally(() => {
                    syncBtn.disabled = false;
                    syncBtn.innerHTML = originalText;
                    syncBtn.style.opacity = "1";
                    initFormOptions();
                    renderChartsAndStats();
                    generateRemindersInterface();
                    updateAppInfo();
                    updateSummaryTotals();
                });
        };

        Promise.all([pushTransactions(), pushReminders()]).then(downloadData);
    });
} // end function syncAllDataFromSheet
// end ĐỒNG BỘ TOÀN DIỆN

// =========================================================================
// RESET APP - TAB SETTINGS
// =========================================================================
function resetAppCompletely() {
    if (!confirm("⚠️ Bạn có chắc chắn muốn xóa toàn bộ lịch sử thiết bị không?\nHành động này không thể hoàn tác!")) return;

    let mask = document.createElement('div');
    mask.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;justify-content:center;align-items:center;";

    let box = document.createElement('div');
    box.className = "card";
    box.style = "width:90%;max-width:320px;padding:20px;text-align:center;background:var(--card-bg);color:var(--text-color);";
    box.innerHTML = `
        <h3 style="margin-top:0;color:var(--danger-color);">🔒 Xác Thực Xóa App</h3>
        <p style="font-size:13px;opacity:0.8;">Vui lòng nhập mật khẩu xác nhận định danh:</p>
        <input type="password" id="secure-reset-pass" class="form-control" style="text-align:center;margin-bottom:15px;" placeholder="••••••••">
        <div style="display:flex;gap:10px;">
            <button class="btn" id="btn-cancel-reset" style="background:#555 !important;flex:1;">Hủy</button>
            <button class="btn" id="btn-confirm-reset" style="background:var(--danger-color) !important;flex:1;">Xóa Sạch</button>
        </div>
    `;
    mask.appendChild(box);
    document.body.appendChild(mask);
    document.getElementById("secure-reset-pass").focus();

    document.getElementById("btn-cancel-reset").onclick = () => mask.remove();
    document.getElementById("btn-confirm-reset").onclick = () => {
        const passVal = document.getElementById("secure-reset-pass").value;
        if (!passVal.trim()) {
            alert("Vui lòng không để trống mật khẩu!");
            return;
        }

        fetch(`${CONFIG.apiEndpoint}?action=checkResetPassword&password=${encodeURIComponent(passVal.trim())}`)
            .then(res => res.json())
            .then(res => {
                if (res.status === "success" && res.match === true) {
                    mask.remove();
                    localStorage.clear();
                    if (window.indexedDB) {
                        indexedDB.deleteDatabase("FamilyFinancePWA");
                    }
                    if (notificationCheckInterval) {
                        clearInterval(notificationCheckInterval);
                    }
                    alert("🗑️ Đã xóa sạch dữ liệu thiết bị và đặt lại ứng dụng thành công!");
                    window.location.reload(true);
                } else {
                    alert("❌ Mật khẩu xác nhận không chính xác!");
                }
            })
            .catch(() => {
                alert("Lỗi kết nối đến máy chủ xác thực!");
            });
    };
} // end function resetAppCompletely
// end RESET APP

// =========================================================================
// SCROLL TO TOP
// =========================================================================
window.onscroll = function() {
    const btn = document.getElementById("scrollTopBtn");
    if (btn) {
        btn.style.display = (document.body.scrollTop > 250 || document.documentElement.scrollTop > 250) ? "flex" : "none";
    }
};

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
} // end function scrollToTop
// end SCROLL TO TOP

// =========================================================================
// LOAD INITIAL SETTINGS
// =========================================================================
function loadInitialSettings() {
    if (!db) return;

    const tx = db.transaction("settings", "readonly");
    const store = tx.objectStore("settings");
    const request = store.getAll();

    request.onsuccess = function(e) {
        const results = e.target.result || [];

        const savedFamily = results.find(item => item.key === "family_data");
        if (savedFamily) {
            localFamilyData = savedFamily.value;
        }

        const lastSync = results.find(item => item.key === "last_sync_time");
        const statusEl = document.getElementById("sync-status");
        if (lastSync && statusEl) {
            statusEl.innerHTML = `Last sync: ${lastSync.value}`;
        }

        loadTheme();
        initFormOptions();
        renderChartsAndStats();
        generateRemindersInterface();
        updateSummaryTotals();

        initAppConfig().then(() => {
            updateAppInfo();
        });
    };

    request.onerror = function(e) {
        console.error("Lỗi load settings:", e.target.error);
        loadTheme();
        initFormOptions();
        renderChartsAndStats();
        generateRemindersInterface();
        updateSummaryTotals();
        initAppConfig().then(() => {
            updateAppInfo();
        });
    };
} // end function loadInitialSettings
// end LOAD INITIAL SETTINGS

// =========================================================================
// KHỞI TẠO APP
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    initDB();
});

window.addEventListener('online', () => {
    syncToGoogleSheets();
    syncRemindersToSheet();
});
// end KHỞI TẠO APP
