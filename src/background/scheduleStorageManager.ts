// src/background/scheduleStorageManager.ts

import { CollectedSchedule, CourseCollection, Schedule, ScheduleType } from "./updateSchedule";

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
        const schedules: AllSchedules = data[this.storageKey];
        for (const course of Object.values(schedules)) {
            for (const schedule of Object.values(course)) {
                if (typeof schedule.completed !== 'boolean') schedule.completed = null;
                if (schedule.due === undefined) schedule.due = null;
            }
        }
        return schedules;
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
    public async updateSchedulesForCourse(courseId: string, newSchedules: CollectedSchedule[], listing: Pick<CourseCollection, 'discoveredIds' | 'listingComplete'>): Promise<void> {
        if (!listing.listingComplete) return;
        const allSchedules = await this.loadAllSchedules();
        const oldSchedulesMap = allSchedules[courseId] || {};
        const updatedSchedulesMap = { ...oldSchedulesMap };

        const newScheduleIds = new Set(listing.discoveredIds);

        // 1. 새로 가져온 스케줄 처리 (추가 또는 업데이트)
        for (const newSchedule of newSchedules) {
            const existingSchedule = updatedSchedulesMap[newSchedule.id];
            const updated: Schedule = {
                ...existingSchedule, ...newSchedule,
                completed: newSchedule.completed ?? existingSchedule?.completed ?? null,
                due: newSchedule.due === undefined ? existingSchedule?.due ?? null : newSchedule.due,
                orphaned: false,
            };
            if (newSchedule.completed === null && existingSchedule?.attendance) {
                updated.attendance = existingSchedule.attendance;
            } else if (!newSchedule.attendance) {
                delete updated.attendance;
            }
            // 새 출석 판정이 없으면 저장된 출석을 진도율보다 우선한다.
            if (newSchedule.completionBasis === 'progress' && existingSchedule?.attendance && typeof existingSchedule.completed === 'boolean') {
                updated.completed = existingSchedule.completed;
                updated.attendance = existingSchedule.attendance;
                delete updated.completionBasis;
            } else if (newSchedule.completed !== null && !newSchedule.completionBasis) {
                delete updated.completionBasis;
            }
            if (updated.due instanceof Date) updated.due = updated.due.toISOString();
            updatedSchedulesMap[newSchedule.id] = updated;
        }

        // 2. 이전에 있었지만 지금은 없어진 스케줄 처리 (orphaned: true)
        for (const scheduleId in oldSchedulesMap) {
            if (oldSchedulesMap[scheduleId].type !== ScheduleType.PA && !newScheduleIds.has(scheduleId)) {
                updatedSchedulesMap[scheduleId].orphaned = true;
            } else if (newScheduleIds.has(scheduleId)) {
                updatedSchedulesMap[scheduleId].orphaned = false;
            }
        }

        // 3. 업데이트된 맵을 전체 데이터에 반영
        allSchedules[courseId] = updatedSchedulesMap;
        await this.saveAllSchedules(allSchedules);
    }
}
