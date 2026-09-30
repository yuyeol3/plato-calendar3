import ScheduleStorageManager from "./scheduleStorageManager";
import { updateData } from "./updateSchedule";

chrome.runtime.onInstalled.addListener(() => {
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
                sendResponse(res);
            }).catch((error) => sendResponse({ result: false, errors: [String(error)], warnings: [] }));
        return true;
    }

    if (message?.action === "loadSchedules") {
        ScheduleStorageManager.getInstance().loadAllSchedules()
            .then((res)=>{
                sendResponse({result : res});
            }).catch(() => sendResponse({ error: "일정 데이터를 불러올 수 없습니다." }));
        return true;
    }

    if (message?.action === "loadCurCourses") {
        chrome.storage.local.get({currentCourses : []})
            .then((res)=> {
                sendResponse({result : res?.currentCourses ?? []});
            }).catch(() => sendResponse({ error: "강좌 목록을 불러올 수 없습니다." }));
        return true;
    }
});
