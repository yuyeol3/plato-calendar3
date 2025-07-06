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
      const storageStr = localStorage.getItem(this.KEY_NAME);
      this.data = storageStr ? JSON.parse(storageStr) : {};
      _CalendarStorageManager.update();
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
      localStorage.setItem(this.KEY_NAME, JSON.stringify(this.data));
    }
    // 조회
    get(date) {
      return Object.values(this.data[date] ?? {});
    }
    // 삭제
    remove(date) {
      delete this.data[date];
      localStorage.setItem(this.KEY_NAME, JSON.stringify(this.data));
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
    static async update() {
      const schedules = await getSchedules();
      const currentCourses = await getCurrentCourses() ?? [];
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
    open(date) {
      this.contentDiv.innerHTML = "";
      this.titleEl.textContent = new Date(date).toLocaleDateString();
      const schedules = CalendarStorageManager.getInstance().get(date);
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
        const targetSchedules = CalendarStorageManager.getInstance().get(d.toDateString());
        for (let i = 0; i < Math.min(targetSchedules.length, this.maxScheduleRender); i++) {
          infoDiv.appendChild(createScheduleMiniDiv(targetSchedules[i]));
        }
        dateLabelDiv.innerHTML = `
                <span class="date-label">${d.getDate().toString()}</span>
                <span class="unresolved-schedules">${targetSchedules.filter((e) => !e.completed && !e.orphaned).length || ""}</span>
            `;
        if (targetSchedules.length > this.maxScheduleRender) {
          const hiddenScheduleDiv = document.createElement("div");
          hiddenScheduleDiv.textContent = `+${targetSchedules.length - this.maxScheduleRender}`;
          infoDiv.appendChild(hiddenScheduleDiv);
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
    static async getView() {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy91dGlscy50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL0NhbGVuZGFyU3RvcmFnZU1hbmFnZXIudHMiLCAiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy9tb2RhbC50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL2NhbGVuZGVyLnRzIiwgIi4uLy4uL3NyYy9jb250ZW50X3NjcmlwdHMvY29udGVudC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgQWxsU2NoZWR1bGVzIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvc2NoZWR1bGVTdG9yYWdlTWFuYWdlclwiO1xyXG5pbXBvcnQgeyBTdWJqZWN0IH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTY2hlZHVsZXMoKSA6IFByb21pc2U8QWxsU2NoZWR1bGVzPiB7XHJcbiAgICBjb25zb2xlLmxvZyhcIlx1QzExQ1x1QkU0NFx1QzJBNCBcdUM2Q0NcdUNFRTRcdUM1RDBcdUFDOEMgXHVDMkE0XHVDRjAwXHVDOTA0IFx1QjM3MFx1Qzc3NFx1RDEzMCBcdUI4NUNcdUI0RENcdUI5N0MgXHVDNjk0XHVDQ0FEXHVENTY5XHVCMkM4XHVCMkU0Li4uXCIpO1xyXG5cclxuICAgIC8vIDEuICdsb2FkU2NoZWR1bGVzJ1x1Qjc3Q1x1QjI5NCBhY3Rpb25cdUM3NDQgXHVCMkY0XHVDNTQ0IFx1QkE1NFx1QzJEQ1x1QzlDMCBcdUM4MDRcdUMxQTFcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyBhY3Rpb246IFwibG9hZFNjaGVkdWxlc1wiIH0pO1xyXG5cclxuICAgIC8vIDQuIFx1QzExQ1x1QkU0NFx1QzJBNCBcdUM2Q0NcdUNFRTRcdUI4NUNcdUJEODBcdUQxMzAgXHVCQzFCXHVDNzQwIFx1QUNCMFx1QUNGQ1xyXG4gICAgY29uc29sZS5sb2coXCJcdUMxMUNcdUJFNDRcdUMyQTQgXHVDNkNDXHVDRUU0XHVCODVDXHVCRDgwXHVEMTMwIFx1QkMxQlx1Qzc0MCBcdUMyQTRcdUNGMDBcdUM5MDQ6XCIsIHJlc3BvbnNlKTtcclxuICAgIFxyXG4gICAgLy8gXHVDNzc0IFx1QjM3MFx1Qzc3NFx1RDEzMFx1Qjk3QyBcdUMwQUNcdUM2QTlcdUQ1NThcdUM1RUMgXHVEMzk4XHVDNzc0XHVDOUMwXHVDNzU4IERPTVx1Qzc0NCBcdUM4NzBcdUM3OTFcdUQ1NjAgXHVDMjE4IFx1Qzc4OFx1QzJCNVx1QjJDOFx1QjJFNC5cclxuICAgIHJldHVybiByZXNwb25zZS5yZXN1bHQ7XHJcbn1cclxuXHJcbmNvbnN0IExBU1RfVVBEQVRFX0tFWSA9IFwicGxhdG8tY2FsZW5kYXIzLWxhc3RVcGRhdGVcIlxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVNjaGVkdWxlcygpIHtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKExBU1RfVVBEQVRFX0tFWSwgbmV3IERhdGUoKS50b1N0cmluZygpKTtcclxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcclxuICAgICAgICBhY3Rpb246IFwidXBkYXRlRGF0YVwiXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhyZXMpO1xyXG59XHJcblxyXG5leHBvcnQgIGZ1bmN0aW9uIENoZWNrU2NoZWR1bGVVcGRhdGVUaW1pbmcoKSB7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICAgIGNvbnN0IGxhc3RVcGRhdGVkID0gbmV3IERhdGUobG9jYWxTdG9yYWdlLmdldEl0ZW0oTEFTVF9VUERBVEVfS0VZKSBhcyBzdHJpbmcpPy5nZXRUaW1lKCkgPz8gMDtcclxuXHJcbiAgICBjb25zdCBIT1VSID0gMTAwMCAqIDM2MDA7XHJcbiAgICByZXR1cm4gKG5vdy1sYXN0VXBkYXRlZCA+IEhPVVIpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q3VycmVudENvdXJzZXMoKSA6IFByb21pc2U8U3ViamVjdFtdPiB7XHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHsgYWN0aW9uOiBcImxvYWRDdXJDb3Vyc2VzXCIgfSk7ICAgIFxyXG4gICAgcmV0dXJuIHJlc3BvbnNlLnJlc3VsdDtcclxufSIsICJpbXBvcnQgeyBTY2hlZHVsZSB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcbmltcG9ydCB7IGdldEN1cnJlbnRDb3Vyc2VzLCBnZXRTY2hlZHVsZXMgfSBmcm9tIFwiLi91dGlsc1wiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDYWxlbmRhclN0b3JhZ2Uge1xyXG4gICAgW2RhdGU6IHN0cmluZ106IHtcclxuICAgICAgICBbc2NoZWR1bGVJZDogc3RyaW5nXTogU2NoZWR1bGU7XHJcbiAgICB9O1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyIHtcclxuICAgIHByaXZhdGUgc3RhdGljIGluc3RhbmNlIDogQ2FsZW5kYXJTdG9yYWdlTWFuYWdlcjtcclxuICAgIHByaXZhdGUgS0VZX05BTUUgOiBzdHJpbmc7XHJcbiAgICBwcml2YXRlIGRhdGEgOiBDYWxlbmRhclN0b3JhZ2U7XHJcbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIHRoaXMuS0VZX05BTUUgPSBcInBsYXRvLWNhbGVuZGFyM1wiO1xyXG4gICAgICAgIGNvbnN0IHN0b3JhZ2VTdHIgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSh0aGlzLktFWV9OQU1FKTtcclxuICAgICAgICB0aGlzLmRhdGEgPSBzdG9yYWdlU3RyID8gSlNPTi5wYXJzZShzdG9yYWdlU3RyKSA6IHt9O1xyXG4gICAgICAgIENhbGVuZGFyU3RvcmFnZU1hbmFnZXIudXBkYXRlKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gXHVDRDk0XHVBQzAwXHJcbiAgICBzZXQoZGF0ZSA6IHN0cmluZywgaWQgOiBzdHJpbmcsIGRhdGEgOiBTY2hlZHVsZSkge1xyXG4gICAgICAgIGlmICghdGhpcy5kYXRhW2RhdGVdKSB0aGlzLmRhdGFbZGF0ZV0gPSB7fTtcclxuICAgICAgICBpZiAoIXRoaXMuZGF0YVtkYXRlXT8uW2lkXSkgdGhpcy5kYXRhW2RhdGVdW2lkXSA9IGRhdGE7XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nU2NoZWR1bGUgPSB0aGlzLmRhdGFbZGF0ZV1baWRdO1xyXG5cclxuICAgICAgICAgICAgZXhpc3RpbmdTY2hlZHVsZS5uYW1lID0gZGF0YS5uYW1lO1xyXG4gICAgICAgICAgICBleGlzdGluZ1NjaGVkdWxlLmNvbXBsZXRlZCA9IGRhdGEuY29tcGxldGVkO1xyXG4gICAgICAgICAgICBleGlzdGluZ1NjaGVkdWxlLmR1ZSA9IGRhdGEuZHVlO1xyXG4gICAgICAgICAgICBleGlzdGluZ1NjaGVkdWxlLm9ycGhhbmVkID0gZGF0YS5vcnBoYW5lZDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMuS0VZX05BTUUsIEpTT04uc3RyaW5naWZ5KHRoaXMuZGF0YSkpO1xyXG4gICAgfSAgIFxyXG5cclxuICAgIC8vIFx1Qzg3MFx1RDY4Q1xyXG4gICAgZ2V0KGRhdGUgOiBzdHJpbmcpIHtcclxuICAgICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLmRhdGFbZGF0ZV0gPz8ge30pO1xyXG4gICAgfVxyXG4gICAgLy8gXHVDMEFEXHVDODFDXHJcbiAgICByZW1vdmUoZGF0ZSA6IHN0cmluZykge1xyXG4gICAgICAgIGRlbGV0ZSB0aGlzLmRhdGFbZGF0ZV07XHJcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0odGhpcy5LRVlfTkFNRSwgSlNPTi5zdHJpbmdpZnkodGhpcy5kYXRhKSk7XHJcbiAgICB9XHJcbiBcclxuICAgIGNsZWFuVXAoc2NoZWR1bGVzIDogU2NoZWR1bGVbXSkge1xyXG4gICAgICAgIGNvbnN0IGRhdGVTdHJpbmdzIDogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XHJcblxyXG4gICAgICAgIGZvciAoY29uc3Qgc2NoZWR1bGUgb2Ygc2NoZWR1bGVzKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZShzY2hlZHVsZS5kdWUudG9TdHJpbmcoKSk7XHJcbiAgICAgICAgICAgIGlmIChkLnRvU3RyaW5nKCkgPT09IFwiSW52YWxpZCBEYXRlXCIpIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICBkLnNldERhdGUoMSk7XHJcbiAgICAgICAgICAgIGRhdGVTdHJpbmdzLmFkZChkLnRvRGF0ZVN0cmluZygpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciAoY29uc3QgZGF0ZVN0cmluZyBvZiBkYXRlU3RyaW5ncykge1xyXG4gICAgICAgICAgICBjb25zdCBkID0gbmV3IERhdGUoZGF0ZVN0cmluZyk7XHJcbiAgICAgICAgICAgIGNvbnN0IG1vbnRoID0gZC5nZXRNb250aCgpO1xyXG5cclxuICAgICAgICAgICAgd2hpbGUgKGQuZ2V0TW9udGgoKSAhPSBtb250aCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5yZW1vdmUoZC50b0RhdGVTdHJpbmcoKSk7XHJcbiAgICAgICAgICAgICAgICBkLnNldERhdGUoZC5nZXREYXRlKCkgKyAxKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGFzeW5jIHVwZGF0ZSgpIHtcclxuICAgICAgICBjb25zdCBzY2hlZHVsZXMgPSBhd2FpdCBnZXRTY2hlZHVsZXMoKTtcclxuICAgICAgICBjb25zdCBjdXJyZW50Q291cnNlcyA9IGF3YWl0IGdldEN1cnJlbnRDb3Vyc2VzKCkgPz8gW107XHJcblxyXG4gICAgICAgIHRoaXMuZ2V0SW5zdGFuY2UoKS5jbGVhblVwKGN1cnJlbnRDb3Vyc2VzLm1hcChlPT5PYmplY3QudmFsdWVzKHNjaGVkdWxlc1tlLmlkXSkpLmZsYXQoKSk7XHJcblxyXG4gICAgICAgIGZvciAoY29uc3QgY291cnNlIG9mIGN1cnJlbnRDb3Vyc2VzKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvdXJzZVNjaGVkdWxlcyA9IE9iamVjdC52YWx1ZXMoc2NoZWR1bGVzW2NvdXJzZS5pZF0pO1xyXG5cclxuICAgICAgICAgICAgZm9yIChjb25zdCBzIG9mIGNvdXJzZVNjaGVkdWxlcykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKHMuZHVlLnRvU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICAgICAgZGF0ZS5zZXRTZWNvbmRzKGRhdGUuZ2V0U2Vjb25kcygpIC0gMSk7IC8vIFx1Qzc5MFx1QzgxNVx1Qzc3OCBcdUFDQkRcdUM2QjAgXHVENTU4XHVCOEU4IFx1QzgwNFx1QzczQ1x1Qjg1QyBcdUMxMjRcdUM4MTVcdUQ1NThcdUFFMzBcclxuICAgICAgICAgICAgICAgIHRoaXMuZ2V0SW5zdGFuY2UoKS5zZXQoXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0ZS50b0RhdGVTdHJpbmcoKSwgXHJcbiAgICAgICAgICAgICAgICAgICAgcy5pZCwgc1xyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgZ2V0SW5zdGFuY2UoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaW5zdGFuY2UgPT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aGlzLmluc3RhbmNlID0gbmV3IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNlO1xyXG4gICAgfVxyXG59IiwgImltcG9ydCB7IFNjaGVkdWxlVHlwZSB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcbmltcG9ydCB7IFNjaGVkdWxlIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcclxuaW1wb3J0IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIgZnJvbSBcIi4vQ2FsZW5kYXJTdG9yYWdlTWFuYWdlclwiO1xyXG5pbXBvcnQgeyBTY2hlZHVsZVN0eWxlcyB9IGZyb20gXCIuL2NhbGVuZGVyXCI7XHJcblxyXG5leHBvcnQgY29uc3QgU2NoZWR1bGVJY29ucyA9IHtcclxuICAgIFsgU2NoZWR1bGVUeXBlLkhXIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vc3YyL2Fzc2lnbi8xNzQ1MjE3MzU4L2ljb25cIixcclxuICAgIFsgU2NoZWR1bGVUeXBlLlZJRCBdIDogXCJodHRwczovL3BsYXRvLnB1c2FuLmFjLmtyL3RoZW1lL2ltYWdlLnBocC9jb3Vyc2Vtb3N2Mi92b2QvMTc0NTIxNzM1OC9pY29uXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5RVUlaIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vc3YyL3F1aXovMTc0NTIxNzM1OC9pY29uXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5aT09NIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vc3YyL3pvb20vMTc0NTIxNzM1OC9pY29uXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5QQSBdIDogXCJodHRwczovL3BsYXRvLnB1c2FuLmFjLmtyL3RoZW1lL2ltYWdlLnBocC9jb3Vyc2Vtb3N2Mi92cGwvMTc0NTIxNzM1OC9pY29uXCJcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlU2NoZWR1bGVEaXYoZGF0YSA6IFNjaGVkdWxlKSB7XHJcbiAgICBjb25zdCBkaXZFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICBkaXZFbC5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgPGRpdiBpZD1cImljb24tZGl2XCI+XHJcbiAgICAgICAgICAgIDxpbWcgc3JjPVwiJHtTY2hlZHVsZUljb25zW2RhdGEudHlwZV19XCI+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgPGg0PiR7ZGF0YS5uYW1lfTwvaDQ+XHJcbiAgICAgICAgICAgIDxwPiR7ZGF0YS5jb3Vyc2UubmFtZX08L3A+XHJcbiAgICAgICAgICAgIDxwPiR7bmV3IERhdGUoZGF0YS5kdWUpLnRvTG9jYWxlU3RyaW5nKCl9PC9wPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIFxyXG4gICAgYFxyXG4gICAgZGl2RWwuY2xhc3NMaXN0LmFkZChcInNjaGVkdWxlXCIpO1xyXG4gICAgZGl2RWwub25jbGljayA9ICgpPT4ge1xyXG4gICAgICAgIHdpbmRvdy5vcGVuKGRhdGEudXJsKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWRhdGEub3JwaGFuZWQgJiYgIWRhdGEuY29tcGxldGVkKSBkaXZFbC5jbGFzc0xpc3QuYWRkKFNjaGVkdWxlU3R5bGVzW2RhdGEudHlwZV0pO1xyXG4gICAgZWxzZSBpZiAoZGF0YS5jb21wbGV0ZWQpIGRpdkVsLmNsYXNzTGlzdC5hZGQoXCJjb21wbGV0ZWRcIilcclxuICAgIGVsc2UgZGl2RWwuY2xhc3NMaXN0LmFkZChcIm9ycGhhbmVkXCIpO1xyXG4gICAgcmV0dXJuIGRpdkVsO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNb2RhbCB7XHJcbiAgICBwcml2YXRlIHN0YXRpYyBpbnN0YW5jZSA6IE1vZGFsO1xyXG4gICAgcHJpdmF0ZSBtb2RhbERpdiA6IEhUTUxEaXZFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSB0aXRsZUVsIDogSFRNTEhlYWRpbmdFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSBjb250ZW50RGl2IDogSFRNTERpdkVsZW1lbnQ7XHJcbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKG1vZGFsRGl2IDogSFRNTERpdkVsZW1lbnQpIHtcclxuICAgICAgICB0aGlzLm1vZGFsRGl2ID0gbW9kYWxEaXY7XHJcbiAgICAgICAgdGhpcy50aXRsZUVsID0gbW9kYWxEaXYucXVlcnlTZWxlY3RvcihcIiN0aXRsZVwiKSBhcyBIVE1MSGVhZGluZ0VsZW1lbnQ7XHJcbiAgICAgICAgdGhpcy5jb250ZW50RGl2ID0gbW9kYWxEaXYucXVlcnlTZWxlY3RvcihcIiNjb250ZW50XCIpIGFzIEhUTUxEaXZFbGVtZW50O1xyXG5cclxuICAgICAgICBjb25zdCBjbG9zZUJ1dHRvbiA9IG1vZGFsRGl2LnF1ZXJ5U2VsZWN0b3IoXCIuY2xvc2UtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgIGNsb3NlQnV0dG9uLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBvcGVuKGRhdGUgOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLmNvbnRlbnREaXYuaW5uZXJIVE1MID0gXCJcIjtcclxuICAgICAgICB0aGlzLnRpdGxlRWwudGV4dENvbnRlbnQgPSBuZXcgRGF0ZShkYXRlKS50b0xvY2FsZURhdGVTdHJpbmcoKTtcclxuICAgICAgICBjb25zdCBzY2hlZHVsZXMgPSBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLmdldEluc3RhbmNlKCkuZ2V0KGRhdGUpO1xyXG5cclxuICAgICAgICBpZiAoc2NoZWR1bGVzLmxlbmd0aCA9PT0gMCApIHJldHVybjtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coZGF0ZSwgc2NoZWR1bGVzKTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBzY2hlZHVsZSBvZiBzY2hlZHVsZXMpIHtcclxuICAgICAgICAgICAgY29uc3QgZGl2RWwgPSBjcmVhdGVTY2hlZHVsZURpdihzY2hlZHVsZSk7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudERpdi5hcHBlbmRDaGlsZChkaXZFbCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm1vZGFsRGl2LmNsYXNzTGlzdC5hZGQoXCJtb2RhbC1vcGVuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGNsb3NlKCkge1xyXG4gICAgICAgIHRoaXMubW9kYWxEaXYuY2xhc3NMaXN0LnJlbW92ZShcIm1vZGFsLW9wZW5cIik7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGdldEluc3RhbmNlKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNlO1xyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBnZXRWaWV3KCkge1xyXG4gICAgICAgIGlmICghdGhpcy5pbnN0YW5jZSkgeyBcclxuICAgICAgICAgICAgY29uc3QgbW9kYWxFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgICAgIG1vZGFsRWwuc2V0QXR0cmlidXRlKCdpZCcsIFwibW9kYWxcIik7XHJcblxyXG4gICAgICAgICAgICBtb2RhbEVsLmlubmVySFRNTCA9IGBcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdXN0b20tbW9kYWwtYmFja2Ryb3BcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdXN0b20tbW9kYWwtZGlhbG9nXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBpZD1cInRvcFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiY2xvc2UtYnRuXCI+XHUwMEQ3PC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGgyIGlkPVwidGl0bGVcIj48L2gyPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgaWQ9XCJjb250ZW50XCI+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgYDsgXHJcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2UgPSBuZXcgTW9kYWwobW9kYWxFbCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICByZXR1cm4gdGhpcy5pbnN0YW5jZS5tb2RhbERpdjtcclxuICAgIH1cclxufSIsICJpbXBvcnQgeyBBbGxTY2hlZHVsZXMgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC9zY2hlZHVsZVN0b3JhZ2VNYW5hZ2VyXCI7XHJcbmltcG9ydCB7IFNjaGVkdWxlLCBTY2hlZHVsZVR5cGUgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC91cGRhdGVTY2hlZHVsZVwiO1xyXG5pbXBvcnQgQ2FsZW5kYXJTdG9yYWdlTWFuYWdlciBmcm9tIFwiLi9DYWxlbmRhclN0b3JhZ2VNYW5hZ2VyXCI7XHJcbmltcG9ydCBNb2RhbCBmcm9tIFwiLi9tb2RhbFwiO1xyXG5pbXBvcnQgeyBDaGVja1NjaGVkdWxlVXBkYXRlVGltaW5nLCBnZXRDdXJyZW50Q291cnNlcywgZ2V0U2NoZWR1bGVzLCB1cGRhdGVTY2hlZHVsZXMgfSBmcm9tIFwiLi91dGlsc1wiO1xyXG5cclxuXHJcbmV4cG9ydCBjb25zdCBTY2hlZHVsZVN0eWxlcyA9IHtcclxuICAgIFsgU2NoZWR1bGVUeXBlLkhXIF0gOiBcImh3XCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5WSUQgXSA6IFwidmlkXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5RVUlaIF0gOiBcInF1aXpcIixcclxuICAgIFsgU2NoZWR1bGVUeXBlLlpPT00gXSA6IFwiem9vbVwiLFxyXG4gICAgWyBTY2hlZHVsZVR5cGUuUEEgXSA6IFwicGFcIlxyXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVTY2hlZHVsZU1pbmlEaXYoZGF0YSA6IFNjaGVkdWxlKSB7XHJcbiAgICBjb25zdCBkaXZFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICBkaXZFbC5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgJHtkYXRhLm5hbWV9XHJcbiAgICBgXHJcbiAgICBkaXZFbC5jbGFzc0xpc3QuYWRkKFwibWluaS1zY2hlZHVsZVwiKTtcclxuICAgIGlmICghZGF0YS5vcnBoYW5lZCAmJiAhZGF0YS5jb21wbGV0ZWQpIGRpdkVsLmNsYXNzTGlzdC5hZGQoU2NoZWR1bGVTdHlsZXNbZGF0YS50eXBlXSk7XHJcbiAgICBlbHNlIGlmIChkYXRhLmNvbXBsZXRlZCkgZGl2RWwuY2xhc3NMaXN0LmFkZChcImNvbXBsZXRlZFwiKVxyXG4gICAgZWxzZSBkaXZFbC5jbGFzc0xpc3QuYWRkKFwib3JwaGFuZWRcIik7XHJcbiAgICByZXR1cm4gZGl2RWw7XHJcbn1cclxuXHJcbi8vIHNpbmdsZXRvblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDYWxlbmRhciB7XHJcbiAgICBwcml2YXRlIHN0YXRpYyBjYWxlbmRlciA6IENhbGVuZGFyO1xyXG4gICAgcHJpdmF0ZSBkYXRlIDogRGF0ZTtcclxuICAgIHByaXZhdGUgZGF0ZUNlbGxzIDogSFRNTFRhYmxlQ2VsbEVsZW1lbnRbXTtcclxuICAgIHByaXZhdGUgbW9udGhMYWJlbCA6IEhUTUxTcGFuRWxlbWVudDtcclxuICAgIHByaXZhdGUgbWF4U2NoZWR1bGVSZW5kZXIgPSAyO1xyXG4gICAgLy8gXHVBRDczXHVDNzc0IFx1QUMwMFx1QzlDMFx1QUNFMFx1Qzc4OFx1Qzc0NCBcdUQ1NDRcdUM2OTQgXHVDNUM2XHVDNzQ0XHVDMjE4XHVCM0M0XHJcbiAgICAvLyBwcml2YXRlIHByZXZCdG4gOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgIC8vIHByaXZhdGUgbmV4dEJ0biA6IEhUTUxCdXR0b25FbGVtZW50O1xyXG5cclxuICAgIHByaXZhdGUgc2NoZWR1bGVzIDogQWxsU2NoZWR1bGVzID0ge307XHJcblxyXG4gICAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihjYWxlbmRhckRpdiA6IEhUTUxEaXZFbGVtZW50KSB7XHJcbiAgICAgICAgdGhpcy5kYXRlID0gbmV3IERhdGUoKTtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0RGF0ZSgxKTsgIC8vIDFcdUM3N0NcdUI4NUMgXHVCOURFXHVDREIwXHVDOEZDXHVBRTMwXHJcblxyXG4gICAgICAgIHRoaXMuZGF0ZUNlbGxzID0gQXJyYXkuZnJvbShjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yQWxsKFwidGJvZHkgdGRcIikpO1xyXG4gICAgICAgIHRoaXMubW9udGhMYWJlbCA9IGNhbGVuZGFyRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjbW9udGgtbGFiZWxcIikgYXMgSFRNTFNwYW5FbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IHByZXZCdG4gPSBjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yKFwiI3ByZXYtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IG5leHRCdG4gPSBjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yKFwiI25leHQtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IHVwZGF0ZUJ0biA9IGNhbGVuZGFyRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjdXBkYXRlLWJ0blwiKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcclxuXHJcbiAgICAgICAgdGhpcy51cGRhdGVNb250aExhYmVsKCk7XHJcblxyXG4gICAgICAgIHByZXZCdG4ub25jbGljayA9ICgpPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnRvUHJldk1vbnRoKCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBuZXh0QnRuLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy50b05leHRNb250aCgpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbmRlcigpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdXBkYXRlQnRuLm9uY2xpY2sgPSBhc3luYyAoKT0+e1xyXG4gICAgICAgICAgICB1cGRhdGVCdG4udGV4dENvbnRlbnQgPSBcIlx1QzVDNVx1QjM3MFx1Qzc3NFx1RDJCOCBcdUM5MTFcIlxyXG4gICAgICAgICAgICB1cGRhdGVCdG4uY2xhc3NMaXN0LmFkZChcInVwZGF0aW5nXCIpO1xyXG4gICAgICAgICAgICB1cGRhdGVCdG4uZGlzYWJsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVNjaGVkdWxlcygpO1xyXG4gICAgICAgICAgICB1cGRhdGVCdG4udGV4dENvbnRlbnQgPSBcIlx1QzVDNVx1QjM3MFx1Qzc3NFx1RDJCOFwiXHJcbiAgICAgICAgICAgIHVwZGF0ZUJ0bi5jbGFzc0xpc3QucmVtb3ZlKFwidXBkYXRpbmdcIik7XHJcbiAgICAgICAgICAgIHVwZGF0ZUJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmIChDaGVja1NjaGVkdWxlVXBkYXRlVGltaW5nKCkpIHVwZGF0ZUJ0bi5jbGljaygpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcmVuZGVyKCkge1xyXG4gICAgICAgIHRoaXMuY2xlYXJDZWxscygpO1xyXG4gICAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZSh0aGlzLmRhdGUpO1xyXG4gICAgICAgIGNvbnN0IG1vbnRoID0gZC5nZXRNb250aCgpO1xyXG4gICAgICAgIGNvbnN0IGRheSA9IGQuZ2V0RGF5KCk7XHJcblxyXG4gICAgICAgIC8vIGF3YWl0IHRoaXMuZ2V0U2NoZWR1bGVzKCk7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2codGhpcy5zY2hlZHVsZXMpO1xyXG4gICAgICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKS50b0RhdGVTdHJpbmcoKTtcclxuICAgICAgICB3aGlsZSAoZC5nZXRNb250aCgpID09IG1vbnRoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuZGF0ZUNlbGxzW2QuZ2V0RGF0ZSgpIC0gMSArIGRheV07XHJcblxyXG4gICAgICAgICAgICBjb25zdCBkYXRlTGFiZWxEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgICAgICAgICBjb25zdCBpbmZvRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHJcbiAgICAgICAgICAgIGRhdGVMYWJlbERpdi5jbGFzc0xpc3QuYWRkKFwiZGF0ZS1sYWJlbC1kaXZcIik7XHJcbiAgICAgICAgICAgIGluZm9EaXYuY2xhc3NMaXN0LmFkZChcImluZm8tZGl2XCIpO1xyXG5cclxuICAgICAgICAgICAgaWYgKGQudG9EYXRlU3RyaW5nKCkgPT0gdG9kYXkpIGRhdGVMYWJlbERpdi5jbGFzc0xpc3QuYWRkKFwidG9kYXlcIik7XHJcblxyXG5cclxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0U2NoZWR1bGVzID0gQ2FsZW5kYXJTdG9yYWdlTWFuYWdlci5nZXRJbnN0YW5jZSgpLmdldChkLnRvRGF0ZVN0cmluZygpKTtcclxuICAgICAgICAgICAgXHJcblxyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IE1hdGgubWluKHRhcmdldFNjaGVkdWxlcy5sZW5ndGgsIHRoaXMubWF4U2NoZWR1bGVSZW5kZXIpOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGluZm9EaXYuYXBwZW5kQ2hpbGQoY3JlYXRlU2NoZWR1bGVNaW5pRGl2KHRhcmdldFNjaGVkdWxlc1tpXSkpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBkYXRlTGFiZWxEaXYuaW5uZXJIVE1MID0gYFxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJkYXRlLWxhYmVsXCI+JHtkLmdldERhdGUoKS50b1N0cmluZygpfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidW5yZXNvbHZlZC1zY2hlZHVsZXNcIj4ke3RhcmdldFNjaGVkdWxlcy5maWx0ZXIoZT0+IWUuY29tcGxldGVkICYmICFlLm9ycGhhbmVkKS5sZW5ndGggfHwgXCJcIn08L3NwYW4+XHJcbiAgICAgICAgICAgIGBcclxuXHJcblxyXG4gICAgICAgICAgICBpZiAodGFyZ2V0U2NoZWR1bGVzLmxlbmd0aCA+IHRoaXMubWF4U2NoZWR1bGVSZW5kZXIpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGhpZGRlblNjaGVkdWxlRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgICAgICAgICAgICAgIGhpZGRlblNjaGVkdWxlRGl2LnRleHRDb250ZW50ID0gYCske3RhcmdldFNjaGVkdWxlcy5sZW5ndGggLSB0aGlzLm1heFNjaGVkdWxlUmVuZGVyfWA7XHJcbiAgICAgICAgICAgICAgICBpbmZvRGl2LmFwcGVuZENoaWxkKGhpZGRlblNjaGVkdWxlRGl2KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGFyZ2V0LmFwcGVuZENoaWxkKGRhdGVMYWJlbERpdik7XHJcbiAgICAgICAgICAgIHRhcmdldC5hcHBlbmRDaGlsZChpbmZvRGl2KTtcclxuICAgICAgICAgICAgY29uc3QgY3VyRCA9IG5ldyBEYXRlKGQudG9TdHJpbmcoKSlcclxuICAgICAgICAgICAgdGFyZ2V0Lm9uY2xpY2sgPSAoKT0+IHsgTW9kYWwuZ2V0SW5zdGFuY2UoKS5vcGVuKGN1ckQudG9EYXRlU3RyaW5nKCkpIH1cclxuICAgICAgICAgICAgZC5zZXREYXRlKGQuZ2V0RGF0ZSgpICsgMSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdG9QcmV2TW9udGgoKSA6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuZGF0ZS5zZXRNb250aCh0aGlzLmRhdGUuZ2V0TW9udGgoKSAtIDEpO1xyXG4gICAgICAgIHRoaXMuZGF0ZS5zZXREYXRlKDEpOyAgLy8gMVx1Qzc3Q1x1Qjg1QyBcdUI5REVcdUNEQjBcdUM4RkNcdUFFMzBcclxuICAgICAgICB0aGlzLnVwZGF0ZU1vbnRoTGFiZWwoKTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB0b05leHRNb250aCgpIDogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldE1vbnRoKHRoaXMuZGF0ZS5nZXRNb250aCgpICsgMSk7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldERhdGUoMSk7ICAvLyAxXHVDNzdDXHVCODVDIFx1QjlERVx1Q0RCMFx1QzhGQ1x1QUUzMFxyXG4gICAgICAgIHRoaXMudXBkYXRlTW9udGhMYWJlbCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgY2xlYXJDZWxscygpIDogdm9pZCB7XHJcbiAgICAgICAgZm9yIChjb25zdCBjZWxsIG9mIHRoaXMuZGF0ZUNlbGxzKSB7XHJcbiAgICAgICAgICAgIGNlbGwudGV4dENvbnRlbnQgPSBcIlwiO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHVwZGF0ZU1vbnRoTGFiZWwoKSB7XHJcbiAgICAgICAgdGhpcy5tb250aExhYmVsLnRleHRDb250ZW50ID0gYCR7dGhpcy5kYXRlLmdldEZ1bGxZZWFyKCl9XHVCMTQ0ICR7dGhpcy5kYXRlLmdldE1vbnRoKCkgKyAxfVx1QzZENGA7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyB1cGRhdGVTY2hlZHVsZXMoKSB7XHJcbiAgICAgICAgYXdhaXQgdXBkYXRlU2NoZWR1bGVzKCk7XHJcbiAgICAgICAgYXdhaXQgQ2FsZW5kYXJTdG9yYWdlTWFuYWdlci51cGRhdGUoKTtcclxuICAgICAgICBhd2FpdCB0aGlzLnJlbmRlcigpO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0VmlldygpIDogUHJvbWlzZTxIVE1MRGl2RWxlbWVudD4ge1xyXG4gICAgICAgIGNvbnN0IGNhbGVuZGFyRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cclxuICAgICAgICBjYWxlbmRhckVsLmlubmVySFRNTCA9IChgXHJcbiAgICAgICAgICAgIDxkaXYgaWQ9XCJjb250cm9sXCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGlkPVwiaW5mb1wiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJwcmV2LWJ0blwiPiZsdDs8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBpZD1cIm1vbnRoLWxhYmVsXCI+PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJuZXh0LWJ0blwiPiZndDs8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cInVwZGF0ZS1idG5cIj5cdUM1QzVcdUIzNzBcdUM3NzRcdUQyQjg8L2J1dHRvbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDx0YWJsZT5cclxuICAgICAgICAgICAgICAgIDx0aGVhZD5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUM3N0M8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVDNkQ0PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1RDY1NDwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUMyMTg8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVCQUE5PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1QUUwODwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUQxQTA8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+ICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgPC90aGVhZD5cclxuICAgICAgICAgICAgICAgIDx0Ym9keT5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgIDwvdGJvZHk+XHJcbiAgICAgICAgICAgIDwvdGFibGU+XHJcbiAgICAgICAgYCk7XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5jYWxlbmRlcikgXHJcbiAgICAgICAgICAgIHRoaXMuY2FsZW5kZXIgPSBuZXcgQ2FsZW5kYXIoY2FsZW5kYXJFbCk7XHJcbiAgICAgICAgLy8gdGhpcy5jYWxlbmRlci5nZXRTY2hlZHVsZXMoKTtcclxuICAgICAgICB0aGlzLmNhbGVuZGVyLnJlbmRlcigpO1xyXG4gICAgICAgIHJldHVybiBjYWxlbmRhckVsO1xyXG4gICAgfVxyXG59O1xyXG4iLCAiaW1wb3J0IENhbGVuZGFyIGZyb20gXCIuL2NhbGVuZGVyXCI7XHJcbmltcG9ydCBNb2RhbCBmcm9tIFwiLi9tb2RhbFwiO1xyXG5pbXBvcnQgeyBTdWJqZWN0IH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcclxuXHJcbi8vIGltcG9ydCB7Y2FsZW5kYXJDc3N9IGZyb20gXCIuL2NvbnN0c1wiO1xyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIG1haW4oKSA6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgdGFyZ2V0RWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLmZyb250LWJveC5mcm9udC1ib3gtY291cnNlXCIpO1xyXG4gICAgaWYgKCF0YXJnZXRFbCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIGNvbnN0IHN0eWxlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XHJcbiAgICBjb25zdCBkZXRhaWxzRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGV0YWlsc1wiKTtcclxuICAgIGNvbnN0IHN1bW1hcnlFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdW1tYXJ5XCIpO1xyXG4gICAgc3VtbWFyeUVsLnRleHRDb250ZW50ID0gXCJQbGF0byBDYWxlbmRhcjNcIjtcclxuICAgIC8vIHN0eWxlRWwuaW5uZXJIVE1MID0gY2FsZW5kYXJDc3M7XHJcbiAgICBcclxuICAgIGRldGFpbHNFbC5hcHBlbmRDaGlsZChzdW1tYXJ5RWwpO1xyXG4gICAgZGV0YWlsc0VsLmFwcGVuZENoaWxkKGF3YWl0IE1vZGFsLmdldFZpZXcoKSk7XHJcbiAgICBkZXRhaWxzRWwuYXBwZW5kQ2hpbGQoYXdhaXQgQ2FsZW5kYXIuZ2V0VmlldygpKTtcclxuICAgIGRldGFpbHNFbC5zZXRBdHRyaWJ1dGUoXCJpZFwiLCBcInBsYXRvLWNhbGVuZGFyXCIpO1xyXG4gICAgXHJcbiAgICB0YXJnZXRFbD8ucHJlcGVuZChkZXRhaWxzRWwpO1xyXG59XHJcblxyXG5tYWluKCk7XHJcblxyXG5cclxuIl0sCiAgIm1hcHBpbmdzIjogIjs7O0FBR0EsaUJBQXNCLGVBQXVDO0FBQ3pELFlBQVEsSUFBSSx3SUFBK0I7QUFHM0MsVUFBTSxXQUFXLE1BQU0sT0FBTyxRQUFRLFlBQVksRUFBRSxRQUFRLGdCQUFnQixDQUFDO0FBRzdFLFlBQVEsSUFBSSxzRkFBcUIsUUFBUTtBQUd6QyxXQUFPLFNBQVM7QUFBQSxFQUNwQjtBQUVBLE1BQU0sa0JBQWtCO0FBRXhCLGlCQUFzQixrQkFBa0I7QUFDcEMsaUJBQWEsUUFBUSxrQkFBaUIsb0JBQUksS0FBSyxHQUFFLFNBQVMsQ0FBQztBQUMzRCxVQUFNLE1BQU0sTUFBTSxPQUFPLFFBQVEsWUFBWTtBQUFBLE1BQ3pDLFFBQVE7QUFBQSxJQUNaLENBQUM7QUFFRCxZQUFRLElBQUksR0FBRztBQUFBLEVBQ25CO0FBRVEsV0FBUyw0QkFBNEI7QUFDekMsVUFBTSxPQUFNLG9CQUFJLEtBQUssR0FBRSxRQUFRO0FBQy9CLFVBQU0sY0FBYyxJQUFJLEtBQUssYUFBYSxRQUFRLGVBQWUsQ0FBVyxHQUFHLFFBQVEsS0FBSztBQUU1RixVQUFNLE9BQU8sTUFBTztBQUNwQixXQUFRLE1BQUksY0FBYztBQUFBLEVBQzlCO0FBRUEsaUJBQXNCLG9CQUF5QztBQUMzRCxVQUFNLFdBQVcsTUFBTSxPQUFPLFFBQVEsWUFBWSxFQUFFLFFBQVEsaUJBQWlC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
