// =========================================================================
// KHAI BÁO TÊN SHEETS THỰC TẾ
// =========================================================================
const SHEETS_CONFIG = {
  TRANSACTIONS: "TRANSACTIONS",
  REMINDERS: "REMINDERS",
  FAMILY: "FAMILY",
  CONFIG_APP: "CONFIG_APP"
};

// =========================================================================
// HÀM XỬ LÝ NGÀY THÁNG CHO VIỆT NAM (GMT+7)
// =========================================================================

// Format Date thành chuỗi yyyy-mm-dd hh:mm:ss theo GMT+7
function formatVietnamDateTime(dateInput) {
  if (!dateInput) return '';
  
  var d;
  if (dateInput instanceof Date) {
    d = new Date(dateInput);
  } else {
    d = new Date(dateInput);
  }
  
  if (isNaN(d.getTime())) return '';
  
  // Chuyển về GMT+7
  var offset = d.getTimezoneOffset();
  var vietnamTime = new Date(d.getTime() + (offset + 420) * 60000);
  
  var year = vietnamTime.getFullYear();
  var month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
  var day = String(vietnamTime.getDate()).padStart(2, '0');
  var hours = String(vietnamTime.getHours()).padStart(2, '0');
  var minutes = String(vietnamTime.getMinutes()).padStart(2, '0');
  var seconds = String(vietnamTime.getSeconds()).padStart(2, '0');
  
  return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
} // end function formatVietnamDateTime

// Parse chuỗi yyyy-mm-dd hh:mm:ss thành Date object
function parseVietnamDateTime(dateStr) {
  if (!dateStr) return new Date();
  
  // Nếu là chuỗi định dạng yyyy-mm-dd hh:mm:ss
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
    var parts = dateStr.split(' ');
    var dateParts = parts[0].split('-');
    var timeParts = parts[1].split(':');
    
    return new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2]),
      parseInt(timeParts[0]),
      parseInt(timeParts[1]),
      parseInt(timeParts[2])
    );
  }
  
  // Nếu là ISO string
  try {
    var d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d;
    }
  } catch(e) {}
  
  return new Date();
} // end function parseVietnamDateTime

// =========================================================================
// 1. HÀM ĐIỀU PHỐI CHÍNH (MAIN ROUTERS)
// =========================================================================

