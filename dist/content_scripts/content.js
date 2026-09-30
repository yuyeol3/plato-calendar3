"use strict";
(() => {
  // src/content_scripts/utils.ts
  async function getSchedules() {
    const response = await chrome.runtime.sendMessage({ action: "loadSchedules" });
    if (!response?.result) throw new Error("\uC77C\uC815 \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    return response.result;
  }
  var LAST_UPDATE_KEY = "plato-calendar3-lastUpdate";
  async function updateSchedules() {
    const res = await chrome.runtime.sendMessage({
      action: "updateData"
    });
    if (typeof res?.result !== "boolean" || !Array.isArray(res.errors) || !Array.isArray(res.warnings)) {
      throw new Error("\uAC31\uC2E0 \uC751\uB2F5\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD655\uC7A5 \uD504\uB85C\uADF8\uB7A8\uC744 \uB2E4\uC2DC \uB85C\uB4DC\uD574 \uC8FC\uC138\uC694.");
    }
    if (res.result && res.errors.length === 0) localStorage.setItem(LAST_UPDATE_KEY, (/* @__PURE__ */ new Date()).toISOString());
    return res;
  }
  function CheckScheduleUpdateTiming() {
    const now = (/* @__PURE__ */ new Date()).getTime();
    const stored = localStorage.getItem(LAST_UPDATE_KEY);
    const lastUpdated = stored ? new Date(stored).getTime() : NaN;
    const HOUR = 1e3 * 3600;
    return !Number.isFinite(lastUpdated) || now - lastUpdated > HOUR;
  }

  // src/content_scripts/CalendarStorageManager.ts
  var CalendarStorageManager = class _CalendarStorageManager {
    constructor() {
      this.monthCache = /* @__PURE__ */ new Map();
      this.schedules = {};
      this.updatePromise = this.refresh();
    }
    async refresh() {
      this.schedules = await getSchedules();
      this.rebuildMonthCache();
    }
    getMonthKey(date) {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    }
    getIndexedSchedules() {
      return Object.values(this.schedules).flatMap((courseSchedules) => Object.values(courseSchedules)).filter((schedule) => schedule.due != null).map((schedule) => {
        const dueDate = new Date(schedule.due.toString());
        dueDate.setSeconds(dueDate.getSeconds() - 1);
        return { schedule, dueDate };
      }).filter(({ dueDate }) => dueDate.toString() !== "Invalid Date").sort((a, b) => {
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
    }
    rebuildMonthCache() {
      const monthCache = /* @__PURE__ */ new Map();
      for (const { schedule, dueDate } of this.getIndexedSchedules()) {
        const monthKey = this.getMonthKey(dueDate);
        const dateKey = dueDate.toDateString();
        if (!monthCache.has(monthKey)) {
          monthCache.set(monthKey, {});
        }
        const monthData = monthCache.get(monthKey);
        if (!monthData[dateKey]) monthData[dateKey] = {};
        monthData[dateKey][schedule.id] = schedule;
      }
      this.monthCache = monthCache;
    }
    async loadMonth(date) {
      await this.updatePromise;
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
    [0 /* HW */]: "https://plato.pusan.ac.kr/theme/image.php/coursemos/assign/1790758578/monologo",
    [1 /* VID */]: "https://plato.pusan.ac.kr/theme/image.php/coursemos/vod/1790758578/monologo",
    [3 /* QUIZ */]: "https://plato.pusan.ac.kr/theme/image.php/coursemos/quiz/1790758578/monologo",
    [2 /* ZOOM */]: "https://plato.pusan.ac.kr/theme/image.php/coursemos/zoom/1790758578/monologo",
    [4 /* PA */]: null
  };
  var ScheduleLabels = {
    [0 /* HW */]: "\uACFC\uC81C",
    [1 /* VID */]: "\uC601\uC0C1",
    [3 /* QUIZ */]: "\uC2DC\uD5D8",
    [2 /* ZOOM */]: "Zoom",
    [4 /* PA */]: "VPL"
  };
  function createScheduleDiv(data) {
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
      icon.onerror = () => {
        iconDiv.textContent = ScheduleLabels[data.type];
      };
      iconDiv.appendChild(icon);
    } else iconDiv.textContent = ScheduleLabels[data.type];
    const content = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = data.name;
    const course = document.createElement("p");
    course.textContent = data.course.name;
    const due = document.createElement("p");
    due.textContent = data.due == null ? "\uB9C8\uAC10 \uC5C6\uC74C" : new Date(data.due.toString()).toLocaleString();
    content.append(title, course, due);
    appendScheduleStatus(content, data);
    if (data.completionBasis === "progress") {
      const label = document.createElement("span");
      label.className = "completion-progress";
      label.textContent = "\uC2DC\uCCAD \uAE30\uC900 100%";
      content.appendChild(label);
    }
    divEl.append(iconDiv, content);
    divEl.classList.add("schedule");
    divEl.onclick = () => {
      window.open(data.url);
    };
    applyScheduleState(divEl, data);
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
  function applyScheduleState(divEl, data) {
    if (data.orphaned) divEl.classList.add("orphaned");
    else if (data.completed === true) divEl.classList.add("completed");
    else if (data.completed === false) divEl.classList.add(ScheduleStyles[data.type]);
    else divEl.classList.add("unknown");
  }
  function appendScheduleStatus(divEl, data, compact = false) {
    if (data.completed == null) {
      const label = document.createElement("span");
      label.className = "completion-unknown";
      if (compact) {
        label.classList.add("completion-unknown-icon");
        label.textContent = "\u26A0\uFE0F";
        label.title = "\uC644\uB8CC \uC5EC\uBD80 \uD655\uC778 \uBD88\uAC00";
        label.setAttribute("aria-label", "\uC644\uB8CC \uC5EC\uBD80 \uD655\uC778 \uBD88\uAC00");
        divEl.prepend(label);
      } else {
        label.textContent = "\uC644\uB8CC \uC5EC\uBD80 \uD655\uC778 \uBD88\uAC00";
        divEl.appendChild(label);
      }
    }
    if (data.attendance === "late") {
      const label = document.createElement("span");
      label.className = "attendance-late";
      label.textContent = "\uC9C0\uAC01";
      divEl.appendChild(label);
    }
  }
  function createScheduleMiniDiv(data, compact = true) {
    const divEl = document.createElement("div");
    divEl.textContent = data.name;
    divEl.classList.add("mini-schedule");
    applyScheduleState(divEl, data);
    appendScheduleStatus(divEl, data, compact);
    return divEl;
  }
  var Calendar = class _Calendar {
    // 굳이 가지고있을 필요 없을수도
    // private prevBtn : HTMLButtonElement;
    // private nextBtn : HTMLButtonElement;
    constructor(calendarDiv) {
      this.maxScheduleRender = 2;
      this.renderVersion = 0;
      this.calendarDiv = calendarDiv;
      this.statusEl = calendarDiv.querySelector("#update-status");
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
        this.render().catch((error) => this.showError(error));
      };
      nextBtn.onclick = () => {
        this.toNextMonth();
        this.render().catch((error) => this.showError(error));
      };
      updateBtn.onclick = async () => {
        updateBtn.textContent = "\uC5C5\uB370\uC774\uD2B8 \uC911";
        updateBtn.classList.add("updating");
        updateBtn.disabled = true;
        try {
          await this.updateSchedules();
        } catch (error) {
          this.showError(error);
        } finally {
          updateBtn.textContent = "\uC5C5\uB370\uC774\uD2B8";
          updateBtn.classList.remove("updating");
          updateBtn.disabled = false;
        }
      };
    }
    showError(error) {
      this.statusEl.textContent = `\uAC31\uC2E0 \uC2E4\uD328: ${error instanceof Error ? error.message : "\uC54C \uC218 \uC5C6\uB294 \uC624\uB958"}`;
      this.statusEl.classList.add("update-error");
    }
    async render() {
      const version = ++this.renderVersion;
      const d = new Date(this.date);
      const month = d.getMonth();
      const day = d.getDay();
      await CalendarStorageManager.getInstance().loadMonth(this.date);
      if (version !== this.renderVersion) return;
      this.clearCells();
      const today = (/* @__PURE__ */ new Date()).toDateString();
      while (d.getMonth() == month) {
        const target = this.dateCells[d.getDate() - 1 + day];
        const dateLabelDiv = document.createElement("div");
        const infoDiv = document.createElement("div");
        dateLabelDiv.classList.add("date-label-div");
        infoDiv.classList.add("info-div");
        if (d.toDateString() == today) dateLabelDiv.classList.add("today");
        const targetSchedules = await CalendarStorageManager.getInstance().get(d.toDateString());
        if (version !== this.renderVersion) return;
        for (let i = 0; i < Math.min(targetSchedules.length, this.maxScheduleRender); i++) {
          infoDiv.appendChild(createScheduleMiniDiv(targetSchedules[i]));
        }
        if (targetSchedules.length > this.maxScheduleRender) {
          const hiddenScheduleDiv = document.createElement("div");
          hiddenScheduleDiv.textContent = `+${targetSchedules.length - this.maxScheduleRender}`;
          infoDiv.appendChild(hiddenScheduleDiv);
        }
        if (targetSchedules.length > this.maxScheduleRender || targetSchedules.some((schedule) => schedule.completed == null)) {
          const hoverDiv = document.createElement("div");
          hoverDiv.classList.add("hover-div");
          for (let i = 0; i < targetSchedules.length; i++) {
            hoverDiv.appendChild(createScheduleMiniDiv(targetSchedules[i], false));
          }
          target.appendChild(hoverDiv);
        }
        dateLabelDiv.innerHTML = `
                <span class="date-label">${d.getDate().toString()}</span>
                <span class="unresolved-schedules">${targetSchedules.filter((e) => e.completed === false && !e.orphaned).length || ""}</span>
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
      this.statusEl.textContent = "\uC77C\uC815\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.";
      this.statusEl.classList.remove("update-error");
      const result = await updateSchedules();
      this.statusEl.textContent = [result.result ? "\uAC31\uC2E0 \uC644\uB8CC" : "\uC77C\uBD80 \uC77C\uC815 \uAC31\uC2E0 \uC2E4\uD328. \uD655\uC778\uD55C \uC77C\uC815\uC740 \uBC18\uC601\uD588\uC2B5\uB2C8\uB2E4.", ...result.errors, ...result.warnings].join("\n");
      this.statusEl.classList.toggle("update-error", !result.result);
      await CalendarStorageManager.update();
      await this.render();
    }
    static async getView() {
      if (this.calender) return this.calender.calendarDiv;
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
            <details id="update-details">
                <summary>\uAC31\uC2E0 \uC548\uB0B4</summary>
                <p id="update-status" role="status" aria-live="polite">\uC644\uB8CC \uC5EC\uBD80 \uD655\uC778 \uBD88\uAC00 \uC77C\uC815\uC740 \uBBF8\uC644\uB8CC \uAC1C\uC218\uC5D0\uC11C \uC81C\uC678\uB429\uB2C8\uB2E4.</p>
            </details>
        `;
      this.calender = new _Calendar(calendarEl);
      try {
        await this.calender.render();
      } catch (error) {
        this.calender.showError(error);
      }
      if (CheckScheduleUpdateTiming()) calendarEl.querySelector("#update-btn").click();
      return calendarEl;
    }
  };

  // src/content_scripts/content.ts
  async function main() {
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
  main().catch((error) => {
    const target = document.getElementById("plato-calendar");
    if (target) {
      const status = document.createElement("p");
      status.setAttribute("role", "status");
      status.textContent = `\uCE98\uB9B0\uB354\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4: ${error instanceof Error ? error.message : "\uC54C \uC218 \uC5C6\uB294 \uC624\uB958"}`;
      const details = document.createElement("details");
      details.id = "update-details";
      const summary = document.createElement("summary");
      summary.textContent = "\uAC31\uC2E0 \uC548\uB0B4";
      details.append(summary, status);
      target.appendChild(details);
    }
  });
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy91dGlscy50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL0NhbGVuZGFyU3RvcmFnZU1hbmFnZXIudHMiLCAiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy9tb2RhbC50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL2NhbGVuZGVyLnRzIiwgIi4uLy4uL3NyYy9jb250ZW50X3NjcmlwdHMvY29udGVudC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgQWxsU2NoZWR1bGVzIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvc2NoZWR1bGVTdG9yYWdlTWFuYWdlclwiO1xyXG5pbXBvcnQgeyBTdWJqZWN0LCBVcGRhdGVSZXN1bHQgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC91cGRhdGVTY2hlZHVsZVwiO1xuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTY2hlZHVsZXMoKSA6IFByb21pc2U8QWxsU2NoZWR1bGVzPiB7XHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHsgYWN0aW9uOiBcImxvYWRTY2hlZHVsZXNcIiB9KTtcbiAgICBpZiAoIXJlc3BvbnNlPy5yZXN1bHQpIHRocm93IG5ldyBFcnJvcihcIlx1Qzc3Q1x1QzgxNSBcdUIzNzBcdUM3NzRcdUQxMzBcdUI5N0MgXHVCRDg4XHVCN0VDXHVDNjJDIFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQuXCIpO1xuICAgIHJldHVybiByZXNwb25zZS5yZXN1bHQ7XHJcbn1cclxuXHJcbmNvbnN0IExBU1RfVVBEQVRFX0tFWSA9IFwicGxhdG8tY2FsZW5kYXIzLWxhc3RVcGRhdGVcIlxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVNjaGVkdWxlcygpOiBQcm9taXNlPFVwZGF0ZVJlc3VsdD4ge1xuICAgIGNvbnN0IHJlczogVXBkYXRlUmVzdWx0ID0gYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xuICAgICAgICBhY3Rpb246IFwidXBkYXRlRGF0YVwiXHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAodHlwZW9mIHJlcz8ucmVzdWx0ICE9PSBcImJvb2xlYW5cIiB8fCAhQXJyYXkuaXNBcnJheShyZXMuZXJyb3JzKSB8fCAhQXJyYXkuaXNBcnJheShyZXMud2FybmluZ3MpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlx1QUMzMVx1QzJFMCBcdUM3NTFcdUIyRjVcdUM3NDQgXHVENjU1XHVDNzc4XHVENTYwIFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQuIFx1RDY1NVx1QzdBNSBcdUQ1MDRcdUI4NUNcdUFERjhcdUI3QThcdUM3NDQgXHVCMkU0XHVDMkRDIFx1Qjg1Q1x1QjREQ1x1RDU3NCBcdUM4RkNcdUMxMzhcdUM2OTQuXCIpO1xuICAgIH1cbiAgICBpZiAocmVzLnJlc3VsdCAmJiByZXMuZXJyb3JzLmxlbmd0aCA9PT0gMCkgbG9jYWxTdG9yYWdlLnNldEl0ZW0oTEFTVF9VUERBVEVfS0VZLCBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkpO1xuICAgIHJldHVybiByZXM7XG59XHJcblxyXG5leHBvcnQgIGZ1bmN0aW9uIENoZWNrU2NoZWR1bGVVcGRhdGVUaW1pbmcoKSB7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICAgIGNvbnN0IHN0b3JlZCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKExBU1RfVVBEQVRFX0tFWSk7XG4gICAgY29uc3QgbGFzdFVwZGF0ZWQgPSBzdG9yZWQgPyBuZXcgRGF0ZShzdG9yZWQpLmdldFRpbWUoKSA6IE5hTjtcblxyXG4gICAgY29uc3QgSE9VUiA9IDEwMDAgKiAzNjAwO1xyXG4gICAgcmV0dXJuICFOdW1iZXIuaXNGaW5pdGUobGFzdFVwZGF0ZWQpIHx8IG5vdy1sYXN0VXBkYXRlZCA+IEhPVVI7XG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q3VycmVudENvdXJzZXMoKSA6IFByb21pc2U8U3ViamVjdFtdPiB7XHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHsgYWN0aW9uOiBcImxvYWRDdXJDb3Vyc2VzXCIgfSk7ICAgIFxyXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHJlc3BvbnNlPy5yZXN1bHQpKSB0aHJvdyBuZXcgRXJyb3IoXCJcdUFDMTVcdUM4OEMgXHVCQUE5XHVCODVEXHVDNzQ0IFx1QkQ4OFx1QjdFQ1x1QzYyQyBcdUMyMTggXHVDNUM2XHVDMkI1XHVCMkM4XHVCMkU0LlwiKTtcbiAgICByZXR1cm4gcmVzcG9uc2UucmVzdWx0O1xufVxuIiwgImltcG9ydCB7IEFsbFNjaGVkdWxlcyB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3NjaGVkdWxlU3RvcmFnZU1hbmFnZXJcIjtcbmltcG9ydCB7IFNjaGVkdWxlIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcbmltcG9ydCB7IGdldFNjaGVkdWxlcyB9IGZyb20gXCIuL3V0aWxzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ2FsZW5kYXJTdG9yYWdlIHtcbiAgICBbZGF0ZTogc3RyaW5nXToge1xuICAgICAgICBbc2NoZWR1bGVJZDogc3RyaW5nXTogU2NoZWR1bGU7XG4gICAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ2FsZW5kYXJTdG9yYWdlTWFuYWdlciB7XG4gICAgcHJpdmF0ZSBzdGF0aWMgaW5zdGFuY2UgOiBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyO1xuICAgIHByaXZhdGUgbW9udGhDYWNoZSA6IE1hcDxzdHJpbmcsIENhbGVuZGFyU3RvcmFnZT47XG4gICAgcHJpdmF0ZSBzY2hlZHVsZXMgOiBBbGxTY2hlZHVsZXM7XG4gICAgcHJpdmF0ZSB1cGRhdGVQcm9taXNlIDogUHJvbWlzZTx2b2lkPjtcblxuICAgIHByaXZhdGUgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMubW9udGhDYWNoZSA9IG5ldyBNYXAoKTtcbiAgICAgICAgdGhpcy5zY2hlZHVsZXMgPSB7fTtcbiAgICAgICAgdGhpcy51cGRhdGVQcm9taXNlID0gdGhpcy5yZWZyZXNoKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZWZyZXNoKCkge1xuICAgICAgICB0aGlzLnNjaGVkdWxlcyA9IGF3YWl0IGdldFNjaGVkdWxlcygpO1xuICAgICAgICB0aGlzLnJlYnVpbGRNb250aENhY2hlKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRNb250aEtleShkYXRlIDogRGF0ZSkge1xuICAgICAgICByZXR1cm4gYCR7ZGF0ZS5nZXRGdWxsWWVhcigpfS0keyhkYXRlLmdldE1vbnRoKCkgKyAxKS50b1N0cmluZygpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0SW5kZXhlZFNjaGVkdWxlcygpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5zY2hlZHVsZXMpXG4gICAgICAgICAgICAuZmxhdE1hcChjb3Vyc2VTY2hlZHVsZXMgPT4gT2JqZWN0LnZhbHVlcyhjb3Vyc2VTY2hlZHVsZXMpKVxuICAgICAgICAgICAgLmZpbHRlcigoc2NoZWR1bGUpID0+IHNjaGVkdWxlLmR1ZSAhPSBudWxsKVxuICAgICAgICAgICAgLm1hcCgoc2NoZWR1bGUpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBkdWVEYXRlID0gbmV3IERhdGUoc2NoZWR1bGUuZHVlIS50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICBkdWVEYXRlLnNldFNlY29uZHMoZHVlRGF0ZS5nZXRTZWNvbmRzKCkgLSAxKTtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzY2hlZHVsZSwgZHVlRGF0ZSB9O1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5maWx0ZXIoKHsgZHVlRGF0ZSB9KSA9PiBkdWVEYXRlLnRvU3RyaW5nKCkgIT09IFwiSW52YWxpZCBEYXRlXCIpXG4gICAgICAgICAgICAuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBhLmR1ZURhdGUuZ2V0VGltZSgpIC0gYi5kdWVEYXRlLmdldFRpbWUoKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgcmVidWlsZE1vbnRoQ2FjaGUoKSB7XG4gICAgICAgIGNvbnN0IG1vbnRoQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgQ2FsZW5kYXJTdG9yYWdlPigpO1xuXG4gICAgICAgIGZvciAoY29uc3QgeyBzY2hlZHVsZSwgZHVlRGF0ZSB9IG9mIHRoaXMuZ2V0SW5kZXhlZFNjaGVkdWxlcygpKSB7XG4gICAgICAgICAgICBjb25zdCBtb250aEtleSA9IHRoaXMuZ2V0TW9udGhLZXkoZHVlRGF0ZSk7XG4gICAgICAgICAgICBjb25zdCBkYXRlS2V5ID0gZHVlRGF0ZS50b0RhdGVTdHJpbmcoKTtcblxuICAgICAgICAgICAgaWYgKCFtb250aENhY2hlLmhhcyhtb250aEtleSkpIHtcbiAgICAgICAgICAgICAgICBtb250aENhY2hlLnNldChtb250aEtleSwge30pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBtb250aERhdGEgPSBtb250aENhY2hlLmdldChtb250aEtleSkgYXMgQ2FsZW5kYXJTdG9yYWdlO1xuICAgICAgICAgICAgaWYgKCFtb250aERhdGFbZGF0ZUtleV0pIG1vbnRoRGF0YVtkYXRlS2V5XSA9IHt9O1xuICAgICAgICAgICAgbW9udGhEYXRhW2RhdGVLZXldW3NjaGVkdWxlLmlkXSA9IHNjaGVkdWxlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5tb250aENhY2hlID0gbW9udGhDYWNoZTtcbiAgICB9XG5cbiAgICBhc3luYyBsb2FkTW9udGgoZGF0ZSA6IERhdGUpIHtcbiAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVQcm9taXNlO1xuICAgIH1cblxuICAgIGFzeW5jIGdldChkYXRlIDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHBhcnNlZERhdGUgPSBuZXcgRGF0ZShkYXRlKTtcbiAgICAgICAgaWYgKHBhcnNlZERhdGUudG9TdHJpbmcoKSA9PT0gXCJJbnZhbGlkIERhdGVcIikgcmV0dXJuIFtdO1xuXG4gICAgICAgIGF3YWl0IHRoaXMubG9hZE1vbnRoKHBhcnNlZERhdGUpO1xuICAgICAgICBjb25zdCBtb250aERhdGEgPSB0aGlzLm1vbnRoQ2FjaGUuZ2V0KHRoaXMuZ2V0TW9udGhLZXkocGFyc2VkRGF0ZSkpID8/IHt9O1xuICAgICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhtb250aERhdGFbcGFyc2VkRGF0ZS50b0RhdGVTdHJpbmcoKV0gPz8ge30pO1xuICAgIH1cblxuICAgIHN0YXRpYyBhc3luYyB1cGRhdGUoKSB7XG4gICAgICAgIGNvbnN0IGluc3RhbmNlID0gdGhpcy5nZXRJbnN0YW5jZSgpO1xuICAgICAgICBpbnN0YW5jZS51cGRhdGVQcm9taXNlID0gaW5zdGFuY2UucmVmcmVzaCgpO1xuICAgICAgICBhd2FpdCBpbnN0YW5jZS51cGRhdGVQcm9taXNlO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXRJbnN0YW5jZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuaW5zdGFuY2UgPT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5pbnN0YW5jZSA9IG5ldyBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5pbnN0YW5jZTtcbiAgICB9XG59XG4iLCAiaW1wb3J0IHsgU2NoZWR1bGVUeXBlIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcclxuaW1wb3J0IHsgU2NoZWR1bGUgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC91cGRhdGVTY2hlZHVsZVwiO1xyXG5pbXBvcnQgQ2FsZW5kYXJTdG9yYWdlTWFuYWdlciBmcm9tIFwiLi9DYWxlbmRhclN0b3JhZ2VNYW5hZ2VyXCI7XHJcbmltcG9ydCB7IGFwcGx5U2NoZWR1bGVTdGF0ZSwgYXBwZW5kU2NoZWR1bGVTdGF0dXMgfSBmcm9tIFwiLi9jYWxlbmRlclwiO1xuXHJcbmV4cG9ydCBjb25zdCBTY2hlZHVsZUljb25zID0ge1xuICAgIFsgU2NoZWR1bGVUeXBlLkhXIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vcy9hc3NpZ24vMTc5MDc1ODU3OC9tb25vbG9nb1wiLFxuICAgIFsgU2NoZWR1bGVUeXBlLlZJRCBdIDogXCJodHRwczovL3BsYXRvLnB1c2FuLmFjLmtyL3RoZW1lL2ltYWdlLnBocC9jb3Vyc2Vtb3Mvdm9kLzE3OTA3NTg1NzgvbW9ub2xvZ29cIixcbiAgICBbIFNjaGVkdWxlVHlwZS5RVUlaIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vcy9xdWl6LzE3OTA3NTg1NzgvbW9ub2xvZ29cIixcbiAgICBbIFNjaGVkdWxlVHlwZS5aT09NIF0gOiBcImh0dHBzOi8vcGxhdG8ucHVzYW4uYWMua3IvdGhlbWUvaW1hZ2UucGhwL2NvdXJzZW1vcy96b29tLzE3OTA3NTg1NzgvbW9ub2xvZ29cIixcbiAgICBbIFNjaGVkdWxlVHlwZS5QQSBdIDogbnVsbCxcbn07XG5cbmNvbnN0IFNjaGVkdWxlTGFiZWxzID0ge1xuICAgIFsgU2NoZWR1bGVUeXBlLkhXIF0gOiBcIlx1QUNGQ1x1QzgxQ1wiLFxuICAgIFsgU2NoZWR1bGVUeXBlLlZJRCBdIDogXCJcdUM2MDFcdUMwQzFcIixcbiAgICBbIFNjaGVkdWxlVHlwZS5RVUlaIF0gOiBcIlx1QzJEQ1x1RDVEOFwiLFxuICAgIFsgU2NoZWR1bGVUeXBlLlpPT00gXSA6IFwiWm9vbVwiLFxuICAgIFsgU2NoZWR1bGVUeXBlLlBBIF0gOiBcIlZQTFwiXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVTY2hlZHVsZURpdihkYXRhIDogU2NoZWR1bGUpIHtcclxuICAgIGNvbnN0IGRpdkVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgIGNvbnN0IGljb25EaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuICAgIGljb25EaXYuaWQgPSBcImljb24tZGl2XCI7XG4gICAgY29uc3QgaWNvblVybCA9IFNjaGVkdWxlSWNvbnNbZGF0YS50eXBlXTtcbiAgICBpZiAoaWNvblVybCkge1xuICAgICAgICBjb25zdCBpY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImltZ1wiKTtcbiAgICAgICAgaWNvbi5zcmMgPSBpY29uVXJsO1xuICAgICAgICBpY29uLmFsdCA9IFNjaGVkdWxlTGFiZWxzW2RhdGEudHlwZV07XG4gICAgICAgIGljb24ud2lkdGggPSAzMjtcbiAgICAgICAgaWNvbi5oZWlnaHQgPSAzMjtcbiAgICAgICAgaWNvbi5vbmVycm9yID0gKCkgPT4geyBpY29uRGl2LnRleHRDb250ZW50ID0gU2NoZWR1bGVMYWJlbHNbZGF0YS50eXBlXTsgfTtcbiAgICAgICAgaWNvbkRpdi5hcHBlbmRDaGlsZChpY29uKTtcbiAgICB9IGVsc2UgaWNvbkRpdi50ZXh0Q29udGVudCA9IFNjaGVkdWxlTGFiZWxzW2RhdGEudHlwZV07XG4gICAgY29uc3QgY29udGVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaDRcIik7XG4gICAgdGl0bGUudGV4dENvbnRlbnQgPSBkYXRhLm5hbWU7XG4gICAgY29uc3QgY291cnNlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInBcIik7XG4gICAgY291cnNlLnRleHRDb250ZW50ID0gZGF0YS5jb3Vyc2UubmFtZTtcbiAgICBjb25zdCBkdWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwicFwiKTtcbiAgICBkdWUudGV4dENvbnRlbnQgPSBkYXRhLmR1ZSA9PSBudWxsID8gXCJcdUI5QzhcdUFDMTAgXHVDNUM2XHVDNzRDXCIgOiBuZXcgRGF0ZShkYXRhLmR1ZS50b1N0cmluZygpKS50b0xvY2FsZVN0cmluZygpO1xuICAgIGNvbnRlbnQuYXBwZW5kKHRpdGxlLCBjb3Vyc2UsIGR1ZSk7XG4gICAgYXBwZW5kU2NoZWR1bGVTdGF0dXMoY29udGVudCwgZGF0YSk7XG4gICAgaWYgKGRhdGEuY29tcGxldGlvbkJhc2lzID09PSBcInByb2dyZXNzXCIpIHtcbiAgICAgICAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICAgICAgbGFiZWwuY2xhc3NOYW1lID0gXCJjb21wbGV0aW9uLXByb2dyZXNzXCI7XG4gICAgICAgIGxhYmVsLnRleHRDb250ZW50ID0gXCJcdUMyRENcdUNDQUQgXHVBRTMwXHVDOTAwIDEwMCVcIjtcbiAgICAgICAgY29udGVudC5hcHBlbmRDaGlsZChsYWJlbCk7XG4gICAgfVxuICAgIGRpdkVsLmFwcGVuZChpY29uRGl2LCBjb250ZW50KTtcbiAgICBkaXZFbC5jbGFzc0xpc3QuYWRkKFwic2NoZWR1bGVcIik7XHJcbiAgICBkaXZFbC5vbmNsaWNrID0gKCk9PiB7XHJcbiAgICAgICAgd2luZG93Lm9wZW4oZGF0YS51cmwpO1xyXG4gICAgfVxyXG5cclxuICAgIGFwcGx5U2NoZWR1bGVTdGF0ZShkaXZFbCwgZGF0YSk7XG4gICAgcmV0dXJuIGRpdkVsO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNb2RhbCB7XHJcbiAgICBwcml2YXRlIHN0YXRpYyBpbnN0YW5jZSA6IE1vZGFsO1xyXG4gICAgcHJpdmF0ZSBtb2RhbERpdiA6IEhUTUxEaXZFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSB0aXRsZUVsIDogSFRNTEhlYWRpbmdFbGVtZW50O1xyXG4gICAgcHJpdmF0ZSBjb250ZW50RGl2IDogSFRNTERpdkVsZW1lbnQ7XHJcbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKG1vZGFsRGl2IDogSFRNTERpdkVsZW1lbnQpIHtcclxuICAgICAgICB0aGlzLm1vZGFsRGl2ID0gbW9kYWxEaXY7XHJcbiAgICAgICAgdGhpcy50aXRsZUVsID0gbW9kYWxEaXYucXVlcnlTZWxlY3RvcihcIiN0aXRsZVwiKSBhcyBIVE1MSGVhZGluZ0VsZW1lbnQ7XHJcbiAgICAgICAgdGhpcy5jb250ZW50RGl2ID0gbW9kYWxEaXYucXVlcnlTZWxlY3RvcihcIiNjb250ZW50XCIpIGFzIEhUTUxEaXZFbGVtZW50O1xyXG5cclxuICAgICAgICBjb25zdCBjbG9zZUJ1dHRvbiA9IG1vZGFsRGl2LnF1ZXJ5U2VsZWN0b3IoXCIuY2xvc2UtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgIGNsb3NlQnV0dG9uLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBvcGVuKGRhdGUgOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLmNvbnRlbnREaXYuaW5uZXJIVE1MID0gXCJcIjtcclxuICAgICAgICB0aGlzLnRpdGxlRWwudGV4dENvbnRlbnQgPSBuZXcgRGF0ZShkYXRlKS50b0xvY2FsZURhdGVTdHJpbmcoKTtcclxuICAgICAgICBjb25zdCBzY2hlZHVsZXMgPSBhd2FpdCBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLmdldEluc3RhbmNlKCkuZ2V0KGRhdGUpO1xyXG5cclxuICAgICAgICBpZiAoc2NoZWR1bGVzLmxlbmd0aCA9PT0gMCApIHJldHVybjtcclxuXHJcbiAgICAgICAgZm9yIChjb25zdCBzY2hlZHVsZSBvZiBzY2hlZHVsZXMpIHtcclxuICAgICAgICAgICAgY29uc3QgZGl2RWwgPSBjcmVhdGVTY2hlZHVsZURpdihzY2hlZHVsZSk7XHJcbiAgICAgICAgICAgIHRoaXMuY29udGVudERpdi5hcHBlbmRDaGlsZChkaXZFbCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLm1vZGFsRGl2LmNsYXNzTGlzdC5hZGQoXCJtb2RhbC1vcGVuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIGNsb3NlKCkge1xyXG4gICAgICAgIHRoaXMubW9kYWxEaXYuY2xhc3NMaXN0LnJlbW92ZShcIm1vZGFsLW9wZW5cIik7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGdldEluc3RhbmNlKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmluc3RhbmNlO1xyXG4gICAgfVxyXG5cclxuICAgIHN0YXRpYyBnZXRWaWV3KCkge1xyXG4gICAgICAgIGlmICghdGhpcy5pbnN0YW5jZSkgeyBcclxuICAgICAgICAgICAgY29uc3QgbW9kYWxFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgICAgIG1vZGFsRWwuc2V0QXR0cmlidXRlKCdpZCcsIFwibW9kYWxcIik7XHJcblxyXG4gICAgICAgICAgICBtb2RhbEVsLmlubmVySFRNTCA9IGBcclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdXN0b20tbW9kYWwtYmFja2Ryb3BcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjdXN0b20tbW9kYWwtZGlhbG9nXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBpZD1cInRvcFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiY2xvc2UtYnRuXCI+XHUwMEQ3PC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPGgyIGlkPVwidGl0bGVcIj48L2gyPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgaWQ9XCJjb250ZW50XCI+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgYDsgXHJcbiAgICAgICAgICAgIHRoaXMuaW5zdGFuY2UgPSBuZXcgTW9kYWwobW9kYWxFbCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICByZXR1cm4gdGhpcy5pbnN0YW5jZS5tb2RhbERpdjtcclxuICAgIH1cclxufVxuIiwgImltcG9ydCB7IFNjaGVkdWxlLCBTY2hlZHVsZVR5cGUgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC91cGRhdGVTY2hlZHVsZVwiO1xyXG5pbXBvcnQgQ2FsZW5kYXJTdG9yYWdlTWFuYWdlciBmcm9tIFwiLi9DYWxlbmRhclN0b3JhZ2VNYW5hZ2VyXCI7XHJcbmltcG9ydCBNb2RhbCBmcm9tIFwiLi9tb2RhbFwiO1xyXG5pbXBvcnQgeyBDaGVja1NjaGVkdWxlVXBkYXRlVGltaW5nLCB1cGRhdGVTY2hlZHVsZXMgfSBmcm9tIFwiLi91dGlsc1wiO1xuXHJcblxyXG5leHBvcnQgY29uc3QgU2NoZWR1bGVTdHlsZXMgPSB7XHJcbiAgICBbIFNjaGVkdWxlVHlwZS5IVyBdIDogXCJod1wiLFxyXG4gICAgWyBTY2hlZHVsZVR5cGUuVklEIF0gOiBcInZpZFwiLFxyXG4gICAgWyBTY2hlZHVsZVR5cGUuUVVJWiBdIDogXCJxdWl6XCIsXHJcbiAgICBbIFNjaGVkdWxlVHlwZS5aT09NIF0gOiBcInpvb21cIixcclxuICAgIFsgU2NoZWR1bGVUeXBlLlBBIF0gOiBcInBhXCJcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5U2NoZWR1bGVTdGF0ZShkaXZFbDogSFRNTEVsZW1lbnQsIGRhdGE6IFNjaGVkdWxlKSB7XG4gICAgaWYgKGRhdGEub3JwaGFuZWQpIGRpdkVsLmNsYXNzTGlzdC5hZGQoXCJvcnBoYW5lZFwiKTtcbiAgICBlbHNlIGlmIChkYXRhLmNvbXBsZXRlZCA9PT0gdHJ1ZSkgZGl2RWwuY2xhc3NMaXN0LmFkZChcImNvbXBsZXRlZFwiKTtcbiAgICBlbHNlIGlmIChkYXRhLmNvbXBsZXRlZCA9PT0gZmFsc2UpIGRpdkVsLmNsYXNzTGlzdC5hZGQoU2NoZWR1bGVTdHlsZXNbZGF0YS50eXBlXSk7XG4gICAgZWxzZSBkaXZFbC5jbGFzc0xpc3QuYWRkKFwidW5rbm93blwiKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFwcGVuZFNjaGVkdWxlU3RhdHVzKGRpdkVsOiBIVE1MRWxlbWVudCwgZGF0YTogU2NoZWR1bGUsIGNvbXBhY3QgPSBmYWxzZSkge1xuICAgIGlmIChkYXRhLmNvbXBsZXRlZCA9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG4gICAgICAgIGxhYmVsLmNsYXNzTmFtZSA9IFwiY29tcGxldGlvbi11bmtub3duXCI7XG4gICAgICAgIGlmIChjb21wYWN0KSB7XG4gICAgICAgICAgICBsYWJlbC5jbGFzc0xpc3QuYWRkKFwiY29tcGxldGlvbi11bmtub3duLWljb25cIik7XG4gICAgICAgICAgICBsYWJlbC50ZXh0Q29udGVudCA9IFwiXHUyNkEwXHVGRTBGXCI7XG4gICAgICAgICAgICBsYWJlbC50aXRsZSA9IFwiXHVDNjQ0XHVCOENDIFx1QzVFQ1x1QkQ4MCBcdUQ2NTVcdUM3NzggXHVCRDg4XHVBQzAwXCI7XG4gICAgICAgICAgICBsYWJlbC5zZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsXCIsIFwiXHVDNjQ0XHVCOENDIFx1QzVFQ1x1QkQ4MCBcdUQ2NTVcdUM3NzggXHVCRDg4XHVBQzAwXCIpO1xuICAgICAgICAgICAgZGl2RWwucHJlcGVuZChsYWJlbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsYWJlbC50ZXh0Q29udGVudCA9IFwiXHVDNjQ0XHVCOENDIFx1QzVFQ1x1QkQ4MCBcdUQ2NTVcdUM3NzggXHVCRDg4XHVBQzAwXCI7XG4gICAgICAgICAgICBkaXZFbC5hcHBlbmRDaGlsZChsYWJlbCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGRhdGEuYXR0ZW5kYW5jZSA9PT0gXCJsYXRlXCIpIHtcbiAgICAgICAgY29uc3QgbGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcbiAgICAgICAgbGFiZWwuY2xhc3NOYW1lID0gXCJhdHRlbmRhbmNlLWxhdGVcIjtcbiAgICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSBcIlx1QzlDMFx1QUMwMVwiO1xuICAgICAgICBkaXZFbC5hcHBlbmRDaGlsZChsYWJlbCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVTY2hlZHVsZU1pbmlEaXYoZGF0YSA6IFNjaGVkdWxlLCBjb21wYWN0ID0gdHJ1ZSkge1xuICAgIGNvbnN0IGRpdkVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcbiAgICBkaXZFbC50ZXh0Q29udGVudCA9IGRhdGEubmFtZTtcbiAgICBkaXZFbC5jbGFzc0xpc3QuYWRkKFwibWluaS1zY2hlZHVsZVwiKTtcbiAgICBhcHBseVNjaGVkdWxlU3RhdGUoZGl2RWwsIGRhdGEpO1xuICAgIGFwcGVuZFNjaGVkdWxlU3RhdHVzKGRpdkVsLCBkYXRhLCBjb21wYWN0KTtcbiAgICByZXR1cm4gZGl2RWw7XHJcbn1cclxuXHJcbi8vIHNpbmdsZXRvblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDYWxlbmRhciB7XHJcbiAgICBwcml2YXRlIHN0YXRpYyBjYWxlbmRlciA6IENhbGVuZGFyO1xyXG4gICAgcHJpdmF0ZSBkYXRlIDogRGF0ZTtcclxuICAgIHByaXZhdGUgZGF0ZUNlbGxzIDogSFRNTFRhYmxlQ2VsbEVsZW1lbnRbXTtcclxuICAgIHByaXZhdGUgbW9udGhMYWJlbCA6IEhUTUxTcGFuRWxlbWVudDtcclxuICAgIHByaXZhdGUgbWF4U2NoZWR1bGVSZW5kZXIgPSAyO1xuICAgIHByaXZhdGUgY2FsZW5kYXJEaXY6IEhUTUxEaXZFbGVtZW50O1xuICAgIHByaXZhdGUgc3RhdHVzRWw6IEhUTUxQYXJhZ3JhcGhFbGVtZW50O1xuICAgIHByaXZhdGUgcmVuZGVyVmVyc2lvbiA9IDA7XG4gICAgLy8gXHVBRDczXHVDNzc0IFx1QUMwMFx1QzlDMFx1QUNFMFx1Qzc4OFx1Qzc0NCBcdUQ1NDRcdUM2OTQgXHVDNUM2XHVDNzQ0XHVDMjE4XHVCM0M0XHJcbiAgICAvLyBwcml2YXRlIHByZXZCdG4gOiBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgIC8vIHByaXZhdGUgbmV4dEJ0biA6IEhUTUxCdXR0b25FbGVtZW50O1xyXG5cclxuICAgIHByaXZhdGUgY29uc3RydWN0b3IoY2FsZW5kYXJEaXYgOiBIVE1MRGl2RWxlbWVudCkge1xuICAgICAgICB0aGlzLmNhbGVuZGFyRGl2ID0gY2FsZW5kYXJEaXY7XG4gICAgICAgIHRoaXMuc3RhdHVzRWwgPSBjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yKFwiI3VwZGF0ZS1zdGF0dXNcIikgYXMgSFRNTFBhcmFncmFwaEVsZW1lbnQ7XG4gICAgICAgIHRoaXMuZGF0ZSA9IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldERhdGUoMSk7ICAvLyAxXHVDNzdDXHVCODVDIFx1QjlERVx1Q0RCMFx1QzhGQ1x1QUUzMFxyXG5cclxuICAgICAgICB0aGlzLmRhdGVDZWxscyA9IEFycmF5LmZyb20oY2FsZW5kYXJEaXYucXVlcnlTZWxlY3RvckFsbChcInRib2R5IHRkXCIpKTtcclxuICAgICAgICB0aGlzLm1vbnRoTGFiZWwgPSBjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yKFwiI21vbnRoLWxhYmVsXCIpIGFzIEhUTUxTcGFuRWxlbWVudDtcclxuICAgICAgICBjb25zdCBwcmV2QnRuID0gY2FsZW5kYXJEaXYucXVlcnlTZWxlY3RvcihcIiNwcmV2LWJ0blwiKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgICAgICBjb25zdCBuZXh0QnRuID0gY2FsZW5kYXJEaXYucXVlcnlTZWxlY3RvcihcIiNuZXh0LWJ0blwiKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgICAgICBjb25zdCB1cGRhdGVCdG4gPSBjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yKFwiI3VwZGF0ZS1idG5cIikgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcblxyXG4gICAgICAgIHRoaXMudXBkYXRlTW9udGhMYWJlbCgpO1xyXG5cclxuICAgICAgICBwcmV2QnRuLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy50b1ByZXZNb250aCgpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbmRlcigpLmNhdGNoKGVycm9yID0+IHRoaXMuc2hvd0Vycm9yKGVycm9yKSk7XG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbmV4dEJ0bi5vbmNsaWNrID0gKCk9PiB7XHJcbiAgICAgICAgICAgIHRoaXMudG9OZXh0TW9udGgoKTtcclxuICAgICAgICAgICAgdGhpcy5yZW5kZXIoKS5jYXRjaChlcnJvciA9PiB0aGlzLnNob3dFcnJvcihlcnJvcikpO1xuICAgICAgICB9XHJcblxyXG4gICAgICAgIHVwZGF0ZUJ0bi5vbmNsaWNrID0gYXN5bmMgKCk9PntcclxuICAgICAgICAgICAgdXBkYXRlQnRuLnRleHRDb250ZW50ID0gXCJcdUM1QzVcdUIzNzBcdUM3NzRcdUQyQjggXHVDOTExXCJcclxuICAgICAgICAgICAgdXBkYXRlQnRuLmNsYXNzTGlzdC5hZGQoXCJ1cGRhdGluZ1wiKTtcclxuICAgICAgICAgICAgdXBkYXRlQnRuLmRpc2FibGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZVNjaGVkdWxlcygpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcihlcnJvcik7XG4gICAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgICAgIHVwZGF0ZUJ0bi50ZXh0Q29udGVudCA9IFwiXHVDNUM1XHVCMzcwXHVDNzc0XHVEMkI4XCI7XG4gICAgICAgICAgICAgICAgdXBkYXRlQnRuLmNsYXNzTGlzdC5yZW1vdmUoXCJ1cGRhdGluZ1wiKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVCdG4uZGlzYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcclxuXHJcbiAgICB9XG5cbiAgICBwcml2YXRlIHNob3dFcnJvcihlcnJvcjogdW5rbm93bikge1xuICAgICAgICB0aGlzLnN0YXR1c0VsLnRleHRDb250ZW50ID0gYFx1QUMzMVx1QzJFMCBcdUMyRTRcdUQzMjg6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIlx1QzU0QyBcdUMyMTggXHVDNUM2XHVCMjk0IFx1QzYyNFx1Qjk1OFwifWA7XG4gICAgICAgIHRoaXMuc3RhdHVzRWwuY2xhc3NMaXN0LmFkZChcInVwZGF0ZS1lcnJvclwiKTtcbiAgICB9XG5cclxuICAgIHByaXZhdGUgYXN5bmMgcmVuZGVyKCkge1xuICAgICAgICBjb25zdCB2ZXJzaW9uID0gKyt0aGlzLnJlbmRlclZlcnNpb247XG4gICAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZSh0aGlzLmRhdGUpO1xuICAgICAgICBjb25zdCBtb250aCA9IGQuZ2V0TW9udGgoKTtcbiAgICAgICAgY29uc3QgZGF5ID0gZC5nZXREYXkoKTtcblxuICAgICAgICBhd2FpdCBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLmdldEluc3RhbmNlKCkubG9hZE1vbnRoKHRoaXMuZGF0ZSk7XG4gICAgICAgIGlmICh2ZXJzaW9uICE9PSB0aGlzLnJlbmRlclZlcnNpb24pIHJldHVybjtcbiAgICAgICAgdGhpcy5jbGVhckNlbGxzKCk7XG5cbiAgICAgICAgLy8gYXdhaXQgdGhpcy5nZXRTY2hlZHVsZXMoKTtcbiAgICAgICAgLy8gY29uc29sZS5sb2codGhpcy5zY2hlZHVsZXMpO1xuICAgICAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCkudG9EYXRlU3RyaW5nKCk7XG4gICAgICAgIHdoaWxlIChkLmdldE1vbnRoKCkgPT0gbW9udGgpIHtcclxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5kYXRlQ2VsbHNbZC5nZXREYXRlKCkgLSAxICsgZGF5XTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGRhdGVMYWJlbERpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgICAgIGNvbnN0IGluZm9EaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cclxuICAgICAgICAgICAgZGF0ZUxhYmVsRGl2LmNsYXNzTGlzdC5hZGQoXCJkYXRlLWxhYmVsLWRpdlwiKTtcclxuICAgICAgICAgICAgaW5mb0Rpdi5jbGFzc0xpc3QuYWRkKFwiaW5mby1kaXZcIik7XHJcblxyXG4gICAgICAgICAgICBpZiAoZC50b0RhdGVTdHJpbmcoKSA9PSB0b2RheSkgZGF0ZUxhYmVsRGl2LmNsYXNzTGlzdC5hZGQoXCJ0b2RheVwiKTtcclxuXHJcblxyXG4gICAgICAgICAgICBjb25zdCB0YXJnZXRTY2hlZHVsZXMgPSAoYXdhaXQgQ2FsZW5kYXJTdG9yYWdlTWFuYWdlci5nZXRJbnN0YW5jZSgpLmdldChkLnRvRGF0ZVN0cmluZygpKSk7XG4gICAgICAgICAgICBpZiAodmVyc2lvbiAhPT0gdGhpcy5yZW5kZXJWZXJzaW9uKSByZXR1cm47XG5cclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1pbih0YXJnZXRTY2hlZHVsZXMubGVuZ3RoLCB0aGlzLm1heFNjaGVkdWxlUmVuZGVyKTsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpbmZvRGl2LmFwcGVuZENoaWxkKGNyZWF0ZVNjaGVkdWxlTWluaURpdih0YXJnZXRTY2hlZHVsZXNbaV0pKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHRhcmdldFNjaGVkdWxlcy5sZW5ndGggPiB0aGlzLm1heFNjaGVkdWxlUmVuZGVyKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBoaWRkZW5TY2hlZHVsZURpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgICAgICAgICBoaWRkZW5TY2hlZHVsZURpdi50ZXh0Q29udGVudCA9IGArJHt0YXJnZXRTY2hlZHVsZXMubGVuZ3RoIC0gdGhpcy5tYXhTY2hlZHVsZVJlbmRlcn1gO1xuICAgICAgICAgICAgICAgIGluZm9EaXYuYXBwZW5kQ2hpbGQoaGlkZGVuU2NoZWR1bGVEaXYpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRhcmdldFNjaGVkdWxlcy5sZW5ndGggPiB0aGlzLm1heFNjaGVkdWxlUmVuZGVyIHx8IHRhcmdldFNjaGVkdWxlcy5zb21lKHNjaGVkdWxlID0+IHNjaGVkdWxlLmNvbXBsZXRlZCA9PSBudWxsKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhvdmVyRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgICAgICAgICAgICAgIGhvdmVyRGl2LmNsYXNzTGlzdC5hZGQoXCJob3Zlci1kaXZcIik7XHJcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRhcmdldFNjaGVkdWxlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIGhvdmVyRGl2LmFwcGVuZENoaWxkKGNyZWF0ZVNjaGVkdWxlTWluaURpdih0YXJnZXRTY2hlZHVsZXNbaV0sIGZhbHNlKSk7XG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0LmFwcGVuZENoaWxkKGhvdmVyRGl2KVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBkYXRlTGFiZWxEaXYuaW5uZXJIVE1MID0gYFxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJkYXRlLWxhYmVsXCI+JHtkLmdldERhdGUoKS50b1N0cmluZygpfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidW5yZXNvbHZlZC1zY2hlZHVsZXNcIj4ke3RhcmdldFNjaGVkdWxlcy5maWx0ZXIoZT0+ZS5jb21wbGV0ZWQgPT09IGZhbHNlICYmICFlLm9ycGhhbmVkKS5sZW5ndGggfHwgXCJcIn08L3NwYW4+XG4gICAgICAgICAgICBgXHJcblxyXG4gICAgICAgICAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoZGF0ZUxhYmVsRGl2KTtcclxuICAgICAgICAgICAgdGFyZ2V0LmFwcGVuZENoaWxkKGluZm9EaXYpO1xyXG4gICAgICAgICAgICBjb25zdCBjdXJEID0gbmV3IERhdGUoZC50b1N0cmluZygpKVxyXG4gICAgICAgICAgICB0YXJnZXQub25jbGljayA9ICgpPT4geyBNb2RhbC5nZXRJbnN0YW5jZSgpLm9wZW4oY3VyRC50b0RhdGVTdHJpbmcoKSkgfVxyXG4gICAgICAgICAgICBkLnNldERhdGUoZC5nZXREYXRlKCkgKyAxKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB0b1ByZXZNb250aCgpIDogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldE1vbnRoKHRoaXMuZGF0ZS5nZXRNb250aCgpIC0gMSk7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldERhdGUoMSk7ICAvLyAxXHVDNzdDXHVCODVDIFx1QjlERVx1Q0RCMFx1QzhGQ1x1QUUzMFxyXG4gICAgICAgIHRoaXMudXBkYXRlTW9udGhMYWJlbCgpO1xyXG5cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHRvTmV4dE1vbnRoKCkgOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0TW9udGgodGhpcy5kYXRlLmdldE1vbnRoKCkgKyAxKTtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0RGF0ZSgxKTsgIC8vIDFcdUM3N0NcdUI4NUMgXHVCOURFXHVDREIwXHVDOEZDXHVBRTMwXHJcbiAgICAgICAgdGhpcy51cGRhdGVNb250aExhYmVsKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBjbGVhckNlbGxzKCkgOiB2b2lkIHtcclxuICAgICAgICBmb3IgKGNvbnN0IGNlbGwgb2YgdGhpcy5kYXRlQ2VsbHMpIHtcclxuICAgICAgICAgICAgY2VsbC50ZXh0Q29udGVudCA9IFwiXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdXBkYXRlTW9udGhMYWJlbCgpIHtcclxuICAgICAgICB0aGlzLm1vbnRoTGFiZWwudGV4dENvbnRlbnQgPSBgJHt0aGlzLmRhdGUuZ2V0RnVsbFllYXIoKX1cdUIxNDQgJHt0aGlzLmRhdGUuZ2V0TW9udGgoKSArIDF9XHVDNkQ0YDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHVwZGF0ZVNjaGVkdWxlcygpIHtcbiAgICAgICAgdGhpcy5zdGF0dXNFbC50ZXh0Q29udGVudCA9IFwiXHVDNzdDXHVDODE1XHVDNzQ0IFx1RDY1NVx1Qzc3OFx1RDU1OFx1QUNFMCBcdUM3ODhcdUMyQjVcdUIyQzhcdUIyRTQuXCI7XG4gICAgICAgIHRoaXMuc3RhdHVzRWwuY2xhc3NMaXN0LnJlbW92ZShcInVwZGF0ZS1lcnJvclwiKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXBkYXRlU2NoZWR1bGVzKCk7XG4gICAgICAgIHRoaXMuc3RhdHVzRWwudGV4dENvbnRlbnQgPSBbcmVzdWx0LnJlc3VsdCA/IFwiXHVBQzMxXHVDMkUwIFx1QzY0NFx1QjhDQ1wiIDogXCJcdUM3N0NcdUJEODAgXHVDNzdDXHVDODE1IFx1QUMzMVx1QzJFMCBcdUMyRTRcdUQzMjguIFx1RDY1NVx1Qzc3OFx1RDU1QyBcdUM3N0NcdUM4MTVcdUM3NDAgXHVCQzE4XHVDNjAxXHVENTg4XHVDMkI1XHVCMkM4XHVCMkU0LlwiLCAuLi5yZXN1bHQuZXJyb3JzLCAuLi5yZXN1bHQud2FybmluZ3NdLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIHRoaXMuc3RhdHVzRWwuY2xhc3NMaXN0LnRvZ2dsZShcInVwZGF0ZS1lcnJvclwiLCAhcmVzdWx0LnJlc3VsdCk7XG4gICAgICAgIGF3YWl0IENhbGVuZGFyU3RvcmFnZU1hbmFnZXIudXBkYXRlKCk7XG4gICAgICAgIGF3YWl0IHRoaXMucmVuZGVyKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRWaWV3KCkgOiBQcm9taXNlPEhUTUxEaXZFbGVtZW50PiB7XG4gICAgICAgIGlmICh0aGlzLmNhbGVuZGVyKSByZXR1cm4gdGhpcy5jYWxlbmRlci5jYWxlbmRhckRpdjtcbiAgICAgICAgY29uc3QgY2FsZW5kYXJFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblxyXG4gICAgICAgIGNhbGVuZGFyRWwuaW5uZXJIVE1MID0gKGBcclxuICAgICAgICAgICAgPGRpdiBpZD1cImNvbnRyb2xcIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgaWQ9XCJpbmZvXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cInByZXYtYnRuXCI+Jmx0OzwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGlkPVwibW9udGgtbGFiZWxcIj48L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cIm5leHQtYnRuXCI+Jmd0OzwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwidXBkYXRlLWJ0blwiPlx1QzVDNVx1QjM3MFx1Qzc3NFx1RDJCODwvYnV0dG9uPlxyXG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDx0YWJsZT5cbiAgICAgICAgICAgICAgICA8dGhlYWQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVDNzdDPC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1QzZENDwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUQ2NTQ8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVDMjE4PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1QkFBOTwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUFFMDg8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVEMUEwPC90aD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIDwvdGhlYWQ+XHJcbiAgICAgICAgICAgICAgICA8dGJvZHk+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICA8L3Rib2R5PlxyXG4gICAgICAgICAgICA8L3RhYmxlPlxuICAgICAgICAgICAgPGRldGFpbHMgaWQ9XCJ1cGRhdGUtZGV0YWlsc1wiPlxuICAgICAgICAgICAgICAgIDxzdW1tYXJ5Plx1QUMzMVx1QzJFMCBcdUM1NDhcdUIwQjQ8L3N1bW1hcnk+XG4gICAgICAgICAgICAgICAgPHAgaWQ9XCJ1cGRhdGUtc3RhdHVzXCIgcm9sZT1cInN0YXR1c1wiIGFyaWEtbGl2ZT1cInBvbGl0ZVwiPlx1QzY0NFx1QjhDQyBcdUM1RUNcdUJEODAgXHVENjU1XHVDNzc4IFx1QkQ4OFx1QUMwMCBcdUM3N0NcdUM4MTVcdUM3NDAgXHVCQkY4XHVDNjQ0XHVCOENDIFx1QUMxQ1x1QzIxOFx1QzVEMFx1QzExQyBcdUM4MUNcdUM2NzhcdUI0MjlcdUIyQzhcdUIyRTQuPC9wPlxuICAgICAgICAgICAgPC9kZXRhaWxzPlxuICAgICAgICBgKTtcclxuXHJcbiAgICAgICAgdGhpcy5jYWxlbmRlciA9IG5ldyBDYWxlbmRhcihjYWxlbmRhckVsKTtcbiAgICAgICAgdHJ5IHsgYXdhaXQgdGhpcy5jYWxlbmRlci5yZW5kZXIoKTsgfVxuICAgICAgICBjYXRjaCAoZXJyb3IpIHsgdGhpcy5jYWxlbmRlci5zaG93RXJyb3IoZXJyb3IpOyB9XG4gICAgICAgIGlmIChDaGVja1NjaGVkdWxlVXBkYXRlVGltaW5nKCkpIChjYWxlbmRhckVsLnF1ZXJ5U2VsZWN0b3IoXCIjdXBkYXRlLWJ0blwiKSBhcyBIVE1MQnV0dG9uRWxlbWVudCkuY2xpY2soKTtcbiAgICAgICAgcmV0dXJuIGNhbGVuZGFyRWw7XHJcbiAgICB9XHJcbn07XHJcbiIsICJpbXBvcnQgQ2FsZW5kYXIgZnJvbSBcIi4vY2FsZW5kZXJcIjtcclxuaW1wb3J0IE1vZGFsIGZyb20gXCIuL21vZGFsXCI7XHJcbmFzeW5jIGZ1bmN0aW9uIG1haW4oKSA6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHRhcmdldEVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5kYXNoYm9hcmQtY29udGFpbmVyXCIpO1xuICAgIGlmICghdGFyZ2V0RWwgfHwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJwbGF0by1jYWxlbmRhclwiKSkgcmV0dXJuO1xuXHJcbiAgICBjb25zdCBkZXRhaWxzRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGV0YWlsc1wiKTtcclxuICAgIGNvbnN0IHN1bW1hcnlFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdW1tYXJ5XCIpO1xyXG4gICAgc3VtbWFyeUVsLnRleHRDb250ZW50ID0gXCJQbGF0byBDYWxlbmRhcjNcIjtcclxuICAgIGRldGFpbHNFbC5zZXRBdHRyaWJ1dGUoXCJpZFwiLCBcInBsYXRvLWNhbGVuZGFyXCIpO1xuICAgIGRldGFpbHNFbC5hcHBlbmRDaGlsZChzdW1tYXJ5RWwpO1xuICAgIHRhcmdldEVsLnByZXBlbmQoZGV0YWlsc0VsKTtcbiAgICBkZXRhaWxzRWwuYXBwZW5kQ2hpbGQoYXdhaXQgTW9kYWwuZ2V0VmlldygpKTtcclxuICAgIGRldGFpbHNFbC5hcHBlbmRDaGlsZChhd2FpdCBDYWxlbmRhci5nZXRWaWV3KCkpO1xyXG59XHJcblxyXG5tYWluKCkuY2F0Y2goZXJyb3IgPT4ge1xuICAgIGNvbnN0IHRhcmdldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwicGxhdG8tY2FsZW5kYXJcIik7XG4gICAgaWYgKHRhcmdldCkge1xuICAgICAgICBjb25zdCBzdGF0dXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwicFwiKTtcbiAgICAgICAgc3RhdHVzLnNldEF0dHJpYnV0ZShcInJvbGVcIiwgXCJzdGF0dXNcIik7XG4gICAgICAgIHN0YXR1cy50ZXh0Q29udGVudCA9IGBcdUNFOThcdUI5QjBcdUIzNTRcdUI5N0MgXHVCRDg4XHVCN0VDXHVDNjJDIFx1QzIxOCBcdUM1QzZcdUMyQjVcdUIyQzhcdUIyRTQ6ICR7ZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIlx1QzU0QyBcdUMyMTggXHVDNUM2XHVCMjk0IFx1QzYyNFx1Qjk1OFwifWA7XG4gICAgICAgIGNvbnN0IGRldGFpbHMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGV0YWlsc1wiKTtcbiAgICAgICAgZGV0YWlscy5pZCA9IFwidXBkYXRlLWRldGFpbHNcIjtcbiAgICAgICAgY29uc3Qgc3VtbWFyeSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdW1tYXJ5XCIpO1xuICAgICAgICBzdW1tYXJ5LnRleHRDb250ZW50ID0gXCJcdUFDMzFcdUMyRTAgXHVDNTQ4XHVCMEI0XCI7XG4gICAgICAgIGRldGFpbHMuYXBwZW5kKHN1bW1hcnksIHN0YXR1cyk7XG4gICAgICAgIHRhcmdldC5hcHBlbmRDaGlsZChkZXRhaWxzKTtcbiAgICB9XG59KTtcblxyXG5cclxuIl0sCiAgIm1hcHBpbmdzIjogIjs7O0FBR0EsaUJBQXNCLGVBQXVDO0FBQ3pELFVBQU0sV0FBVyxNQUFNLE9BQU8sUUFBUSxZQUFZLEVBQUUsUUFBUSxnQkFBZ0IsQ0FBQztBQUM3RSxRQUFJLENBQUMsVUFBVSxPQUFRLE9BQU0sSUFBSSxNQUFNLDJGQUFxQjtBQUM1RCxXQUFPLFNBQVM7QUFBQSxFQUNwQjtBQUVBLE1BQU0sa0JBQWtCO0FBRXhCLGlCQUFzQixrQkFBeUM7QUFDM0QsVUFBTSxNQUFvQixNQUFNLE9BQU8sUUFBUSxZQUFZO0FBQUEsTUFDdkQsUUFBUTtBQUFBLElBQ1osQ0FBQztBQUVELFFBQUksT0FBTyxLQUFLLFdBQVcsYUFBYSxDQUFDLE1BQU0sUUFB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
