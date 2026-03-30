import { AllSchedules } from "../background/scheduleStorageManager";
import { Schedule, Subject } from "../background/updateSchedule";
import { getCurrentCourses, getSchedules } from "./utils";

export interface CalendarStorage {
    [date: string]: {
        [scheduleId: string]: Schedule;
    };
}

export default class CalendarStorageManager {
    private static instance : CalendarStorageManager;
    private monthCache : Map<string, CalendarStorage>;
    private schedules : AllSchedules;
    private currentCourses : Subject[];
    private updatePromise : Promise<void>;

    private constructor() {
        this.monthCache = new Map();
        this.schedules = {};
        this.currentCourses = [];
        this.updatePromise = this.refresh();
    }

    private async refresh() {
        this.schedules = await getSchedules();
        this.currentCourses = await getCurrentCourses();
        this.monthCache.clear();
    }

    private getMonthKey(date : Date) {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    }

    private getSourceSchedules() {
        const targetCourseIds = this.currentCourses.length === 0
            ? Object.keys(this.schedules)
            : this.currentCourses.map((course) => course.id);

        return targetCourseIds
            .flatMap((courseId) => Object.values(this.schedules[courseId] ?? {}))
            .filter((schedule) => new Date(schedule.due.toString()).toString() !== "Invalid Date")
            .sort((a, b) => {
                return new Date(a.due.toString()).getTime() - new Date(b.due.toString()).getTime();
            });
    }

    private buildMonth(date : Date) {
        const targetYear = date.getFullYear();
        const targetMonth = date.getMonth();
        const monthData : CalendarStorage = {};

        for (const schedule of this.getSourceSchedules()) {
            const dueDate = new Date(schedule.due.toString());
            dueDate.setSeconds(dueDate.getSeconds() - 1);

            if (dueDate.getFullYear() !== targetYear || dueDate.getMonth() !== targetMonth) continue;

            const dateKey = dueDate.toDateString();
            if (!monthData[dateKey]) monthData[dateKey] = {};
            monthData[dateKey][schedule.id] = schedule;
        }

        this.monthCache.set(this.getMonthKey(date), monthData);
    }

    async loadMonth(date : Date) {
        await this.updatePromise;
        const monthKey = this.getMonthKey(date);

        if (!this.monthCache.has(monthKey)) {
            this.buildMonth(date);
        }
    }

    async get(date : string) {
        const parsedDate = new Date(date);
        if (parsedDate.toString() === "Invalid Date") return [];

        await this.loadMonth(parsedDate);
        const monthData = this.monthCache.get(this.getMonthKey(parsedDate)) ?? {};
        return Object.values(monthData[parsedDate.toDateString()] ?? {});
    }

    static async update() {
        const instance = this.getInstance();
        instance.updatePromise = instance.refresh();
        await instance.updatePromise;
    }

    static getInstance() {
        if (this.instance == null) {
            this.instance = new CalendarStorageManager();
        }

        return this.instance;
    }
}
