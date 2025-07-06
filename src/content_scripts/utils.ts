import { AllSchedules } from "../background/scheduleStorageManager";
import { Subject } from "../background/updateSchedule";

export async function getSchedules() : Promise<AllSchedules> {
    console.log("서비스 워커에게 스케줄 데이터 로드를 요청합니다...");

    // 1. 'loadSchedules'라는 action을 담아 메시지 전송
    const response = await chrome.runtime.sendMessage({ action: "loadSchedules" });

    // 4. 서비스 워커로부터 받은 결과
    console.log("서비스 워커로부터 받은 스케줄:", response);
    
    // 이 데이터를 사용하여 페이지의 DOM을 조작할 수 있습니다.
    return response.result;
}

const LAST_UPDATE_KEY = "plato-calendar3-lastUpdate"

export async function updateSchedules() {
    localStorage.setItem(LAST_UPDATE_KEY, new Date().toString());
    const res = await chrome.runtime.sendMessage({
        action: "updateData"
    });

    console.log(res);
}

export  function CheckScheduleUpdateTiming() {
    const now = new Date().getTime();
    const lastUpdated = new Date(localStorage.getItem(LAST_UPDATE_KEY) as string)?.getTime() ?? 0;

    const HOUR = 1000 * 3600;
    return (now-lastUpdated > HOUR);
}

export async function getCurrentCourses() : Promise<Subject[]> {
    const response = await chrome.runtime.sendMessage({ action: "loadCurCourses" });    
    return response.result;
}