function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var responseData;
  
  try {
    if (action === "getAllAppData") {
      responseData = getAppDataAction(ss);
    } 
    else if (action === "checkResetPassword") {
      var password = e.parameter.password;
      responseData = checkPasswordAction(ss, password);
    } 
    else if (action === "getFamilyData") {
      responseData = getFamilyDataAction(ss);
    }
    else {
      responseData = { status: "error", message: "Hành động không hợp lệ" };
    }
  } catch (err) {
    responseData = { status: "error", message: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
} // end function doGet

function doPost(e) {
  var responseData;
  try {
    var params = e.parameter;
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    }
    
    var action = params.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    Logger.log("Action: " + action);
    Logger.log("Params: " + JSON.stringify(params));
    
    if (action === "saveTransaction") {
      responseData = saveTransactionAction(ss, params);
    } 
    else if (action === "saveReminder") {
      responseData = saveReminderAction(ss, params);
    }
    else if (action === "syncReminders") {
      responseData = syncRemindersAction(ss, params);
    }
    else if (action === "syncTransactions") {
      responseData = syncTransactionsAction(ss, params);
    }
    else if (action === "updateReminderStatus") {
      responseData = updateReminderStatusAction(ss, params);
    }
    else if (action === "updatePassword") {
      responseData = updatePasswordAction(ss, params);
    }
    else {
      responseData = { status: "error", message: "Hành động POST không hợp lệ" };
    }
  } catch (err) {
    responseData = { status: "error", message: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
} // end function doPost

// end TÁC VỤ ĐIỀU PHỐI CHÍNH

// =========================================================================
// 2. CÁC HÀM XỬ LÝ ĐỌC DỮ LIỆU (READ ACTIONS)
// =========================================================================

function getAppDataAction(ss) {
  var data = {
    transactions: readTransactionsSheetData(ss),
    reminders: readRemindersSheetData(ss),
    family: readFamilySheetData(ss)
  };
  return { status: "success", data: data };
} // end function getAppDataAction

function getFamilyDataAction(ss) {
  var familyData = readFamilySheetData(ss);
  return { status: "success", data: familyData };
} // end function getFamilyDataAction

function checkPasswordAction(ss, password) {
  var sheet = ss.getSheetByName(SHEETS_CONFIG.CONFIG_APP);
  if (!sheet) return { status: "error", message: "Không tìm thấy sheet CONFIG_APP" };
  
  var correctPassword = sheet.getRange("A1").getValue().toString().trim();
  if (password === correctPassword) {
    return { status: "success", match: true };
  } else {
    return { status: "success", match: false };
  }
} // end function checkPasswordAction

// end TÁC VỤ ĐỌC DỮ LIỆU

// =========================================================================
// 3. CÁC HÀM XỬ LÝ GHI DỮ LIỆU (WRITE ACTIONS)
// =========================================================================

function saveTransactionAction(ss, params) {
  var sheet = ss.getSheetByName(SHEETS_CONFIG.TRANSACTIONS);
  if (!sheet) return { status: "error", message: "Không tìm thấy sheet TRANSACTIONS" };
  
  var timestampStr = params.timestamp || new Date().toISOString();
  var formattedDate = formatVietnamDateTime(timestampStr);
  
  var type = params.type || "";
  var subtype = params.subtype || "";
  var amount = parseFloat(params.amount) || 0;
  var note = params.note || "";
  
  sheet.appendRow([formattedDate, type, subtype, amount, note]);
  
  return { status: "success", message: "Đã ghi nhận giao dịch thành công!" };
} // end function saveTransactionAction

function syncTransactionsAction(ss, params) {
  var sheet = ss.getSheetByName(SHEETS_CONFIG.TRANSACTIONS);
  if (!sheet) return { status: "error", message: "Không tìm thấy sheet TRANSACTIONS" };
  
  var transactions = params.data || [];
  if (!Array.isArray(transactions)) {
    return { status: "error", message: "Dữ liệu không hợp lệ" };
  }
  
  var count = 0;
  transactions.forEach(function(tx) {
    if (tx.timestamp && tx.type && tx.subtype && tx.amount !== undefined) {
      var formattedDate = formatVietnamDateTime(tx.timestamp);
      
      sheet.appendRow([
        formattedDate,
        tx.type || "",
        tx.subtype || "",
        parseFloat(tx.amount) || 0,
        tx.note || ""
      ]);
      count++;
    }
  });
  
  return { status: "success", message: "Đã đồng bộ " + count + " giao dịch!" };
} // end function syncTransactionsAction

function saveReminderAction(ss, params) {
  var sheet = ss.getSheetByName(SHEETS_CONFIG.REMINDERS);
  if (!sheet) return { status: "error", message: "Không tìm thấy sheet REMINDERS" };
  
  // Cấu trúc sheet REMINDERS: NỘI DUNG NHẮC, TẦN SUẤT, NGÀY BẮT ĐẦU, TRẠNG THÁI, NGÀY NHẮC TIẾP THEO, LẦN NHẮC CUỐI
  var noiDungNhac = params.noiDungNhac || params.content || "";
  var tanSuat = params.tanSuat || params.frequency || "ONCE";
  
  var ngayBatDau = params.ngayBatDau || params.startDate || new Date().toISOString();
  var ngayBatDauFormatted = formatVietnamDateTime(ngayBatDau);
  
  var trangThai = params.trangThai || params.status || "ENABLED";
  
  var ngayNhacTiepTheo = params.nextReminderDate || ngayBatDau;
  var ngayNhacTiepTheoFormatted = formatVietnamDateTime(ngayNhacTiepTheo);
  
  var lanNhacCuoi = params.lastTriggeredAt ? formatVietnamDateTime(params.lastTriggeredAt) : "";
  
  sheet.appendRow([noiDungNhac, tanSuat, ngayBatDauFormatted, trangThai, ngayNhacTiepTheoFormatted, lanNhacCuoi]);
  
  return { status: "success", message: "Đã thêm nhắc hẹn thành công!" };
} // end function saveReminderAction

function syncRemindersAction(ss, params) {
  var sheet = ss.getSheetByName(SHEETS_CONFIG.REMINDERS);
  if (!sheet) return { status: "error", message: "Không tìm thấy sheet REMINDERS" };
  
  var reminders = params.data || [];
  if (!Array.isArray(reminders)) {
    return { status: "error", message: "Dữ liệu không hợp lệ" };
  }
  
  var count = 0;
  reminders.forEach(function(rem) {
    if (rem.content && rem.startDate) {
      var ngayBatDau = formatVietnamDateTime(rem.startDate);
      var ngayNhacTiepTheo = rem.nextReminderDate ? formatVietnamDateTime(rem.nextReminderDate) : ngayBatDau;
      var lanNhacCuoi = rem.lastTriggeredAt ? formatVietnamDateTime(rem.lastTriggeredAt) : "";
      
      sheet.appendRow([
        rem.content || "",
        rem.frequency || "ONCE",
        ngayBatDau,
        rem.status || "ENABLED",
        ngayNhacTiepTheo,
        lanNhacCuoi
      ]);
      count++;
    }
  });
  
  return { status: "success", message: "Đã đồng bộ " + count + " nhắc hẹn!" };
} // end function syncRemindersAction

function updateReminderStatusAction(ss, params) {
  var sheet = ss.getSheetByName(SHEETS_CONFIG.REMINDERS);
  if (!sheet) return { status: "error", message: "Không tìm thấy sheet REMINDERS" };
  
  var rowIndex = parseInt(params.rowIndex) || -1;
  var newStatus = params.status || "ENABLED";
  
  if (newStatus !== "ENABLED" && newStatus !== "DISABLED") {
    return { status: "error", message: "Trạng thái không hợp lệ" };
  }
  
  if (rowIndex < 2) {
    return { status: "error", message: "Chỉ mục dòng không hợp lệ" };
  }
  
  sheet.getRange(rowIndex, 4).setValue(newStatus);
  return { status: "success", message: "Đã cập nhật trạng thái nhắc hẹn!" };
} // end function updateReminderStatusAction

function updatePasswordAction(ss, params) {
  var sheet = ss.getSheetByName(SHEETS_CONFIG.CONFIG_APP);
  if (!sheet) return { status: "error", message: "Không tìm thấy sheet CONFIG_APP" };
  
  var newPassword = params.newPassword || "";
  if (newPassword.trim() === "") {
    return { status: "error", message: "Mật khẩu mới không được để trống!" };
  }
  
  sheet.getRange("A1").setValue(newPassword.trim());
  return { status: "success", message: "Đổi mật khẩu ứng dụng thành công!" };
} // end function updatePasswordAction

// end TÁC VỤ GHI DỮ LIỆU

// =========================================================================
// 4. CÁC HÀM TRÍCH XUẤT DỮ LIỆU THẤP CẤP (LOW LEVEL READERS)
// =========================================================================

function readTransactionsSheetData(ss) {
  var list = [];
  var sheet = ss.getSheetByName(SHEETS_CONFIG.TRANSACTIONS);
  if (!sheet) return list;
  
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    
    var timestamp = rows[i][0];
    var timestampStr = "";
    if (timestamp instanceof Date) {
      timestampStr = formatVietnamDateTime(timestamp);
    } else {
      timestampStr = timestamp.toString();
    }
    
    list.push({
      timestamp: timestampStr,
      type: rows[i][1] || "",
      subtype: rows[i][2] || "",
      amount: parseFloat(rows[i][3]) || 0,
      note: rows[i][4] || ""
    });
  }
  return list;
} // end function readTransactionsSheetData

function readRemindersSheetData(ss) {
  var reminders = [];
  var sheet = ss.getSheetByName(SHEETS_CONFIG.REMINDERS);
  if (!sheet) return reminders;
  
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    
    // Cấu trúc: NỘI DUNG NHẮC, TẦN SUẤT, NGÀY BẮT ĐẦU, TRẠNG THÁI, NGÀY NHẮC TIẾP THEO, LẦN NHẮC CUỐI
    var content = rows[i][0] || "";
    var frequency = rows[i][1] || "ONCE";
    
    var startDate = rows[i][2];
    var startDateStr = "";
    if (startDate instanceof Date) {
      startDateStr = formatVietnamDateTime(startDate);
    } else {
      startDateStr = startDate.toString();
    }
    
    var status = (rows[i][3] || "ENABLED").toString().trim().toUpperCase();
    
    var nextReminderDate = rows[i][4];
    var nextReminderDateStr = "";
    if (nextReminderDate instanceof Date) {
      nextReminderDateStr = formatVietnamDateTime(nextReminderDate);
    } else {
      nextReminderDateStr = nextReminderDate ? nextReminderDate.toString() : startDateStr;
    }
    
    var lastTriggeredAt = rows[i][5];
    var lastTriggeredAtStr = "";
    if (lastTriggeredAt instanceof Date) {
      lastTriggeredAtStr = formatVietnamDateTime(lastTriggeredAt);
    } else {
      lastTriggeredAtStr = lastTriggeredAt ? lastTriggeredAt.toString() : "";
    }
    
    reminders.push({
      content: content,
      frequency: frequency,
      startDate: startDateStr,
      status: status,
      nextReminderDate: nextReminderDateStr,
      lastTriggeredAt: lastTriggeredAtStr,
      rowIndex: i + 1
    });
  }
  return reminders;
} // end function readRemindersSheetData

