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
      this.monthCache = /* @__PURE__ */ new Map();
      this.schedules = {};
      this.currentCourses = [];
      this.updatePromise = this.refresh();
    }
    async refresh() {
      this.schedules = await getSchedules();
      this.currentCourses = await getCurrentCourses();
      this.monthCache.clear();
    }
    getMonthKey(date) {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    }
    getSourceSchedules() {
      const targetCourseIds = this.currentCourses.length === 0 ? Object.keys(this.schedules) : this.currentCourses.map((course) => course.id);
      return targetCourseIds.flatMap((courseId) => Object.values(this.schedules[courseId] ?? {})).filter((schedule) => new Date(schedule.due.toString()).toString() !== "Invalid Date").sort((a, b) => {
        return new Date(a.due.toString()).getTime() - new Date(b.due.toString()).getTime();
      });
    }
    buildMonth(date) {
      const targetYear = date.getFullYear();
      const targetMonth = date.getMonth();
      const monthData = {};
      for (const schedule of this.getSourceSchedules()) {
        const dueDate = new Date(schedule.due.toString());
        dueDate.setSeconds(dueDate.getSeconds() - 1);
        if (dueDate.getFullYear() !== targetYear || dueDate.getMonth() !== targetMonth) continue;
        const dateKey = dueDate.toDateString();
        if (!monthData[dateKey]) monthData[dateKey] = {};
        monthData[dateKey][schedule.id] = schedule;
      }
      this.monthCache.set(this.getMonthKey(date), monthData);
    }
    async loadMonth(date) {
      await this.updatePromise;
      const monthKey = this.getMonthKey(date);
      if (!this.monthCache.has(monthKey)) {
        this.buildMonth(date);
      }
    }
    async get(date) {
      const parsedDate = new Date(date);
      if (parsedDate.toString() === "Invalid Date") return [];
      await this.loadMonth(parsedDate);
      const monthData = this.monthCache.get(this.getMonthKey(parsedDate)) ?? {};
      return Object.values(monthData[parsedDate.toDateString()] ?? {});
    }
    static async update() {
      const instance = this.getInstance();
      instance.updatePromise = instance.refresh();
      await instance.updatePromise;
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
      await CalendarStorageManager.getInstance().loadMonth(this.date);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy91dGlscy50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL0NhbGVuZGFyU3RvcmFnZU1hbmFnZXIudHMiLCAiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy9tb2RhbC50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL2NhbGVuZGVyLnRzIiwgIi4uLy4uL3NyYy9jb250ZW50X3NjcmlwdHMvY29udGVudC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgQWxsU2NoZWR1bGVzIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvc2NoZWR1bGVTdG9yYWdlTWFuYWdlclwiO1xyXG5pbXBvcnQgeyBTdWJqZWN0IH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTY2hlZHVsZXMoKSA6IFByb21pc2U8QWxsU2NoZWR1bGVzPiB7XHJcbiAgICBjb25zb2xlLmxvZyhcIlx1QzExQ1x1QkU0NFx1QzJBNCBcdUM2Q0NcdUNFRTRcdUM1RDBcdUFDOEMgXHVDMkE0XHVDRjAwXHVDOTA0IFx1QjM3MFx1Qzc3NFx1RDEzMCBcdUI4NUNcdUI0RENcdUI5N0MgXHVDNjk0XHVDQ0FEXHVENTY5XHVCMkM4XHVCMkU0Li4uXCIpO1xyXG5cclxuICAgIC8vIDEuICdsb2FkU2NoZWR1bGVzJ1x1Qjc3Q1x1QjI5NCBhY3Rpb25cdUM3NDQgXHVCMkY0XHVDNTQ0IFx1QkE1NFx1QzJEQ1x1QzlDMCBcdUM4MDRcdUMxQTFcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyBhY3Rpb246IFwibG9hZFNjaGVkdWxlc1wiIH0pO1xyXG5cclxuICAgIC8vIDQuIFx1QzExQ1x1QkU0NFx1QzJBNCBcdUM2Q0NcdUNFRTRcdUI4NUNcdUJEODBcdUQxMzAgXHVCQzFCXHVDNzQwIFx1QUNCMFx1QUNGQ1xyXG4gICAgY29uc29sZS5sb2coXCJcdUMxMUNcdUJFNDRcdUMyQTQgXHVDNkNDXHVDRUU0XHVCODVDXHVCRDgwXHVEMTMwIFx1QkMxQlx1Qzc0MCBcdUMyQTRcdUNGMDBcdUM5MDQ6XCIsIHJlc3BvbnNlKTtcclxuICAgIFxyXG4gICAgLy8gXHVDNzc0IFx1QjM3MFx1Qzc3NFx1RDEzMFx1Qjk3QyBcdUMwQUNcdUM2QTlcdUQ1NThcdUM1RUMgXHVEMzk4XHVDNzc0XHVDOUMwXHVDNzU4IERPTVx1Qzc0NCBcdUM4NzBcdUM3OTFcdUQ1NjAgXHVDMjE4IFx1Qzc4OFx1QzJCNVx1QjJDOFx1QjJFNC5cclxuICAgIHJldHVybiByZXNwb25zZS5yZXN1bHQ7XHJcbn1cclxuXHJcbmNvbnN0IExBU1RfVVBEQVRFX0tFWSA9IFwicGxhdG8tY2FsZW5kYXIzLWxhc3RVcGRhdGVcIlxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVNjaGVkdWxlcygpIHtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKExBU1RfVVBEQVRFX0tFWSwgbmV3IERhdGUoKS50b1N0cmluZygpKTtcclxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcclxuICAgICAgICBhY3Rpb246IFwidXBkYXRlRGF0YVwiXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhyZXMpO1xyXG59XHJcblxyXG5leHBvcnQgIGZ1bmN0aW9uIENoZWNrU2NoZWR1bGVVcGRhdGVUaW1pbmcoKSB7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICAgIGNvbnN0IGxhc3RVcGRhdGVkID0gbmV3IERhdGUobG9jYWxTdG9yYWdlLmdldEl0ZW0oTEFTVF9VUERBVEVfS0VZKSBhcyBzdHJpbmcpPy5nZXRUaW1lKCkgPz8gMDtcclxuXHJcbiAgICBjb25zdCBIT1VSID0gMTAwMCAqIDM2MDA7XHJcbiAgICByZXR1cm4gKG5vdy1sYXN0VXBkYXRlZCA+IEhPVVIpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q3VycmVudENvdXJzZXMoKSA6IFByb21pc2U8U3ViamVjdFtdPiB7XHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHsgYWN0aW9uOiBcImxvYWRDdXJDb3Vyc2VzXCIgfSk7ICAgIFxyXG4gICAgcmV0dXJuIHJlc3BvbnNlLnJlc3VsdDtcclxufSIsICJpbXBvcnQgeyBBbGxTY2hlZHVsZXMgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC9zY2hlZHVsZVN0b3JhZ2VNYW5hZ2VyXCI7XG5pbXBvcnQgeyBTY2hlZHVsZSwgU3ViamVjdCB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XG5pbXBvcnQgeyBnZXRDdXJyZW50Q291cnNlcywgZ2V0U2NoZWR1bGVzIH0gZnJvbSBcIi4vdXRpbHNcIjtcblxuZXhwb3J0IGludGVyZmFjZSBDYWxlbmRhclN0b3JhZ2Uge1xuICAgIFtkYXRlOiBzdHJpbmddOiB7XG4gICAgICAgIFtzY2hlZHVsZUlkOiBzdHJpbmddOiBTY2hlZHVsZTtcbiAgICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyIHtcbiAgICBwcml2YXRlIHN0YXRpYyBpbnN0YW5jZSA6IENhbGVuZGFyU3RvcmFnZU1hbmFnZXI7XG4gICAgcHJpdmF0ZSBtb250aENhY2hlIDogTWFwPHN0cmluZywgQ2FsZW5kYXJTdG9yYWdlPjtcbiAgICBwcml2YXRlIHNjaGVkdWxlcyA6IEFsbFNjaGVkdWxlcztcbiAgICBwcml2YXRlIGN1cnJlbnRDb3Vyc2VzIDogU3ViamVjdFtdO1xuICAgIHByaXZhdGUgdXBkYXRlUHJvbWlzZSA6IFByb21pc2U8dm9pZD47XG5cbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLm1vbnRoQ2FjaGUgPSBuZXcgTWFwKCk7XG4gICAgICAgIHRoaXMuc2NoZWR1bGVzID0ge307XG4gICAgICAgIHRoaXMuY3VycmVudENvdXJzZXMgPSBbXTtcbiAgICAgICAgdGhpcy51cGRhdGVQcm9taXNlID0gdGhpcy5yZWZyZXNoKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZWZyZXNoKCkge1xuICAgICAgICB0aGlzLnNjaGVkdWxlcyA9IGF3YWl0IGdldFNjaGVkdWxlcygpO1xuICAgICAgICB0aGlzLmN1cnJlbnRDb3Vyc2VzID0gYXdhaXQgZ2V0Q3VycmVudENvdXJzZXMoKTtcbiAgICAgICAgdGhpcy5tb250aENhY2hlLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRNb250aEtleShkYXRlIDogRGF0ZSkge1xuICAgICAgICByZXR1cm4gYCR7ZGF0ZS5nZXRGdWxsWWVhcigpfS0keyhkYXRlLmdldE1vbnRoKCkgKyAxKS50b1N0cmluZygpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0U291cmNlU2NoZWR1bGVzKCkge1xuICAgICAgICBjb25zdCB0YXJnZXRDb3Vyc2VJZHMgPSB0aGlzLmN1cnJlbnRDb3Vyc2VzLmxlbmd0aCA9PT0gMFxuICAgICAgICAgICAgPyBPYmplY3Qua2V5cyh0aGlzLnNjaGVkdWxlcylcbiAgICAgICAgICAgIDogdGhpcy5jdXJyZW50Q291cnNlcy5tYXAoKGNvdXJzZSkgPT4gY291cnNlLmlkKTtcblxuICAgICAgICByZXR1cm4gdGFyZ2V0Q291cnNlSWRzXG4gICAgICAgICAgICAuZmxhdE1hcCgoY291cnNlSWQpID0+IE9iamVjdC52YWx1ZXModGhpcy5zY2hlZHVsZXNbY291cnNlSWRdID8/IHt9KSlcbiAgICAgICAgICAgIC5maWx0ZXIoKHNjaGVkdWxlKSA9PiBuZXcgRGF0ZShzY2hlZHVsZS5kdWUudG9TdHJpbmcoKSkudG9TdHJpbmcoKSAhPT0gXCJJbnZhbGlkIERhdGVcIilcbiAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBEYXRlKGEuZHVlLnRvU3RyaW5nKCkpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGIuZHVlLnRvU3RyaW5nKCkpLmdldFRpbWUoKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYnVpbGRNb250aChkYXRlIDogRGF0ZSkge1xuICAgICAgICBjb25zdCB0YXJnZXRZZWFyID0gZGF0ZS5nZXRGdWxsWWVhcigpO1xuICAgICAgICBjb25zdCB0YXJnZXRNb250aCA9IGRhdGUuZ2V0TW9udGgoKTtcbiAgICAgICAgY29uc3QgbW9udGhEYXRhIDogQ2FsZW5kYXJTdG9yYWdlID0ge307XG5cbiAgICAgICAgZm9yIChjb25zdCBzY2hlZHVsZSBvZiB0aGlzLmdldFNvdXJjZVNjaGVkdWxlcygpKSB7XG4gICAgICAgICAgICBjb25zdCBkdWVEYXRlID0gbmV3IERhdGUoc2NoZWR1bGUuZHVlLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgZHVlRGF0ZS5zZXRTZWNvbmRzKGR1ZURhdGUuZ2V0U2Vjb25kcygpIC0gMSk7XG5cbiAgICAgICAgICAgIGlmIChkdWVEYXRlLmdldEZ1bGxZZWFyKCkgIT09IHRhcmdldFllYXIgfHwgZHVlRGF0ZS5nZXRNb250aCgpICE9PSB0YXJnZXRNb250aCkgY29udGludWU7XG5cbiAgICAgICAgICAgIGNvbnN0IGRhdGVLZXkgPSBkdWVEYXRlLnRvRGF0ZVN0cmluZygpO1xuICAgICAgICAgICAgaWYgKCFtb250aERhdGFbZGF0ZUtleV0pIG1vbnRoRGF0YVtkYXRlS2V5XSA9IHt9O1xuICAgICAgICAgICAgbW9udGhEYXRhW2RhdGVLZXldW3NjaGVkdWxlLmlkXSA9IHNjaGVkdWxlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tb250aENhY2hlLnNldCh0aGlzLmdldE1vbnRoS2V5KGRhdGUpLCBtb250aERhdGEpO1xuICAgIH1cblxuICAgIGFzeW5jIGxvYWRNb250aChkYXRlIDogRGF0ZSkge1xuICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVByb21pc2U7XG4gICAgICAgIGNvbnN0IG1vbnRoS2V5ID0gdGhpcy5nZXRNb250aEtleShkYXRlKTtcblxuICAgICAgICBpZiAoIXRoaXMubW9udGhDYWNoZS5oYXMobW9udGhLZXkpKSB7XG4gICAgICAgICAgICB0aGlzLmJ1aWxkTW9udGgoZGF0ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhc3luYyBnZXQoZGF0ZSA6IHN0cmluZykge1xuICAgICAgICBjb25zdCBwYXJzZWREYXRlID0gbmV3IERhdGUoZGF0ZSk7XG4gICAgICAgIGlmIChwYXJzZWREYXRlLnRvU3RyaW5nKCkgPT09IFwiSW52YWxpZCBEYXRlXCIpIHJldHVybiBbXTtcblxuICAgICAgICBhd2FpdCB0aGlzLmxvYWRNb250aChwYXJzZWREYXRlKTtcbiAgICAgICAgY29uc3QgbW9udGhEYXRhID0gdGhpcy5tb250aENhY2hlLmdldCh0aGlzLmdldE1vbnRoS2V5KHBhcnNlZERhdGUpKSA/PyB7fTtcbiAgICAgICAgcmV0dXJuIE9iamVjdC52YWx1ZXMobW9udGhEYXRhW3BhcnNlZERhdGUudG9EYXRlU3RyaW5nKCldID8/IHt9KTtcbiAgICB9XG5cbiAgICBzdGF0aWMgYXN5bmMgdXBkYXRlKCkge1xuICAgICAgICBjb25zdCBpbnN0YW5jZSA9IHRoaXMuZ2V0SW5zdGFuY2UoKTtcbiAgICAgICAgaW5zdGFuY2UudXBkYXRlUHJvbWlzZSA9IGluc3RhbmNlLnJlZnJlc2goKTtcbiAgICAgICAgYXdhaXQgaW5zdGFuY2UudXBkYXRlUHJvbWlzZTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0SW5zdGFuY2UoKSB7XG4gICAgICAgIGlmICh0aGlzLmluc3RhbmNlID09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2UgPSBuZXcgQ2FsZW5kYXJTdG9yYWdlTWFuYWdlcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuaW5zdGFuY2U7XG4gICAgfVxufVxuIiwgImltcG9ydCB7IFNjaGVkdWxlVHlwZSB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcbmltcG9ydCB7IFNjaGVkdWxlIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcclxuaW1wb3J0IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIgZnJvbSBcIi4vQ2FsZW5kYXJTdG9yYWdlTWFuYWdlclwiO1xyXG5pbXBvcnQgeyBTY2hlZHVsZVN0eWxlcyB9IGZyb20gXCIuL2NhbGVuZGVyXCI7XHJcblxyXG5leHBvcnQgY29uc3QgU2NoZWR1bGVJY29ucyA9IHtcclxuICAgIFsgU2NoZWR1bGVUeXBlLkhXIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vc3YyL2Fzc2lnbi8xNzQ1MjE3MzU4L2ljb25cIixcclxuICAgIFsgU2NoZWR1bGVUeXBlLlZJRCBdIDogXCJodHRwczovL3BsYXRvLnB1c2FuLmFjLmtyL3RoZW1lL2ltYWdlLnBocC9jb3Vyc2Vtb3N2Mi92b2QvMTc0NTIxNzM1OC9pY29uXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5RVUlaIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vc3YyL3F1aXovMTc0NTIxNzM1OC9pY29uXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5aT09NIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vc3YyL3pvb20vMTc0NTIxNzM1OC9pY29uXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5QQSBdIDogXCJodHRwczovL3BsYXRvLnB1c2FuLmFjLmtyL3RoZW1lL2ltYWdlLnBocC9jb3Vyc2Vtb3N2Mi92cGwvMTc0NTIxNzM1OC9pY29uXCJcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlU2NoZWR1bGVEaXYoZGF0YSA6IFNjaGVkdWxlKSB7XHJcbiAgICBjb25zdCBkaXZFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICBkaXZFbC5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgPGRpdiBpZD1cImljb24tZGl2XCI+XHJcbiAgICAgICAgICAgIDxpbWcgc3JjPVwiJHtTY2hlZHVsZUljb25zW2RhdGEudHlwZV19XCI+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgPGg0PiR7ZGF0YS5uYW1lfTwvaDQ+XHJcbiAgICAgICAgICAgIDxwPiR7ZGF0YS5jb3Vyc2UubmFtZX08L3A+XHJcbiAgICAgICAgICAgIDxwPiR7bmV3IERhdGUoZGF0YS5kdWUpLnRvTG9jYWxlU3RyaW5nKCl9PC9wPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIFxyXG4gICAgYFxyXG4gICAgZGl2RWwuY2xhc3NMaXN0LmFkZChcInNjaGVkdWxlXCIpO1xyXG4gICAgZGl2RWwub25jbGljayA9ICgpPT4ge1xyXG4gICAgICAgIHdpbmRvdy5vcGVuKGRhdGEudXJsKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWRhdGEub3JwaGFuZWQgJiYgIWRhdGEuY29tcGxldGVkKSBkaXZFbC5jbGFzc0xpc3QuYWRkKFNjaGVkdWxlU3R5bGVzW2RhdGEudHlwZV0pO1xyXG4gICAgZWxzZSBpZiAoZGF0YS5jb21wbGV0ZWQpIGRpdkVsLmNsYXNzTGlzdC5hZGQoXCJjb21wbGV0ZWRcIilcclxuICAgIGVsc2UgZGl2RWwuY2xhc3NMaXN0LmFkZChcIm9ycGhhbmVkXCIpO1xyXG4gICAgcmV0dXJuIGRpdkVsO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNb2RhbCB7XHJcbiAgICBwcml2YXRlIHN0YXRpYyBpbnN0YW5jZSA6IE1vZGFsO1xyXG4gICAgcHJpdmF0ZSBtb2RhbERpdiA6IEhUTUxEaXZFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSB0aXRsZUVsIDogSFRNTEhlYWRpbmdFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSBjb250ZW50RGl2IDogSFRNTERpdkVsZW1lbnQ7XHJcbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKG1vZGFsRGl2IDogSFRNTERpdkVsZW1lbnQpIHtcclxuICAgICAgICB0aGlzLm1vZGFsRGl2ID0gbW9kYWxEaXY7XHJcbiAgICAgICAgdGhpcy50aXRsZUVsID0gbW9kYWxEaXYucXVlcnlTZWxlY3RvcihcIiN0aXRsZVwiKSBhcyBIVE1MSGVhZGluZ0VsZW1lbnQ7XHJcbiAgICAgICAgdGhpcy5jb250ZW50RGl2ID0gbW9kYWxEaXYucXVlcnlTZWxlY3RvcihcIiNjb250ZW50XCIpIGFzIEhUTUxEaXZFbGVtZW50O1xyXG5cclxuICAgICAgICBjb25zdCBjbG9zZUJ1dHRvbiA9IG1vZGFsRGl2LnF1ZXJ5U2VsZWN0b3IoXCIuY2xvc2UtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgIGNsb3NlQnV0dG9uLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBvcGVuKGRhdGUgOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLmNvbnRlbnREaXYuaW5uZXJIVE1MID0gXCJcIjtcclxuICAgICAgICB0aGlzLnRpdGxlRWwudGV4dENvbnRlbnQgPSBuZXcgRGF0ZShkYXRlKS50b0xvY2FsZURhdGVTdHJpbmcoKTtcclxuICAgICAgICBjb25zdCBzY2hlZHVsZXMgPSBhd2FpdCBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLmdldEluc3RhbmNlKCkuZ2V0KGRhdGUpO1xyXG5cclxuICAgICAgICBpZiAoc2NoZWR1bGVzLmxlbmd0aCA9PT0gMCApIHJldHVybjtcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coZGF0ZSwgc2NoZWR1bGVzKTtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBzY2hlZHVsZSBvZiBzY2hlZHVsZXMpIHtcclxuICAgICAgICAgICAgY29uc3QgZGl2RWwgPSBjcmVhdGVTY2hlZHVsZURpdihzY2hlZHVsZSk7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudERpdi5hcHBlbmRDaGlsZChkaXZFbCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm1vZGFsRGl2LmNsYXNzTGlzdC5hZGQoXCJtb2RhbC1vcGVuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGNsb3NlKCkge1xyXG4gICAgICAgIHRoaXMubW9kYWxEaXYuY2xhc3NMaXN0LnJlbW92ZShcIm1vZGFsLW9wZW5cIik7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGdldEluc3RhbmNlKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNlO1xyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBnZXRWaWV3KCkge1xyXG4gICAgICAgIGlmICghdGhpcy5pbnN0YW5jZSkgeyBcclxuICAgICAgICAgICAgY29uc3QgbW9kYWxFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgICAgIG1vZGFsRWwuc2V0QXR0cmlidXRlKCdpZCcsIFwibW9kYWxcIik7XHJcblxyXG4gICAgICAgICAgICBtb2RhbEVsLmlubmVySFRNTCA9IGBcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdXN0b20tbW9kYWwtYmFja2Ryb3BcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdXN0b20tbW9kYWwtZGlhbG9nXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBpZD1cInRvcFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiY2xvc2UtYnRuXCI+XHUwMEQ3PC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGgyIGlkPVwidGl0bGVcIj48L2gyPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgaWQ9XCJjb250ZW50XCI+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgYDsgXHJcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2UgPSBuZXcgTW9kYWwobW9kYWxFbCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICByZXR1cm4gdGhpcy5pbnN0YW5jZS5tb2RhbERpdjtcclxuICAgIH1cclxufSIsICJpbXBvcnQgeyBBbGxTY2hlZHVsZXMgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC9zY2hlZHVsZVN0b3JhZ2VNYW5hZ2VyXCI7XHJcbmltcG9ydCB7IFNjaGVkdWxlLCBTY2hlZHVsZVR5cGUgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC91cGRhdGVTY2hlZHVsZVwiO1xyXG5pbXBvcnQgQ2FsZW5kYXJTdG9yYWdlTWFuYWdlciBmcm9tIFwiLi9DYWxlbmRhclN0b3JhZ2VNYW5hZ2VyXCI7XHJcbmltcG9ydCBNb2RhbCBmcm9tIFwiLi9tb2RhbFwiO1xyXG5pbXBvcnQgeyBDaGVja1NjaGVkdWxlVXBkYXRlVGltaW5nLCBnZXRDdXJyZW50Q291cnNlcywgZ2V0U2NoZWR1bGVzLCB1cGRhdGVTY2hlZHVsZXMgfSBmcm9tIFwiLi91dGlsc1wiO1xyXG5cclxuXHJcbmV4cG9ydCBjb25zdCBTY2hlZHVsZVN0eWxlcyA9IHtcclxuICAgIFsgU2NoZWR1bGVUeXBlLkhXIF0gOiBcImh3XCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5WSUQgXSA6IFwidmlkXCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5RVUlaIF0gOiBcInF1aXpcIixcclxuICAgIFsgU2NoZWR1bGVUeXBlLlpPT00gXSA6IFwiem9vbVwiLFxyXG4gICAgWyBTY2hlZHVsZVR5cGUuUEEgXSA6IFwicGFcIlxyXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVTY2hlZHVsZU1pbmlEaXYoZGF0YSA6IFNjaGVkdWxlKSB7XHJcbiAgICBjb25zdCBkaXZFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICBkaXZFbC5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgJHtkYXRhLm5hbWV9XHJcbiAgICBgXHJcbiAgICBkaXZFbC5jbGFzc0xpc3QuYWRkKFwibWluaS1zY2hlZHVsZVwiKTtcclxuICAgIGlmICghZGF0YS5vcnBoYW5lZCAmJiAhZGF0YS5jb21wbGV0ZWQpIGRpdkVsLmNsYXNzTGlzdC5hZGQoU2NoZWR1bGVTdHlsZXNbZGF0YS50eXBlXSk7XHJcbiAgICBlbHNlIGlmIChkYXRhLmNvbXBsZXRlZCkgZGl2RWwuY2xhc3NMaXN0LmFkZChcImNvbXBsZXRlZFwiKVxyXG4gICAgZWxzZSBkaXZFbC5jbGFzc0xpc3QuYWRkKFwib3JwaGFuZWRcIik7XHJcbiAgICByZXR1cm4gZGl2RWw7XHJcbn1cclxuXHJcbi8vIHNpbmdsZXRvblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDYWxlbmRhciB7XHJcbiAgICBwcml2YXRlIHN0YXRpYyBjYWxlbmRlciA6IENhbGVuZGFyO1xyXG4gICAgcHJpdmF0ZSBkYXRlIDogRGF0ZTtcclxuICAgIHByaXZhdGUgZGF0ZUNlbGxzIDogSFRNTFRhYmxlQ2VsbEVsZW1lbnRbXTtcclxuICAgIHByaXZhdGUgbW9udGhMYWJlbCA6IEhUTUxTcGFuRWxlbWVudDtcclxuICAgIHByaXZhdGUgbWF4U2NoZWR1bGVSZW5kZXIgPSAyO1xyXG4gICAgLy8gXHVBRDczXHVDNzc0IFx1QUMwMFx1QzlDMFx1QUNFMFx1Qzc4OFx1Qzc0NCBcdUQ1NDRcdUM2OTQgXHVDNUM2XHVDNzQ0XHVDMjE4XHVCM0M0XHJcbiAgICAvLyBwcml2YXRlIHByZXZCdG4gOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgIC8vIHByaXZhdGUgbmV4dEJ0biA6IEhUTUxCdXR0b25FbGVtZW50O1xyXG5cclxuICAgIHByaXZhdGUgc2NoZWR1bGVzIDogQWxsU2NoZWR1bGVzID0ge307XHJcblxyXG4gICAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihjYWxlbmRhckRpdiA6IEhUTUxEaXZFbGVtZW50KSB7XHJcbiAgICAgICAgdGhpcy5kYXRlID0gbmV3IERhdGUoKTtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0RGF0ZSgxKTsgIC8vIDFcdUM3N0NcdUI4NUMgXHVCOURFXHVDREIwXHVDOEZDXHVBRTMwXHJcblxyXG4gICAgICAgIHRoaXMuZGF0ZUNlbGxzID0gQXJyYXkuZnJvbShjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yQWxsKFwidGJvZHkgdGRcIikpO1xyXG4gICAgICAgIHRoaXMubW9udGhMYWJlbCA9IGNhbGVuZGFyRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjbW9udGgtbGFiZWxcIikgYXMgSFRNTFNwYW5FbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IHByZXZCdG4gPSBjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yKFwiI3ByZXYtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IG5leHRCdG4gPSBjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yKFwiI25leHQtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IHVwZGF0ZUJ0biA9IGNhbGVuZGFyRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjdXBkYXRlLWJ0blwiKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcclxuXHJcbiAgICAgICAgdGhpcy51cGRhdGVNb250aExhYmVsKCk7XHJcblxyXG4gICAgICAgIHByZXZCdG4ub25jbGljayA9ICgpPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnRvUHJldk1vbnRoKCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBuZXh0QnRuLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy50b05leHRNb250aCgpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbmRlcigpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdXBkYXRlQnRuLm9uY2xpY2sgPSBhc3luYyAoKT0+e1xyXG4gICAgICAgICAgICB1cGRhdGVCdG4udGV4dENvbnRlbnQgPSBcIlx1QzVDNVx1QjM3MFx1Qzc3NFx1RDJCOCBcdUM5MTFcIlxyXG4gICAgICAgICAgICB1cGRhdGVCdG4uY2xhc3NMaXN0LmFkZChcInVwZGF0aW5nXCIpO1xyXG4gICAgICAgICAgICB1cGRhdGVCdG4uZGlzYWJsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVNjaGVkdWxlcygpO1xyXG4gICAgICAgICAgICB1cGRhdGVCdG4udGV4dENvbnRlbnQgPSBcIlx1QzVDNVx1QjM3MFx1Qzc3NFx1RDJCOFwiXHJcbiAgICAgICAgICAgIHVwZGF0ZUJ0bi5jbGFzc0xpc3QucmVtb3ZlKFwidXBkYXRpbmdcIik7XHJcbiAgICAgICAgICAgIHVwZGF0ZUJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmIChDaGVja1NjaGVkdWxlVXBkYXRlVGltaW5nKCkpIHVwZGF0ZUJ0bi5jbGljaygpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcmVuZGVyKCkge1xuICAgICAgICB0aGlzLmNsZWFyQ2VsbHMoKTtcbiAgICAgICAgY29uc3QgZCA9IG5ldyBEYXRlKHRoaXMuZGF0ZSk7XG4gICAgICAgIGNvbnN0IG1vbnRoID0gZC5nZXRNb250aCgpO1xuICAgICAgICBjb25zdCBkYXkgPSBkLmdldERheSgpO1xuXG4gICAgICAgIGF3YWl0IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIuZ2V0SW5zdGFuY2UoKS5sb2FkTW9udGgodGhpcy5kYXRlKTtcblxuICAgICAgICAvLyBhd2FpdCB0aGlzLmdldFNjaGVkdWxlcygpO1xuICAgICAgICAvLyBjb25zb2xlLmxvZyh0aGlzLnNjaGVkdWxlcyk7XG4gICAgICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKS50b0RhdGVTdHJpbmcoKTtcbiAgICAgICAgd2hpbGUgKGQuZ2V0TW9udGgoKSA9PSBtb250aCkge1xyXG4gICAgICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmRhdGVDZWxsc1tkLmdldERhdGUoKSAtIDEgKyBkYXldO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgZGF0ZUxhYmVsRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgICAgICAgICAgY29uc3QgaW5mb0RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblxyXG4gICAgICAgICAgICBkYXRlTGFiZWxEaXYuY2xhc3NMaXN0LmFkZChcImRhdGUtbGFiZWwtZGl2XCIpO1xyXG4gICAgICAgICAgICBpbmZvRGl2LmNsYXNzTGlzdC5hZGQoXCJpbmZvLWRpdlwiKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChkLnRvRGF0ZVN0cmluZygpID09IHRvZGF5KSBkYXRlTGFiZWxEaXYuY2xhc3NMaXN0LmFkZChcInRvZGF5XCIpO1xyXG5cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFNjaGVkdWxlcyA9IChhd2FpdCBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLmdldEluc3RhbmNlKCkuZ2V0KGQudG9EYXRlU3RyaW5nKCkpKTtcclxuXHJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgTWF0aC5taW4odGFyZ2V0U2NoZWR1bGVzLmxlbmd0aCwgdGhpcy5tYXhTY2hlZHVsZVJlbmRlcik7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaW5mb0Rpdi5hcHBlbmRDaGlsZChjcmVhdGVTY2hlZHVsZU1pbmlEaXYodGFyZ2V0U2NoZWR1bGVzW2ldKSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICh0YXJnZXRTY2hlZHVsZXMubGVuZ3RoID4gdGhpcy5tYXhTY2hlZHVsZVJlbmRlcikge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaGlkZGVuU2NoZWR1bGVEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgICAgICAgICAgICAgaGlkZGVuU2NoZWR1bGVEaXYudGV4dENvbnRlbnQgPSBgKyR7dGFyZ2V0U2NoZWR1bGVzLmxlbmd0aCAtIHRoaXMubWF4U2NoZWR1bGVSZW5kZXJ9YDtcclxuICAgICAgICAgICAgICAgIGluZm9EaXYuYXBwZW5kQ2hpbGQoaGlkZGVuU2NoZWR1bGVEaXYpO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGhvdmVyRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgICAgICAgICAgICAgIGhvdmVyRGl2LmNsYXNzTGlzdC5hZGQoXCJob3Zlci1kaXZcIik7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRhcmdldFNjaGVkdWxlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGhvdmVyRGl2LmFwcGVuZENoaWxkKGNyZWF0ZVNjaGVkdWxlTWluaURpdih0YXJnZXRTY2hlZHVsZXNbaV0pKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRhcmdldC5hcHBlbmRDaGlsZChob3ZlckRpdilcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgZGF0ZUxhYmVsRGl2LmlubmVySFRNTCA9IGBcclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwiZGF0ZS1sYWJlbFwiPiR7ZC5nZXREYXRlKCkudG9TdHJpbmcoKX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInVucmVzb2x2ZWQtc2NoZWR1bGVzXCI+JHt0YXJnZXRTY2hlZHVsZXMuZmlsdGVyKGU9PiFlLmNvbXBsZXRlZCAmJiAhZS5vcnBoYW5lZCkubGVuZ3RoIHx8IFwiXCJ9PC9zcGFuPlxyXG4gICAgICAgICAgICBgXHJcblxyXG4gICAgICAgICAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoZGF0ZUxhYmVsRGl2KTtcclxuICAgICAgICAgICAgdGFyZ2V0LmFwcGVuZENoaWxkKGluZm9EaXYpO1xyXG4gICAgICAgICAgICBjb25zdCBjdXJEID0gbmV3IERhdGUoZC50b1N0cmluZygpKVxyXG4gICAgICAgICAgICB0YXJnZXQub25jbGljayA9ICgpPT4geyBNb2RhbC5nZXRJbnN0YW5jZSgpLm9wZW4oY3VyRC50b0RhdGVTdHJpbmcoKSkgfVxyXG4gICAgICAgICAgICBkLnNldERhdGUoZC5nZXREYXRlKCkgKyAxKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB0b1ByZXZNb250aCgpIDogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldE1vbnRoKHRoaXMuZGF0ZS5nZXRNb250aCgpIC0gMSk7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldERhdGUoMSk7ICAvLyAxXHVDNzdDXHVCODVDIFx1QjlERVx1Q0RCMFx1QzhGQ1x1QUUzMFxyXG4gICAgICAgIHRoaXMudXBkYXRlTW9udGhMYWJlbCgpO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHRvTmV4dE1vbnRoKCkgOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0TW9udGgodGhpcy5kYXRlLmdldE1vbnRoKCkgKyAxKTtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0RGF0ZSgxKTsgIC8vIDFcdUM3N0NcdUI4NUMgXHVCOURFXHVDREIwXHVDOEZDXHVBRTMwXHJcbiAgICAgICAgdGhpcy51cGRhdGVNb250aExhYmVsKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBjbGVhckNlbGxzKCkgOiB2b2lkIHtcclxuICAgICAgICBmb3IgKGNvbnN0IGNlbGwgb2YgdGhpcy5kYXRlQ2VsbHMpIHtcclxuICAgICAgICAgICAgY2VsbC50ZXh0Q29udGVudCA9IFwiXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdXBkYXRlTW9udGhMYWJlbCgpIHtcclxuICAgICAgICB0aGlzLm1vbnRoTGFiZWwudGV4dENvbnRlbnQgPSBgJHt0aGlzLmRhdGUuZ2V0RnVsbFllYXIoKX1cdUIxNDQgJHt0aGlzLmRhdGUuZ2V0TW9udGgoKSArIDF9XHVDNkQ0YDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHVwZGF0ZVNjaGVkdWxlcygpIHtcclxuICAgICAgICBhd2FpdCB1cGRhdGVTY2hlZHVsZXMoKTtcclxuICAgICAgICBhd2FpdCBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLnVwZGF0ZSgpO1xyXG4gICAgICAgIGF3YWl0IHRoaXMucmVuZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIHN0YXRpYyBnZXRWaWV3KCkgOiBIVE1MRGl2RWxlbWVudCB7XHJcbiAgICAgICAgY29uc3QgY2FsZW5kYXJFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblxyXG4gICAgICAgIGNhbGVuZGFyRWwuaW5uZXJIVE1MID0gKGBcclxuICAgICAgICAgICAgPGRpdiBpZD1cImNvbnRyb2xcIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgaWQ9XCJpbmZvXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cInByZXYtYnRuXCI+Jmx0OzwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGlkPVwibW9udGgtbGFiZWxcIj48L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cIm5leHQtYnRuXCI+Jmd0OzwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwidXBkYXRlLWJ0blwiPlx1QzVDNVx1QjM3MFx1Qzc3NFx1RDJCODwvYnV0dG9uPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPHRhYmxlPlxyXG4gICAgICAgICAgICAgICAgPHRoZWFkPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1Qzc3QzwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUM2RDQ8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVENjU0PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1QzIxODwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUJBQTk8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVBRTA4PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1RDFBMDwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICA8L3RoZWFkPlxyXG4gICAgICAgICAgICAgICAgPHRib2R5PlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgPC90Ym9keT5cclxuICAgICAgICAgICAgPC90YWJsZT5cclxuICAgICAgICBgKTtcclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLmNhbGVuZGVyKSBcclxuICAgICAgICAgICAgdGhpcy5jYWxlbmRlciA9IG5ldyBDYWxlbmRhcihjYWxlbmRhckVsKTtcclxuICAgICAgICAvLyB0aGlzLmNhbGVuZGVyLmdldFNjaGVkdWxlcygpO1xyXG4gICAgICAgIHRoaXMuY2FsZW5kZXIucmVuZGVyKCk7XHJcbiAgICAgICAgcmV0dXJuIGNhbGVuZGFyRWw7XHJcbiAgICB9XHJcbn07XHJcbiIsICJpbXBvcnQgQ2FsZW5kYXIgZnJvbSBcIi4vY2FsZW5kZXJcIjtcclxuaW1wb3J0IE1vZGFsIGZyb20gXCIuL21vZGFsXCI7XHJcbmltcG9ydCB7IFN1YmplY3QgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC91cGRhdGVTY2hlZHVsZVwiO1xyXG5cclxuLy8gaW1wb3J0IHtjYWxlbmRhckNzc30gZnJvbSBcIi4vY29uc3RzXCI7XHJcblxyXG5cclxuYXN5bmMgZnVuY3Rpb24gbWFpbigpIDogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCB0YXJnZXRFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIuZnJvbnQtYm94LmZyb250LWJveC1jb3Vyc2VcIik7XHJcbiAgICBpZiAoIXRhcmdldEVsKSByZXR1cm47XHJcblxyXG4gICAgLy8gY29uc3Qgc3R5bGVFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcclxuICAgIGNvbnN0IGRldGFpbHNFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkZXRhaWxzXCIpO1xyXG4gICAgY29uc3Qgc3VtbWFyeUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN1bW1hcnlcIik7XHJcbiAgICBzdW1tYXJ5RWwudGV4dENvbnRlbnQgPSBcIlBsYXRvIENhbGVuZGFyM1wiO1xyXG4gICAgLy8gc3R5bGVFbC5pbm5lckhUTUwgPSBjYWxlbmRhckNzcztcclxuICAgIFxyXG4gICAgZGV0YWlsc0VsLmFwcGVuZENoaWxkKHN1bW1hcnlFbCk7XHJcbiAgICBkZXRhaWxzRWwuYXBwZW5kQ2hpbGQoYXdhaXQgTW9kYWwuZ2V0VmlldygpKTtcclxuICAgIGRldGFpbHNFbC5hcHBlbmRDaGlsZChhd2FpdCBDYWxlbmRhci5nZXRWaWV3KCkpO1xyXG4gICAgZGV0YWlsc0VsLnNldEF0dHJpYnV0ZShcImlkXCIsIFwicGxhdG8tY2FsZW5kYXJcIik7XHJcbiAgICBcclxuICAgIHRhcmdldEVsPy5wcmVwZW5kKGRldGFpbHNFbCk7XHJcbn1cclxuXHJcbm1haW4oKTtcclxuXHJcblxyXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7QUFHQSxpQkFBc0IsZUFBdUM7QUFDekQsWUFBUSxJQUFJLHdJQUErQjtBQUczQyxVQUFNLFdBQVcsTUFBTSxPQUFPLFFBQVEsWUFBWSxFQUFFLFFBQVEsZ0JBQWdCLENBQUM7QUFHN0UsWUFBUSxJQUFJLHNGQUFxQixRQUFRO0FBR3pDLFdBQU8s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
