"use strict";
(() => {
  // src/content_scripts/utils.ts
  async function getSchedules() {
    console.log("\uC11C\uBE44\uC2A4 \uC6CC\uCEE4\uC5D0\uAC8C \uC2A4\uCF00\uC904 \uB370\uC774\uD130 \uB85C\uB4DC\uB97C \uC694\uCCAD\uD569\uB2C8\uB2E4...");
    const response = await chrome.runtime.sendMessage({ action: "loadSchedules" });
    console.log("\uC11C\uBE44\uC2A4 \uC6CC\uCEE4\uB85C\uBD80\uD130 \uBC1B\uC740 \uC2A4\uCF00\uC904:", response);
    return response.result;
  }
  async function updateSchedules() {
    const res = await chrome.runtime.sendMessage({
      action: "updateData"
    });
    console.log(res);
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
    static async update() {
      const schedules = await getSchedules();
      const currentCourses = await getCurrentCourses();
      for (const course of currentCourses) {
        const courseSchedules = Object.values(schedules[course.id]);
        for (const s of courseSchedules) {
          this.getInstance().set(
            new Date(s.due.toString()).toDateString(),
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

  // src/content_scripts/calender.ts
  var Calendar = class _Calendar {
    constructor(calendarDiv) {
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
        await updateSchedules();
        await CalendarStorageManager.update();
        await this.render();
      };
    }
    async render() {
      this.clearCells();
      const d = new Date(this.date);
      const month = d.getMonth();
      const day = d.getDay();
      while (d.getMonth() == month) {
        const target = this.dateCells[d.getDate() - 1 + day];
        const dateLabelDiv = document.createElement("div");
        const infoDiv = document.createElement("div");
        dateLabelDiv.classList.add("date-label-div");
        infoDiv.classList.add("info-div");
        dateLabelDiv.textContent = d.getDate().toString();
        const targetSchedules = CalendarStorageManager.getInstance().get(d.toDateString());
        for (const schedule of targetSchedules) {
          const divEl = document.createElement("div");
          divEl.textContent = schedule.name;
          divEl.style.width = "90%";
          infoDiv.appendChild(divEl);
        }
        target.appendChild(dateLabelDiv);
        target.appendChild(infoDiv);
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
    // private async getSchedules() {
    //     this.schedules = await getSchedules();
    //     const currentCourses = await getCurrentCourses();
    // }
    static async getView() {
      const calendarEl = document.createElement("div");
      calendarEl.innerHTML = `
            <div id="info">
                <button id="prev-btn">prev</button>
                <span id="month-label"></span>
                <button id="next-btn">next</button>
            </div>
            <button id="update-btn">\uC5C5\uB370\uC774\uD2B8</button>
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
    detailsEl.appendChild(await Calendar.getView());
    detailsEl.setAttribute("id", "plato-calendar");
    targetEl?.prepend(detailsEl);
  }
  main();
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy91dGlscy50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL0NhbGVuZGFyU3RvcmFnZU1hbmFnZXIudHMiLCAiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy9jYWxlbmRlci50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL2NvbnRlbnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IEFsbFNjaGVkdWxlcyB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3NjaGVkdWxlU3RvcmFnZU1hbmFnZXJcIjtcclxuaW1wb3J0IHsgU3ViamVjdCB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0U2NoZWR1bGVzKCkgOiBQcm9taXNlPEFsbFNjaGVkdWxlcz4ge1xyXG4gICAgY29uc29sZS5sb2coXCJcdUMxMUNcdUJFNDRcdUMyQTQgXHVDNkNDXHVDRUU0XHVDNUQwXHVBQzhDIFx1QzJBNFx1Q0YwMFx1QzkwNCBcdUIzNzBcdUM3NzRcdUQxMzAgXHVCODVDXHVCNERDXHVCOTdDIFx1QzY5NFx1Q0NBRFx1RDU2OVx1QjJDOFx1QjJFNC4uLlwiKTtcclxuXHJcbiAgICAvLyAxLiAnbG9hZFNjaGVkdWxlcydcdUI3N0NcdUIyOTQgYWN0aW9uXHVDNzQ0IFx1QjJGNFx1QzU0NCBcdUJBNTRcdUMyRENcdUM5QzAgXHVDODA0XHVDMUExXHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHsgYWN0aW9uOiBcImxvYWRTY2hlZHVsZXNcIiB9KTtcclxuXHJcbiAgICAvLyA0LiBcdUMxMUNcdUJFNDRcdUMyQTQgXHVDNkNDXHVDRUU0XHVCODVDXHVCRDgwXHVEMTMwIFx1QkMxQlx1Qzc0MCBcdUFDQjBcdUFDRkNcclxuICAgIGNvbnNvbGUubG9nKFwiXHVDMTFDXHVCRTQ0XHVDMkE0IFx1QzZDQ1x1Q0VFNFx1Qjg1Q1x1QkQ4MFx1RDEzMCBcdUJDMUJcdUM3NDAgXHVDMkE0XHVDRjAwXHVDOTA0OlwiLCByZXNwb25zZSk7XHJcbiAgICBcclxuICAgIC8vIFx1Qzc3NCBcdUIzNzBcdUM3NzRcdUQxMzBcdUI5N0MgXHVDMEFDXHVDNkE5XHVENTU4XHVDNUVDIFx1RDM5OFx1Qzc3NFx1QzlDMFx1Qzc1OCBET01cdUM3NDQgXHVDODcwXHVDNzkxXHVENTYwIFx1QzIxOCBcdUM3ODhcdUMyQjVcdUIyQzhcdUIyRTQuXHJcbiAgICByZXR1cm4gcmVzcG9uc2UucmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlU2NoZWR1bGVzKCkge1xyXG4gICAgY29uc3QgcmVzID0gYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xyXG4gICAgICAgIGFjdGlvbjogXCJ1cGRhdGVEYXRhXCJcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnNvbGUubG9nKHJlcyk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRDdXJyZW50Q291cnNlcygpIDogUHJvbWlzZTxTdWJqZWN0W10+IHtcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyBhY3Rpb246IFwibG9hZEN1ckNvdXJzZXNcIiB9KTsgICAgXHJcbiAgICByZXR1cm4gcmVzcG9uc2UucmVzdWx0O1xyXG59IiwgImltcG9ydCB7IFNjaGVkdWxlIH0gZnJvbSBcIi4uL2JhY2tncm91bmQvdXBkYXRlU2NoZWR1bGVcIjtcclxuaW1wb3J0IHsgZ2V0Q3VycmVudENvdXJzZXMsIGdldFNjaGVkdWxlcyB9IGZyb20gXCIuL3V0aWxzXCI7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIENhbGVuZGFyU3RvcmFnZSB7XHJcbiAgICBbZGF0ZTogc3RyaW5nXToge1xyXG4gICAgICAgIFtzY2hlZHVsZUlkOiBzdHJpbmddOiBTY2hlZHVsZTtcclxuICAgIH07XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENhbGVuZGFyU3RvcmFnZU1hbmFnZXIge1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgaW5zdGFuY2UgOiBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyO1xyXG4gICAgcHJpdmF0ZSBLRVlfTkFNRSA6IHN0cmluZztcclxuICAgIHByaXZhdGUgZGF0YSA6IENhbGVuZGFyU3RvcmFnZTtcclxuICAgIHByaXZhdGUgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy5LRVlfTkFNRSA9IFwicGxhdG8tY2FsZW5kYXIzXCI7XHJcbiAgICAgICAgY29uc3Qgc3RvcmFnZVN0ciA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKHRoaXMuS0VZX05BTUUpO1xyXG4gICAgICAgIHRoaXMuZGF0YSA9IHN0b3JhZ2VTdHIgPyBKU09OLnBhcnNlKHN0b3JhZ2VTdHIpIDoge307XHJcbiAgICB9XHJcblxyXG4gICAgLy8gXHVDRDk0XHVBQzAwXHJcbiAgICBzZXQoZGF0ZSA6IHN0cmluZywgaWQgOiBzdHJpbmcsIGRhdGEgOiBTY2hlZHVsZSkge1xyXG4gICAgICAgIGlmICghdGhpcy5kYXRhW2RhdGVdKSB0aGlzLmRhdGFbZGF0ZV0gPSB7fTtcclxuICAgICAgICBpZiAoIXRoaXMuZGF0YVtkYXRlXT8uW2lkXSkgdGhpcy5kYXRhW2RhdGVdW2lkXSA9IGRhdGE7XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nU2NoZWR1bGUgPSB0aGlzLmRhdGFbZGF0ZV1baWRdO1xyXG5cclxuICAgICAgICAgICAgZXhpc3RpbmdTY2hlZHVsZS5uYW1lID0gZGF0YS5uYW1lO1xyXG4gICAgICAgICAgICBleGlzdGluZ1NjaGVkdWxlLmNvbXBsZXRlZCA9IGRhdGEuY29tcGxldGVkO1xyXG4gICAgICAgICAgICBleGlzdGluZ1NjaGVkdWxlLmR1ZSA9IGRhdGEuZHVlO1xyXG4gICAgICAgICAgICBleGlzdGluZ1NjaGVkdWxlLm9ycGhhbmVkID0gZGF0YS5vcnBoYW5lZDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMuS0VZX05BTUUsIEpTT04uc3RyaW5naWZ5KHRoaXMuZGF0YSkpO1xyXG4gICAgfSAgIFxyXG5cclxuICAgIC8vIFx1Qzg3MFx1RDY4Q1xyXG4gICAgZ2V0KGRhdGUgOiBzdHJpbmcpIHtcclxuICAgICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLmRhdGFbZGF0ZV0gPz8ge30pO1xyXG4gICAgfVxyXG4gICAgLy8gXHVDMEFEXHVDODFDXHJcbiAgICByZW1vdmUoZGF0ZSA6IHN0cmluZykge1xyXG4gICAgICAgIGRlbGV0ZSB0aGlzLmRhdGFbZGF0ZV07XHJcbiAgICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0odGhpcy5LRVlfTkFNRSwgSlNPTi5zdHJpbmdpZnkodGhpcy5kYXRhKSk7XHJcbiAgICB9XHJcbiBcclxuICAgIHN0YXRpYyBhc3luYyB1cGRhdGUoKSB7XHJcbiAgICAgICAgY29uc3Qgc2NoZWR1bGVzID0gYXdhaXQgZ2V0U2NoZWR1bGVzKCk7XHJcbiAgICAgICAgY29uc3QgY3VycmVudENvdXJzZXMgPSBhd2FpdCBnZXRDdXJyZW50Q291cnNlcygpO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IGNvdXJzZSBvZiBjdXJyZW50Q291cnNlcykge1xyXG4gICAgICAgICAgICBjb25zdCBjb3Vyc2VTY2hlZHVsZXMgPSBPYmplY3QudmFsdWVzKHNjaGVkdWxlc1tjb3Vyc2UuaWRdKTtcclxuXHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgcyBvZiBjb3Vyc2VTY2hlZHVsZXMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZ2V0SW5zdGFuY2UoKS5zZXQoXHJcbiAgICAgICAgICAgICAgICAgICAgbmV3IERhdGUocy5kdWUudG9TdHJpbmcoKSkudG9EYXRlU3RyaW5nKCksIHMuaWQsIHNcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGdldEluc3RhbmNlKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmluc3RhbmNlID09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhpcy5pbnN0YW5jZSA9IG5ldyBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy5pbnN0YW5jZTtcclxuICAgIH1cclxufSIsICJpbXBvcnQgeyBBbGxTY2hlZHVsZXMgfSBmcm9tIFwiLi4vYmFja2dyb3VuZC9zY2hlZHVsZVN0b3JhZ2VNYW5hZ2VyXCI7XHJcbmltcG9ydCBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyIGZyb20gXCIuL0NhbGVuZGFyU3RvcmFnZU1hbmFnZXJcIjtcclxuaW1wb3J0IHsgZ2V0Q3VycmVudENvdXJzZXMsIGdldFNjaGVkdWxlcywgdXBkYXRlU2NoZWR1bGVzIH0gZnJvbSBcIi4vdXRpbHNcIjtcclxuXHJcblxyXG4vLyBzaW5nbGV0b25cclxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ2FsZW5kYXIge1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgY2FsZW5kZXIgOiBDYWxlbmRhcjtcclxuICAgIHByaXZhdGUgZGF0ZSA6IERhdGU7XHJcbiAgICBwcml2YXRlIGRhdGVDZWxscyA6IEhUTUxUYWJsZUNlbGxFbGVtZW50W107XHJcbiAgICBwcml2YXRlIG1vbnRoTGFiZWwgOiBIVE1MU3BhbkVsZW1lbnQ7XHJcbiAgICAvLyBcdUFENzNcdUM3NzQgXHVBQzAwXHVDOUMwXHVBQ0UwXHVDNzg4XHVDNzQ0IFx1RDU0NFx1QzY5NCBcdUM1QzZcdUM3NDRcdUMyMThcdUIzQzRcclxuICAgIC8vIHByaXZhdGUgcHJldkJ0biA6IEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgLy8gcHJpdmF0ZSBuZXh0QnRuIDogSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcblxyXG4gICAgcHJpdmF0ZSBzY2hlZHVsZXMgOiBBbGxTY2hlZHVsZXMgPSB7fTtcclxuXHJcbiAgICBwcml2YXRlIGNvbnN0cnVjdG9yKGNhbGVuZGFyRGl2IDogSFRNTERpdkVsZW1lbnQpIHtcclxuICAgICAgICB0aGlzLmRhdGUgPSBuZXcgRGF0ZSgpO1xyXG4gICAgICAgIHRoaXMuZGF0ZS5zZXREYXRlKDEpOyAgLy8gMVx1Qzc3Q1x1Qjg1QyBcdUI5REVcdUNEQjBcdUM4RkNcdUFFMzBcclxuXHJcbiAgICAgICAgdGhpcy5kYXRlQ2VsbHMgPSBBcnJheS5mcm9tKGNhbGVuZGFyRGl2LnF1ZXJ5U2VsZWN0b3JBbGwoXCJ0Ym9keSB0ZFwiKSk7XHJcbiAgICAgICAgdGhpcy5tb250aExhYmVsID0gY2FsZW5kYXJEaXYucXVlcnlTZWxlY3RvcihcIiNtb250aC1sYWJlbFwiKSBhcyBIVE1MU3BhbkVsZW1lbnQ7XHJcbiAgICAgICAgY29uc3QgcHJldkJ0biA9IGNhbGVuZGFyRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjcHJldi1idG5cIikgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICAgICAgY29uc3QgbmV4dEJ0biA9IGNhbGVuZGFyRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjbmV4dC1idG5cIikgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICAgICAgY29uc3QgdXBkYXRlQnRuID0gY2FsZW5kYXJEaXYucXVlcnlTZWxlY3RvcihcIiN1cGRhdGUtYnRuXCIpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG5cclxuICAgICAgICB0aGlzLnVwZGF0ZU1vbnRoTGFiZWwoKTtcclxuXHJcbiAgICAgICAgcHJldkJ0bi5vbmNsaWNrID0gKCk9PiB7XHJcbiAgICAgICAgICAgIHRoaXMudG9QcmV2TW9udGgoKTtcclxuICAgICAgICAgICAgdGhpcy5yZW5kZXIoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG5leHRCdG4ub25jbGljayA9ICgpPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnRvTmV4dE1vbnRoKCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB1cGRhdGVCdG4ub25jbGljayA9IGFzeW5jICgpPT57XHJcbiAgICAgICAgICAgIGF3YWl0IHVwZGF0ZVNjaGVkdWxlcygpO1xyXG4gICAgICAgICAgICBhd2FpdCBDYWxlbmRhclN0b3JhZ2VNYW5hZ2VyLnVwZGF0ZSgpO1xyXG4gICAgICAgICAgICBhd2FpdCB0aGlzLnJlbmRlcigpO1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyByZW5kZXIoKSB7XHJcbiAgICAgICAgdGhpcy5jbGVhckNlbGxzKCk7XHJcbiAgICAgICAgY29uc3QgZCA9IG5ldyBEYXRlKHRoaXMuZGF0ZSk7XHJcbiAgICAgICAgY29uc3QgbW9udGggPSBkLmdldE1vbnRoKCk7XHJcbiAgICAgICAgY29uc3QgZGF5ID0gZC5nZXREYXkoKTtcclxuXHJcbiAgICAgICAgLy8gYXdhaXQgdGhpcy5nZXRTY2hlZHVsZXMoKTtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyh0aGlzLnNjaGVkdWxlcyk7XHJcblxyXG4gICAgICAgIHdoaWxlIChkLmdldE1vbnRoKCkgPT0gbW9udGgpIHtcclxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5kYXRlQ2VsbHNbZC5nZXREYXRlKCkgLSAxICsgZGF5XTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGRhdGVMYWJlbERpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgICAgIGNvbnN0IGluZm9EaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cclxuICAgICAgICAgICAgZGF0ZUxhYmVsRGl2LmNsYXNzTGlzdC5hZGQoXCJkYXRlLWxhYmVsLWRpdlwiKTtcclxuICAgICAgICAgICAgaW5mb0Rpdi5jbGFzc0xpc3QuYWRkKFwiaW5mby1kaXZcIik7XHJcblxyXG4gICAgICAgICAgICBkYXRlTGFiZWxEaXYudGV4dENvbnRlbnQgPSBkLmdldERhdGUoKS50b1N0cmluZygpO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0U2NoZWR1bGVzID0gQ2FsZW5kYXJTdG9yYWdlTWFuYWdlci5nZXRJbnN0YW5jZSgpLmdldChkLnRvRGF0ZVN0cmluZygpKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGZvciAoY29uc3Qgc2NoZWR1bGUgb2YgdGFyZ2V0U2NoZWR1bGVzKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBkaXZFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgICAgICAgICBkaXZFbC50ZXh0Q29udGVudCA9IHNjaGVkdWxlLm5hbWU7XHJcbiAgICAgICAgICAgICAgICBkaXZFbC5zdHlsZS53aWR0aCA9IFwiOTAlXCI7XHJcbiAgICAgICAgICAgICAgICBpbmZvRGl2LmFwcGVuZENoaWxkKGRpdkVsKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGFyZ2V0LmFwcGVuZENoaWxkKGRhdGVMYWJlbERpdik7XHJcbiAgICAgICAgICAgIHRhcmdldC5hcHBlbmRDaGlsZChpbmZvRGl2KTtcclxuICAgICAgICAgICAgZC5zZXREYXRlKGQuZ2V0RGF0ZSgpICsgMSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdG9QcmV2TW9udGgoKSA6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuZGF0ZS5zZXRNb250aCh0aGlzLmRhdGUuZ2V0TW9udGgoKSAtIDEpO1xyXG4gICAgICAgIHRoaXMuZGF0ZS5zZXREYXRlKDEpOyAgLy8gMVx1Qzc3Q1x1Qjg1QyBcdUI5REVcdUNEQjBcdUM4RkNcdUFFMzBcclxuICAgICAgICB0aGlzLnVwZGF0ZU1vbnRoTGFiZWwoKTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB0b05leHRNb250aCgpIDogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldE1vbnRoKHRoaXMuZGF0ZS5nZXRNb250aCgpICsgMSk7XHJcbiAgICAgICAgdGhpcy5kYXRlLnNldERhdGUoMSk7ICAvLyAxXHVDNzdDXHVCODVDIFx1QjlERVx1Q0RCMFx1QzhGQ1x1QUUzMFxyXG4gICAgICAgIHRoaXMudXBkYXRlTW9udGhMYWJlbCgpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgY2xlYXJDZWxscygpIDogdm9pZCB7XHJcbiAgICAgICAgZm9yIChjb25zdCBjZWxsIG9mIHRoaXMuZGF0ZUNlbGxzKSB7XHJcbiAgICAgICAgICAgIGNlbGwudGV4dENvbnRlbnQgPSBcIlwiO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHVwZGF0ZU1vbnRoTGFiZWwoKSB7XHJcbiAgICAgICAgdGhpcy5tb250aExhYmVsLnRleHRDb250ZW50ID0gYCR7dGhpcy5kYXRlLmdldEZ1bGxZZWFyKCl9XHVCMTQ0ICR7dGhpcy5kYXRlLmdldE1vbnRoKCkgKyAxfVx1QzZENGA7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gcHJpdmF0ZSBhc3luYyBnZXRTY2hlZHVsZXMoKSB7XHJcbiAgICAvLyAgICAgdGhpcy5zY2hlZHVsZXMgPSBhd2FpdCBnZXRTY2hlZHVsZXMoKTtcclxuICAgIC8vICAgICBjb25zdCBjdXJyZW50Q291cnNlcyA9IGF3YWl0IGdldEN1cnJlbnRDb3Vyc2VzKCk7XHJcblxyXG4gICAgICAgIFxyXG4gICAgLy8gfVxyXG5cclxuICAgIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0VmlldygpIDogUHJvbWlzZTxIVE1MRGl2RWxlbWVudD4ge1xyXG4gICAgICAgIGNvbnN0IGNhbGVuZGFyRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cclxuICAgICAgICBjYWxlbmRhckVsLmlubmVySFRNTCA9IChgXHJcbiAgICAgICAgICAgIDxkaXYgaWQ9XCJpbmZvXCI+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwicHJldi1idG5cIj5wcmV2PC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBpZD1cIm1vbnRoLWxhYmVsXCI+PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cIm5leHQtYnRuXCI+bmV4dDwvYnV0dG9uPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPGJ1dHRvbiBpZD1cInVwZGF0ZS1idG5cIj5cdUM1QzVcdUIzNzBcdUM3NzRcdUQyQjg8L2J1dHRvbj5cclxuICAgICAgICAgICAgPHRhYmxlPlxyXG4gICAgICAgICAgICAgICAgPHRoZWFkPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1Qzc3QzwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUM2RDQ8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVENjU0PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1QzIxODwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUJBQTk8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVBRTA4PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1RDFBMDwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICA8L3RoZWFkPlxyXG4gICAgICAgICAgICAgICAgPHRib2R5PlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgPC90Ym9keT5cclxuICAgICAgICAgICAgPC90YWJsZT5cclxuICAgICAgICBgKTtcclxuXHJcbiAgICAgICAgaWYgKCF0aGlzLmNhbGVuZGVyKSBcclxuICAgICAgICAgICAgdGhpcy5jYWxlbmRlciA9IG5ldyBDYWxlbmRhcihjYWxlbmRhckVsKTtcclxuICAgICAgICAvLyB0aGlzLmNhbGVuZGVyLmdldFNjaGVkdWxlcygpO1xyXG4gICAgICAgIHRoaXMuY2FsZW5kZXIucmVuZGVyKCk7XHJcbiAgICAgICAgcmV0dXJuIGNhbGVuZGFyRWw7XHJcbiAgICB9XHJcbn07XHJcbiIsICJpbXBvcnQgQ2FsZW5kYXIgZnJvbSBcIi4vY2FsZW5kZXJcIjtcclxuaW1wb3J0IHsgU3ViamVjdCB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcbi8vIGltcG9ydCB7Y2FsZW5kYXJDc3N9IGZyb20gXCIuL2NvbnN0c1wiO1xyXG5cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIG1haW4oKSA6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgdGFyZ2V0RWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiLmZyb250LWJveC5mcm9udC1ib3gtY291cnNlXCIpO1xyXG4gICAgaWYgKCF0YXJnZXRFbCkgcmV0dXJuO1xyXG5cclxuICAgIC8vIGNvbnN0IHN0eWxlRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3R5bGVcIik7XHJcbiAgICBjb25zdCBkZXRhaWxzRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGV0YWlsc1wiKTtcclxuICAgIGNvbnN0IHN1bW1hcnlFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdW1tYXJ5XCIpO1xyXG4gICAgc3VtbWFyeUVsLnRleHRDb250ZW50ID0gXCJQbGF0byBDYWxlbmRhcjNcIjtcclxuICAgIC8vIHN0eWxlRWwuaW5uZXJIVE1MID0gY2FsZW5kYXJDc3M7XHJcbiAgICBcclxuICAgIGRldGFpbHNFbC5hcHBlbmRDaGlsZChzdW1tYXJ5RWwpO1xyXG4gICAgZGV0YWlsc0VsLmFwcGVuZENoaWxkKGF3YWl0IENhbGVuZGFyLmdldFZpZXcoKSk7XHJcbiAgICBkZXRhaWxzRWwuc2V0QXR0cmlidXRlKFwiaWRcIiwgXCJwbGF0by1jYWxlbmRhclwiKTtcclxuICAgIFxyXG4gICAgLy8gdGFyZ2V0RWw/LnByZXBlbmQoc3R5bGVFbCk7XHJcbiAgICB0YXJnZXRFbD8ucHJlcGVuZChkZXRhaWxzRWwpO1xyXG5cclxuICAgIC8vIGNvbnN0IHJlcyA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcclxuICAgIC8vICAgICBhY3Rpb246IFwibG9hZEN1ckNvdXJzZXNcIlxyXG4gICAgLy8gfSk7XHJcblxyXG4gICAgLy8gY29uc29sZS5sb2cocmVzKTtcclxufVxyXG5cclxubWFpbigpO1xyXG5cclxuXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7OztBQUdBLGlCQUFzQixlQUF1QztBQUN6RCxZQUFRLElBQUksd0lBQStCO0FBRzNDLFVBQU0sV0FBVyxNQUFNLE9BQU8sUUFBUSxZQUFZLEVBQUUsUUFBUSxnQkFBZ0IsQ0FBQztBQUc3RSxZQUFRLElBQUksc0ZBQXFCLFFBQVE7QUFHekMsV0FBTyxTQUFTO0FBQUEsRUFDcEI7QUFFQSxpQkFBc0Isa0JBQWtCO0FBQ3BDLFVBQU0sTUFBTSxNQUFNLE9BQU8sUUFBUSxZQUFZO0FBQUEsTUFDekMsUUFBUTtBQUFBLElBQ1osQ0FBQztBQUVELFlBQVEsSUFBSSxHQUFHO0FBQUEsRUFDbkI7QUFFQSxpQkFBc0Isb0JBQXlDO0FBQzNELFVBQU0sV0FBVyxNQUFNLE9BQU8sUUFBUSxZQUFZLEVBQUUsUUFBUSxpQkFBaUIsQ0FBQztBQUM5RSxXQUFPLFNBQVM7QUFBQSxFQUNwQjs7O0FDbEJBLE1BQXFCLHlCQUFyQixNQUFxQix3QkFBdUI7QUFBQSxJQUloQyxjQUFjO0FBQ2xCLFdBQUssV0FBVztBQUNoQixZQUFNLGFBQWEsYUFBYSxRQUFRLEtBQUssUUFBUTtBQUNyRCxXQUFLLE9BQU8sYUFBYSxLQUFLLE1BQU0sVUFBVSxJQUFJLENBQUM7QUFBQSxJQUN2RDtBQUFBO0FBQUEsSUFHQSxJQUFJLE1B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
