import { AllSchedules } from "../background/scheduleStorageManager";
import { Schedule } from "../background/updateSchedule";
import CalendarStorageManager from "./CalendarStorageManager";
import { getCurrentCourses, getSchedules, updateSchedules } from "./utils";

function createScheduleDiv(data : Schedule) {
    const divEl = document.createElement("div");
    divEl.innerHTML = `
        <img src=""></img>
    `
}

// singleton
export default class Calendar {
    private static calender : Calendar;
    private date : Date;
    private dateCells : HTMLTableCellElement[];
    private monthLabel : HTMLSpanElement;
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
            await updateSchedules();
            await CalendarStorageManager.update();
            await this.render();
        };
    }

    private async render() {
        this.clearCells();
        const d = new Date(this.date);
        const month = d.getMonth();
        const day = d.getDay();

        // await this.getSchedules();
        // console.log(this.schedules);

        while (d.getMonth() == month) {
            const target = this.dateCells[d.getDate() - 1 + day];

            const dateLabelDiv = document.createElement("div");
            const infoDiv = document.createElement("div");

            dateLabelDiv.classList.add("date-label-div");
            infoDiv.classList.add("info-div");

            dateLabelDiv.textContent = d.getDate().toString();

            const targetSchedules = CalendarStorageManager.getInstance().get(d.toDateString());
            
            for (const schedule of targetSchedules) {
                const divEl = document.createElement("div");
                divEl.textContent = schedule.name;
                divEl.style.width = "90%";
                infoDiv.appendChild(divEl);
            }

            target.appendChild(dateLabelDiv);
            target.appendChild(infoDiv);
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

    // private async getSchedules() {
    //     this.schedules = await getSchedules();
    //     const currentCourses = await getCurrentCourses();

        
    // }

    public static async getView() : Promise<HTMLDivElement> {
        const calendarEl = document.createElement("div");

        calendarEl.innerHTML = (`
            <div id="info">
                <button id="prev-btn">prev</button>
                <span id="month-label"></span>
                <button id="next-btn">next</button>
            </div>
            <button id="update-btn">업데이트</button>
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
