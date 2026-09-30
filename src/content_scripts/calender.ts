import { Schedule, ScheduleType } from "../background/updateSchedule";
import CalendarStorageManager from "./CalendarStorageManager";
import Modal from "./modal";
import { CheckScheduleUpdateTiming, updateSchedules } from "./utils";


export const ScheduleStyles = {
    [ ScheduleType.HW ] : "hw",
    [ ScheduleType.VID ] : "vid",
    [ ScheduleType.QUIZ ] : "quiz",
    [ ScheduleType.ZOOM ] : "zoom",
    [ ScheduleType.PA ] : "pa"
}

export function applyScheduleState(divEl: HTMLElement, data: Schedule) {
    if (data.orphaned) divEl.classList.add("orphaned");
    else if (data.completed === true) divEl.classList.add("completed");
    else if (data.completed === false) divEl.classList.add(ScheduleStyles[data.type]);
    else divEl.classList.add("unknown");
}

export function appendScheduleStatus(divEl: HTMLElement, data: Schedule, compact = false) {
    if (data.completed == null) {
        const label = document.createElement("span");
        label.className = "completion-unknown";
        if (compact) {
            label.classList.add("completion-unknown-icon");
            label.textContent = "⚠️";
            label.title = "완료 여부 확인 불가";
            label.setAttribute("aria-label", "완료 여부 확인 불가");
            divEl.prepend(label);
        } else {
            label.textContent = "완료 여부 확인 불가";
            divEl.appendChild(label);
        }
    }
    if (data.attendance === "late") {
        const label = document.createElement("span");
        label.className = "attendance-late";
        label.textContent = "지각";
        divEl.appendChild(label);
    }
}

function createScheduleMiniDiv(data : Schedule, compact = true) {
    const divEl = document.createElement("div");
    divEl.textContent = data.name;
    divEl.classList.add("mini-schedule");
    applyScheduleState(divEl, data);
    appendScheduleStatus(divEl, data, compact);
    return divEl;
}

// singleton
export default class Calendar {
    private static calender : Calendar;
    private date : Date;
    private dateCells : HTMLTableCellElement[];
    private monthLabel : HTMLSpanElement;
    private maxScheduleRender = 2;
    private calendarDiv: HTMLDivElement;
    private statusEl: HTMLParagraphElement;
    private renderVersion = 0;
    // 굳이 가지고있을 필요 없을수도
    // private prevBtn : HTMLButtonElement;
    // private nextBtn : HTMLButtonElement;

    private constructor(calendarDiv : HTMLDivElement) {
        this.calendarDiv = calendarDiv;
        this.statusEl = calendarDiv.querySelector("#update-status") as HTMLParagraphElement;
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
            this.render().catch(error => this.showError(error));
        }

        nextBtn.onclick = ()=> {
            this.toNextMonth();
            this.render().catch(error => this.showError(error));
        }

        updateBtn.onclick = async ()=>{
            updateBtn.textContent = "업데이트 중"
            updateBtn.classList.add("updating");
            updateBtn.disabled = true;
            try {
                await this.updateSchedules();
            } catch (error) {
                this.showError(error);
            } finally {
                updateBtn.textContent = "업데이트";
                updateBtn.classList.remove("updating");
                updateBtn.disabled = false;
            }
        };

    }

    private showError(error: unknown) {
        this.statusEl.textContent = `갱신 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`;
        this.statusEl.classList.add("update-error");
    }

    private async render() {
        const version = ++this.renderVersion;
        const d = new Date(this.date);
        const month = d.getMonth();
        const day = d.getDay();

        await CalendarStorageManager.getInstance().loadMonth(this.date);
        if (version !== this.renderVersion) return;
        this.clearCells();

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
            if (version !== this.renderVersion) return;

            for (let i = 0; i < Math.min(targetSchedules.length, this.maxScheduleRender); i++) {
                infoDiv.appendChild(createScheduleMiniDiv(targetSchedules[i]));
            }

            if (targetSchedules.length > this.maxScheduleRender) {
                const hiddenScheduleDiv = document.createElement("div");
                hiddenScheduleDiv.textContent = `+${targetSchedules.length - this.maxScheduleRender}`;
                infoDiv.appendChild(hiddenScheduleDiv);
            }
            if (targetSchedules.length > this.maxScheduleRender || targetSchedules.some(schedule => schedule.completed == null)) {
                const hoverDiv = document.createElement("div");
                hoverDiv.classList.add("hover-div");
                for (let i = 0; i < targetSchedules.length; i++) {
                    hoverDiv.appendChild(createScheduleMiniDiv(targetSchedules[i], false));
                }
                target.appendChild(hoverDiv)
            }

            dateLabelDiv.innerHTML = `
                <span class="date-label">${d.getDate().toString()}</span>
                <span class="unresolved-schedules">${targetSchedules.filter(e=>e.completed === false && !e.orphaned).length || ""}</span>
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
        this.statusEl.textContent = "일정을 확인하고 있습니다.";
        this.statusEl.classList.remove("update-error");
        const result = await updateSchedules();
        this.statusEl.textContent = [result.result ? "갱신 완료" : "일부 일정 갱신 실패. 확인한 일정은 반영했습니다.", ...result.errors, ...result.warnings].join("\n");
        this.statusEl.classList.toggle("update-error", !result.result);
        await CalendarStorageManager.update();
        await this.render();
    }

    public static async getView() : Promise<HTMLDivElement> {
        if (this.calender) return this.calender.calendarDiv;
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
            <details id="update-details">
                <summary>갱신 안내</summary>
                <p id="update-status" role="status" aria-live="polite">완료 여부 확인 불가 일정은 미완료 개수에서 제외됩니다.</p>
            </details>
        `);

        this.calender = new Calendar(calendarEl);
        try { await this.calender.render(); }
        catch (error) { this.calender.showError(error); }
        if (CheckScheduleUpdateTiming()) (calendarEl.querySelector("#update-btn") as HTMLButtonElement).click();
        return calendarEl;
    }
};
