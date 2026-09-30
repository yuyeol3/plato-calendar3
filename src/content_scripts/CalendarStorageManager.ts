import { AllSchedules } from "../background/scheduleStorageManager";
import { Schedule } from "../background/updateSchedule";
import { getSchedules } from "./utils";

export interface CalendarStorage {
    [date: string]: {
        [scheduleId: string]: Schedule;
    };
}

export default class CalendarStorageManager {
    private static instance : CalendarStorageManager;
    private monthCache : Map<string, CalendarStorage>;
    private schedules : AllSchedules;
    private updatePromise : Promise<void>;

    private constructor() {
        this.monthCache = new Map();
        this.schedules = {};
        this.updatePromise = this.refresh();
    }

    private async refresh() {
        this.schedules = await getSchedules();
        this.rebuildMonthCache();
    }

    private getMonthKey(date : Date) {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    }

    private getIndexedSchedules() {
        return Object.values(this.schedules)
            .flatMap(courseSchedules => Object.values(courseSchedules))
            .filter((schedule) => schedule.due != null)
            .map((schedule) => {
                const dueDate = new Date(schedule.due!.toString());
                dueDate.setSeconds(dueDate.getSeconds() - 1);
                return { schedule, dueDate };
            })
            .filter(({ dueDate }) => dueDate.toString() !== "Invalid Date")
            .sort((a, b) => {
                return a.dueDate.getTime() - b.dueDate.getTime();
            });
    }

    private rebuildMonthCache() {
        const monthCache = new Map<string, CalendarStorage>();

        for (const { schedule, dueDate } of this.getIndexedSchedules()) {
            const monthKey = this.getMonthKey(dueDate);
            const dateKey = dueDate.toDateString();

            if (!monthCache.has(monthKey)) {
                monthCache.set(monthKey, {});
            }

            const monthData = monthCache.get(monthKey) as CalendarStorage;
            if (!monthData[dateKey]) monthData[dateKey] = {};
            monthData[dateKey][schedule.id] = schedule;
        }

        this.monthCache = monthCache;
    }

    async loadMonth(date : Date) {
        await this.updatePromise;
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
