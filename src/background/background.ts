import ScheduleStorageManager from "./scheduleStorageManager";
import { updateData } from "./updateSchedule";

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.remove("calendarData");
    chrome.storage.local.get({
        allSchedules : {},
        currentCourses : []
    }).then((res) => {
        chrome.storage.local.set({
            allSchedules : res?.allSchedules ?? {},
            currentCourses : res?.currentCourses ?? []
        });
    });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse)=> {
    if (message?.action === "updateData") {
        updateData()
            .then((res)=>{
                sendResponse({result: res});
            });
        return true;
    }

    if (message?.action === "loadSchedules") {
        ScheduleStorageManager.getInstance().loadAllSchedules()
            .then((res)=>{
                sendResponse({result : res});
            });
        return true;
    }

    if (message?.action === "loadCurCourses") {
        chrome.storage.local.get({currentCourses : []})
            .then((res)=> {
                sendResponse({result : res?.currentCourses ?? []});
            });
        return true;
    }
});
