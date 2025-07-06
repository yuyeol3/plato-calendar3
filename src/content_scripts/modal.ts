import { ScheduleType } from "../background/updateSchedule";
import { Schedule } from "../background/updateSchedule";
import CalendarStorageManager from "./CalendarStorageManager";
import { ScheduleStyles } from "./calender";

export const ScheduleIcons = {
    [ ScheduleType.HW ] : "https://plato.pusan.ac.kr/theme/image.php/coursemosv2/assign/1745217358/icon",
    [ ScheduleType.VID ] : "https://plato.pusan.ac.kr/theme/image.php/coursemosv2/vod/1745217358/icon",
    [ ScheduleType.QUIZ ] : "https://plato.pusan.ac.kr/theme/image.php/coursemosv2/quiz/1745217358/icon",
    [ ScheduleType.ZOOM ] : "https://plato.pusan.ac.kr/theme/image.php/coursemosv2/zoom/1745217358/icon",
    [ ScheduleType.PA ] : "https://plato.pusan.ac.kr/theme/image.php/coursemosv2/vpl/1745217358/icon"
}

function createScheduleDiv(data : Schedule) {
    const divEl = document.createElement("div");
    divEl.innerHTML = `
        <div id="icon-div">
            <img src="${ScheduleIcons[data.type]}">
        </div>
        <div>
            <h4>${data.name}</h4>
            <p>${data.course.name}</p>
            <p>${new Date(data.due).toLocaleString()}</p>
        </div>
        
    `
    divEl.classList.add("schedule");
    divEl.onclick = ()=> {
        window.open(data.url);
    }

    if (!data.orphaned && !data.completed) divEl.classList.add(ScheduleStyles[data.type]);
    else if (data.completed) divEl.classList.add("completed")
    else divEl.classList.add("orphaned");
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

    open(date : string) {
        this.contentDiv.innerHTML = "";
        this.titleEl.textContent = new Date(date).toLocaleDateString();
        const schedules = CalendarStorageManager.getInstance().get(date);

        if (schedules.length === 0 ) return;

        console.log(date, schedules);

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