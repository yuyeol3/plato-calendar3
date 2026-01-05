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
      this.data[date] = {};
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
        while (d.getMonth() == month) {
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
      const currentCourses = await getCurrentCourses();
      this.getInstance().data = data;
      if (Object.keys(currentCourses).length == 0) return;
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
        if (targetSchedules.length > this.maxScheduleRender) {
          const hiddenScheduleDiv = document.createElement("div");
          hiddenScheduleDiv.textContent = `+${targetSchedules.length - this.maxScheduleRender}`;
          infoDiv.appendChild(hiddenScheduleDiv);
          const hoverDiv = document.createElement("div");
          hoverDiv.classList.add("hover-div");
          for (let i = 0; i < targetSchedules.length; i++) {
            hoverDiv.appendChild(createScheduleMiniDiv(targetSchedules[i]));
          }
          target.appendChild(hoverDiv);
        }
        dateLabelDiv.innerHTML = `
                <span class="date-label">${d.getDate().toString()}</span>
                <span class="unresolved-schedules">${targetSchedules.filter((e) => !e.completed && !e.orphaned).length || ""}</span>
            `;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy91dGlscy50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL0NhbGVuZGFyU3RvcmFnZU1hbmFnZXIudHMiLCAiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy9tb2RhbC50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL2NhbGVuZGVyLnRzIiwgIi4uLy4uL3NyYy9jb250ZW50X3NjcmlwdHMvY29udGVudC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgQWxsU2NoZWR1bGVzIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvc2NoZWR1bGVTdG9yYWdlTWFuYWdlclwiO1xyXG5pbXBvcnQgeyBTdWJqZWN0IH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTY2hlZHVsZXMoKSA6IFByb21pc2U8QWxsU2NoZWR1bGVzPiB7XHJcbiAgICBjb25zb2xlLmxvZyhcIlx1QzExQ1x1QkU0NFx1QzJBNCBcdUM2Q0NcdUNFRTRcdUM1RDBcdUFDOEMgXHVDMkE0XHVDRjAwXHVDOTA0IFx1QjM3MFx1Qzc3NFx1RDEzMCBcdUI4NUNcdUI0RENcdUI5N0MgXHVDNjk0XHVDQ0FEXHVENTY5XHVCMkM4XHVCMkU0Li4uXCIpO1xyXG5cclxuICAgIC8vIDEuICdsb2FkU2NoZWR1bGVzJ1x1Qjc3Q1x1QjI5NCBhY3Rpb25cdUM3NDQgXHVCMkY0XHVDNTQ0IFx1QkE1NFx1QzJEQ1x1QzlDMCBcdUM4MDRcdUMxQTFcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyBhY3Rpb246IFwibG9hZFNjaGVkdWxlc1wiIH0pO1xyXG5cclxuICAgIC8vIDQuIFx1QzExQ1x1QkU0NFx1QzJBNCBcdUM2Q0NcdUNFRTRcdUI4NUNcdUJEODBcdUQxMzAgXHVCQzFCXHVDNzQwIFx1QUNCMFx1QUNGQ1xyXG4gICAgY29uc29sZS5sb2coXCJcdUMxMUNcdUJFNDRcdUMyQTQgXHVDNkNDXHVDRUU0XHVCODVDXHVCRDgwXHVEMTMwIFx1QkMxQlx1Qzc0MCBcdUMyQTRcdUNGMDBcdUM5MDQ6XCIsIHJlc3BvbnNlKTtcclxuICAgIFxyXG4gICAgLy8gXHVDNzc0IFx1QjM3MFx1Qzc3NFx1RDEzMFx1Qjk3QyBcdUMwQUNcdUM2QTlcdUQ1NThcdUM1RUMgXHVEMzk4XHVDNzc0XHVDOUMwXHVDNzU4IERPTVx1Qzc0NCBcdUM4NzBcdUM3OTFcdUQ1NjAgXHVDMjE4IFx1Qzc4OFx1QzJCNVx1QjJDOFx1QjJFNC5cclxuICAgIHJldHVybiByZXNwb25zZS5yZXN1bHQ7XHJcbn1cclxuXHJcbmNvbnN0IExBU1RfVVBEQVRFX0tFWSA9IFwicGxhdG8tY2FsZW5kYXIzLWxhc3RVcGRhdGVcIlxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVNjaGVkdWxlcygpIHtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKExBU1RfVVBEQVRFX0tFWSwgbmV3IERhdGUoKS50b1N0cmluZygpKTtcclxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcclxuICAgICAgICBhY3Rpb246IFwidXBkYXRlRGF0YVwiXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhyZXMpO1xyXG59XHJcblxyXG5leHBvcnQgIGZ1bmN0aW9uIENoZWNrU2NoZWR1bGVVcGRhdGVUaW1pbmcoKSB7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICAgIGNvbnN0IGxhc3RVcGRhdGVkID0gbmV3IERhdGUobG9jYWxTdG9yYWdlLmdldEl0ZW0oTEFTVF9VUERBVEVfS0VZKSBhcyBzdHJpbmcpPy5nZXRUaW1lKCkgPz8gMDtcclxuXHJcbiAgICBjb25zdCBIT1VSID0gMTAwMCAqIDM2MDA7XHJcbiAgICByZXR1cm4gKG5vdy1sYXN0VXBkYXRlZCA+IEhPVVIpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q3VycmVudENvdXJzZXMoKSA6IFByb21pc2U8U3ViamVjdFtdPiB7XHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHsgYWN0aW9uOiBcImxvYWRDdXJDb3Vyc2VzXCIgfSk7ICAgIFxyXG4gICAgcmV0dXJuIHJlc3BvbnNlLnJlc3VsdDtcclxufSIsICJpbXBvcnQgeyBTY2hlZHVsZSB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcbmltcG9ydCB7IGdldEN1cnJlbnRDb3Vyc2VzLCBnZXRTY2hlZHVsZXMgfSBmcm9tIFwiLi91dGlsc1wiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDYWxlbmRhclN0b3JhZ2Uge1xyXG4gICAgW2RhdGU6IHN0cmluZ106IHtcclxuICAgICAgICBbc2NoZWR1bGVJZDogc3RyaW5nXTogU2NoZWR1bGU7XHJcbiAgICB9O1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyIHtcclxuICAgIHByaXZhdGUgc3RhdGljIGluc3RhbmNlIDogQ2FsZW5kYXJTdG9yYWdlTWFuYWdlcjtcclxuICAgIHByaXZhdGUgS0VZX05BTUUgOiBzdHJpbmc7XHJcbiAgICBwcml2YXRlIGRhdGEgOiBDYWxlbmRhclN0b3JhZ2U7XHJcbiAgICBwcml2YXRlIHVwZGF0ZVByb21pc2UgOiBQcm9taXNlPHZvaWQ+O1xyXG4gICAgcHJpdmF0ZSBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLktFWV9OQU1FID0gXCJwbGF0by1jYWxlbmRhcjNcIjtcclxuICAgICAgICAvLyBjb25zdCBzdG9yYWdlU3RyID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0odGhpcy5LRVlfTkFNRSk7XHJcbiAgICAgICAgdGhpcy5kYXRhID0ge307XHJcbiAgICAgICAgdGhpcy51cGRhdGVQcm9taXNlID0gQ2FsZW5kYXJTdG9yYWdlTWFuYWdlci51cGRhdGUoKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBcdUNEOTRcdUFDMDBcclxuICAgIHNldChkYXRlIDogc3RyaW5nLCBpZCA6IHN0cmluZywgZGF0YSA6IFNjaGVkdWxlKSB7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJpbnNpZGUgc2V0OlwiLCBkYXRlLCBpZCwgZGF0YSk7XHJcbiAgICAgICAgaWYgKCF0aGlzLmRhdGFbZGF0ZV0pIHRoaXMuZGF0YVtkYXRlXSA9IHt9O1xyXG4gICAgICAgIGlmICghdGhpcy5kYXRhW2RhdGVdPy5baWRdKSB0aGlzLmRhdGFbZGF0ZV1baWRdID0gZGF0YTtcclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdTY2hlZHVsZSA9IHRoaXMuZGF0YVtkYXRlXVtpZF07XHJcblxyXG4gICAgICAgICAgICBleGlzdGluZ1NjaGVkdWxlLm5hbWUgPSBkYXRhLm5hbWU7XHJcbiAgICAgICAgICAgIGV4aXN0aW5nU2NoZWR1bGUuY29tcGxldGVkID0gZGF0YS5jb21wbGV0ZWQ7XHJcbiAgICAgICAgICAgIGV4aXN0aW5nU2NoZWR1bGUuZHVlID0gZGF0YS5kdWU7XHJcbiAgICAgICAgICAgIGV4aXN0aW5nU2NoZWR1bGUub3JwaGFuZWQgPSBkYXRhLm9ycGhhbmVkO1xyXG5cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMuS0VZX05BTUUsIEpTT04uc3RyaW5naWZ5KHRoaXMuZGF0YSkpO1xyXG4gICAgICAgIENhbGVuZGFyU3RvcmFnZU1hbmFnZXIuc2F2ZSh0aGlzLmRhdGEpO1xyXG4gICAgfSAgIFxyXG5cclxuICAgIC8vIFx1Qzg3MFx1RDY4Q1xyXG4gICAgYXN5bmMgZ2V0KGRhdGUgOiBzdHJpbmcpIHtcclxuICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb21pc2U7XHJcbiAgICAgICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5kYXRhW2RhdGVdID8/IHt9KTtcclxuICAgIH1cclxuICAgIC8vIFx1QzBBRFx1QzgxQ1xyXG4gICAgcmVtb3ZlKGRhdGUgOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLmRhdGFbZGF0ZV0gPSB7fTtcclxuICAgICAgICAvLyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSh0aGlzLktFWV9OQU1FLCBKU09OLnN0cmluZ2lmeSh0aGlzLmRhdGEpKTtcclxuICAgICAgICBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLnNhdmUodGhpcy5kYXRhKTtcclxuICAgIH1cclxuXHJcbiAgICByZW1vdmVCeUlkKGRhdGUgOiBzdHJpbmcsIGlkIDogc3RyaW5nKSB7XHJcbiAgICAgICAgZGVsZXRlIHRoaXMuZGF0YVtkYXRlXT8uW2lkXTtcclxuICAgICAgICBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLnNhdmUodGhpcy5kYXRhKTtcclxuICAgIH1cclxuIFxyXG4gICAgY2xlYW5VcChzY2hlZHVsZXMgOiBTY2hlZHVsZVtdKSB7XHJcbiAgICAgICAgY29uc3QgZGF0ZVN0cmluZ3MgOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBzY2hlZHVsZSBvZiBzY2hlZHVsZXMpIHtcclxuICAgICAgICAgICAgY29uc3QgZCA9IG5ldyBEYXRlKHNjaGVkdWxlLmR1ZS50b1N0cmluZygpKTtcclxuICAgICAgICAgICAgaWYgKGQudG9TdHJpbmcoKSA9PT0gXCJJbnZhbGlkIERhdGVcIikgY29udGludWU7XHJcbiAgICAgICAgICAgIGQuc2V0RGF0ZSgxKTtcclxuICAgICAgICAgICAgZGF0ZVN0cmluZ3MuYWRkKGQudG9EYXRlU3RyaW5nKCkpO1xyXG4gICAgICAgIH1cclxuXHJcblxyXG4gICAgICAgIGZvciAoY29uc3QgZGF0ZVN0cmluZyBvZiBkYXRlU3RyaW5ncykge1xyXG4gICAgICAgICAgICBjb25zdCBkID0gbmV3IERhdGUoZGF0ZVN0cmluZyk7XHJcbiAgICAgICAgICAgIGNvbnN0IG1vbnRoID0gZC5nZXRNb250aCgpO1xyXG5cclxuICAgICAgICAgICAgd2hpbGUgKGQuZ2V0TW9udGgoKSA9PSBtb250aCkge1xyXG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCJkZWxldGluZyA6IFwiLCBkKTtcclxuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlKGQudG9EYXRlU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICAgICAgZC5zZXREYXRlKGQuZ2V0RGF0ZSgpICsgMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBhc3luYyBzYXZlKGRhdGEgOiBDYWxlbmRhclN0b3JhZ2UpIHtcclxuICAgICAgICBhd2FpdCBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XHJcbiAgICAgICAgICAgIGRhdGEgOiBkYXRhLFxyXG4gICAgICAgICAgICBhY3Rpb24gOiBcImNhbGVuZGFyL3NhdmVcIlxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGFzeW5jIGxvYWQoKSA6IFByb21pc2U8Q2FsZW5kYXJTdG9yYWdlPiB7XHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XHJcbiAgICAgICAgICAgIGFjdGlvbiA6IFwiY2FsZW5kYXIvbG9hZFwiXHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlLnJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgYXN5bmMgdXBkYXRlKCkge1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmxvYWQoKTtcclxuICAgICAgICBjb25zdCBzY2hlZHVsZXMgPSBhd2FpdCBnZXRTY2hlZHVsZXMoKTtcclxuICAgICAgICBjb25zdCBjdXJyZW50Q291cnNlcyA9IGF3YWl0IGdldEN1cnJlbnRDb3Vyc2VzKCk7XHJcblxyXG5cclxuICAgICAgICB0aGlzLmdldEluc3RhbmNlKCkuZGF0YSA9IGRhdGE7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coY3VycmVudENvdXJzZXMpO1xyXG4gICAgICAgIGlmIChPYmplY3Qua2V5cyhjdXJyZW50Q291cnNlcykubGVuZ3RoID09IDApIHJldHVybjtcclxuICAgICAgICB0aGlzLmdldEluc3RhbmNlKCkuY2xlYW5VcChjdXJyZW50Q291cnNlcy5tYXAoZT0+T2JqZWN0LnZhbHVlcyhzY2hlZHVsZXNbZS5pZF0pKS5mbGF0KCkpO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwiY2xlYW51cCB0YXJnZXQ6IFwiLCBjdXJyZW50Q291cnNlcy5tYXAoZT0+T2JqZWN0LnZhbHVlcyhzY2hlZHVsZXNbZS5pZF0pKS5mbGF0KCkpO1xyXG4gICAgICAgIGZvciAoY29uc3QgY291cnNlIG9mIGN1cnJlbnRDb3Vyc2VzKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvdXJzZVNjaGVkdWxlcyA9IE9iamVjdC52YWx1ZXMoc2NoZWR1bGVzW2NvdXJzZS5pZF0pO1xyXG5cclxuICAgICAgICAgICAgZm9yIChjb25zdCBzIG9mIGNvdXJzZVNjaGVkdWxlcykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKHMuZHVlLnRvU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICAgICAgZGF0ZS5zZXRTZWNvbmRzKGRhdGUuZ2V0U2Vjb25kcygpIC0gMSk7IC8vIFx1Qzc5MFx1QzgxNVx1Qzc3OCBcdUFDQkRcdUM2QjAgXHVENTU4XHVCOEU4IFx1QzgwNFx1QzczQ1x1Qjg1QyBcdUMxMjRcdUM4MTVcdUQ1NThcdUFFMzBcclxuICAgICAgICAgICAgICAgIHRoaXMuZ2V0SW5zdGFuY2UoKS5zZXQoXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0ZS50b0RhdGVTdHJpbmcoKSwgXHJcbiAgICAgICAgICAgICAgICAgICAgcy5pZCwgc1xyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgZ2V0SW5zdGFuY2UoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaW5zdGFuY2UgPT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aGlzLmluc3RhbmNlID0gbmV3IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNlO1xyXG4gICAgfVxyXG59IiwgImltcG9ydCB7IFNjaGVkdWxlVHlwZSB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcbmltcG9ydCB7IFNjaGVkdWxlIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcclxuaW1wb3J0IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIgZnJvbSBcIi4vQ2FsZW5kYXJTdG9yYWdlTWFuYWdlclwiO1xyXG5pbXBvcnQgeyBTY2hlZHVsZVN0eWxlcyB9IGZyb20gXCIuL2NhbGVuZGVyXCI7XHJcblxyXG5leHBvcnQgY29uc3QgU2NoZWR1bGVJY29ucyA9IHtcclxuICAgIFsgU2NoZWR1bGVUeXBlLkhXIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vc3YyL2Fzc2lnbi8xNzQ1MjE3MzU4L2ljb25cIixcclxuICAgIFsgU2NoZWR1bGVUeXBlLlZJRCBdIDogXCJodHRwczovL3BsYXRvLnB1c2FuLmFjLmtyL3RoZW1lL2ltYWdlLnBocC9jb3Vyc2Vtb3N2Mi92b2QvMTc0NTIxNzM1OC9pY29uXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5RVUlaIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vc3YyL3F1aXovMTc0NTIxNzM1OC9pY29uXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5aT09NIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vc3YyL3pvb20vMTc0NTIxNzM1OC9pY29uXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5QQSBdIDogXCJodHRwczovL3BsYXRvLnB1c2FuLmFjLmtyL3RoZW1lL2ltYWdlLnBocC9jb3Vyc2Vtb3N2Mi92cGwvMTc0NTIxNzM1OC9pY29uXCJcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlU2NoZWR1bGVEaXYoZGF0YSA6IFNjaGVkdWxlKSB7XHJcbiAgICBjb25zdCBkaXZFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICBkaXZFbC5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgPGRpdiBpZD1cImljb24tZGl2XCI+XHJcbiAgICAgICAgICAgIDxpbWcgc3JjPVwiJHtTY2hlZHVsZUljb25zW2RhdGEudHlwZV19XCI+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgPGg0PiR7ZGF0YS5uYW1lfTwvaDQ+XHJcbiAgICAgICAgICAgIDxwPiR7ZGF0YS5jb3Vyc2UubmFtZX08L3A+XHJcbiAgICAgICAgICAgIDxwPiR7bmV3IERhdGUoZGF0YS5kdWUpLnRvTG9jYWxlU3RyaW5nKCl9PC9wPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIFxyXG4gICAgYFxyXG4gICAgZGl2RWwuY2xhc3NMaXN0LmFkZChcInNjaGVkdWxlXCIpO1xyXG4gICAgZGl2RWwub25jbGljayA9ICgpPT4ge1xyXG4gICAgICAgIHdpbmRvdy5vcGVuKGRhdGEudXJsKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWRhdGEub3JwaGFuZWQgJiYgIWRhdGEuY29tcGxldGVkKSBkaXZFbC5jbGFzc0xpc3QuYWRkKFNjaGVkdWxlU3R5bGVzW2RhdGEudHlwZV0pO1xyXG4gICAgZWxzZSBpZiAoZGF0YS5jb21wbGV0ZWQpIGRpdkVsLmNsYXNzTGlzdC5hZGQoXCJjb21wbGV0ZWRcIilcclxuICAgIGVsc2UgZGl2RWwuY2xhc3NMaXN0LmFkZChcIm9ycGhhbmVkXCIpO1xyXG4gICAgcmV0dXJuIGRpdkVsO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNb2RhbCB7XHJcbiAgICBwcml2YXRlIHN0YXRpYyBpbnN0YW5jZSA6IE1vZGFsO1xyXG4gICAgcHJpdmF0ZSBtb2RhbERpdiA6IEhUTUxEaXZFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSB0aXRsZUVsIDogSFRNTEhlYWRpbmdFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSBjb250ZW50RGl2IDogSFRNTERpdkVsZW1lbnQ7XHJcbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKG1vZGFsRGl2IDogSFRNTERpdkVsZW1lbnQpIHtcclxuICAgICAgICB0aGlzLm1vZGFsRGl2ID0gbW9kYWxEaXY7XHJcbiAgICAgICAgdGhpcy50aXRsZUVsID0gbW9kYWxEaXYucXVlcnlTZWxlY3RvcihcIiN0aXRsZVwiKSBhcyBIVE1MSGVhZGluZ0VsZW1lbnQ7XHJcbiAgICAgICAgdGhpcy5jb250ZW50RGl2ID0gbW9kYWxEaXYucXVlcnlTZWxlY3RvcihcIiNjb250ZW50XCIpIGFzIEhUTUxEaXZFbGVtZW50O1xyXG5cclxuICAgICAgICBjb25zdCBjbG9zZUJ1dHRvbiA9IG1vZGFsRGl2LnF1ZXJ5U2VsZWN0b3IoXCIuY2xvc2UtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgIGNsb3NlQnV0dG9uLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBvcGVuKGRhdGUgOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLmNvbnRlbnREaXYuaW5uZXJIVE1MID0gXCJcIjtcclxuICAgICAgICB0aGlzLnRpdGxlRWwudGV4dENvbnRlbnQgPSBuZXcgRGF0ZShkYXRlKS50b0xvY2FsZURhdGVTdHJpbmcoKTtcclxuICAgICAgICBjb25zdCBzY2hlZHVsZXMgPSBhd2FpdCBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLmdldEluc3RhbmNlKCkuZ2V0KGRhdGUpO1xyXG5cclxuICAgICAgICBpZiAoc2NoZWR1bGVzLmxlbmd0aCA9PT0gMCApIHJldHVybjtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coZGF0ZSwgc2NoZWR1bGVzKTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBzY2hlZHVsZSBvZiBzY2hlZHVsZXMpIHtcclxuICAgICAgICAgICAgY29uc3QgZGl2RWwgPSBjcmVhdGVTY2hlZHVsZURpdihzY2hlZHVsZSk7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudERpdi5hcHBlbmRDaGlsZChkaXZFbCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm1vZGFsRGl2LmNsYXNzTGlzdC5hZGQoXCJtb2RhbC1vcGVuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGNsb3NlKCkge1xyXG4gICAgICAgIHRoaXMubW9kYWxEaXYuY2xhc3NMaXN0LnJlbW92ZShcIm1vZGFsLW9wZW5cIik7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGdldEluc3RhbmNlKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNlO1xyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBnZXRWaWV3KCkge1xyXG4gICAgICAgIGlmICghdGhpcy5pbnN0YW5jZSkgeyBcclxuICAgICAgICAgICAgY29uc3QgbW9kYWxFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgICAgIG1vZGFsRWwuc2V0QXR0cmlidXRlKCdpZCcsIFwibW9kYWxcIik7XHJcblxyXG4gICAgICAgICAgICBtb2RhbEVsLmlubmVySFRNTCA9IGBcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdXN0b20tbW9kYWwtYmFja2Ryb3BcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdXN0b20tbW9kYWwtZGlhbG9nXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBpZD1cInRvcFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiY2xvc2UtYnRuXCI+XHUwMEQ3PC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGgyIGlkPVwidGl0bGVcIj48L2gyPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgaWQ9XCJjb250ZW50XCI+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgYDsgXHJcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2UgPSBuZXcgTW9kYWwobW9kYWxFbCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICByZXR1cm4gdGhpcy5pbnN0YW5jZS5tb2RhbERpdjtcclxuICAgIH1cclxufSIsICJpbXBvcnQgeyBBbGxTY2hlZHVsZXMgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC9zY2hlZHVsZVN0b3JhZ2VNYW5hZ2VyXCI7XHJcbmltcG9ydCB7IFNjaGVkdWxlLCBTY2hlZHVsZVR5cGUgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC91cGRhdGVTY2hlZHVsZVwiO1xyXG5pbXBvcnQgQ2FsZW5kYXJTdG9yYWdlTWFuYWdlciBmcm9tIFwiLi9DYWxlbmRhclN0b3JhZ2VNYW5hZ2VyXCI7XHJcbmltcG9ydCBNb2RhbCBmcm9tIFwiLi9tb2RhbFwiO1xyXG5pbXBvcnQgeyBDaGVja1NjaGVkdWxlVXBkYXRlVGltaW5nLCBnZXRDdXJyZW50Q291cnNlcywgZ2V0U2NoZWR1bGVzLCB1cGRhdGVTY2hlZHVsZXMgfSBmcm9tIFwiLi91dGlsc1wiO1xyXG5cclxuXHJcbmV4cG9ydCBjb25zdCBTY2hlZHVsZVN0eWxlcyA9IHtcclxuICAgIFsgU2NoZWR1bGVUeXBlLkhXIF0gOiBcImh3XCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5WSUQgXSA6IFwidmlkXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5RVUlaIF0gOiBcInF1aXpcIixcclxuICAgIFsgU2NoZWR1bGVUeXBlLlpPT00gXSA6IFwiem9vbVwiLFxyXG4gICAgWyBTY2hlZHVsZVR5cGUuUEEgXSA6IFwicGFcIlxyXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVTY2hlZHVsZU1pbmlEaXYoZGF0YSA6IFNjaGVkdWxlKSB7XHJcbiAgICBjb25zdCBkaXZFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICBkaXZFbC5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgJHtkYXRhLm5hbWV9XHJcbiAgICBgXHJcbiAgICBkaXZFbC5jbGFzc0xpc3QuYWRkKFwibWluaS1zY2hlZHVsZVwiKTtcclxuICAgIGlmICghZGF0YS5vcnBoYW5lZCAmJiAhZGF0YS5jb21wbGV0ZWQpIGRpdkVsLmNsYXNzTGlzdC5hZGQoU2NoZWR1bGVTdHlsZXNbZGF0YS50eXBlXSk7XHJcbiAgICBlbHNlIGlmIChkYXRhLmNvbXBsZXRlZCkgZGl2RWwuY2xhc3NMaXN0LmFkZChcImNvbXBsZXRlZFwiKVxyXG4gICAgZWxzZSBkaXZFbC5jbGFzc0xpc3QuYWRkKFwib3JwaGFuZWRcIik7XHJcbiAgICByZXR1cm4gZGl2RWw7XHJcbn1cclxuXHJcbi8vIHNpbmdsZXRvblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDYWxlbmRhciB7XHJcbiAgICBwcml2YXRlIHN0YXRpYyBjYWxlbmRlciA6IENhbGVuZGFyO1xyXG4gICAgcHJpdmF0ZSBkYXRlIDogRGF0ZTtcclxuICAgIHByaXZhdGUgZGF0ZUNlbGxzIDogSFRNTFRhYmxlQ2VsbEVsZW1lbnRbXTtcclxuICAgIHByaXZhdGUgbW9udGhMYWJlbCA6IEhUTUxTcGFuRWxlbWVudDtcclxuICAgIHByaXZhdGUgbWF4U2NoZWR1bGVSZW5kZXIgPSAyO1xyXG4gICAgLy8gXHVBRDczXHVDNzc0IFx1QUMwMFx1QzlDMFx1QUNFMFx1Qzc4OFx1Qzc0NCBcdUQ1NDRcdUM2OTQgXHVDNUM2XHVDNzQ0XHVDMjE4XHVCM0M0XHJcbiAgICAvLyBwcml2YXRlIHByZXZCdG4gOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgIC8vIHByaXZhdGUgbmV4dEJ0biA6IEhUTUxCdXR0b25FbGVtZW50O1xyXG5cclxuICAgIHByaXZhdGUgc2NoZWR1bGVzIDogQWxsU2NoZWR1bGVzID0ge307XHJcblxyXG4gICAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihjYWxlbmRhckRpdiA6IEhUTUxEaXZFbGVtZW50KSB7XHJcbiAgICAgICAgdGhpcy5kYXRlID0gbmV3IERhdGUoKTtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0RGF0ZSgxKTsgIC8vIDFcdUM3N0NcdUI4NUMgXHVCOURFXHVDREIwXHVDOEZDXHVBRTMwXHJcblxyXG4gICAgICAgIHRoaXMuZGF0ZUNlbGxzID0gQXJyYXkuZnJvbShjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yQWxsKFwidGJvZHkgdGRcIikpO1xyXG4gICAgICAgIHRoaXMubW9udGhMYWJlbCA9IGNhbGVuZGFyRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjbW9udGgtbGFiZWxcIikgYXMgSFRNTFNwYW5FbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IHByZXZCdG4gPSBjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yKFwiI3ByZXYtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IG5leHRCdG4gPSBjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yKFwiI25leHQtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IHVwZGF0ZUJ0biA9IGNhbGVuZGFyRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjdXBkYXRlLWJ0blwiKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcclxuXHJcbiAgICAgICAgdGhpcy51cGRhdGVNb250aExhYmVsKCk7XHJcblxyXG4gICAgICAgIHByZXZCdG4ub25jbGljayA9ICgpPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnRvUHJldk1vbnRoKCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBuZXh0QnRuLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy50b05leHRNb250aCgpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbmRlcigpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdXBkYXRlQnRuLm9uY2xpY2sgPSBhc3luYyAoKT0+e1xyXG4gICAgICAgICAgICB1cGRhdGVCdG4udGV4dENvbnRlbnQgPSBcIlx1QzVDNVx1QjM3MFx1Qzc3NFx1RDJCOCBcdUM5MTFcIlxyXG4gICAgICAgICAgICB1cGRhdGVCdG4uY2xhc3NMaXN0LmFkZChcInVwZGF0aW5nXCIpO1xyXG4gICAgICAgICAgICB1cGRhdGVCdG4uZGlzYWJsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVNjaGVkdWxlcygpO1xyXG4gICAgICAgICAgICB1cGRhdGVCdG4udGV4dENvbnRlbnQgPSBcIlx1QzVDNVx1QjM3MFx1Qzc3NFx1RDJCOFwiXHJcbiAgICAgICAgICAgIHVwZGF0ZUJ0bi5jbGFzc0xpc3QucmVtb3ZlKFwidXBkYXRpbmdcIik7XHJcbiAgICAgICAgICAgIHVwZGF0ZUJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmIChDaGVja1NjaGVkdWxlVXBkYXRlVGltaW5nKCkpIHVwZGF0ZUJ0bi5jbGljaygpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcmVuZGVyKCkge1xyXG4gICAgICAgIHRoaXMuY2xlYXJDZWxscygpO1xyXG4gICAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZSh0aGlzLmRhdGUpO1xyXG4gICAgICAgIGNvbnN0IG1vbnRoID0gZC5nZXRNb250aCgpO1xyXG4gICAgICAgIGNvbnN0IGRheSA9IGQuZ2V0RGF5KCk7XHJcblxyXG4gICAgICAgIC8vIGF3YWl0IHRoaXMuZ2V0U2NoZWR1bGVzKCk7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2codGhpcy5zY2hlZHVsZXMpO1xyXG4gICAgICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKS50b0RhdGVTdHJpbmcoKTtcclxuICAgICAgICB3aGlsZSAoZC5nZXRNb250aCgpID09IG1vbnRoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuZGF0ZUNlbGxzW2QuZ2V0RGF0ZSgpIC0gMSArIGRheV07XHJcblxyXG4gICAgICAgICAgICBjb25zdCBkYXRlTGFiZWxEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgICAgICAgICBjb25zdCBpbmZvRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHJcbiAgICAgICAgICAgIGRhdGVMYWJlbERpdi5jbGFzc0xpc3QuYWRkKFwiZGF0ZS1sYWJlbC1kaXZcIik7XHJcbiAgICAgICAgICAgIGluZm9EaXYuY2xhc3NMaXN0LmFkZChcImluZm8tZGl2XCIpO1xyXG5cclxuICAgICAgICAgICAgaWYgKGQudG9EYXRlU3RyaW5nKCkgPT0gdG9kYXkpIGRhdGVMYWJlbERpdi5jbGFzc0xpc3QuYWRkKFwidG9kYXlcIik7XHJcblxyXG5cclxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0U2NoZWR1bGVzID0gKGF3YWl0IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIuZ2V0SW5zdGFuY2UoKS5nZXQoZC50b0RhdGVTdHJpbmcoKSkpO1xyXG5cclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1pbih0YXJnZXRTY2hlZHVsZXMubGVuZ3RoLCB0aGlzLm1heFNjaGVkdWxlUmVuZGVyKTsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpbmZvRGl2LmFwcGVuZENoaWxkKGNyZWF0ZVNjaGVkdWxlTWluaURpdih0YXJnZXRTY2hlZHVsZXNbaV0pKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHRhcmdldFNjaGVkdWxlcy5sZW5ndGggPiB0aGlzLm1heFNjaGVkdWxlUmVuZGVyKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBoaWRkZW5TY2hlZHVsZURpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgICAgICAgICBoaWRkZW5TY2hlZHVsZURpdi50ZXh0Q29udGVudCA9IGArJHt0YXJnZXRTY2hlZHVsZXMubGVuZ3RoIC0gdGhpcy5tYXhTY2hlZHVsZVJlbmRlcn1gO1xyXG4gICAgICAgICAgICAgICAgaW5mb0Rpdi5hcHBlbmRDaGlsZChoaWRkZW5TY2hlZHVsZURpdik7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgaG92ZXJEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgICAgICAgICAgICAgaG92ZXJEaXYuY2xhc3NMaXN0LmFkZChcImhvdmVyLWRpdlwiKTtcclxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGFyZ2V0U2NoZWR1bGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaG92ZXJEaXYuYXBwZW5kQ2hpbGQoY3JlYXRlU2NoZWR1bGVNaW5pRGl2KHRhcmdldFNjaGVkdWxlc1tpXSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0LmFwcGVuZENoaWxkKGhvdmVyRGl2KVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBkYXRlTGFiZWxEaXYuaW5uZXJIVE1MID0gYFxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJkYXRlLWxhYmVsXCI+JHtkLmdldERhdGUoKS50b1N0cmluZygpfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidW5yZXNvbHZlZC1zY2hlZHVsZXNcIj4ke3RhcmdldFNjaGVkdWxlcy5maWx0ZXIoZT0+IWUuY29tcGxldGVkICYmICFlLm9ycGhhbmVkKS5sZW5ndGggfHwgXCJcIn08L3NwYW4+XHJcbiAgICAgICAgICAgIGBcclxuXHJcbiAgICAgICAgICAgIHRhcmdldC5hcHBlbmRDaGlsZChkYXRlTGFiZWxEaXYpO1xyXG4gICAgICAgICAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoaW5mb0Rpdik7XHJcbiAgICAgICAgICAgIGNvbnN0IGN1ckQgPSBuZXcgRGF0ZShkLnRvU3RyaW5nKCkpXHJcbiAgICAgICAgICAgIHRhcmdldC5vbmNsaWNrID0gKCk9PiB7IE1vZGFsLmdldEluc3RhbmNlKCkub3BlbihjdXJELnRvRGF0ZVN0cmluZygpKSB9XHJcbiAgICAgICAgICAgIGQuc2V0RGF0ZShkLmdldERhdGUoKSArIDEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHRvUHJldk1vbnRoKCkgOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0TW9udGgodGhpcy5kYXRlLmdldE1vbnRoKCkgLSAxKTtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0RGF0ZSgxKTsgIC8vIDFcdUM3N0NcdUI4NUMgXHVCOURFXHVDREIwXHVDOEZDXHVBRTMwXHJcbiAgICAgICAgdGhpcy51cGRhdGVNb250aExhYmVsKCk7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdG9OZXh0TW9udGgoKSA6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuZGF0ZS5zZXRNb250aCh0aGlzLmRhdGUuZ2V0TW9udGgoKSArIDEpO1xyXG4gICAgICAgIHRoaXMuZGF0ZS5zZXREYXRlKDEpOyAgLy8gMVx1Qzc3Q1x1Qjg1QyBcdUI5REVcdUNEQjBcdUM4RkNcdUFFMzBcclxuICAgICAgICB0aGlzLnVwZGF0ZU1vbnRoTGFiZWwoKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGNsZWFyQ2VsbHMoKSA6IHZvaWQge1xyXG4gICAgICAgIGZvciAoY29uc3QgY2VsbCBvZiB0aGlzLmRhdGVDZWxscykge1xyXG4gICAgICAgICAgICBjZWxsLnRleHRDb250ZW50ID0gXCJcIjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB1cGRhdGVNb250aExhYmVsKCkge1xyXG4gICAgICAgIHRoaXMubW9udGhMYWJlbC50ZXh0Q29udGVudCA9IGAke3RoaXMuZGF0ZS5nZXRGdWxsWWVhcigpfVx1QjE0NCAke3RoaXMuZGF0ZS5nZXRNb250aCgpICsgMX1cdUM2RDRgO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgdXBkYXRlU2NoZWR1bGVzKCkge1xyXG4gICAgICAgIGF3YWl0IHVwZGF0ZVNjaGVkdWxlcygpO1xyXG4gICAgICAgIGF3YWl0IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIudXBkYXRlKCk7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5yZW5kZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgc3RhdGljIGdldFZpZXcoKSA6IEhUTUxEaXZFbGVtZW50IHtcclxuICAgICAgICBjb25zdCBjYWxlbmRhckVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHJcbiAgICAgICAgY2FsZW5kYXJFbC5pbm5lckhUTUwgPSAoYFxyXG4gICAgICAgICAgICA8ZGl2IGlkPVwiY29udHJvbFwiPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBpZD1cImluZm9cIj5cclxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwicHJldi1idG5cIj4mbHQ7PC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gaWQ9XCJtb250aC1sYWJlbFwiPjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwibmV4dC1idG5cIj4mZ3Q7PC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJ1cGRhdGUtYnRuXCI+XHVDNUM1XHVCMzcwXHVDNzc0XHVEMkI4PC9idXR0b24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8dGFibGU+XHJcbiAgICAgICAgICAgICAgICA8dGhlYWQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVDNzdDPC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1QzZENDwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUQ2NTQ8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVDMjE4PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1QkFBOTwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUFFMDg8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVEMUEwPC90aD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIDwvdGhlYWQ+XHJcbiAgICAgICAgICAgICAgICA8dGJvZHk+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICA8L3Rib2R5PlxyXG4gICAgICAgICAgICA8L3RhYmxlPlxyXG4gICAgICAgIGApO1xyXG5cclxuICAgICAgICBpZiAoIXRoaXMuY2FsZW5kZXIpIFxyXG4gICAgICAgICAgICB0aGlzLmNhbGVuZGVyID0gbmV3IENhbGVuZGFyKGNhbGVuZGFyRWwpO1xyXG4gICAgICAgIC8vIHRoaXMuY2FsZW5kZXIuZ2V0U2NoZWR1bGVzKCk7XHJcbiAgICAgICAgdGhpcy5jYWxlbmRlci5yZW5kZXIoKTtcclxuICAgICAgICByZXR1cm4gY2FsZW5kYXJFbDtcclxuICAgIH1cclxufTtcclxuIiwgImltcG9ydCBDYWxlbmRhciBmcm9tIFwiLi9jYWxlbmRlclwiO1xyXG5pbXBvcnQgTW9kYWwgZnJvbSBcIi4vbW9kYWxcIjtcclxuaW1wb3J0IHsgU3ViamVjdCB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcblxyXG4vLyBpbXBvcnQge2NhbGVuZGFyQ3NzfSBmcm9tIFwiLi9jb25zdHNcIjtcclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiBtYWluKCkgOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHRhcmdldEVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5mcm9udC1ib3guZnJvbnQtYm94LWNvdXJzZVwiKTtcclxuICAgIGlmICghdGFyZ2V0RWwpIHJldHVybjtcclxuXHJcbiAgICAvLyBjb25zdCBzdHlsZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xyXG4gICAgY29uc3QgZGV0YWlsc0VsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRldGFpbHNcIik7XHJcbiAgICBjb25zdCBzdW1tYXJ5RWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3VtbWFyeVwiKTtcclxuICAgIHN1bW1hcnlFbC50ZXh0Q29udGVudCA9IFwiUGxhdG8gQ2FsZW5kYXIzXCI7XHJcbiAgICAvLyBzdHlsZUVsLmlubmVySFRNTCA9IGNhbGVuZGFyQ3NzO1xyXG4gICAgXHJcbiAgICBkZXRhaWxzRWwuYXBwZW5kQ2hpbGQoc3VtbWFyeUVsKTtcclxuICAgIGRldGFpbHNFbC5hcHBlbmRDaGlsZChhd2FpdCBNb2RhbC5nZXRWaWV3KCkpO1xyXG4gICAgZGV0YWlsc0VsLmFwcGVuZENoaWxkKGF3YWl0IENhbGVuZGFyLmdldFZpZXcoKSk7XHJcbiAgICBkZXRhaWxzRWwuc2V0QXR0cmlidXRlKFwiaWRcIiwgXCJwbGF0by1jYWxlbmRhclwiKTtcclxuICAgIFxyXG4gICAgdGFyZ2V0RWw/LnByZXBlbmQoZGV0YWlsc0VsKTtcclxufVxyXG5cclxu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
