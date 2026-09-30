import { ScheduleType } from "../background/updateSchedule";
import { Schedule } from "../background/updateSchedule";
import CalendarStorageManager from "./CalendarStorageManager";
import { applyScheduleState, appendScheduleStatus } from "./calender";

export const ScheduleIcons = {
    [ ScheduleType.HW ] : "https://plato.pusan.ac.kr/theme/image.php/coursemos/assign/1790758578/monologo",
    [ ScheduleType.VID ] : "https://plato.pusan.ac.kr/theme/image.php/coursemos/vod/1790758578/monologo",
    [ ScheduleType.QUIZ ] : "https://plato.pusan.ac.kr/theme/image.php/coursemos/quiz/1790758578/monologo",
    [ ScheduleType.ZOOM ] : "https://plato.pusan.ac.kr/theme/image.php/coursemos/zoom/1790758578/monologo",
    [ ScheduleType.PA ] : null,
};

const ScheduleLabels = {
    [ ScheduleType.HW ] : "과제",
    [ ScheduleType.VID ] : "영상",
    [ ScheduleType.QUIZ ] : "시험",
    [ ScheduleType.ZOOM ] : "Zoom",
    [ ScheduleType.PA ] : "VPL"
}

function createScheduleDiv(data : Schedule) {
    const divEl = document.createElement("div");
    const iconDiv = document.createElement("div");
    iconDiv.id = "icon-div";
    const iconUrl = ScheduleIcons[data.type];
    if (iconUrl) {
        const icon = document.createElement("img");
        icon.src = iconUrl;
        icon.alt = ScheduleLabels[data.type];
        icon.width = 32;
        icon.height = 32;
        icon.onerror = () => { iconDiv.textContent = ScheduleLabels[data.type]; };
        iconDiv.appendChild(icon);
    } else iconDiv.textContent = ScheduleLabels[data.type];
    const content = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = data.name;
    const course = document.createElement("p");
    course.textContent = data.course.name;
    const due = document.createElement("p");
    due.textContent = data.due == null ? "마감 없음" : new Date(data.due.toString()).toLocaleString();
    content.append(title, course, due);
    appendScheduleStatus(content, data);
    if (data.completionBasis === "progress") {
        const label = document.createElement("span");
        label.className = "completion-progress";
        label.textContent = "시청 기준 100%";
        content.appendChild(label);
    }
    divEl.append(iconDiv, content);
    divEl.classList.add("schedule");
    divEl.onclick = ()=> {
        window.open(data.url);
    }

    applyScheduleState(divEl, data);
    return divEl;
}

export default class Modal {
    private static instance : Modal;
    private modalDiv : HTMLDivElement;
    private titleEl : HTMLHeadingElement;
    private contentDiv : HTMLDivElement;
    private constructor(modalDiv : HTMLDivElement) {
        this.modalDiv = modalDiv;
        this.titleEl = modalDiv.querySelector("#title") as HTMLHeadingElement;
        this.contentDiv = modalDiv.querySelector("#content") as HTMLDivElement;

        const closeButton = modalDiv.querySelector(".close-btn") as HTMLButtonElement;
        closeButton.onclick = ()=> {
            this.close();
        }
    }

    async open(date : string) {
        this.contentDiv.innerHTML = "";
        this.titleEl.textContent = new Date(date).toLocaleDateString();
        const schedules = await CalendarStorageManager.getInstance().get(date);

        if (schedules.length === 0 ) return;

        for (const schedule of schedules) {
            const divEl = createScheduleDiv(schedule);
            this.contentDiv.appendChild(divEl);
        }

        this.modalDiv.classList.add("modal-open");
    }

    close() {
        this.modalDiv.classList.remove("modal-open");
    }

    static getInstance() {
        return this.instance;
    }

    static getView() {
        if (!this.instance) { 
            const modalEl = document.createElement("div");
            modalEl.setAttribute('id', "modal");

            modalEl.innerHTML = `
                <div class="custom-modal-backdrop"></div>
                <div class="custom-modal-dialog">
                    <div id="top">
                        <button class="close-btn">×</button>
                    </div>
                    <h2 id="title"></h2>
                    <div id="content"></div>
                </div>
            `; 
            this.instance = new Modal(modalEl);
        };
        return this.instance.modalDiv;
    }
}
