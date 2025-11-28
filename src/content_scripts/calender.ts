import { AllSchedules } from "../background/scheduleStorageManager";
import { Schedule, ScheduleType } from "../background/updateSchedule";
import CalendarStorageManager from "./CalendarStorageManager";
import Modal from "./modal";
import { CheckScheduleUpdateTiming, getCurrentCourses, getSchedules, updateSchedules } from "./utils";


export const ScheduleStyles = {
    [ ScheduleType.HW ] : "hw",
    [ ScheduleType.VID ] : "vid",
    [ ScheduleType.QUIZ ] : "quiz",
    [ ScheduleType.ZOOM ] : "zoom",
    [ ScheduleType.PA ] : "pa"
}

function createScheduleMiniDiv(data : Schedule) {
    const divEl = document.createElement("div");
    divEl.innerHTML = `
        ${data.name}
    `
    divEl.classList.add("mini-schedule");
    if (!data.orphaned && !data.completed) divEl.classList.add(ScheduleStyles[data.type]);
    else if (data.completed) divEl.classList.add("completed")
    else divEl.classList.add("orphaned");
    return divEl;
}

// singleton
export default class Calendar {
    private static calender : Calendar;
    private date : Date;
    private dateCells : HTMLTableCellElement[];
    private monthLabel : HTMLSpanElement;
    private maxScheduleRender = 2;
    // 굳이 가지고있을 필요 없을수도
    // private prevBtn : HTMLButtonElement;
    // private nextBtn : HTMLButtonElement;

    private schedules : AllSchedules = {};

    private constructor(calendarDiv : HTMLDivElement) {
        this.date = new Date();
        this.date.setDate(1);  // 1일로 맞춰주기

        this.dateCells = Array.from(calendarDiv.querySelectorAll("tbody td"));
        this.monthLabel = calendarDiv.querySelector("#month-label") as HTMLSpanElement;
        const prevBtn = calendarDiv.querySelector("#prev-btn") as HTMLButtonElement;
        const nextBtn = calendarDiv.querySelector("#next-btn") as HTMLButtonElement;
        const updateBtn = calendarDiv.querySelector("#update-btn") as HTMLButtonElement;

        this.updateMonthLabel();

        prevBtn.onclick = ()=> {
            this.toPrevMonth();
            this.render();
        }

        nextBtn.onclick = ()=> {
            this.toNextMonth();
            this.render();
        }

        updateBtn.onclick = async ()=>{
            updateBtn.textContent = "업데이트 중"
            updateBtn.classList.add("updating");
            updateBtn.disabled = true;
            await this.updateSchedules();
            updateBtn.textContent = "업데이트"
            updateBtn.classList.remove("updating");
            updateBtn.disabled = false;
        };

        if (CheckScheduleUpdateTiming()) updateBtn.click();
    }

    private async render() {
        this.clearCells();
        const d = new Date(this.date);
        const month = d.getMonth();
        const day = d.getDay();

        // await this.getSchedules();
        // console.log(this.schedules);
        const today = new Date().toDateString();
        while (d.getMonth() == month) {
            const target = this.dateCells[d.getDate() - 1 + day];

            const dateLabelDiv = document.createElement("div");
            const infoDiv = document.createElement("div");

            dateLabelDiv.classList.add("date-label-div");
            infoDiv.classList.add("info-div");

            if (d.toDateString() == today) dateLabelDiv.classList.add("today");


            const targetSchedules = (await CalendarStorageManager.getInstance().get(d.toDateString()));

            for (let i = 0; i < Math.min(targetSchedules.length, this.maxScheduleRender); i++) {
                infoDiv.appendChild(createScheduleMiniDiv(targetSchedules[i]));
            }

            if (targetSchedules.length > this.maxScheduleRender) {
                const hiddenScheduleDiv = document.createElement("div");
                hiddenScheduleDiv.textContent = `+${targetSchedules.length - this.maxScheduleRender}`;
                infoDiv.appendChild(hiddenScheduleDiv);

                const hoverDiv = document.createElement("div");
                hoverDiv.classList.add("hover-div");
                for (let i = 0; i < targetSchedules.length; i++) {
                    hoverDiv.appendChild(createScheduleMiniDiv(targetSchedules[i]));
                }
                target.appendChild(hoverDiv)
            }

            dateLabelDiv.innerHTML = `
                <span class="date-label">${d.getDate().toString()}</span>
                <span class="unresolved-schedules">${targetSchedules.filter(e=>!e.completed && !e.orphaned).length || ""}</span>
            `

            target.appendChild(dateLabelDiv);
            target.appendChild(infoDiv);
            const curD = new Date(d.toString())
            target.onclick = ()=> { Modal.getInstance().open(curD.toDateString()) }
            d.setDate(d.getDate() + 1);
        }
        
    }

    private toPrevMonth() : void {
        this.date.setMonth(this.date.getMonth() - 1);
        this.date.setDate(1);  // 1일로 맞춰주기
        this.updateMonthLabel();

    }

    private toNextMonth() : void {
        this.date.setMonth(this.date.getMonth() + 1);
        this.date.setDate(1);  // 1일로 맞춰주기
        this.updateMonthLabel();
    }

    private clearCells() : void {
        for (const cell of this.dateCells) {
            cell.textContent = "";
        }
    }

    private updateMonthLabel() {
        this.monthLabel.textContent = `${this.date.getFullYear()}년 ${this.date.getMonth() + 1}월`;
    }

    private async updateSchedules() {
        await updateSchedules();
        await CalendarStorageManager.update();
        await this.render();
    }

    public static getView() : HTMLDivElement {
        const calendarEl = document.createElement("div");

        calendarEl.innerHTML = (`
            <div id="control">
                <div id="info">
                    <button id="prev-btn">&lt;</button>
                    <span id="month-label"></span>
                    <button id="next-btn">&gt;</button>
                </div>
                <button id="update-btn">업데이트</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>일</th>
                        <th>월</th>
                        <th>화</th>
                        <th>수</th>
                        <th>목</th>
                        <th>금</th>
                        <th>토</th>
                    </tr>                
                </thead>
                <tbody>
                    <tr>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        `);

        if (!this.calender) 
            this.calender = new Calendar(calendarEl);
        // this.calender.getSchedules();
        this.calender.render();
        return calendarEl;
    }
};
