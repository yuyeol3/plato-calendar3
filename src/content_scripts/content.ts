import Calendar from "./calender";
import Modal from "./modal";
async function main() : Promise<void> {
    const targetEl = document.querySelector(".dashboard-container");
    if (!targetEl || document.getElementById("plato-calendar")) return;

    const detailsEl = document.createElement("details");
    const summaryEl = document.createElement("summary");
    summaryEl.textContent = "Plato Calendar3";
    detailsEl.setAttribute("id", "plato-calendar");
    detailsEl.appendChild(summaryEl);
    targetEl.prepend(detailsEl);
    detailsEl.appendChild(await Modal.getView());
    detailsEl.appendChild(await Calendar.getView());
}

main().catch(error => {
    const target = document.getElementById("plato-calendar");
    if (target) {
        const status = document.createElement("p");
        status.setAttribute("role", "status");
        status.textContent = `캘린더를 불러올 수 없습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`;
        const details = document.createElement("details");
        details.id = "update-details";
        const summary = document.createElement("summary");
        summary.textContent = "갱신 안내";
        details.append(summary, status);
        target.appendChild(details);
    }
});


