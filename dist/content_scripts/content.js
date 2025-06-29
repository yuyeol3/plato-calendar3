"use strict";
(() => {
  // src/content_scripts/calender.ts
  var Calendar = class _Calendar {
    constructor(calendarDiv) {
      this.date = /* @__PURE__ */ new Date();
      this.date.setDate(1);
      this.dateCells = Array.from(calendarDiv.querySelectorAll("tbody td"));
      this.monthLabel = calendarDiv.querySelector("#month-label");
      this.prevBtn = calendarDiv.querySelector("#prev-btn");
      this.nextBtn = calendarDiv.querySelector("#next-btn");
      this.updateMonthLabel();
      this.prevBtn.onclick = () => {
        this.toPrevMonth();
        this.render();
      };
      this.nextBtn.onclick = () => {
        this.toNextMonth();
        this.render();
      };
    }
    render() {
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
    static getView() {
      const calendarEl = document.createElement("div");
      calendarEl.innerHTML = `
            <div id="info">
                <button id="prev-btn">prev</button>
                <span id="month-label"></span>
                <button id="next-btn">next</button>
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
    detailsEl.appendChild(Calendar.getView());
    detailsEl.setAttribute("id", "plato-calendar");
    targetEl?.prepend(detailsEl);
    const res = await chrome.runtime.sendMessage({
      action: "updateData"
    });
    console.log(res);
  }
  main();
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL2NvbnRlbnRfc2NyaXB0cy9jYWxlbmRlci50cyIsICIuLi8uLi9zcmMvY29udGVudF9zY3JpcHRzL2NvbnRlbnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8vIHNpbmdsZXRvblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDYWxlbmRhciB7XHJcbiAgICBwcml2YXRlIHN0YXRpYyBjYWxlbmRlciA6IENhbGVuZGFyO1xyXG4gICAgcHJpdmF0ZSBkYXRlIDogRGF0ZTtcclxuICAgIHByaXZhdGUgZGF0ZUNlbGxzIDogSFRNTFRhYmxlQ2VsbEVsZW1lbnRbXTtcclxuICAgIHByaXZhdGUgbW9udGhMYWJlbCA6IEhUTUxTcGFuRWxlbWVudDtcclxuICAgIHByaXZhdGUgcHJldkJ0biA6IEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgcHJpdmF0ZSBuZXh0QnRuIDogSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcblxyXG4gICAgcHJpdmF0ZSBjb25zdHJ1Y3RvcihjYWxlbmRhckRpdiA6IEhUTUxEaXZFbGVtZW50KSB7XHJcbiAgICAgICAgdGhpcy5kYXRlID0gbmV3IERhdGUoKTtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0RGF0ZSgxKTsgIC8vIDFcdUM3N0NcdUI4NUMgXHVCOURFXHVDREIwXHVDOEZDXHVBRTMwXHJcblxyXG4gICAgICAgIHRoaXMuZGF0ZUNlbGxzID0gQXJyYXkuZnJvbShjYWxlbmRhckRpdi5xdWVyeVNlbGVjdG9yQWxsKFwidGJvZHkgdGRcIikpO1xyXG4gICAgICAgIHRoaXMubW9udGhMYWJlbCA9IGNhbGVuZGFyRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjbW9udGgtbGFiZWxcIikgYXMgSFRNTFNwYW5FbGVtZW50O1xyXG4gICAgICAgIHRoaXMucHJldkJ0biA9IGNhbGVuZGFyRGl2LnF1ZXJ5U2VsZWN0b3IoXCIjcHJldi1idG5cIikgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICAgICAgdGhpcy5uZXh0QnRuID0gY2FsZW5kYXJEaXYucXVlcnlTZWxlY3RvcihcIiNuZXh0LWJ0blwiKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgICAgICB0aGlzLnVwZGF0ZU1vbnRoTGFiZWwoKTtcclxuXHJcbiAgICAgICAgdGhpcy5wcmV2QnRuLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy50b1ByZXZNb250aCgpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbmRlcigpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5uZXh0QnRuLm9uY2xpY2sgPSAoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy50b05leHRNb250aCgpO1xyXG4gICAgICAgICAgICB0aGlzLnJlbmRlcigpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSByZW5kZXIoKSA6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuY2xlYXJDZWxscygpO1xyXG4gICAgICAgIGNvbnN0IGQgPSBuZXcgRGF0ZSh0aGlzLmRhdGUpO1xyXG4gICAgICAgIGNvbnN0IG1vbnRoID0gZC5nZXRNb250aCgpO1xyXG4gICAgICAgIGNvbnN0IGRheSA9IGQuZ2V0RGF5KCk7XHJcbiAgICAgICAgd2hpbGUgKGQuZ2V0TW9udGgoKSA9PSBtb250aCkge1xyXG4gICAgICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmRhdGVDZWxsc1tkLmdldERhdGUoKSAtIDEgKyBkYXldO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgZGF0ZUxhYmVsRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgICAgICAgICAgY29uc3QgaW5mb0RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcblxyXG4gICAgICAgICAgICBkYXRlTGFiZWxEaXYuY2xhc3NMaXN0LmFkZChcImRhdGUtbGFiZWwtZGl2XCIpO1xyXG4gICAgICAgICAgICBpbmZvRGl2LmNsYXNzTGlzdC5hZGQoXCJpbmZvLWRpdlwiKTtcclxuXHJcbiAgICAgICAgICAgIGRhdGVMYWJlbERpdi50ZXh0Q29udGVudCA9IGQuZ2V0RGF0ZSgpLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgICAgIHRhcmdldC5hcHBlbmRDaGlsZChkYXRlTGFiZWxEaXYpO1xyXG4gICAgICAgICAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoaW5mb0Rpdik7XHJcbiAgICAgICAgICAgIGQuc2V0RGF0ZShkLmdldERhdGUoKSArIDEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHRvUHJldk1vbnRoKCkgOiB2b2lkIHtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0TW9udGgodGhpcy5kYXRlLmdldE1vbnRoKCkgLSAxKTtcclxuICAgICAgICB0aGlzLmRhdGUuc2V0RGF0ZSgxKTsgIC8vIDFcdUM3N0NcdUI4NUMgXHVCOURFXHVDREIwXHVDOEZDXHVBRTMwXHJcbiAgICAgICAgdGhpcy51cGRhdGVNb250aExhYmVsKCk7XHJcblxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdG9OZXh0TW9udGgoKSA6IHZvaWQge1xyXG4gICAgICAgIHRoaXMuZGF0ZS5zZXRNb250aCh0aGlzLmRhdGUuZ2V0TW9udGgoKSArIDEpO1xyXG4gICAgICAgIHRoaXMuZGF0ZS5zZXREYXRlKDEpOyAgLy8gMVx1Qzc3Q1x1Qjg1QyBcdUI5REVcdUNEQjBcdUM4RkNcdUFFMzBcclxuICAgICAgICB0aGlzLnVwZGF0ZU1vbnRoTGFiZWwoKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGNsZWFyQ2VsbHMoKSA6IHZvaWQge1xyXG4gICAgICAgIGZvciAoY29uc3QgY2VsbCBvZiB0aGlzLmRhdGVDZWxscykge1xyXG4gICAgICAgICAgICBjZWxsLnRleHRDb250ZW50ID0gXCJcIjtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB1cGRhdGVNb250aExhYmVsKCkge1xyXG4gICAgICAgIHRoaXMubW9udGhMYWJlbC50ZXh0Q29udGVudCA9IGAke3RoaXMuZGF0ZS5nZXRGdWxsWWVhcigpfVx1QjE0NCAke3RoaXMuZGF0ZS5nZXRNb250aCgpICsgMX1cdUM2RDRgO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBzdGF0aWMgZ2V0VmlldygpIDogSFRNTERpdkVsZW1lbnQge1xyXG4gICAgICAgIGNvbnN0IGNhbGVuZGFyRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG5cclxuICAgICAgICBjYWxlbmRhckVsLmlubmVySFRNTCA9IChgXHJcbiAgICAgICAgICAgIDxkaXYgaWQ9XCJpbmZvXCI+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIGlkPVwicHJldi1idG5cIj5wcmV2PC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8c3BhbiBpZD1cIm1vbnRoLWxhYmVsXCI+PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBpZD1cIm5leHQtYnRuXCI+bmV4dDwvYnV0dG9uPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPHRhYmxlPlxyXG4gICAgICAgICAgICAgICAgPHRoZWFkPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1Qzc3QzwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUM2RDQ8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVENjU0PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1QzIxODwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0aD5cdUJBQTk8L3RoPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGg+XHVBRTA4PC90aD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRoPlx1RDFBMDwvdGg+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICA8L3RoZWFkPlxyXG4gICAgICAgICAgICAgICAgPHRib2R5PlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgICAgIDx0cj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgPC90cj5cclxuICAgICAgICAgICAgICAgICAgICA8dHI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdHI+XHJcbiAgICAgICAgICAgICAgICAgICAgPHRyPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHRkPjwvdGQ+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDx0ZD48L3RkPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8dGQ+PC90ZD5cclxuICAgICAgICAgICAgICAgICAgICA8L3RyPlxyXG4gICAgICAgICAgICAgICAgPC90Ym9keT5cclxuICAgICAgICAgICAgPC90YWJsZT5cclxuICAgICAgICBgKTtcclxuICAgICAgICB0aGlzLmNhbGVuZGVyID0gbmV3IENhbGVuZGFyKGNhbGVuZGFyRWwpO1xyXG4gICAgICAgIHRoaXMuY2FsZW5kZXIucmVuZGVyKCk7XHJcbiAgICAgICAgcmV0dXJuIGNhbGVuZGFyRWw7XHJcbiAgICB9XHJcbn07XHJcbiIsICJpbXBvcnQgQ2FsZW5kYXIgZnJvbSBcIi4vY2FsZW5kZXJcIjtcclxuaW1wb3J0IHsgc3ViamVjdCB9IGZyb20gXCIuLi9iYWNrZ3JvdW5kL3VwZGF0ZVNjaGVkdWxlXCI7XHJcbi8vIGltcG9ydCB7Y2FsZW5kYXJDc3N9IGZyb20gXCIuL2NvbnN0c1wiO1xyXG5cclxuaW50ZXJmYWNlIHVwZGF0ZURhdGEge1xyXG4gICAgcmVzdWx0IDogc3ViamVjdFtdO1xyXG59O1xyXG5cclxuYXN5bmMgZnVuY3Rpb24gbWFpbigpIDogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCB0YXJnZXRFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIuZnJvbnQtYm94LmZyb250LWJveC1jb3Vyc2VcIik7XHJcbiAgICBpZiAoIXRhcmdldEVsKSByZXR1cm47XHJcblxyXG4gICAgLy8gY29uc3Qgc3R5bGVFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzdHlsZVwiKTtcclxuICAgIGNvbnN0IGRldGFpbHNFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkZXRhaWxzXCIpO1xyXG4gICAgY29uc3Qgc3VtbWFyeUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN1bW1hcnlcIik7XHJcbiAgICBzdW1tYXJ5RWwudGV4dENvbnRlbnQgPSBcIlBsYXRvIENhbGVuZGFyM1wiO1xyXG4gICAgLy8gc3R5bGVFbC5pbm5lckhUTUwgPSBjYWxlbmRhckNzcztcclxuICAgIFxyXG4gICAgZGV0YWlsc0VsLmFwcGVuZENoaWxkKHN1bW1hcnlFbCk7XHJcbiAgICBkZXRhaWxzRWwuYXBwZW5kQ2hpbGQoQ2FsZW5kYXIuZ2V0VmlldygpKTtcclxuICAgIGRldGFpbHNFbC5zZXRBdHRyaWJ1dGUoXCJpZFwiLCBcInBsYXRvLWNhbGVuZGFyXCIpO1xyXG4gICAgXHJcbiAgICAvLyB0YXJnZXRFbD8ucHJlcGVuZChzdHlsZUVsKTtcclxuICAgIHRhcmdldEVsPy5wcmVwZW5kKGRldGFpbHNFbCk7XHJcblxyXG4gICAgY29uc3QgcmVzIDogdXBkYXRlRGF0YSB8IHVuZGVmaW5lZCA9IGF3YWl0IGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHtcclxuICAgICAgICBhY3Rpb246IFwidXBkYXRlRGF0YVwiXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zb2xlLmxvZyhyZXMpO1xyXG5cclxufVxyXG5cclxubWFpbigpO1xyXG5cclxuXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7OztBQUNBLE1BQXFCLFdBQXJCLE1BQXFCLFVBQVM7QUFBQSxJQVFsQixZQUFZLGFBQThCO0FBQzlDLFdBQUssT0FBTyxvQkFBSSxLQUFLO0FBQ3JCLFdBQUssS0FBSyxRQUFRLENBQUM7QUFFbkIsV0FBSyxZQUFZLE1BQU0sS0FBSyxZQUFZLGlCQUFpQixVQUFVLENBQUM7QUFDcEUsV0FBSyxhQUFhLFlBQVksY0FBYyxjQUFjO0FBQzFELFdBQUssVUFBVSxZQUFZLGNBQWMsV0FBVztBQUNwRCxXQUFLLFVBQVUsWUFBWSxjQUFjLFdBQVc7QUFDcEQsV0FBSyxpQkFBaUI7QUFFdEIsV0FBSyxRQUFRLFVBQVUsTUFBSztBQUN4QixhQUFLLFlBQVk7QUFDakIsYUFBSyxPQUFPO0FB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
