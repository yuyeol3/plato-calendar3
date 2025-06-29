// singleton
export default class Calendar {
    private static calender : Calendar;
    private date : Date;
    private dateCells : HTMLTableCellElement[];
    private monthLabel : HTMLSpanElement;
    private prevBtn : HTMLButtonElement;
    private nextBtn : HTMLButtonElement;

    private constructor(calendarDiv : HTMLDivElement) {
        this.date = new Date();
        this.date.setDate(1);  // 1일로 맞춰주기

        this.dateCells = Array.from(calendarDiv.querySelectorAll("tbody td"));
        this.monthLabel = calendarDiv.querySelector("#month-label") as HTMLSpanElement;
        this.prevBtn = calendarDiv.querySelector("#prev-btn") as HTMLButtonElement;
        this.nextBtn = calendarDiv.querySelector("#next-btn") as HTMLButtonElement;
        this.updateMonthLabel();

        this.prevBtn.onclick = ()=> {
            this.toPrevMonth();
            this.render();
        }

        this.nextBtn.onclick = ()=> {
            this.toNextMonth();
            this.render();
        }

    }

    private render() : void {
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

    private toPrevMonth() : void {
        this.date.setMonth(this.date.getMonth() - 1);
        this.date.setDate(1);  // 1일로 맞춰주기
        this.updateMonthLabel();

    }

    private toNextMonth() : void {
        this.date.setMonth(this.date.getMonth() + 1);
        this.date.setDate(1);  // 1일로 맞춰주기
        this.updateMonthLabel();
    }

    private clearCells() : void {
        for (const cell of this.dateCells) {
            cell.textContent = "";
        }
    }

    private updateMonthLabel() {
        this.monthLabel.textContent = `${this.date.getFullYear()}년 ${this.date.getMonth() + 1}월`;
    }

    public static getView() : HTMLDivElement {
        const calendarEl = document.createElement("div");

        calendarEl.innerHTML = (`
            <div id="info">
                <button id="prev-btn">prev</button>
                <span id="month-label"></span>
                <button id="next-btn">next</button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>일</th>
                        <th>월</th>
                        <th>화</th>
                        <th>수</th>
                        <th>목</th>
                        <th>금</th>
                        <th>토</th>
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
        `);
        this.calender = new Calendar(calendarEl);
        this.calender.render();
        return calendarEl;
    }
};
