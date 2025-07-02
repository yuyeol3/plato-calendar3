// src/background/scheduleStorageManager.ts

import { Schedule } from "./updateSchedule";

// 전체 스케줄의 데이터 구조를 정의하는 인터페이스
export interface AllSchedules {
    [courseId: string]: {
        [scheduleId: string]: Schedule;
    };
}

export default class ScheduleStorageManager {
    private static instance: ScheduleStorageManager;
    private readonly storageKey = 'allSchedules';

    private constructor() { }

    /**
     * 클래스의 유일한 인스턴스를 반환합니다.
     */
    public static getInstance(): ScheduleStorageManager {
        if (!ScheduleStorageManager.instance) {
            ScheduleStorageManager.instance = new ScheduleStorageManager();
        }
        return ScheduleStorageManager.instance;
    }

    /**
     * 저장된 모든 스케줄 데이터를 불러옵니다.
     * @returns 과목 ID로 그룹화된 전체 스케줄 객체
     */
    public async loadAllSchedules(): Promise<AllSchedules> {
        const data = await chrome.storage.local.get({ [this.storageKey]: {} });
        return data[this.storageKey];
    }

    /**
     * 전체 스케줄 데이터를 저장합니다.
     * @param allSchedules 저장할 전체 스케줄 객체
     */
    public async saveAllSchedules(allSchedules: AllSchedules): Promise<void> {
        await chrome.storage.local.set({ [this.storageKey]: allSchedules });
    }

    /**
     * 특정 과목의 스케줄 목록을 업데이트합니다.
     * @param courseId 업데이트할 과목의 ID
     * @param newSchedules 웹사이트에서 새로 가져온 해당 과목의 스케줄 배열
     */
    public async updateSchedulesForCourse(courseId: string, newSchedules: Schedule[]): Promise<void> {


        const allSchedules = await this.loadAllSchedules();
        const oldSchedulesMap = allSchedules[courseId] || {};
        const updatedSchedulesMap = { ...oldSchedulesMap };

        const newScheduleIds = new Set(newSchedules.map(s => s.id));

        // 1. 새로 가져온 스케줄 처리 (추가 또는 업데이트)
        for (const newSchedule of newSchedules) {
            newSchedule.due = newSchedule.due.toString();
            const existingSchedule = updatedSchedulesMap[newSchedule.id];

            if (existingSchedule) {
                // 이미 존재하면 -> 정보 업데이트, orphaned: false로 변경
                existingSchedule.name = newSchedule.name;
                existingSchedule.completed = newSchedule.completed;
                existingSchedule.due = newSchedule.due;
                existingSchedule.orphaned = false;
            } else {
                // 존재하지 않으면 -> 새로 추가
                updatedSchedulesMap[newSchedule.id] = { ...newSchedule };
            }
        }

        // 2. 이전에 있었지만 지금은 없어진 스케줄 처리 (orphaned: true)
        for (const scheduleId in oldSchedulesMap) {
            if (!newScheduleIds.has(scheduleId)) {
                updatedSchedulesMap[scheduleId].orphaned = true;
            }
        }

        // 3. 업데이트된 맵을 전체 데이터에 반영
        allSchedules[courseId] = updatedSchedulesMap;
        await this.saveAllSchedules(allSchedules);
    }
}