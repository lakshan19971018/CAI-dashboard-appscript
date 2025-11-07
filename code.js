function fetchAPI(period) {
  var baseUrl = "https://phoenix.spemai.com/api/v1/usage/analytic-usage";
  var url = baseUrl + "?period=" + period;
  var options = {
    "method": "GET",
    "muteHttpExceptions": true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();

    // Parse the response as JSON
    var json;
    try {
      json = JSON.parse(responseText);
    } catch (e) {
      return;
    }

    // Check if the API returned a success message
    if (!json.message || json.message !== "Dashboard data retrieved successfully") {
      return;
    }

    // Handle "daily", "all", and "today" periods (all return daily_usage data)
    if (period === "daily" || period === "all" || period === "today") {
      var usage = json.data.usage || {
        total_requests: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        knowledgebases: 0,
        users: 0
      };
      var mainSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("MainData") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("MainData");
      mainSheet.clear();
      var mainData = [
        ["Total Requests", "Prompt Tokens", "Completion Tokens", "Total Tokens", "Knowledgebases", "Users"],
        [usage.total_requests, usage.prompt_tokens, usage.completion_tokens, usage.total_tokens, usage.knowledgebases, usage.users]
      ];
      mainSheet.getRange(1, 1, mainData.length, mainData[0].length).setValues(mainData);

      // For "daily" and "all", write directly to "DailyUsage" sheet
      // For "today", write to "TodayData" sheet and append to "DailyUsage"
      var detailSheetName = (period === "today") ? "TodayData" : "DailyUsage";
      var detailSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(detailSheetName) || SpreadsheetApp.getActiveSpreadsheet().insertSheet(detailSheetName);
      detailSheet.clear();

      var detailData = [["Date", "Request", "KB Name", "KB Requests", "User ID", "User Requests"]];
      var dailyData = json.data.daily_usage || [];

      // Only process dailyData if it's not empty
      if (dailyData.length > 0) {
        dailyData.forEach(function(day) {
          for (var kb in day.requests_per_kb) {
            detailData.push([day.date, day.request, kb, day.requests_per_kb[kb], "", ""]);
          }
          for (var user in day.requests_per_user) {
            detailData.push([day.date, day.request, "", "", user, day.requests_per_user[user]]);
          }
        });
        detailSheet.getRange(1, 1, detailData.length, detailData[0].length).setValues(detailData);
      }

      // If period is "today", append the data to "DailyUsage" after removing existing entries for today
      if (period === "today" && dailyData.length > 0) {
        var dailyUsageSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DailyUsage") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("DailyUsage");
        var todayDate = dailyData[0].date.split('T')[0]; // Extract YYYY-MM-DD from the API date
        var existingData = dailyUsageSheet.getDataRange().getValues();
        var rowsToDelete = [];

        // Skip the header row (index 0) and compare dates
        for (var i = 1; i < existingData.length; i++) {
          var existingDate = new Date(existingData[i][0]);
          var formattedExistingDate = Utilities.formatDate(existingDate, Session.getScriptTimeZone(), "yyyy-MM-dd");
          if (formattedExistingDate === todayDate) {
            rowsToDelete.push(i + 1); // Row numbers are 1-based in Google Sheets
          }
        }

        // Delete rows in reverse order to avoid index shifting
        rowsToDelete.sort((a, b) => b - a); // Sort in descending order
        rowsToDelete.forEach(function(row) {
          dailyUsageSheet.deleteRow(row);
        });

        // Append the new data from "TodayData" to "DailyUsage"
        var lastRow = dailyUsageSheet.getLastRow();
        if (lastRow === 0) {
          // If the sheet is empty, include the header
          dailyUsageSheet.getRange(1, 1, detailData.length, detailData[0].length).setValues(detailData);
        } else {
          // Otherwise, append only the data rows (skip the header)
          var dataToAppend = detailData.slice(1); // Exclude the header row
          if (dataToAppend.length > 0) {
            dailyUsageSheet.getRange(lastRow + 1, 1, dataToAppend.length, dataToAppend[0].length).setValues(dataToAppend);
          }
        }
      }
    }

  } catch (e) {
    // Handle errors silently since logs are removed
    return;
  }
}

function fetchData() {
  // Check if "DailyUsage" sheet exists to determine if this is the first run
  var dailyUsageSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("DailyUsage");
  if (!dailyUsageSheet || dailyUsageSheet.getLastRow() <= 1) {
    // First run: Fetch "all" data
    Logger.log("First run: Fetching 'all' data");
    fetchAPI("all");
  } else {
    // Subsequent runs: Fetch "today" data
    Logger.log("Subsequent run: Fetching 'today' data");
    fetchAPI("today");
  }


}