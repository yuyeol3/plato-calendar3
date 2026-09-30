import { AllSchedules } from "../background/scheduleStorageManager";
import { Subject, UpdateResult } from "../background/updateSchedule";

export async function getSchedules() : Promise<AllSchedules> {
    const response = await chrome.runtime.sendMessage({ action: "loadSchedules" });
    if (!response?.result) throw new Error("일정 데이터를 불러올 수 없습니다.");
    return response.result;
}

const LAST_UPDATE_KEY = "plato-calendar3-lastUpdate"

export async function updateSchedules(): Promise<UpdateResult> {
    const res: UpdateResult = await chrome.runtime.sendMessage({
        action: "updateData"
    });

    if (typeof res?.result !== "boolean" || !Array.isArray(res.errors) || !Array.isArray(res.warnings)) {
        throw new Error("갱신 응답을 확인할 수 없습니다. 확장 프로그램을 다시 로드해 주세요.");
    }
    if (res.result && res.errors.length === 0) localStorage.setItem(LAST_UPDATE_KEY, new Date().toISOString());
    return res;
}

export  function CheckScheduleUpdateTiming() {
    const now = new Date().getTime();
    const stored = localStorage.getItem(LAST_UPDATE_KEY);
    const lastUpdated = stored ? new Date(stored).getTime() : NaN;

    const HOUR = 1000 * 3600;
    return !Number.isFinite(lastUpdated) || now-lastUpdated > HOUR;
}

export async function getCurrentCourses() : Promise<Subject[]> {
    const response = await chrome.runtime.sendMessage({ action: "loadCurCourses" });    
    if (!Array.isArray(response?.result)) throw new Error("강좌 목록을 불러올 수 없습니다.");
    return response.result;
}
