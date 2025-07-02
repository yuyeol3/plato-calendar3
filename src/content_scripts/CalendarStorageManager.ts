import { Schedule } from "../background/updateSchedule";
import { getCurrentCourses, getSchedules } from "./utils";

export interface CalendarStorage {
    [date: string]: {
        [scheduleId: string]: Schedule;
    };
}

export default class CalendarStorageManager {
    private static instance : CalendarStorageManager;
    private KEY_NAME : string;
    private data : CalendarStorage;
    private constructor() {
        this.KEY_NAME = "plato-calendar3";
        const storageStr = localStorage.getItem(this.KEY_NAME);
        this.data = storageStr ? JSON.parse(storageStr) : {};

    }

    // 추가
    set(date : string, id : string, data : Schedule) {
        if (!this.data[date]) this.data[date] = {};
        if (!this.data[date]?.[id]) this.data[date][id] = data;
        else {
            const existingSchedule = this.data[date][id];

            existingSchedule.name = data.name;
            existingSchedule.completed = data.completed;
            existingSchedule.due = data.due;
            existingSchedule.orphaned = data.orphaned;
        }

        localStorage.setItem(this.KEY_NAME, JSON.stringify(this.data));
    }   

    // 조회
    get(date : string) {
        return Object.values(this.data[date] ?? {});
    }
    // 삭제
    remove(date : string) {
        delete this.data[date];
        localStorage.setItem(this.KEY_NAME, JSON.stringify(this.data));
    }
 
    static async update() {
        const schedules = await getSchedules();
        const currentCourses = await getCurrentCourses();

        for (const course of currentCourses) {
            const courseSchedules = Object.values(schedules[course.id]);

            for (const s of courseSchedules) {
                this.getInstance().set(
                    new Date(s.due.toString()).toDateString(), s.id, s
                );
            }
        }
    }

    static getInstance() {
        if (this.instance == null) {
            this.instance = new CalendarStorageManager();
        }

        return this.instance;
    }
}