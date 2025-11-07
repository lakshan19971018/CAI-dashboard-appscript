// Helper function to convert UTC to Sri Lankan time
function convertToSriLankaTime(utcDateTime) {
  var utcDate = new Date(utcDateTime);
  var sriLankaOffsetMs = (5 * 60 + 30) * 60 * 1000; // 5 hours 30 minutes in milliseconds
  var sriLankaDate = new Date(utcDate.getTime() + sriLankaOffsetMs);
  var formattedDate = Utilities.formatDate(sriLankaDate, "UTC", "yyyy-MM-dd'T'HH:mm:ss.SSS");
  return formattedDate + "+00:00";
}

function fetchQAData(period, startDate, endDate) {
  var baseUrl = "https://phoenix.spemai.com/api/v1/usage/qa-usage";
  
  // Build the URL with period and optional date range
  var url = baseUrl + "?period=" + period + "&groupby=kb";
  if (period === "time-range" && startDate && endDate) {
    url += "&start_date=" + startDate + "&end_date=" + endDate;
  }
  var options = {
    "method": "GET",
    "muteHttpExceptions": true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    Logger.log("API Response: " + responseText);
    var json = JSON.parse(responseText);

    if (!json.message.includes("QA usage data retrieved successfully")) {
      Logger.log("API Error: " + (json.message || "No message"));
      return;
    }

    if (period === "daily" || period === "all" || period === "today" || period === "time-range") {
      var detailSheetName = (period === "today") ? "QAToday" : "QADailyUsage";
      var detailSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(detailSheetName) || SpreadsheetApp.getActiveSpreadsheet().insertSheet(detailSheetName);
      detailSheet.clear();

      var detailData = [["Date", "KB Name", "User ID", "Question", "Answer", "Datetime"]];
      var qaData = json.data;

      Logger.log("qaData: " + JSON.stringify(qaData));

      if (Object.keys(qaData).length === 0) {
        Logger.log("No data found for period: " + period);
      } else {
        for (var date in qaData) {
          var kbData = qaData[date];
          for (var kbName in kbData) {
            var userData = kbData[kbName];
            for (var userId in userData) {
              var entries = userData[userId];
              entries.forEach(function(entry) {
                var sriLankaDateTime = convertToSriLankaTime(entry.datetime);
                detailData.push([
                  date,
                  kbName,
                  userId,
                  entry.question,
                  entry.answer,
                  sriLankaDateTime
                ]);
              });
            }
          }
        }
      }

      Logger.log("detailData: " + JSON.stringify(detailData));
      if (detailData.length > 1) {
        detailSheet.getRange(1, 1, detailData.length, detailData[0].length).setValues(detailData);
      } else {
        Logger.log("No data to write to sheet: " + detailSheetName);
        detailSheet.getRange(1, 1, 1, detailData[0].length).setValues([detailData[0]]);
      }

      if (period === "today" && detailData.length > 1) {
        var qaDailyUsageSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("QADailyUsage") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("QADailyUsage");
        var todayDate = detailData[1][0].split('T')[0];
        var existingData = qaDailyUsageSheet.getDataRange().getValues();
        var rowsToDelete = [];

        for (var i = 1; i < existingData.length; i++) {
          var existingDate = new Date(existingData[i][0]);
          var formattedExistingDate = Utilities.formatDate(existingDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
          if (formattedExistingDate === todayDate) {
            rowsToDelete.push(i + 1);
          }
        }

        rowsToDelete.sort((a, b) => b - a);
        rowsToDelete.forEach(function(row) {
          qaDailyUsageSheet.deleteRow(row);
        });

        var lastRow = qaDailyUsageSheet.getLastRow();
        if (lastRow === 0) {
          qaDailyUsageSheet.getRange(1, 1, detailData.length, detailData[0].length).setValues(detailData);
        } else {
          var dataToAppend = detailData.slice(1);
          if (dataToAppend.length > 0) {
            qaDailyUsageSheet.getRange(lastRow + 1, 1, dataToAppend.length, dataToAppend[0].length).setValues(dataToAppend);
          }
        }
      }
    }
  } catch (e) {
    Logger.log("Error in fetchQAData: " + e.message);
    return;
  }
}

function fetchQAUsageData() {
  var qaDailyUsageSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("QADailyUsage");
  if (!qaDailyUsageSheet || qaDailyUsageSheet.getLastRow() <= 1) {
    fetchQAData("all");
  } else {
    fetchQAData("today");
  }
}