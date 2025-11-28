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
    private updatePromise : Promise<void>;
    private constructor() {
        this.KEY_NAME = "plato-calendar3";
        // const storageStr = localStorage.getItem(this.KEY_NAME);
        this.data = {};
        this.updatePromise = CalendarStorageManager.update();
    }

    // 추가
    set(date : string, id : string, data : Schedule) {
        // console.log("inside set:", date, id, data);
        if (!this.data[date]) this.data[date] = {};
        if (!this.data[date]?.[id]) this.data[date][id] = data;
        else {
            const existingSchedule = this.data[date][id];

            existingSchedule.name = data.name;
            existingSchedule.completed = data.completed;
            existingSchedule.due = data.due;
            existingSchedule.orphaned = data.orphaned;

        }

        // localStorage.setItem(this.KEY_NAME, JSON.stringify(this.data));
        CalendarStorageManager.save(this.data);
    }   

    // 조회
    async get(date : string) {
        await this.updatePromise;
        return Object.values(this.data[date] ?? {});
    }
    // 삭제
    remove(date : string) {
        this.data[date] = {};
        // localStorage.setItem(this.KEY_NAME, JSON.stringify(this.data));
        CalendarStorageManager.save(this.data);
    }

    removeById(date : string, id : string) {
        delete this.data[date]?.[id];
        CalendarStorageManager.save(this.data);
    }
 
    cleanUp(schedules : Schedule[]) {
        const dateStrings : Set<string> = new Set();

        for (const schedule of schedules) {
            const d = new Date(schedule.due.toString());
            if (d.toString() === "Invalid Date") continue;
            d.setDate(1);
            dateStrings.add(d.toDateString());
        }


        for (const dateString of dateStrings) {
            const d = new Date(dateString);
            const month = d.getMonth();

            while (d.getMonth() == month) {
                // console.log("deleting : ", d);
                this.remove(d.toDateString());
                d.setDate(d.getDate() + 1);
            }
        }

    }

    static async save(data : CalendarStorage) {
        await chrome.runtime.sendMessage({
            data : data,
            action : "calendar/save"
        })
    }

    static async load() : Promise<CalendarStorage> {
        const response = await chrome.runtime.sendMessage({
            action : "calendar/load"
        })

        return response.result;
    }

    static async update() {
        const data = await this.load();
        const schedules = await getSchedules();
        const currentCourses = await getCurrentCourses();

        if (Object.keys(currentCourses).length == 0) return;

        this.getInstance().data = data;
        // console.log(currentCourses);
        this.getInstance().cleanUp(currentCourses.map(e=>Object.values(schedules[e.id])).flat());
        // console.log("cleanup target: ", currentCourses.map(e=>Object.values(schedules[e.id])).flat());
        for (const course of currentCourses) {
            const courseSchedules = Object.values(schedules[course.id]);

            for (const s of courseSchedules) {
                const date = new Date(s.due.toString());
                date.setSeconds(date.getSeconds() - 1); // 자정인 경우 하루 전으로 설정하기
                this.getInstance().set(
                    date.toDateString(), 
                    s.id, s
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