function readFamilySheetData(ss) {
  var family = [];
  var sheet = ss.getSheetByName(SHEETS_CONFIG.FAMILY);
  if (!sheet) return family;
  
  var rows = sheet.getRange("A4:S").getValues();
  
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i][0] || rows[i][0].toString().trim() === "" || rows[i][0].toString().trim().toUpperCase() === "NICKNAME") continue;
    
    var formatDate = function(dateVal) {
      if (!dateVal) return "-";
      if (dateVal instanceof Date) {
        var day = String(dateVal.getDate()).padStart(2, '0');
        var month = String(dateVal.getMonth() + 1).padStart(2, '0');
        var year = dateVal.getFullYear();
        return day + "/" + month + "/" + year;
      }
      return dateVal.toString();
    };
    
    family.push({
      nickname: rows[i][0] || "-",
      fullname: rows[i][1] || "-",
      dob: formatDate(rows[i][2]),
      noisinh: rows[i][3] || "-",
      diachi: rows[i][4] || "-",
      cccd: {
        so: rows[i][5] || "-",
        ngaycap: rows[i][6] || "-",
        ngayhethan: rows[i][7] || "-",
        noicap: rows[i][8] || "-"
      },
      hochieu: {
        so: rows[i][9] || "-",
        ngaycap: rows[i][10] || "-",
        ngayhethan: rows[i][11] || "-",
        noicap: rows[i][12] || "-"
      },
      bhyt: rows[i][13] || "-",
      bhxh: rows[i][14] || "-",
      masothue: rows[i][15] || "-",
      lltp: {
        so: rows[i][16] || "-",
        ngaycap: formatDate(rows[i][17]),
        noicap: rows[i][18] || "-"
      }
    });
  }
  return family;
} // end function readFamilySheetData

// end TÁC VỤ TRÍCH XUẤT DỮ LIỆU THẤP CẤP