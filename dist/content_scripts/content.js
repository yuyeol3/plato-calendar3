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
      _CalendarStorageManager.save(this.data);
    }
    // 조회
    get(date) {
      return Object.values(this.data[date] ?? {});
    }
    // 삭제
    remove(date) {
      delete this.data[date];
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy91dGlscy50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL0NhbGVuZGFyU3RvcmFnZU1hbmFnZXIudHMiLCAiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy9tb2RhbC50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL2NhbGVuZGVyLnRzIiwgIi4uLy4uL3NyYy9jb250ZW50X3NjcmlwdHMvY29udGVudC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgQWxsU2NoZWR1bGVzIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvc2NoZWR1bGVTdG9yYWdlTWFuYWdlclwiO1xyXG5pbXBvcnQgeyBTdWJqZWN0IH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTY2hlZHVsZXMoKSA6IFByb21pc2U8QWxsU2NoZWR1bGVzPiB7XHJcbiAgICBjb25zb2xlLmxvZyhcIlx1QzExQ1x1QkU0NFx1QzJBNCBcdUM2Q0NcdUNFRTRcdUM1RDBcdUFDOEMgXHVDMkE0XHVDRjAwXHVDOTA0IFx1QjM3MFx1Qzc3NFx1RDEzMCBcdUI4NUNcdUI0RENcdUI5N0MgXHVDNjk0XHVDQ0FEXHVENTY5XHVCMkM4XHVCMkU0Li4uXCIpO1xyXG5cclxuICAgIC8vIDEuICdsb2FkU2NoZWR1bGVzJ1x1Qjc3Q1x1QjI5NCBhY3Rpb25cdUM3NDQgXHVCMkY0XHVDNTQ0IFx1QkE1NFx1QzJEQ1x1QzlDMCBcdUM4MDRcdUMxQTFcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyBhY3Rpb246IFwibG9hZFNjaGVkdWxlc1wiIH0pO1xyXG5cclxuICAgIC8vIDQuIFx1QzExQ1x1QkU0NFx1QzJBNCBcdUM2Q0NcdUNFRTRcdUI4NUNcdUJEODBcdUQxMzAgXHVCQzFCXHVDNzQwIFx1QUNCMFx1QUNGQ1xyXG4gICAgY29uc29sZS5sb2coXCJcdUMxMUNcdUJFNDRcdUMyQTQgXHVDNkNDXHVDRUU0XHVCODVDXHVCRDgwXHVEMTMwIFx1QkMxQlx1Qzc0MCBcdUMyQTRcdUNGMDBcdUM5MDQ6XCIsIHJlc3BvbnNlKTtcclxuICAgIFxyXG4gICAgLy8gXHVDNzc0IFx1QjM3MFx1Qzc3NFx1RDEzMFx1Qjk3QyBcdUMwQUNcdUM2QTlcdUQ1NThcdUM1RUMgXHVEMzk4XHVDNzc0XHVDOUMwXHVDNzU4IERPTVx1Qzc0NCBcdUM4NzBcdUM3OTFcdUQ1NjAgXHVDMjE4IFx1Qzc4OFx1QzJCNVx1QjJDOFx1QjJFNC5cclxuICAgIHJldHVybiByZXNwb25zZS5yZXN1bHQ7XHJcbn1cclxuXHJcbmNvbnN0IExBU1RfVVBEQVRFX0tFWSA9IFwicGxhdG8tY2FsZW5kYXIzLWxhc3RVcGRhdGVcIlxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVNjaGVkdWxlcygpIHtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKExBU1RfVVBEQVRFX0tFWSwgbmV3IERhdGUoKS50b1N0cmluZygpKTtcclxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcclxuICAgICAgICBhY3Rpb246IFwidXBkYXRlRGF0YVwiXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhyZXMpO1xyXG59XHJcblxyXG5leHBvcnQgIGZ1bmN0aW9uIENoZWNrU2NoZWR1bGVVcGRhdGVUaW1pbmcoKSB7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICAgIGNvbnN0IGxhc3RVcGRhdGVkID0gbmV3IERhdGUobG9jYWxTdG9yYWdlLmdldEl0ZW0oTEFTVF9VUERBVEVfS0VZKSBhcyBzdHJpbmcpPy5nZXRUaW1lKCkgPz8gMDtcclxuXHJcbiAgICBjb25zdCBIT1VSID0gMTAwMCAqIDM2MDA7XHJcbiAgICByZXR1cm4gKG5vdy1sYXN0VXBkYXRlZCA+IEhPVVIpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q3VycmVudENvdXJzZXMoKSA6IFByb21pc2U8U3ViamVjdFtdPiB7XHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHsgYWN0aW9uOiBcImxvYWRDdXJDb3Vyc2VzXCIgfSk7ICAgIFxyXG4gICAgcmV0dXJuIHJlc3BvbnNlLnJlc3VsdDtcclxufSIsICJpbXBvcnQgeyBTY2hlZHVsZSB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcbmltcG9ydCB7IGdldEN1cnJlbnRDb3Vyc2VzLCBnZXRTY2hlZHVsZXMgfSBmcm9tIFwiLi91dGlsc1wiO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDYWxlbmRhclN0b3JhZ2Uge1xyXG4gICAgW2RhdGU6IHN0cmluZ106IHtcclxuICAgICAgICBbc2NoZWR1bGVJZDogc3RyaW5nXTogU2NoZWR1bGU7XHJcbiAgICB9O1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyIHtcclxuICAgIHByaXZhdGUgc3RhdGljIGluc3RhbmNlIDogQ2FsZW5kYXJTdG9yYWdlTWFuYWdlcjtcclxuICAgIHByaXZhdGUgS0VZX05BTUUgOiBzdHJpbmc7XHJcbiAgICBwcml2YXRlIGRhdGEgOiBDYWxlbmRhclN0b3JhZ2U7XHJcbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgICAgIHRoaXMuS0VZX05BTUUgPSBcInBsYXRvLWNhbGVuZGFyM1wiO1xyXG4gICAgICAgIC8vIGNvbnN0IHN0b3JhZ2VTdHIgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSh0aGlzLktFWV9OQU1FKTtcclxuICAgICAgICB0aGlzLmRhdGEgPSB7fTtcclxuICAgICAgICBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLnVwZGF0ZSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFx1Q0Q5NFx1QUMwMFxyXG4gICAgc2V0KGRhdGUgOiBzdHJpbmcsIGlkIDogc3RyaW5nLCBkYXRhIDogU2NoZWR1bGUpIHtcclxuICAgICAgICBpZiAoIXRoaXMuZGF0YVtkYXRlXSkgdGhpcy5kYXRhW2RhdGVdID0ge307XHJcbiAgICAgICAgaWYgKCF0aGlzLmRhdGFbZGF0ZV0/LltpZF0pIHRoaXMuZGF0YVtkYXRlXVtpZF0gPSBkYXRhO1xyXG4gICAgICAgIGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCBleGlzdGluZ1NjaGVkdWxlID0gdGhpcy5kYXRhW2RhdGVdW2lkXTtcclxuXHJcbiAgICAgICAgICAgIGV4aXN0aW5nU2NoZWR1bGUubmFtZSA9IGRhdGEubmFtZTtcclxuICAgICAgICAgICAgZXhpc3RpbmdTY2hlZHVsZS5jb21wbGV0ZWQgPSBkYXRhLmNvbXBsZXRlZDtcclxuICAgICAgICAgICAgZXhpc3RpbmdTY2hlZHVsZS5kdWUgPSBkYXRhLmR1ZTtcclxuICAgICAgICAgICAgZXhpc3RpbmdTY2hlZHVsZS5vcnBoYW5lZCA9IGRhdGEub3JwaGFuZWQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSh0aGlzLktFWV9OQU1FLCBKU09OLnN0cmluZ2lmeSh0aGlzLmRhdGEpKTtcclxuICAgICAgICBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLnNhdmUodGhpcy5kYXRhKTtcclxuICAgIH0gICBcclxuXHJcbiAgICAvLyBcdUM4NzBcdUQ2OENcclxuICAgIGdldChkYXRlIDogc3RyaW5nKSB7XHJcbiAgICAgICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5kYXRhW2RhdGVdID8/IHt9KTtcclxuICAgIH1cclxuICAgIC8vIFx1QzBBRFx1QzgxQ1xyXG4gICAgcmVtb3ZlKGRhdGUgOiBzdHJpbmcpIHtcclxuICAgICAgICBkZWxldGUgdGhpcy5kYXRhW2RhdGVdO1xyXG4gICAgICAgIC8vIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMuS0VZX05BTUUsIEpTT04uc3RyaW5naWZ5KHRoaXMuZGF0YSkpO1xyXG4gICAgICAgIENhbGVuZGFyU3RvcmFnZU1hbmFnZXIuc2F2ZSh0aGlzLmRhdGEpO1xyXG4gICAgfVxyXG4gXHJcbiAgICBjbGVhblVwKHNjaGVkdWxlcyA6IFNjaGVkdWxlW10pIHtcclxuICAgICAgICBjb25zdCBkYXRlU3RyaW5ncyA6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IHNjaGVkdWxlIG9mIHNjaGVkdWxlcykge1xyXG4gICAgICAgICAgICBjb25zdCBkID0gbmV3IERhdGUoc2NoZWR1bGUuZHVlLnRvU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICBpZiAoZC50b1N0cmluZygpID09PSBcIkludmFsaWQgRGF0ZVwiKSBjb250aW51ZTtcclxuICAgICAgICAgICAgZC5zZXREYXRlKDEpO1xyXG4gICAgICAgICAgICBkYXRlU3RyaW5ncy5hZGQoZC50b0RhdGVTdHJpbmcoKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IGRhdGVTdHJpbmcgb2YgZGF0ZVN0cmluZ3MpIHtcclxuICAgICAgICAgICAgY29uc3QgZCA9IG5ldyBEYXRlKGRhdGVTdHJpbmcpO1xyXG4gICAgICAgICAgICBjb25zdCBtb250aCA9IGQuZ2V0TW9udGgoKTtcclxuXHJcbiAgICAgICAgICAgIHdoaWxlIChkLmdldE1vbnRoKCkgIT0gbW9udGgpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlKGQudG9EYXRlU3RyaW5nKCkpO1xyXG4gICAgICAgICAgICAgICAgZC5zZXREYXRlKGQuZ2V0RGF0ZSgpICsgMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBhc3luYyBzYXZlKGRhdGEgOiBDYWxlbmRhclN0b3JhZ2UpIHtcclxuICAgICAgICBhd2FpdCBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XHJcbiAgICAgICAgICAgIGRhdGEgOiBkYXRhLFxyXG4gICAgICAgICAgICBhY3Rpb24gOiBcImNhbGVuZGFyL3NhdmVcIlxyXG4gICAgICAgIH0pXHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGFzeW5jIGxvYWQoKSA6IFByb21pc2U8Q2FsZW5kYXJTdG9yYWdlPiB7XHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7XHJcbiAgICAgICAgICAgIGFjdGlvbiA6IFwiY2FsZW5kYXIvbG9hZFwiXHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlLnJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgYXN5bmMgdXBkYXRlKCkge1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmxvYWQoKTtcclxuICAgICAgICBjb25zdCBzY2hlZHVsZXMgPSBhd2FpdCBnZXRTY2hlZHVsZXMoKTtcclxuICAgICAgICBjb25zdCBjdXJyZW50Q291cnNlcyA9IGF3YWl0IGdldEN1cnJlbnRDb3Vyc2VzKCkgPz8gW107XHJcblxyXG4gICAgICAgIHRoaXMuZ2V0SW5zdGFuY2UoKS5kYXRhID0gZGF0YTtcclxuICAgICAgICB0aGlzLmdldEluc3RhbmNlKCkuY2xlYW5VcChjdXJyZW50Q291cnNlcy5tYXAoZT0+T2JqZWN0LnZhbHVlcyhzY2hlZHVsZXNbZS5pZF0pKS5mbGF0KCkpO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IGNvdXJzZSBvZiBjdXJyZW50Q291cnNlcykge1xyXG4gICAgICAgICAgICBjb25zdCBjb3Vyc2VTY2hlZHVsZXMgPSBPYmplY3QudmFsdWVzKHNjaGVkdWxlc1tjb3Vyc2UuaWRdKTtcclxuXHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgcyBvZiBjb3Vyc2VTY2hlZHVsZXMpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZShzLmR1ZS50b1N0cmluZygpKTtcclxuICAgICAgICAgICAgICAgIGRhdGUuc2V0U2Vjb25kcyhkYXRlLmdldFNlY29uZHMoKSAtIDEpOyAvLyBcdUM3OTBcdUM4MTVcdUM3NzggXHVBQ0JEXHVDNkIwIFx1RDU1OFx1QjhFOCBcdUM4MDRcdUM3M0NcdUI4NUMgXHVDMTI0XHVDODE1XHVENTU4XHVBRTMwXHJcbiAgICAgICAgICAgICAgICB0aGlzLmdldEluc3RhbmNlKCkuc2V0KFxyXG4gICAgICAgICAgICAgICAgICAgIGRhdGUudG9EYXRlU3RyaW5nKCksIFxyXG4gICAgICAgICAgICAgICAgICAgIHMuaWQsIHNcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGdldEluc3RhbmNlKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmluc3RhbmNlID09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhpcy5pbnN0YW5jZSA9IG5ldyBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy5pbnN0YW5jZTtcclxuICAgIH1cclxufSIsICJpbXBvcnQgeyBTY2hlZHVsZVR5cGUgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC91cGRhdGVTY2hlZHVsZVwiO1xyXG5pbXBvcnQgeyBTY2hlZHVsZSB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcbmltcG9ydCBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyIGZyb20gXCIuL0NhbGVuZGFyU3RvcmFnZU1hbmFnZXJcIjtcclxuaW1wb3J0IHsgU2NoZWR1bGVTdHlsZXMgfSBmcm9tIFwiLi9jYWxlbmRlclwiO1xyXG5cclxuZXhwb3J0IGNvbnN0IFNjaGVkdWxlSWNvbnMgPSB7XHJcbiAgICBbIFNjaGVkdWxlVHlwZS5IVyBdIDogXCJodHRwczovL3BsYXRvLnB1c2FuLmFjLmtyL3RoZW1lL2ltYWdlLnBocC9jb3Vyc2Vtb3N2Mi9hc3NpZ24vMTc0NTIxNzM1OC9pY29uXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5WSUQgXSA6IFwiaHR0cHM6Ly9wbGF0by5wdXNhbi5hYy5rci90aGVtZS9pbWFnZS5waHAvY291cnNlbW9zdjIvdm9kLzE3NDUyMTczNTgvaWNvblwiLFxyXG4gICAgWyBTY2hlZHVsZVR5cGUuUVVJWiBdIDogXCJodHRwczovL3BsYXRvLnB1c2FuLmFjLmtyL3RoZW1lL2ltYWdlLnBocC9jb3Vyc2Vtb3N2Mi9xdWl6LzE3NDUyMTczNTgvaWNvblwiLFxyXG4gICAgWyBTY2hlZHVsZVR5cGUuWk9PTSBdIDogXCJodHRwczovL3BsYXRvLnB1c2FuLmFjLmtyL3RoZW1lL2ltYWdlLnBocC9jb3Vyc2Vtb3N2Mi96b29tLzE3NDUyMTczNTgvaWNvblwiLFxyXG4gICAgWyBTY2hlZHVsZVR5cGUuUEEgXSA6IFwiaHR0cHM6Ly9wbGF0by5wdXNhbi5hYy5rci90aGVtZS9pbWFnZS5waHAvY291cnNlbW9zdjIvdnBsLzE3NDUyMTczNTgvaWNvblwiXHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNyZWF0ZVNjaGVkdWxlRGl2KGRhdGEgOiBTY2hlZHVsZSkge1xyXG4gICAgY29uc3QgZGl2RWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgZGl2RWwuaW5uZXJIVE1MID0gYFxyXG4gICAgICAgIDxkaXYgaWQ9XCJpY29uLWRpdlwiPlxyXG4gICAgICAgICAgICA8aW1nIHNyYz1cIiR7U2NoZWR1bGVJY29uc1tkYXRhLnR5cGVdfVwiPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgIDxoND4ke2RhdGEubmFtZX08L2g0PlxyXG4gICAgICAgICAgICA8cD4ke2RhdGEuY291cnNlLm5hbWV9PC9wPlxyXG4gICAgICAgICAgICA8cD4ke25ldyBEYXRlKGRhdGEuZHVlKS50b0xvY2FsZVN0cmluZygpfTwvcD5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgICBcclxuICAgIGBcclxuICAgIGRpdkVsLmNsYXNzTGlzdC5hZGQoXCJzY2hlZHVsZVwiKTtcclxuICAgIGRpdkVsLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICB3aW5kb3cub3BlbihkYXRhLnVybCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFkYXRhLm9ycGhhbmVkICYmICFkYXRhLmNvbXBsZXRlZCkgZGl2RWwuY2xhc3NMaXN0LmFkZChTY2hlZHVsZVN0eWxlc1tkYXRhLnR5cGVdKTtcclxuICAgIGVsc2UgaWYgKGRhdGEuY29tcGxldGVkKSBkaXZFbC5jbGFzc0xpc3QuYWRkKFwiY29tcGxldGVkXCIpXHJcbiAgICBlbHNlIGRpdkVsLmNsYXNzTGlzdC5hZGQoXCJvcnBoYW5lZFwiKTtcclxuICAgIHJldHVybiBkaXZFbDtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTW9kYWwge1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgaW5zdGFuY2UgOiBNb2RhbDtcclxuICAgIHByaXZhdGUgbW9kYWxEaXYgOiBIVE1MRGl2RWxlbWVudDtcclxuICAgIHByaXZhdGUgdGl0bGVFbCA6IEhUTUxIZWFkaW5nRWxlbWVudDtcclxuICAgIHByaXZhdGUgY29udGVudERpdiA6IEhUTUxEaXZFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSBjb25zdHJ1Y3Rvcihtb2RhbERpdiA6IEhUTUxEaXZFbGVtZW50KSB7XHJcbiAgICAgICAgdGhpcy5tb2RhbERpdiA9IG1vZGFsRGl2O1xyXG4gICAgICAgIHRoaXMudGl0bGVFbCA9IG1vZGFsRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjdGl0bGVcIikgYXMgSFRNTEhlYWRpbmdFbGVtZW50O1xyXG4gICAgICAgIHRoaXMuY29udGVudERpdiA9IG1vZGFsRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjY29udGVudFwiKSBhcyBIVE1MRGl2RWxlbWVudDtcclxuXHJcbiAgICAgICAgY29uc3QgY2xvc2VCdXR0b24gPSBtb2RhbERpdi5xdWVyeVNlbGVjdG9yKFwiLmNsb3NlLWJ0blwiKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgICAgICBjbG9zZUJ1dHRvbi5vbmNsaWNrID0gKCk9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuY2xvc2UoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgb3BlbihkYXRlIDogc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5jb250ZW50RGl2LmlubmVySFRNTCA9IFwiXCI7XHJcbiAgICAgICAgdGhpcy50aXRsZUVsLnRleHRDb250ZW50ID0gbmV3IERhdGUoZGF0ZSkudG9Mb2NhbGVEYXRlU3RyaW5nKCk7XHJcbiAgICAgICAgY29uc3Qgc2NoZWR1bGVzID0gQ2FsZW5kYXJTdG9yYWdlTWFuYWdlci5nZXRJbnN0YW5jZSgpLmdldChkYXRlKTtcclxuXHJcbiAgICAgICAgaWYgKHNjaGVkdWxlcy5sZW5ndGggPT09IDAgKSByZXR1cm47XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGRhdGUsIHNjaGVkdWxlcyk7XHJcblxyXG4gICAgICAgIGZvciAoY29uc3Qgc2NoZWR1bGUgb2Ygc2NoZWR1bGVzKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGRpdkVsID0gY3JlYXRlU2NoZWR1bGVEaXYoc2NoZWR1bGUpO1xyXG4gICAgICAgICAgICB0aGlzLmNvbnRlbnREaXYuYXBwZW5kQ2hpbGQoZGl2RWwpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5tb2RhbERpdi5jbGFzc0xpc3QuYWRkKFwibW9kYWwtb3BlblwiKTtcclxuICAgIH1cclxuXHJcbiAgICBjbG9zZSgpIHtcclxuICAgICAgICB0aGlzLm1vZGFsRGl2LmNsYXNzTGlzdC5yZW1vdmUoXCJtb2RhbC1vcGVuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBnZXRJbnN0YW5jZSgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5pbnN0YW5jZTtcclxuICAgIH1cclxuXHJcbiAgICBzdGF0aWMgZ2V0VmlldygpIHtcclxuICAgICAgICBpZiAoIXRoaXMuaW5zdGFuY2UpIHsgXHJcbiAgICAgICAgICAgIGNvbnN0IG1vZGFsRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgICAgICAgICBtb2RhbEVsLnNldEF0dHJpYnV0ZSgnaWQnLCBcIm1vZGFsXCIpO1xyXG5cclxuICAgICAgICAgICAgbW9kYWxFbC5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY3VzdG9tLW1vZGFsLWJhY2tkcm9wXCI+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY3VzdG9tLW1vZGFsLWRpYWxvZ1wiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgaWQ9XCJ0b3BcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImNsb3NlLWJ0blwiPlx1MDBENzwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxoMiBpZD1cInRpdGxlXCI+PC9oMj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGlkPVwiY29udGVudFwiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIGA7IFxyXG4gICAgICAgICAgICB0aGlzLmluc3RhbmNlID0gbmV3IE1vZGFsKG1vZGFsRWwpO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuaW5zdGFuY2UubW9kYWxEaXY7XHJcbiAgICB9XHJcbn0iLCAiaW1wb3J0IHsgQWxsU2NoZWR1bGVzIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvc2NoZWR1bGVTdG9yYWdlTWFuYWdlclwiO1xyXG5pbXBvcnQgeyBTY2hlZHVsZSwgU2NoZWR1bGVUeXBlIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcclxuaW1wb3J0IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIgZnJvbSBcIi4vQ2FsZW5kYXJTdG9yYWdlTWFuYWdlclwiO1xyXG5pbXBvcnQgTW9kYWwgZnJvbSBcIi4vbW9kYWxcIjtcclxuaW1wb3J0IHsgQ2hlY2tTY2hlZHVsZVVwZGF0ZVRpbWluZywgZ2V0Q3VycmVudENvdXJzZXMsIGdldFNjaGVkdWxlcywgdXBkYXRlU2NoZWR1bGVzIH0gZnJvbSBcIi4vdXRpbHNcIjtcclxuXHJcblxyXG5leHBvcnQgY29uc3QgU2NoZWR1bGVTdHlsZXMgPSB7XHJcbiAgICBbIFNjaGVkdWxlVHlwZS5IVyBdIDogXCJod1wiLFxyXG4gICAgWyBTY2hlZHVsZVR5cGUuVklEIF0gOiBcInZpZFwiLFxyXG4gICAgWyBTY2hlZHVsZVR5cGUuUVVJWiBdIDogXCJxdWl6XCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5aT09NIF0gOiBcInpvb21cIixcclxuICAgIFsgU2NoZWR1bGVUeXBlLlBBIF0gOiBcInBhXCJcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlU2NoZWR1bGVNaW5pRGl2KGRhdGEgOiBTY2hlZHVsZSkge1xyXG4gICAgY29uc3QgZGl2RWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgZGl2RWwuaW5uZXJIVE1MID0gYFxyXG4gICAgICAgICR7ZGF0YS5uYW1lfVxyXG4gICAgYFxyXG4gICAgZGl2RWwuY2xhc3NMaXN0LmFkZChcIm1pbmktc2NoZWR1bGVcIik7XHJcbiAgICBpZiAoIWRhdGEub3JwaGFuZWQgJiYgIWRhdGEuY29tcGxldGVkKSBkaXZFbC5jbGFzc0xpc3QuYWRkKFNjaGVkdWxlU3R5bGVzW2RhdGEudHlwZV0pO1xyXG4gICAgZWxzZSBpZiAoZGF0YS5jb21wbGV0ZWQpIGRpdkVsLmNsYXNzTGlzdC5hZGQoXCJjb21wbGV0ZWRcIilcclxuICAgIGVsc2UgZGl2RWwuY2xhc3NMaXN0LmFkZChcIm9ycGhhbmVkXCIpO1xyXG4gICAgcmV0dXJuIGRpdkVsO1xyXG59XHJcblxyXG4vLyBzaW5nbGV0b25cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ2FsZW5kYXIge1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgY2FsZW5kZXIgOiBDYWxlbmRhcjtcclxuICAgIHByaXZhdGUgZGF0ZSA6IERhdGU7XHJcbiAgICBwcml2YXRlIGRhdGVDZWxscyA6IEhUTUxUYWJsZUNlbGxFbGVtZW50W107XHJcbiAgICBwcml2YXRlIG1vbnRoTGFiZWwgOiBIVE1MU3BhbkVsZW1lbnQ7XHJcbiAgICBwcml2YXRlIG1heFNjaGVkdWxlUmVuZGVyID0gMjtcclxuICAgIC8vIFx1QUQ3M1x1Qzc3NCBcdUFDMDBcdUM5QzBcdUFDRTBcdUM3ODhcdUM3NDQgXHVENTQ0XHVDNjk0IFx1QzVDNlx1Qzc0NFx1QzIxOFx1QjNDNFxyXG4gICAgLy8gcHJpdmF0ZSBwcmV2QnRuIDogSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICAvLyBwcml2YXRlIG5leHRCdG4gOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuXHJcbiAgICBwcml2YXRlIHNjaGVkdWxlcyA6IEFsbFNjaGVkdWxlcyA9IHt9O1xyXG5cclxuICAgIHByaXZhdGUgY29uc3RydWN0b3IoY2FsZW5kYXJEaXYgOiBIVE1MRGl2RWxlbWVudCkge1xyXG4gICAgICAgIHRoaXMuZGF0ZSA9IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldERhdGUoMSk7ICAvLyAxXHVDNzdDXHVCODVDIFx1QjlERVx1Q0RCMFx1QzhGQ1x1QUUzMFxyXG5cclxuICAgICAgICB0aGlzLmRhdGVDZWxscyA9IEFycmF5LmZyb20oY2FsZW5kYXJEaXYucXVlcnlTZWxlY3RvckFsbChcInRib2R5IHRkXCIpKTtcclxuICAgICAgICB0aGlzLm1vbnRoTGFiZWwgPSBjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yKFwiI21vbnRoLWxhYmVsXCIpIGFzIEhUTUxTcGFuRWxlbWVudDtcclxuICAgICAgICBjb25zdCBwcmV2QnRuID0gY2FsZW5kYXJEaXYucXVlcnlTZWxlY3RvcihcIiNwcmV2LWJ0blwiKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgICAgICBjb25zdCBuZXh0QnRuID0gY2FsZW5kYXJEaXYucXVlcnlTZWxlY3RvcihcIiNuZXh0LWJ0blwiKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgICAgICBjb25zdCB1cGRhdGVCdG4gPSBjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yKFwiI3VwZGF0ZS1idG5cIikgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcblxyXG4gICAgICAgIHRoaXMudXBkYXRlTW9udGhMYWJlbCgpO1xyXG5cclxuICAgICAgICBwcmV2QnRuLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy50b1ByZXZNb250aCgpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbmRlcigpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbmV4dEJ0bi5vbmNsaWNrID0gKCk9PiB7XHJcbiAgICAgICAgICAgIHRoaXMudG9OZXh0TW9udGgoKTtcclxuICAgICAgICAgICAgdGhpcy5yZW5kZXIoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHVwZGF0ZUJ0bi5vbmNsaWNrID0gYXN5bmMgKCk9PntcclxuICAgICAgICAgICAgdXBkYXRlQnRuLnRleHRDb250ZW50ID0gXCJcdUM1QzVcdUIzNzBcdUM3NzRcdUQyQjggXHVDOTExXCJcclxuICAgICAgICAgICAgdXBkYXRlQnRuLmNsYXNzTGlzdC5hZGQoXCJ1cGRhdGluZ1wiKTtcclxuICAgICAgICAgICAgdXBkYXRlQnRuLmRpc2FibGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVTY2hlZHVsZXMoKTtcclxuICAgICAgICAgICAgdXBkYXRlQnRuLnRleHRDb250ZW50ID0gXCJcdUM1QzVcdUIzNzBcdUM3NzRcdUQyQjhcIlxyXG4gICAgICAgICAgICB1cGRhdGVCdG4uY2xhc3NMaXN0LnJlbW92ZShcInVwZGF0aW5nXCIpO1xyXG4gICAgICAgICAgICB1cGRhdGVCdG4uZGlzYWJsZWQgPSBmYWxzZTtcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAoQ2hlY2tTY2hlZHVsZVVwZGF0ZVRpbWluZygpKSB1cGRhdGVCdG4uY2xpY2soKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHJlbmRlcigpIHtcclxuICAgICAgICB0aGlzLmNsZWFyQ2VsbHMoKTtcclxuICAgICAgICBjb25zdCBkID0gbmV3IERhdGUodGhpcy5kYXRlKTtcclxuICAgICAgICBjb25zdCBtb250aCA9IGQuZ2V0TW9udGgoKTtcclxuICAgICAgICBjb25zdCBkYXkgPSBkLmdldERheSgpO1xyXG5cclxuICAgICAgICAvLyBhd2FpdCB0aGlzLmdldFNjaGVkdWxlcygpO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKHRoaXMuc2NoZWR1bGVzKTtcclxuICAgICAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCkudG9EYXRlU3RyaW5nKCk7XHJcbiAgICAgICAgd2hpbGUgKGQuZ2V0TW9udGgoKSA9PSBtb250aCkge1xyXG4gICAgICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmRhdGVDZWxsc1tkLmdldERhdGUoKSAtIDEgKyBkYXldO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgZGF0ZUxhYmVsRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgICAgICAgICAgY29uc3QgaW5mb0RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblxyXG4gICAgICAgICAgICBkYXRlTGFiZWxEaXYuY2xhc3NMaXN0LmFkZChcImRhdGUtbGFiZWwtZGl2XCIpO1xyXG4gICAgICAgICAgICBpbmZvRGl2LmNsYXNzTGlzdC5hZGQoXCJpbmZvLWRpdlwiKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChkLnRvRGF0ZVN0cmluZygpID09IHRvZGF5KSBkYXRlTGFiZWxEaXYuY2xhc3NMaXN0LmFkZChcInRvZGF5XCIpO1xyXG5cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFNjaGVkdWxlcyA9IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIuZ2V0SW5zdGFuY2UoKS5nZXQoZC50b0RhdGVTdHJpbmcoKSk7XHJcbiAgICAgICAgICAgIFxyXG5cclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1pbih0YXJnZXRTY2hlZHVsZXMubGVuZ3RoLCB0aGlzLm1heFNjaGVkdWxlUmVuZGVyKTsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpbmZvRGl2LmFwcGVuZENoaWxkKGNyZWF0ZVNjaGVkdWxlTWluaURpdih0YXJnZXRTY2hlZHVsZXNbaV0pKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZGF0ZUxhYmVsRGl2LmlubmVySFRNTCA9IGBcclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZGF0ZS1sYWJlbFwiPiR7ZC5nZXREYXRlKCkudG9TdHJpbmcoKX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInVucmVzb2x2ZWQtc2NoZWR1bGVzXCI+JHt0YXJnZXRTY2hlZHVsZXMuZmlsdGVyKGU9PiFlLmNvbXBsZXRlZCAmJiAhZS5vcnBoYW5lZCkubGVuZ3RoIHx8IFwiXCJ9PC9zcGFuPlxyXG4gICAgICAgICAgICBgXHJcblxyXG5cclxuICAgICAgICAgICAgaWYgKHRhcmdldFNjaGVkdWxlcy5sZW5ndGggPiB0aGlzLm1heFNjaGVkdWxlUmVuZGVyKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBoaWRkZW5TY2hlZHVsZURpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgICAgICAgICBoaWRkZW5TY2hlZHVsZURpdi50ZXh0Q29udGVudCA9IGArJHt0YXJnZXRTY2hlZHVsZXMubGVuZ3RoIC0gdGhpcy5tYXhTY2hlZHVsZVJlbmRlcn1gO1xyXG4gICAgICAgICAgICAgICAgaW5mb0Rpdi5hcHBlbmRDaGlsZChoaWRkZW5TY2hlZHVsZURpdik7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRhcmdldC5hcHBlbmRDaGlsZChkYXRlTGFiZWxEaXYpO1xyXG4gICAgICAgICAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoaW5mb0Rpdik7XHJcbiAgICAgICAgICAgIGNvbnN0IGN1ckQgPSBuZXcgRGF0ZShkLnRvU3RyaW5nKCkpXHJcbiAgICAgICAgICAgIHRhcmdldC5vbmNsaWNrID0gKCk9PiB7IE1vZGFsLmdldEluc3RhbmNlKCkub3BlbihjdXJELnRvRGF0ZVN0cmluZygpKSB9XHJcbiAgICAgICAgICAgIGQuc2V0RGF0ZShkLmdldERhdGUoKSArIDEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHRvUHJldk1vbnRoKCkgOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0TW9udGgodGhpcy5kYXRlLmdldE1vbnRoKCkgLSAxKTtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0RGF0ZSgxKTsgIC8vIDFcdUM3N0NcdUI4NUMgXHVCOURFXHVDREIwXHVDOEZDXHVBRTMwXHJcbiAgICAgICAgdGhpcy51cGRhdGVNb250aExhYmVsKCk7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdG9OZXh0TW9udGgoKSA6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuZGF0ZS5zZXRNb250aCh0aGlzLmRhdGUuZ2V0TW9udGgoKSArIDEpO1xyXG4gICAgICAgIHRoaXMuZGF0ZS5zZXREYXRlKDEpOyAgLy8gMVx1Qzc3Q1x1Qjg1QyBcdUI5REVcdUNEQjBcdUM4RkNcdUFFMzBcclxuICAgICAgICB0aGlzLnVwZGF0ZU1vbnRoTGFiZWwoKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGNsZWFyQ2VsbHMoKSA6IHZvaWQge1xyXG4gICAgICAgIGZvciAoY29uc3QgY2VsbCBvZiB0aGlzLmRhdGVDZWxscykge1xyXG4gICAgICAgICAgICBjZWxsLnRleHRDb250ZW50ID0gXCJcIjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB1cGRhdGVNb250aExhYmVsKCkge1xyXG4gICAgICAgIHRoaXMubW9udGhMYWJlbC50ZXh0Q29udGVudCA9IGAke3RoaXMuZGF0ZS5nZXRGdWxsWWVhcigpfVx1QjE0NCAke3RoaXMuZGF0ZS5nZXRNb250aCgpICsgMX1cdUM2RDRgO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgdXBkYXRlU2NoZWR1bGVzKCkge1xyXG4gICAgICAgIGF3YWl0IHVwZGF0ZVNjaGVkdWxlcygpO1xyXG4gICAgICAgIGF3YWl0IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIudXBkYXRlKCk7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5yZW5kZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgc3RhdGljIGFzeW5jIGdldFZpZXcoKSA6IFByb21pc2U8SFRNTERpdkVsZW1lbnQ+IHtcclxuICAgICAgICBjb25zdCBjYWxlbmRhckVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuXHJcbiAgICAgICAgY2FsZW5kYXJFbC5pbm5lckhUTUwgPSAoYFxyXG4gICAgICAgICAgICA8ZGl2IGlkPVwiY29udHJvbFwiPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBpZD1cImluZm9cIj5cclxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwicHJldi1idG5cIj4mbHQ7PC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gaWQ9XCJtb250aC1sYWJlbFwiPjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwibmV4dC1idG5cIj4mZ3Q7PC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxidXR0b24gaWQ9XCJ1cGRhdGUtYnRuXCI+XHVDNUM1XHVCMzcwXHVDNzc0XHVEMkI4PC9idXR0b24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8dGFibGU+XHJcbiAgICAgICAgICAgICAgICA8dGhlYWQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVDNzdDPC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1QzZENDwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUQ2NTQ8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVDMjE4PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1QkFBOTwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUFFMDg8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVEMUEwPC90aD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIDwvdGhlYWQ+XHJcbiAgICAgICAgICAgICAgICA8dGJvZHk+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICA8L3Rib2R5PlxyXG4gICAgICAgICAgICA8L3RhYmxlPlxyXG4gICAgICAgIGApO1xyXG5cclxuICAgICAgICBpZiAoIXRoaXMuY2FsZW5kZXIpIFxyXG4gICAgICAgICAgICB0aGlzLmNhbGVuZGVyID0gbmV3IENhbGVuZGFyKGNhbGVuZGFyRWwpO1xyXG4gICAgICAgIC8vIHRoaXMuY2FsZW5kZXIuZ2V0U2NoZWR1bGVzKCk7XHJcbiAgICAgICAgdGhpcy5jYWxlbmRlci5yZW5kZXIoKTtcclxuICAgICAgICByZXR1cm4gY2FsZW5kYXJFbDtcclxuICAgIH1cclxufTtcclxuIiwgImltcG9ydCBDYWxlbmRhciBmcm9tIFwiLi9jYWxlbmRlclwiO1xyXG5pbXBvcnQgTW9kYWwgZnJvbSBcIi4vbW9kYWxcIjtcclxuaW1wb3J0IHsgU3ViamVjdCB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcblxyXG4vLyBpbXBvcnQge2NhbGVuZGFyQ3NzfSBmcm9tIFwiLi9jb25zdHNcIjtcclxuXHJcblxyXG5hc3luYyBmdW5jdGlvbiBtYWluKCkgOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHRhcmdldEVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5mcm9udC1ib3guZnJvbnQtYm94LWNvdXJzZVwiKTtcclxuICAgIGlmICghdGFyZ2V0RWwpIHJldHVybjtcclxuXHJcbiAgICAvLyBjb25zdCBzdHlsZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN0eWxlXCIpO1xyXG4gICAgY29uc3QgZGV0YWlsc0VsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRldGFpbHNcIik7XHJcbiAgICBjb25zdCBzdW1tYXJ5RWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3VtbWFyeVwiKTtcclxuICAgIHN1bW1hcnlFbC50ZXh0Q29udGVudCA9IFwiUGxhdG8gQ2FsZW5kYXIzXCI7XHJcbiAgICAvLyBzdHlsZUVsLmlubmVySFRNTCA9IGNhbGVuZGFyQ3NzO1xyXG4gICAgXHJcbiAgICBkZXRhaWxzRWwuYXBwZW5kQ2hpbGQoc3VtbWFyeUVsKTtcclxuICAgIGRldGFpbHNFbC5hcHBlbmRDaGlsZChhd2FpdCBNb2RhbC5nZXRWaWV3KCkpO1xyXG4gICAgZGV0YWlsc0VsLmFwcGVuZENoaWxkKGF3YWl0IENhbGVuZGFyLmdldFZpZXcoKSk7XHJcbiAgICBkZXRhaWxzRWwuc2V0QXR0cmlidXRlKFwiaWRcIiwgXCJwbGF0by1jYWxlbmRhclwiKTtcclxuICAgIFxyXG4gICAgdGFyZ2V0RWw/LnByZXBlbmQoZGV0YWlsc0VsKTtcclxufVxyXG5cclxubWFpbigpO1xyXG5cclxuXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7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
