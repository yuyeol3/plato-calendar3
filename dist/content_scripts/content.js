"use strict";
(() => {
  // src/content_scripts/utils.ts
  async function getSchedules() {
    console.log("\uC11C\uBE44\uC2A4 \uC6CC\uCEE4\uC5D0\uAC8C \uC2A4\uCF00\uC904 \uB370\uC774\uD130 \uB85C\uB4DC\uB97C \uC694\uCCAD\uD569\uB2C8\uB2E4...");
    const response = await chrome.runtime.sendMessage({ action: "loadSchedules" });
    console.log("\uC11C\uBE44\uC2A4 \uC6CC\uCEE4\uB85C\uBD80\uD130 \uBC1B\uC740 \uC2A4\uCF00\uC904:", response);
    return response.result;
  }
  var LAST_UPDATE_KEY = "plato-calendar3-lastUpdate";
  async function updateSchedules() {
    localStorage.setItem(LAST_UPDATE_KEY, (/* @__PURE__ */ new Date()).toString());
    const res = await chrome.runtime.sendMessage({
      action: "updateData"
    });
    console.log(res);
  }
  function CheckScheduleUpdateTiming() {
    const now = (/* @__PURE__ */ new Date()).getTime();
    const lastUpdated = new Date(localStorage.getItem(LAST_UPDATE_KEY))?.getTime() ?? 0;
    const HOUR = 1e3 * 3600;
    return now - lastUpdated > HOUR;
  }
  async function getCurrentCourses() {
    const response = await chrome.runtime.sendMessage({ action: "loadCurCourses" });
    return response.result;
  }

  // src/content_scripts/CalendarStorageManager.ts
  var CalendarStorageManager = class _CalendarStorageManager {
    constructor() {
      this.KEY_NAME = "plato-calendar3";
      this.data = {};
      this.updatePromise = _CalendarStorageManager.update();
    }
    // 추가
    set(date, id, data) {
      if (!this.data[date]) this.data[date] = {};
      if (!this.data[date]?.[id]) this.data[date][id] = data;
      else {
        const existingSchedule = this.data[date][id];
        existingSchedule.name = data.name;
        existingSchedule.completed = data.completed;
        existingSchedule.due = data.due;
        existingSchedule.orphaned = data.orphaned;
      }
      _CalendarStorageManager.save(this.data);
    }
    // 조회
    async get(date) {
      await this.updatePromise;
      return Object.values(this.data[date] ?? {});
    }
    // 삭제
    remove(date) {
      delete this.data[date];
      _CalendarStorageManager.save(this.data);
    }
    removeById(date, id) {
      delete this.data[date]?.[id];
      _CalendarStorageManager.save(this.data);
    }
    cleanUp(schedules) {
      const dateStrings = /* @__PURE__ */ new Set();
      for (const schedule of schedules) {
        const d = new Date(schedule.due.toString());
        if (d.toString() === "Invalid Date") continue;
        d.setDate(1);
        dateStrings.add(d.toDateString());
      }
      for (const dateString of dateStrings) {
        const d = new Date(dateString);
        const month = d.getMonth();
        while (d.getMonth() != month) {
          this.remove(d.toDateString());
          d.setDate(d.getDate() + 1);
        }
      }
    }
    static async save(data) {
      await chrome.runtime.sendMessage({
        data,
        action: "calendar/save"
      });
    }
    static async load() {
      const response = await chrome.runtime.sendMessage({
        action: "calendar/load"
      });
      return response.result;
    }
    static async update() {
      const data = await this.load();
      const schedules = await getSchedules();
      const currentCourses = await getCurrentCourses() ?? [];
      this.getInstance().data = data;
      this.getInstance().cleanUp(currentCourses.map((e) => Object.values(schedules[e.id])).flat());
      for (const course of currentCourses) {
        const courseSchedules = Object.values(schedules[course.id]);
        for (const s of courseSchedules) {
          const date = new Date(s.due.toString());
          date.setSeconds(date.getSeconds() - 1);
          this.getInstance().set(
            date.toDateString(),
            s.id,
            s
          );
        }
      }
    }
    static getInstance() {
      if (this.instance == null) {
        this.instance = new _CalendarStorageManager();
      }
      return this.instance;
    }
  };

  // src/content_scripts/modal.ts
  var ScheduleIcons = {
    [0 /* HW */]: "https://plato.pusan.ac.kr/theme/image.php/coursemosv2/assign/1745217358/icon",
    [1 /* VID */]: "https://plato.pusan.ac.kr/theme/image.php/coursemosv2/vod/1745217358/icon",
    [3 /* QUIZ */]: "https://plato.pusan.ac.kr/theme/image.php/coursemosv2/quiz/1745217358/icon",
    [2 /* ZOOM */]: "https://plato.pusan.ac.kr/theme/image.php/coursemosv2/zoom/1745217358/icon",
    [4 /* PA */]: "https://plato.pusan.ac.kr/theme/image.php/coursemosv2/vpl/1745217358/icon"
  };
  function createScheduleDiv(data) {
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
        
    `;
    divEl.classList.add("schedule");
    divEl.onclick = () => {
      window.open(data.url);
    };
    if (!data.orphaned && !data.completed) divEl.classList.add(ScheduleStyles[data.type]);
    else if (data.completed) divEl.classList.add("completed");
    else divEl.classList.add("orphaned");
    return divEl;
  }
  var Modal = class _Modal {
    constructor(modalDiv) {
      this.modalDiv = modalDiv;
      this.titleEl = modalDiv.querySelector("#title");
      this.contentDiv = modalDiv.querySelector("#content");
      const closeButton = modalDiv.querySelector(".close-btn");
      closeButton.onclick = () => {
        this.close();
      };
    }
    async open(date) {
      this.contentDiv.innerHTML = "";
      this.titleEl.textContent = new Date(date).toLocaleDateString();
      const schedules = await CalendarStorageManager.getInstance().get(date);
      if (schedules.length === 0) return;
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
        modalEl.setAttribute("id", "modal");
        modalEl.innerHTML = `
                <div class="custom-modal-backdrop"></div>
                <div class="custom-modal-dialog">
                    <div id="top">
                        <button class="close-btn">\xD7</button>
                    </div>
                    <h2 id="title"></h2>
                    <div id="content"></div>
                </div>
            `;
        this.instance = new _Modal(modalEl);
      }
      ;
      return this.instance.modalDiv;
    }
  };

  // src/content_scripts/calender.ts
  var ScheduleStyles = {
    [0 /* HW */]: "hw",
    [1 /* VID */]: "vid",
    [3 /* QUIZ */]: "quiz",
    [2 /* ZOOM */]: "zoom",
    [4 /* PA */]: "pa"
  };
  function createScheduleMiniDiv(data) {
    const divEl = document.createElement("div");
    divEl.innerHTML = `
        ${data.name}
    `;
    divEl.classList.add("mini-schedule");
    if (!data.orphaned && !data.completed) divEl.classList.add(ScheduleStyles[data.type]);
    else if (data.completed) divEl.classList.add("completed");
    else divEl.classList.add("orphaned");
    return divEl;
  }
  var Calendar = class _Calendar {
    constructor(calendarDiv) {
      this.maxScheduleRender = 2;
      // 굳이 가지고있을 필요 없을수도
      // private prevBtn : HTMLButtonElement;
      // private nextBtn : HTMLButtonElement;
      this.schedules = {};
      this.date = /* @__PURE__ */ new Date();
      this.date.setDate(1);
      this.dateCells = Array.from(calendarDiv.querySelectorAll("tbody td"));
      this.monthLabel = calendarDiv.querySelector("#month-label");
      const prevBtn = calendarDiv.querySelector("#prev-btn");
      const nextBtn = calendarDiv.querySelector("#next-btn");
      const updateBtn = calendarDiv.querySelector("#update-btn");
      this.updateMonthLabel();
      prevBtn.onclick = () => {
        this.toPrevMonth();
        this.render();
      };
      nextBtn.onclick = () => {
        this.toNextMonth();
        this.render();
      };
      updateBtn.onclick = async () => {
        updateBtn.textContent = "\uC5C5\uB370\uC774\uD2B8 \uC911";
        updateBtn.classList.add("updating");
        updateBtn.disabled = true;
        await this.updateSchedules();
        updateBtn.textContent = "\uC5C5\uB370\uC774\uD2B8";
        updateBtn.classList.remove("updating");
        updateBtn.disabled = false;
      };
      if (CheckScheduleUpdateTiming()) updateBtn.click();
    }
    async render() {
      this.clearCells();
      const d = new Date(this.date);
      const month = d.getMonth();
      const day = d.getDay();
      const today = (/* @__PURE__ */ new Date()).toDateString();
      while (d.getMonth() == month) {
        const target = this.dateCells[d.getDate() - 1 + day];
        const dateLabelDiv = document.createElement("div");
        const infoDiv = document.createElement("div");
        dateLabelDiv.classList.add("date-label-div");
        infoDiv.classList.add("info-div");
        if (d.toDateString() == today) dateLabelDiv.classList.add("today");
        const targetSchedules = await CalendarStorageManager.getInstance().get(d.toDateString());
        for (let i = 0; i < Math.min(targetSchedules.length, this.maxScheduleRender); i++) {
          infoDiv.appendChild(createScheduleMiniDiv(targetSchedules[i]));
        }
        dateLabelDiv.innerHTML = `
                <span class="date-label">${d.getDate().toString()}</span>
                <span class="unresolved-schedules">${targetSchedules.filter((e) => !e.completed && !e.orphaned).length || ""}</span>
            `;
        const hoverDiv = document.createElement("div");
        if (targetSchedules.length > this.maxScheduleRender) {
          const hiddenScheduleDiv = document.createElement("div");
          hiddenScheduleDiv.textContent = `+${targetSchedules.length - this.maxScheduleRender}`;
          infoDiv.appendChild(hiddenScheduleDiv);
          hoverDiv.classList.add("hover-div");
          for (let i = 0; i < targetSchedules.length; i++) {
            hoverDiv.appendChild(createScheduleMiniDiv(targetSchedules[i]));
          }
          target.appendChild(hoverDiv);
        }
        target.appendChild(dateLabelDiv);
        target.appendChild(infoDiv);
        const curD = new Date(d.toString());
        target.onclick = () => {
          Modal.getInstance().open(curD.toDateString());
        };
        d.setDate(d.getDate() + 1);
      }
    }
    toPrevMonth() {
      this.date.setMonth(this.date.getMonth() - 1);
      this.date.setDate(1);
      this.updateMonthLabel();
    }
    toNextMonth() {
      this.date.setMonth(this.date.getMonth() + 1);
      this.date.setDate(1);
      this.updateMonthLabel();
    }
    clearCells() {
      for (const cell of this.dateCells) {
        cell.textContent = "";
      }
    }
    updateMonthLabel() {
      this.monthLabel.textContent = `${this.date.getFullYear()}\uB144 ${this.date.getMonth() + 1}\uC6D4`;
    }
    async updateSchedules() {
      await updateSchedules();
      await CalendarStorageManager.update();
      await this.render();
    }
    static getView() {
      const calendarEl = document.createElement("div");
      calendarEl.innerHTML = `
            <div id="control">
                <div id="info">
                    <button id="prev-btn">&lt;</button>
                    <span id="month-label"></span>
                    <button id="next-btn">&gt;</button>
                </div>
                <button id="update-btn">\uC5C5\uB370\uC774\uD2B8</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>\uC77C</th>
                        <th>\uC6D4</th>
                        <th>\uD654</th>
                        <th>\uC218</th>
                        <th>\uBAA9</th>
                        <th>\uAE08</th>
                        <th>\uD1A0</th>
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
        `;
      if (!this.calender)
        this.calender = new _Calendar(calendarEl);
      this.calender.render();
      return calendarEl;
    }
  };

  // src/content_scripts/content.ts
  async function main() {
    const targetEl = document.querySelector(".front-box.front-box-course");
    if (!targetEl) return;
    const detailsEl = document.createElement("details");
    const summaryEl = document.createElement("summary");
    summaryEl.textContent = "Plato Calendar3";
    detailsEl.appendChild(summaryEl);
    detailsEl.appendChild(await Modal.getView());
    detailsEl.appendChild(await Calendar.getView());
    detailsEl.setAttribute("id", "plato-calendar");
    targetEl?.prepend(detailsEl);
  }
  main();
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy91dGlscy50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL0NhbGVuZGFyU3RvcmFnZU1hbmFnZXIudHMiLCAiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy9tb2RhbC50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL2NhbGVuZGVyLnRzIiwgIi4uLy4uL3NyYy9jb250ZW50X3NjcmlwdHMvY29udGVudC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgQWxsU2NoZWR1bGVzIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvc2NoZWR1bGVTdG9yYWdlTWFuYWdlclwiO1xyXG5pbXBvcnQgeyBTdWJqZWN0IH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTY2hlZHVsZXMoKSA6IFByb21pc2U8QWxsU2NoZWR1bGVzPiB7XHJcbiAgICBjb25zb2xlLmxvZyhcIlx1QzExQ1x1QkU0NFx1QzJBNCBcdUM2Q0NcdUNFRTRcdUM1RDBcdUFDOEMgXHVDMkE0XHVDRjAwXHVDOTA0IFx1QjM3MFx1Qzc3NFx1RDEzMCBcdUI4NUNcdUI0RENcdUI5N0MgXHVDNjk0XHVDQ0FEXHVENTY5XHVCMkM4XHVCMkU0Li4uXCIpO1xyXG5cclxuICAgIC8vIDEuICdsb2FkU2NoZWR1bGVzJ1x1Qjc3Q1x1QjI5NCBhY3Rpb25cdUM3NDQgXHVCMkY0XHVDNTQ0IFx1QkE1NFx1QzJEQ1x1QzlDMCBcdUM4MDRcdUMxQTFcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyBhY3Rpb246IFwibG9hZFNjaGVkdWxlc1wiIH0pO1xyXG5cclxuICAgIC8vIDQuIFx1QzExQ1x1QkU0NFx1QzJBNCBcdUM2Q0NcdUNFRTRcdUI4NUNcdUJEODBcdUQxMzAgXHVCQzFCXHVDNzQwIFx1QUNCMFx1QUNGQ1xyXG4gICAgY29uc29sZS5sb2coXCJcdUMxMUNcdUJFNDRcdUMyQTQgXHVDNkNDXHVDRUU0XHVCODVDXHVCRDgwXHVEMTMwIFx1QkMxQlx1Qzc0MCBcdUMyQTRcdUNGMDBcdUM5MDQ6XCIsIHJlc3BvbnNlKTtcclxuICAgIFxyXG4gICAgLy8gXHVDNzc0IFx1QjM3MFx1Qzc3NFx1RDEzMFx1Qjk3QyBcdUMwQUNcdUM2QTlcdUQ1NThcdUM1RUMgXHVEMzk4XHVDNzc0XHVDOUMwXHVDNzU4IERPTVx1Qzc0NCBcdUM4NzBcdUM3OTFcdUQ1NjAgXHVDMjE4IFx1Qzc4OFx1QzJCNVx1QjJDOFx1QjJFNC5cclxuICAgIHJldHVybiByZXNwb25zZS5yZXN1bHQ7XHJcbn1cclxuXHJcbmNvbnN0IExBU1RfVVBEQVRFX0tFWSA9IFwicGxhdG8tY2FsZW5kYXIzLWxhc3RVcGRhdGVcIlxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVNjaGVkdWxlcygpIHtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKExBU1RfVVBEQVRFX0tFWSwgbmV3IERhdGUoKS50b1N0cmluZygpKTtcclxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcclxuICAgICAgICBhY3Rpb246IFwidXBkYXRlRGF0YVwiXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhyZXMpO1xyXG59XHJcblxyXG5leHBvcnQgIGZ1bmN0aW9uIENoZWNrU2NoZWR1bGVVcGRhdGVUaW1pbmcoKSB7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICAgIGNvbnN0IGxhc3RVcGRhdGVkID0gbmV3IERhdGUobG9jYWxTdG9yYWdlLmdldEl0ZW0oTEFTVF9VUERBVEVfS0VZKSBhcyBzdHJpbmcpPy5nZXRUaW1lKCkgPz8gMDtcclxuXHJcbiAgICBjb25zdCBIT1VSID0gMTAwMCAqIDM2MDA7XHJcbiAgICByZXR1cm4gKG5vdy1sYXN0VXBkYXRlZCA+IEhPVVIpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q3VycmVudENvdXJzZXMoKSA6IFByb21pc2U8U3ViamVjdFtdPiB7XHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHsgYWN0aW9uOiBcImxvYWRDdXJDb3Vyc2VzXCIgfSk7ICAgIFxyXG4gICAgcmV0dXJuIHJlc3BvbnNlLnJlc3VsdDtcclxufSIsICJpbXBvcnQgeyBTY2hlZHVsZSB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcbmltcG9ydCB7IGdldEN1cnJlbnRDb3Vyc2VzLCBnZXRTY2hlZHVsZXMgfSBmcm9tIFwiLi91dGlsc1wiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDYWxlbmRhclN0b3JhZ2Uge1xyXG4gICAgW2RhdGU6IHN0cmluZ106IHtcclxuICAgICAgICBbc2NoZWR1bGVJZDogc3RyaW5nXTogU2NoZWR1bGU7XHJcbiAgICB9O1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyIHtcclxuICAgIHByaXZhdGUgc3RhdGljIGluc3RhbmNlIDogQ2FsZW5kYXJTdG9yYWdlTWFuYWdlcjtcclxuICAgIHByaXZhdGUgS0VZX05BTUUgOiBzdHJpbmc7XHJcbiAgICBwcml2YXRlIGRhdGEgOiBDYWxlbmRhclN0b3JhZ2U7XHJcbiAgICBwcml2YXRlIHVwZGF0ZVByb21pc2UgOiBQcm9taXNlPHZvaWQ+O1xyXG4gICAgcHJpdmF0ZSBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLktFWV9OQU1FID0gXCJwbGF0by1jYWxlbmRhcjNcIjtcclxuICAgICAgICAvLyBjb25zdCBzdG9yYWdlU3RyID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0odGhpcy5LRVlfTkFNRSk7XHJcbiAgICAgICAgdGhpcy5kYXRhID0ge307XHJcbiAgICAgICAgdGhpcy51cGRhdGVQcm9taXNlID0gQ2FsZW5kYXJTdG9yYWdlTWFuYWdlci51cGRhdGUoKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBcdUNEOTRcdUFDMDBcclxuICAgIHNldChkYXRlIDogc3RyaW5nLCBpZCA6IHN0cmluZywgZGF0YSA6IFNjaGVkdWxlKSB7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJpbnNpZGUgc2V0OlwiLCBkYXRlLCBpZCwgZGF0YSk7XHJcbiAgICAgICAgaWYgKCF0aGlzLmRhdGFbZGF0ZV0pIHRoaXMuZGF0YVtkYXRlXSA9IHt9O1xyXG4gICAgICAgIGlmICghdGhpcy5kYXRhW2RhdGVdPy5baWRdKSB0aGlzLmRhdGFbZGF0ZV1baWRdID0gZGF0YTtcclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdTY2hlZHVsZSA9IHRoaXMuZGF0YVtkYXRlXVtpZF07XHJcblxyXG4gICAgICAgICAgICBleGlzdGluZ1NjaGVkdWxlLm5hbWUgPSBkYXRhLm5hbWU7XHJcbiAgICAgICAgICAgIGV4aXN0aW5nU2NoZWR1bGUuY29tcGxldGVkID0gZGF0YS5jb21wbGV0ZWQ7XHJcbiAgICAgICAgICAgIGV4aXN0aW5nU2NoZWR1bGUuZHVlID0gZGF0YS5kdWU7XHJcbiAgICAgICAgICAgIGV4aXN0aW5nU2NoZWR1bGUub3JwaGFuZWQgPSBkYXRhLm9ycGhhbmVkO1xyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMuS0VZX05BTUUsIEpTT04uc3RyaW5naWZ5KHRoaXMuZGF0YSkpO1xyXG4gICAgICAgIENhbGVuZGFyU3RvcmFnZU1hbmFnZXIuc2F2ZSh0aGlzLmRhdGEpO1xyXG4gICAgfSAgIFxyXG5cclxuICAgIC8vIFx1Qzg3MFx1RDY4Q1xyXG4gICAgYXN5bmMgZ2V0KGRhdGUgOiBzdHJpbmcpIHtcclxuICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb21pc2U7XHJcbiAgICAgICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5kYXRhW2RhdGVdID8/IHt9KTtcclxuICAgIH1cclxuICAgIC8vIFx1QzBBRFx1QzgxQ1xyXG4gICAgcmVtb3ZlKGRhdGUgOiBzdHJpbmcpIHtcclxuICAgICAgICBkZWxldGUgdGhpcy5kYXRhW2RhdGVdO1xyXG4gICAgICAgIC8vIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMuS0VZX05BTUUsIEpTT04uc3RyaW5naWZ5KHRoaXMuZGF0YSkpO1xyXG4gICAgICAgIENhbGVuZGFyU3RvcmFnZU1hbmFnZXIuc2F2ZSh0aGlzLmRhdGEpO1xyXG4gICAgfVxyXG5cclxuICAgIHJlbW92ZUJ5SWQoZGF0ZSA6IHN0cmluZywgaWQgOiBzdHJpbmcpIHtcclxuICAgICAgICBkZWxldGUgdGhpcy5kYXRhW2RhdGVdPy5baWRdO1xyXG4gICAgICAgIENhbGVuZGFyU3RvcmFnZU1hbmFnZXIuc2F2ZSh0aGlzLmRhdGEpO1xyXG4gICAgfVxyXG4gXHJcbiAgICBjbGVhblVwKHNjaGVkdWxlcyA6IFNjaGVkdWxlW10pIHtcclxuICAgICAgICBjb25zdCBkYXRlU3RyaW5ncyA6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IHNjaGVkdWxlIG9mIHNjaGVkdWxlcykge1xyXG4gICAgICAgICAgICBjb25zdCBkID0gbmV3IERhdGUoc2NoZWR1bGUuZHVlLnRvU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICBpZiAoZC50b1N0cmluZygpID09PSBcIkludmFsaWQgRGF0ZVwiKSBjb250aW51ZTtcclxuICAgICAgICAgICAgZC5zZXREYXRlKDEpO1xyXG4gICAgICAgICAgICBkYXRlU3RyaW5ncy5hZGQoZC50b0RhdGVTdHJpbmcoKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IGRhdGVTdHJpbmcgb2YgZGF0ZVN0cmluZ3MpIHtcclxuICAgICAgICAgICAgY29uc3QgZCA9IG5ldyBEYXRlKGRhdGVTdHJpbmcpO1xyXG4gICAgICAgICAgICBjb25zdCBtb250aCA9IGQuZ2V0TW9udGgoKTtcclxuXHJcbiAgICAgICAgICAgIHdoaWxlIChkLmdldE1vbnRoKCkgIT0gbW9udGgpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlKGQudG9EYXRlU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICAgICAgZC5zZXREYXRlKGQuZ2V0RGF0ZSgpICsgMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBhc3luYyBzYXZlKGRhdGEgOiBDYWxlbmRhclN0b3JhZ2UpIHtcclxuICAgICAgICBhd2FpdCBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XHJcbiAgICAgICAgICAgIGRhdGEgOiBkYXRhLFxyXG4gICAgICAgICAgICBhY3Rpb24gOiBcImNhbGVuZGFyL3NhdmVcIlxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGFzeW5jIGxvYWQoKSA6IFByb21pc2U8Q2FsZW5kYXJTdG9yYWdlPiB7XHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XHJcbiAgICAgICAgICAgIGFjdGlvbiA6IFwiY2FsZW5kYXIvbG9hZFwiXHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlLnJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgYXN5bmMgdXBkYXRlKCkge1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmxvYWQoKTtcclxuICAgICAgICBjb25zdCBzY2hlZHVsZXMgPSBhd2FpdCBnZXRTY2hlZHVsZXMoKTtcclxuICAgICAgICBjb25zdCBjdXJyZW50Q291cnNlcyA9IGF3YWl0IGdldEN1cnJlbnRDb3Vyc2VzKCkgPz8gW107XHJcblxyXG4gICAgICAgIHRoaXMuZ2V0SW5zdGFuY2UoKS5kYXRhID0gZGF0YTtcclxuICAgICAgICB0aGlzLmdldEluc3RhbmNlKCkuY2xlYW5VcChjdXJyZW50Q291cnNlcy5tYXAoZT0+T2JqZWN0LnZhbHVlcyhzY2hlZHVsZXNbZS5pZF0pKS5mbGF0KCkpO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiY2xlYW51cCB0YXJnZXQ6IFwiLCBjdXJyZW50Q291cnNlcy5tYXAoZT0+T2JqZWN0LnZhbHVlcyhzY2hlZHVsZXNbZS5pZF0pKS5mbGF0KCkpO1xyXG4gICAgICAgIGZvciAoY29uc3QgY291cnNlIG9mIGN1cnJlbnRDb3Vyc2VzKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvdXJzZVNjaGVkdWxlcyA9IE9iamVjdC52YWx1ZXMoc2NoZWR1bGVzW2NvdXJzZS5pZF0pO1xyXG5cclxuICAgICAgICAgICAgZm9yIChjb25zdCBzIG9mIGNvdXJzZVNjaGVkdWxlcykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKHMuZHVlLnRvU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICAgICAgZGF0ZS5zZXRTZWNvbmRzKGRhdGUuZ2V0U2Vjb25kcygpIC0gMSk7IC8vIFx1Qzc5MFx1QzgxNVx1Qzc3OCBcdUFDQkRcdUM2QjAgXHVENTU4XHVCOEU4IFx1QzgwNFx1QzczQ1x1Qjg1QyBcdUMxMjRcdUM4MTVcdUQ1NThcdUFFMzBcclxuICAgICAgICAgICAgICAgIHRoaXMuZ2V0SW5zdGFuY2UoKS5zZXQoXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0ZS50b0RhdGVTdHJpbmcoKSwgXHJcbiAgICAgICAgICAgICAgICAgICAgcy5pZCwgc1xyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgZ2V0SW5zdGFuY2UoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaW5zdGFuY2UgPT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aGlzLmluc3RhbmNlID0gbmV3IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNlO1xyXG4gICAgfVxyXG59IiwgImltcG9ydCB7IFNjaGVkdWxlVHlwZSB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcbmltcG9ydCB7IFNjaGVkdWxlIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcclxuaW1wb3J0IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIgZnJvbSBcIi4vQ2FsZW5kYXJTdG9yYWdlTWFuYWdlclwiO1xyXG5pbXBvcnQgeyBTY2hlZHVsZVN0eWxlcyB9IGZyb20gXCIuL2NhbGVuZGVyXCI7XHJcblxyXG5leHBvcnQgY29uc3QgU2NoZWR1bGVJY29ucyA9IHtcclxuICAgIFsgU2NoZWR1bGVUeXBlLkhXIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vc3YyL2Fzc2lnbi8xNzQ1MjE3MzU4L2ljb25cIixcclxuICAgIFsgU2NoZWR1bGVUeXBlLlZJRCBdIDogXCJodHRwczovL3BsYXRvLnB1c2FuLmFjLmtyL3RoZW1lL2ltYWdlLnBocC9jb3Vyc2Vtb3N2Mi92b2QvMTc0NTIxNzM1OC9pY29uXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5RVUlaIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vc3YyL3F1aXovMTc0NTIxNzM1OC9pY29uXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5aT09NIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vc3YyL3pvb20vMTc0NTIxNzM1OC9pY29uXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5QQSBdIDogXCJodHRwczovL3BsYXRvLnB1c2FuLmFjLmtyL3RoZW1lL2ltYWdlLnBocC9jb3Vyc2Vtb3N2Mi92cGwvMTc0NTIxNzM1OC9pY29uXCJcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlU2NoZWR1bGVEaXYoZGF0YSA6IFNjaGVkdWxlKSB7XHJcbiAgICBjb25zdCBkaXZFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICBkaXZFbC5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgPGRpdiBpZD1cImljb24tZGl2XCI+XHJcbiAgICAgICAgICAgIDxpbWcgc3JjPVwiJHtTY2hlZHVsZUljb25zW2RhdGEudHlwZV19XCI+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgPGg0PiR7ZGF0YS5uYW1lfTwvaDQ+XHJcbiAgICAgICAgICAgIDxwPiR7ZGF0YS5jb3Vyc2UubmFtZX08L3A+XHJcbiAgICAgICAgICAgIDxwPiR7bmV3IERhdGUoZGF0YS5kdWUpLnRvTG9jYWxlU3RyaW5nKCl9PC9wPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIFxyXG4gICAgYFxyXG4gICAgZGl2RWwuY2xhc3NMaXN0LmFkZChcInNjaGVkdWxlXCIpO1xyXG4gICAgZGl2RWwub25jbGljayA9ICgpPT4ge1xyXG4gICAgICAgIHdpbmRvdy5vcGVuKGRhdGEudXJsKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWRhdGEub3JwaGFuZWQgJiYgIWRhdGEuY29tcGxldGVkKSBkaXZFbC5jbGFzc0xpc3QuYWRkKFNjaGVkdWxlU3R5bGVzW2RhdGEudHlwZV0pO1xyXG4gICAgZWxzZSBpZiAoZGF0YS5jb21wbGV0ZWQpIGRpdkVsLmNsYXNzTGlzdC5hZGQoXCJjb21wbGV0ZWRcIilcclxuICAgIGVsc2UgZGl2RWwuY2xhc3NMaXN0LmFkZChcIm9ycGhhbmVkXCIpO1xyXG4gICAgcmV0dXJuIGRpdkVsO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNb2RhbCB7XHJcbiAgICBwcml2YXRlIHN0YXRpYyBpbnN0YW5jZSA6IE1vZGFsO1xyXG4gICAgcHJpdmF0ZSBtb2RhbERpdiA6IEhUTUxEaXZFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSB0aXRsZUVsIDogSFRNTEhlYWRpbmdFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSBjb250ZW50RGl2IDogSFRNTERpdkVsZW1lbnQ7XHJcbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKG1vZGFsRGl2IDogSFRNTERpdkVsZW1lbnQpIHtcclxuICAgICAgICB0aGlzLm1vZGFsRGl2ID0gbW9kYWxEaXY7XHJcbiAgICAgICAgdGhpcy50aXRsZUVsID0gbW9kYWxEaXYucXVlcnlTZWxlY3RvcihcIiN0aXRsZVwiKSBhcyBIVE1MSGVhZGluZ0VsZW1lbnQ7XHJcbiAgICAgICAgdGhpcy5jb250ZW50RGl2ID0gbW9kYWxEaXYucXVlcnlTZWxlY3RvcihcIiNjb250ZW50XCIpIGFzIEhUTUxEaXZFbGVtZW50O1xyXG5cclxuICAgICAgICBjb25zdCBjbG9zZUJ1dHRvbiA9IG1vZGFsRGl2LnF1ZXJ5U2VsZWN0b3IoXCIuY2xvc2UtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgIGNsb3NlQnV0dG9uLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBvcGVuKGRhdGUgOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLmNvbnRlbnREaXYuaW5uZXJIVE1MID0gXCJcIjtcclxuICAgICAgICB0aGlzLnRpdGxlRWwudGV4dENvbnRlbnQgPSBuZXcgRGF0ZShkYXRlKS50b0xvY2FsZURhdGVTdHJpbmcoKTtcclxuICAgICAgICBjb25zdCBzY2hlZHVsZXMgPSBhd2FpdCBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLmdldEluc3RhbmNlKCkuZ2V0KGRhdGUpO1xyXG5cclxuICAgICAgICBpZiAoc2NoZWR1bGVzLmxlbmd0aCA9PT0gMCApIHJldHVybjtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coZGF0ZSwgc2NoZWR1bGVzKTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBzY2hlZHVsZSBvZiBzY2hlZHVsZXMpIHtcclxuICAgICAgICAgICAgY29uc3QgZGl2RWwgPSBjcmVhdGVTY2hlZHVsZURpdihzY2hlZHVsZSk7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudERpdi5hcHBlbmRDaGlsZChkaXZFbCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm1vZGFsRGl2LmNsYXNzTGlzdC5hZGQoXCJtb2RhbC1vcGVuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGNsb3NlKCkge1xyXG4gICAgICAgIHRoaXMubW9kYWxEaXYuY2xhc3NMaXN0LnJlbW92ZShcIm1vZGFsLW9wZW5cIik7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGdldEluc3RhbmNlKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNlO1xyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBnZXRWaWV3KCkge1xyXG4gICAgICAgIGlmICghdGhpcy5pbnN0YW5jZSkgeyBcclxuICAgICAgICAgICAgY29uc3QgbW9kYWxFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgICAgIG1vZGFsRWwuc2V0QXR0cmlidXRlKCdpZCcsIFwibW9kYWxcIik7XHJcblxyXG4gICAgICAgICAgICBtb2RhbEVsLmlubmVySFRNTCA9IGBcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdXN0b20tbW9kYWwtYmFja2Ryb3BcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdXN0b20tbW9kYWwtZGlhbG9nXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBpZD1cInRvcFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiY2xvc2UtYnRuXCI+XHUwMEQ3PC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGgyIGlkPVwidGl0bGVcIj48L2gyPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgaWQ9XCJjb250ZW50XCI+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgYDsgXHJcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2UgPSBuZXcgTW9kYWwobW9kYWxFbCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICByZXR1cm4gdGhpcy5pbnN0YW5jZS5tb2RhbERpdjtcclxuICAgIH1cclxufSIsICJpbXBvcnQgeyBBbGxTY2hlZHVsZXMgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC9zY2hlZHVsZVN0b3JhZ2VNYW5hZ2VyXCI7XHJcbmltcG9ydCB7IFNjaGVkdWxlLCBTY2hlZHVsZVR5cGUgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC91cGRhdGVTY2hlZHVsZVwiO1xyXG5pbXBvcnQgQ2FsZW5kYXJTdG9yYWdlTWFuYWdlciBmcm9tIFwiLi9DYWxlbmRhclN0b3JhZ2VNYW5hZ2VyXCI7XHJcbmltcG9ydCBNb2RhbCBmcm9tIFwiLi9tb2RhbFwiO1xyXG5pbXBvcnQgeyBDaGVja1NjaGVkdWxlVXBkYXRlVGltaW5nLCBnZXRDdXJyZW50Q291cnNlcywgZ2V0U2NoZWR1bGVzLCB1cGRhdGVTY2hlZHVsZXMgfSBmcm9tIFwiLi91dGlsc1wiO1xyXG5cclxuXHJcbmV4cG9ydCBjb25zdCBTY2hlZHVsZVN0eWxlcyA9IHtcclxuICAgIFsgU2NoZWR1bGVUeXBlLkhXIF0gOiBcImh3XCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5WSUQgXSA6IFwidmlkXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5RVUlaIF0gOiBcInF1aXpcIixcclxuICAgIFsgU2NoZWR1bGVUeXBlLlpPT00gXSA6IFwiem9vbVwiLFxyXG4gICAgWyBTY2hlZHVsZVR5cGUuUEEgXSA6IFwicGFcIlxyXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVTY2hlZHVsZU1pbmlEaXYoZGF0YSA6IFNjaGVkdWxlKSB7XHJcbiAgICBjb25zdCBkaXZFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICBkaXZFbC5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgJHtkYXRhLm5hbWV9XHJcbiAgICBgXHJcbiAgICBkaXZFbC5jbGFzc0xpc3QuYWRkKFwibWluaS1zY2hlZHVsZVwiKTtcclxuICAgIGlmICghZGF0YS5vcnBoYW5lZCAmJiAhZGF0YS5jb21wbGV0ZWQpIGRpdkVsLmNsYXNzTGlzdC5hZGQoU2NoZWR1bGVTdHlsZXNbZGF0YS50eXBlXSk7XHJcbiAgICBlbHNlIGlmIChkYXRhLmNvbXBsZXRlZCkgZGl2RWwuY2xhc3NMaXN0LmFkZChcImNvbXBsZXRlZFwiKVxyXG4gICAgZWxzZSBkaXZFbC5jbGFzc0xpc3QuYWRkKFwib3JwaGFuZWRcIik7XHJcbiAgICByZXR1cm4gZGl2RWw7XHJcbn1cclxuXHJcbi8vIHNpbmdsZXRvblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDYWxlbmRhciB7XHJcbiAgICBwcml2YXRlIHN0YXRpYyBjYWxlbmRlciA6IENhbGVuZGFyO1xyXG4gICAgcHJpdmF0ZSBkYXRlIDogRGF0ZTtcclxuICAgIHByaXZhdGUgZGF0ZUNlbGxzIDogSFRNTFRhYmxlQ2VsbEVsZW1lbnRbXTtcclxuICAgIHByaXZhdGUgbW9udGhMYWJlbCA6IEhUTUxTcGFuRWxlbWVudDtcclxuICAgIHByaXZhdGUgbWF4U2NoZWR1bGVSZW5kZXIgPSAyO1xyXG4gICAgLy8gXHVBRDczXHVDNzc0IFx1QUMwMFx1QzlDMFx1QUNFMFx1Qzc4OFx1Qzc0NCBcdUQ1NDRcdUM2OTQgXHVDNUM2XHVDNzQ0XHVDMjE4XHVCM0M0XHJcbiAgICAvLyBwcml2YXRlIHByZXZCdG4gOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgIC8vIHByaXZhdGUgbmV4dEJ0biA6IEhUTUxCdXR0b25FbGVtZW50O1xyXG5cclxuICAgIHByaXZhdGUgc2NoZWR1bGVzIDogQWxsU2NoZWR1bGVzID0ge307XHJcblxyXG4gICAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihjYWxlbmRhckRpdiA6IEhUTUxEaXZFbGVtZW50KSB7XHJcbiAgICAgICAgdGhpcy5kYXRlID0gbmV3IERhdGUoKTtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0RGF0ZSgxKTsgIC8vIDFcdUM3N0NcdUI4NUMgXHVCOURFXHVDREIwXHVDOEZDXHVBRTMwXHJcblxyXG4gICAgICAgIHRoaXMuZGF0ZUNlbGxzID0gQXJyYXkuZnJvbShjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yQWxsKFwidGJvZHkgdGRcIikpO1xyXG4gICAgICAgIHRoaXMubW9udGhMYWJlbCA9IGNhbGVuZGFyRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjbW9udGgtbGFiZWxcIikgYXMgSFRNTFNwYW5FbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IHByZXZCdG4gPSBjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yKFwiI3ByZXYtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IG5leHRCdG4gPSBjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yKFwiI25leHQtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IHVwZGF0ZUJ0biA9IGNhbGVuZGFyRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjdXBkYXRlLWJ0blwiKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcclxuXHJcbiAgICAgICAgdGhpcy51cGRhdGVNb250aExhYmVsKCk7XHJcblxyXG4gICAgICAgIHByZXZCdG4ub25jbGljayA9ICgpPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnRvUHJldk1vbnRoKCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBuZXh0QnRuLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy50b05leHRNb250aCgpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbmRlcigpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdXBkYXRlQnRuLm9uY2xpY2sgPSBhc3luYyAoKT0+e1xyXG4gICAgICAgICAgICB1cGRhdGVCdG4udGV4dENvbnRlbnQgPSBcIlx1QzVDNVx1QjM3MFx1Qzc3NFx1RDJCOCBcdUM5MTFcIlxyXG4gICAgICAgICAgICB1cGRhdGVCdG4uY2xhc3NMaXN0LmFkZChcInVwZGF0aW5nXCIpO1xyXG4gICAgICAgICAgICB1cGRhdGVCdG4uZGlzYWJsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVNjaGVkdWxlcygpO1xyXG4gICAgICAgICAgICB1cGRhdGVCdG4udGV4dENvbnRlbnQgPSBcIlx1QzVDNVx1QjM3MFx1Qzc3NFx1RDJCOFwiXHJcbiAgICAgICAgICAgIHVwZGF0ZUJ0bi5jbGFzc0xpc3QucmVtb3ZlKFwidXBkYXRpbmdcIik7XHJcbiAgICAgICAgICAgIHVwZGF0ZUJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmIChDaGVja1NjaGVkdWxlVXBkYXRlVGltaW5nKCkpIHVwZGF0ZUJ0bi5jbGljaygpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcmVuZGVyKCkge1xyXG4gICAgICAgIHRoaXMuY2xlYXJDZWxscygpO1xyXG4gICAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZSh0aGlzLmRhdGUpO1xyXG4gICAgICAgIGNvbnN0IG1vbnRoID0gZC5nZXRNb250aCgpO1xyXG4gICAgICAgIGNvbnN0IGRheSA9IGQuZ2V0RGF5KCk7XHJcblxyXG4gICAgICAgIC8vIGF3YWl0IHRoaXMuZ2V0U2NoZWR1bGVzKCk7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2codGhpcy5zY2hlZHVsZXMpO1xyXG4gICAgICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKS50b0RhdGVTdHJpbmcoKTtcclxuICAgICAgICB3aGlsZSAoZC5nZXRNb250aCgpID09IG1vbnRoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuZGF0ZUNlbGxzW2QuZ2V0RGF0ZSgpIC0gMSArIGRheV07XHJcblxyXG4gICAgICAgICAgICBjb25zdCBkYXRlTGFiZWxEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgICAgICAgICBjb25zdCBpbmZvRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHJcbiAgICAgICAgICAgIGRhdGVMYWJlbERpdi5jbGFzc0xpc3QuYWRkKFwiZGF0ZS1sYWJlbC1kaXZcIik7XHJcbiAgICAgICAgICAgIGluZm9EaXYuY2xhc3NMaXN0LmFkZChcImluZm8tZGl2XCIpO1xyXG5cclxuICAgICAgICAgICAgaWYgKGQudG9EYXRlU3RyaW5nKCkgPT0gdG9kYXkpIGRhdGVMYWJlbERpdi5jbGFzc0xpc3QuYWRkKFwidG9kYXlcIik7XHJcblxyXG5cclxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0U2NoZWR1bGVzID0gKGF3YWl0IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIuZ2V0SW5zdGFuY2UoKS5nZXQoZC50b0RhdGVTdHJpbmcoKSkpO1xyXG4gICAgICAgICAgICAvLyBmb3IgKGxldCBpID0gMDsgaSA8IHRhcmdldFNjaGVkdWxlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAvLyAgICAgY29uc3QgdGFyZ2V0U2NoZWR1bGUgPSB0YXJnZXRTY2hlZHVsZXNbaV07XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gfVxyXG5cclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1pbih0YXJnZXRTY2hlZHVsZXMubGVuZ3RoLCB0aGlzLm1heFNjaGVkdWxlUmVuZGVyKTsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpbmZvRGl2LmFwcGVuZENoaWxkKGNyZWF0ZVNjaGVkdWxlTWluaURpdih0YXJnZXRTY2hlZHVsZXNbaV0pKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZGF0ZUxhYmVsRGl2LmlubmVySFRNTCA9IGBcclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZGF0ZS1sYWJlbFwiPiR7ZC5nZXREYXRlKCkudG9TdHJpbmcoKX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInVucmVzb2x2ZWQtc2NoZWR1bGVzXCI+JHt0YXJnZXRTY2hlZHVsZXMuZmlsdGVyKGU9PiFlLmNvbXBsZXRlZCAmJiAhZS5vcnBoYW5lZCkubGVuZ3RoIHx8IFwiXCJ9PC9zcGFuPlxyXG4gICAgICAgICAgICBgXHJcblxyXG4gICAgICAgICAgICBjb25zdCBob3ZlckRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgICAgIGlmICh0YXJnZXRTY2hlZHVsZXMubGVuZ3RoID4gdGhpcy5tYXhTY2hlZHVsZVJlbmRlcikge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaGlkZGVuU2NoZWR1bGVEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgICAgICAgICAgICAgaGlkZGVuU2NoZWR1bGVEaXYudGV4dENvbnRlbnQgPSBgKyR7dGFyZ2V0U2NoZWR1bGVzLmxlbmd0aCAtIHRoaXMubWF4U2NoZWR1bGVSZW5kZXJ9YDtcclxuICAgICAgICAgICAgICAgIGluZm9EaXYuYXBwZW5kQ2hpbGQoaGlkZGVuU2NoZWR1bGVEaXYpO1xyXG5cclxuICAgICAgICAgICAgICAgIGhvdmVyRGl2LmNsYXNzTGlzdC5hZGQoXCJob3Zlci1kaXZcIik7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRhcmdldFNjaGVkdWxlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGhvdmVyRGl2LmFwcGVuZENoaWxkKGNyZWF0ZVNjaGVkdWxlTWluaURpdih0YXJnZXRTY2hlZHVsZXNbaV0pKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0LmFwcGVuZENoaWxkKGhvdmVyRGl2KVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoZGF0ZUxhYmVsRGl2KTtcclxuICAgICAgICAgICAgdGFyZ2V0LmFwcGVuZENoaWxkKGluZm9EaXYpO1xyXG4gICAgICAgICAgICBjb25zdCBjdXJEID0gbmV3IERhdGUoZC50b1N0cmluZygpKVxyXG4gICAgICAgICAgICB0YXJnZXQub25jbGljayA9ICgpPT4geyBNb2RhbC5nZXRJbnN0YW5jZSgpLm9wZW4oY3VyRC50b0RhdGVTdHJpbmcoKSkgfVxyXG4gICAgICAgICAgICAvLyB0YXJnZXQub25tb3VzZW92ZXIgPSAoKT0+IHsgaG92ZXJEaXYuY2xhc3NMaXN0LmFkZChcInNob3dcIikgfVxyXG4gICAgICAgICAgICAvLyB0YXJnZXQub25tb3VzZW91dCA9ICgpID0+IHsgaG92ZXJEaXYuY2xhc3NMaXN0LnJlbW92ZShcInNob3dcIikgfVxyXG4gICAgICAgICAgICBkLnNldERhdGUoZC5nZXREYXRlKCkgKyAxKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB0b1ByZXZNb250aCgpIDogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldE1vbnRoKHRoaXMuZGF0ZS5nZXRNb250aCgpIC0gMSk7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldERhdGUoMSk7ICAvLyAxXHVDNzdDXHVCODVDIFx1QjlERVx1Q0RCMFx1QzhGQ1x1QUUzMFxyXG4gICAgICAgIHRoaXMudXBkYXRlTW9udGhMYWJlbCgpO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHRvTmV4dE1vbnRoKCkgOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0TW9udGgodGhpcy5kYXRlLmdldE1vbnRoKCkgKyAxKTtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0RGF0ZSgxKTsgIC8vIDFcdUM3N0NcdUI4NUMgXHVCOURFXHVDREIwXHVDOEZDXHVBRTMwXHJcbiAgICAgICAgdGhpcy51cGRhdGVNb250aExhYmVsKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBjbGVhckNlbGxzKCkgOiB2b2lkIHtcclxuICAgICAgICBmb3IgKGNvbnN0IGNlbGwgb2YgdGhpcy5kYXRlQ2VsbHMpIHtcclxuICAgICAgICAgICAgY2VsbC50ZXh0Q29udGVudCA9IFwiXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdXBkYXRlTW9udGhMYWJlbCgpIHtcclxuICAgICAgICB0aGlzLm1vbnRoTGFiZWwudGV4dENvbnRlbnQgPSBgJHt0aGlzLmRhdGUuZ2V0RnVsbFllYXIoKX1cdUIxNDQgJHt0aGlzLmRhdGUuZ2V0TW9udGgoKSArIDF9XHVDNkQ0YDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHVwZGF0ZVNjaGVkdWxlcygpIHtcclxuICAgICAgICBhd2FpdCB1cGRhdGVTY2hlZHVsZXMoKTtcclxuICAgICAgICBhd2FpdCBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLnVwZGF0ZSgpO1xyXG4gICAgICAgIGF3YWl0IHRoaXMucmVuZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIHN0YXRpYyBnZXRWaWV3KCkgOiBIVE1MRGl2RWxlbWVudCB7XHJcbiAgICAgICAgY29uc3QgY2FsZW5kYXJFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblxyXG4gICAgICAgIGNhbGVuZGFyRWwuaW5uZXJIVE1MID0gKGBcclxuICAgICAgICAgICAgPGRpdiBpZD1cImNvbnRyb2xcIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgaWQ9XCJpbmZvXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cInByZXYtYnRuXCI+Jmx0OzwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGlkPVwibW9udGgtbGFiZWxcIj48L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cIm5leHQtYnRuXCI+Jmd0OzwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwidXBkYXRlLWJ0blwiPlx1QzVDNVx1QjM3MFx1Qzc3NFx1RDJCODwvYnV0dG9uPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPHRhYmxlPlxyXG4gICAgICAgICAgICAgICAgPHRoZWFkPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1Qzc3QzwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUM2RDQ8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVENjU0PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1QzIxODwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUJBQTk8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVBRTA4PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1RDFBMDwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICA8L3RoZWFkPlxyXG4gICAgICAgICAgICAgICAgPHRib2R5PlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgPC90Ym9keT5cclxuICAgICAgICAgICAgPC90YWJsZT5cclxuICAgICAgICBgKTtcclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLmNhbGVuZGVyKSBcclxuICAgICAgICAgICAgdGhpcy5jYWxlbmRlciA9IG5ldyBDYWxlbmRhcihjYWxlbmRhckVsKTtcclxuICAgICAgICAvLyB0aGlzLmNhbGVuZGVyLmdldFNjaGVkdWxlcygpO1xyXG4gICAgICAgIHRoaXMuY2FsZW5kZXIucmVuZGVyKCk7XHJcbiAgICAgICAgcmV0dXJuIGNhbGVuZGFyRWw7XHJcbiAgICB9XHJcbn07XHJcbiIsICJpbXBvcnQgQ2FsZW5kYXIgZnJvbSBcIi4vY2FsZW5kZXJcIjtcclxuaW1wb3J0IE1vZGFsIGZyb20gXCIuL21vZGFsXCI7XHJcbmltcG9ydCB7IFN1YmplY3QgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC91cGRhdGVTY2hlZHVsZVwiO1xyXG5cclxuLy8gaW1wb3J0IHtjYWxlbmRhckNzc30gZnJvbSBcIi4vY29uc3RzXCI7XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gbWFpbigpIDogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCB0YXJnZXRFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIuZnJvbnQtYm94LmZyb250LWJveC1jb3Vyc2VcIik7XHJcbiAgICBpZiAoIXRhcmdldEVsKSByZXR1cm47XHJcblxyXG4gICAgLy8gY29uc3Qgc3R5bGVFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcclxuICAgIGNvbnN0IGRldGFpbHNFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkZXRhaWxzXCIpO1xyXG4gICAgY29uc3Qgc3VtbWFyeUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN1bW1hcnlcIik7XHJcbiAgICBzdW1tYXJ5RWwudGV4dENvbnRlbnQgPSBcIlBsYXRvIENhbGVuZGFyM1wiO1xyXG4gICAgLy8gc3R5bGVFbC5pbm5lckhUTUwgPSBjYWxlbmRhckNzcztcclxuICAgIFxyXG4gICAgZGV0YWlsc0VsLmFwcGVuZENoaWxkKHN1bW1hcnlFbCk7XHJcbiAgICBkZXRhaWxzRWwuYXBwZW5kQ2hpbGQoYXdhaXQgTW9kYWwuZ2V0VmlldygpKTtcclxuICAgIGRldGFpbHNFbC5hcHBlbmRDaGlsZChhd2FpdCBDYWxlbmRhci5nZXRWaWV3KCkpO1xyXG4gICAgZGV0YWlsc0VsLnNldEF0dHJpYnV0ZShcImlkXCIsIFwicGxhdG8tY2FsZW5kYXJcIik7XHJcbiAgICBcclxuICAgIHRhcmdldEVsPy5wcmVwZW5kKGRldGFpbHNFbCk7XHJcbn1cclxuXHJcbm1haW4oKTtcclxuXHJcblxyXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7QUFHQSxpQkFBc0IsZUFBdUM7QUFDekQsWUFBUSxJQUFJLHdJQUErQjtBQUczQyxVQUFNLFdBQVcsTUFBTSxPQUFPLFFBQVEsWUFBWSxFQUFFLFFBQVEsZ0JBQWdCLENBQUM7QUFHN0UsWUFBUSxJQUFJLHNGQUFxQixRQUFRO0FBR3pDLFdBQU8sU0FBUztBQUFBLEVBQ3BCO0FBRUEsTUFBTSxrQkFBa0I7QUFFeEIsaUJBQXNCLGtCQUFrQjtBQUNwQyxpQkFBYSxRQUFRLGtCQUFpQixvQkFBSSxLQUFLLEdBQUUsU0FBUyxDQUFDO0FBQzNELFVBQU0sTUFBTSxNQUFNLE9BQU8sUUFBUSxZQUFZO0FBQUEsTUFDekMsUUFBUTtBQUFBLElBQ1osQ0FBQztBQUVELFlBQVEsSUFBSSxHQUFHO0FBQUEsRUFDbkI7QUFFUSxXQUFTLDRCQUE0QjtBQUN6QyxVQUFNLE9BQU0sb0JBQUksS0FBSyxHQUFFLFFBQVE7QUFDL0IsVUFBTSxjQUFjLElBQUksS0FBSyxhQUFhLFFBQVEsZUFBZSxDQUFXLEdBQUcsUUFBUSxLQUFLO0FBRTVGLFVBQU0sT0FBTyxNQUFPO0FBQ3BCLFdBQVEsTUFBSSxjQUFjO0FBQUEsRUFDOUI7QUFFQSxpQkFBc0Isb0JBQXlDO0FBQzNELFVBQU0sV0FBVyxNQUFNLE9BQU8sUUFBUSxZQUFZLEVBQUUsUUFBUSxpQkFBaUIsQ0FBQztBQUM5RSxXQUFPLFNBQVM7QUFBQSxFQUNwQjs7O0FDN0JBLE1BQXFCLHlCQUFyQixNQUFxQix3QkFBdUI7QUFBQSxJQUtoQyxjQUFjO0FBQ2xCLFdBQUssV0FBVztB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
