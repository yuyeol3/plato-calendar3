import ScheduleStorageManager from "./scheduleStorageManager";
import { getCoursesList, updateData } from "./updateSchedule";

chrome.runtime.onInstalled.addListener(() => {
  // requestCount를 0으로 초기화하여 storage에 저장
//   chrome.storage.local.set({ requestCount: 0 });
//   console.log('확장 프로그램이 설치되었으며, 카운터를 초기화합니다.');
    chrome.storage.local.set({schedules : {}});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse)=> {
    if (message?.action === "updateData") {
      updateData()
        .then((res)=>{
          sendResponse({result: res});
      });
    }

    if (message?.action === "loadSchedules") {
      ScheduleStorageManager.getInstance().loadAllSchedules()
        .then((res)=>{
          sendResponse({result : res});
        })
    }

    if (message?.action === "loadCurCourses") {
      chrome.storage.local.get({currentCourses : {}})
        .then((res)=> {
          sendResponse({result : res?.currentCourses ?? {}})
        })
    }
  
    return true;
});