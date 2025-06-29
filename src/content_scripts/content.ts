import Calendar from "./calender";
import { subject } from "../background/updateSchedule";
// import {calendarCss} from "./consts";

interface updateData {
    result : subject[];
};

async function main() : Promise<void> {
    const targetEl = document.querySelector(".front-box.front-box-course");
    if (!targetEl) return;

    // const styleEl = document.createElement("style");
    const detailsEl = document.createElement("details");
    const summaryEl = document.createElement("summary");
    summaryEl.textContent = "Plato Calendar3";
    // styleEl.innerHTML = calendarCss;
    
    detailsEl.appendChild(summaryEl);
    detailsEl.appendChild(Calendar.getView());
    detailsEl.setAttribute("id", "plato-calendar");
    
    // targetEl?.prepend(styleEl);
    targetEl?.prepend(detailsEl);

    // const res : updateData | undefined = await chrome.runtime.sendMessage({
    //     action: "updateData"
    // });

    // console.log(res);

}

main();


