import { parse } from 'node-html-parser';
import ScheduleStorageManager from './scheduleStorageManager';

enum ScheduleType { HW, VID, ZOOM, QUIZ, PA };

export interface Schedule {
    type : ScheduleType;
    id : string;
    name : string;
    url : string;  
    course : Subject;
    completed : boolean;
    orphaned : boolean;
    due : Date | string;
};

export interface Subject {
    name : string;
    url : string;
    id : string;
}

async function fetchAndParse(url: string) {
    const res = await fetch(url);
    if (res.ok) {
        const page = await res.text();
        // console.log(page);
        const parsed = parse(page);
        return parsed;
    }
}

export async function getCoursesListTest() {
    const res = await fetch("https://plato.pusan.ac.kr/local/ubion/user/index.php?year=2024&semester=20");
    const coursePage = await res.text();
    
    const parsed = parse(coursePage);
    const courses = Array.from(parsed.querySelectorAll(".my-course-lists tr"));
    const result : Subject[] = [];
    for (const course of courses) {
        const name = course.querySelector("a")?.textContent.split(' ')[0];
        const url = course.querySelector("a")?.getAttribute("href");
        const cid = new URL(url as string).searchParams.get("id");

        result.push({name, url,  id : cid} as Subject);
    }

    chrome.storage.local.set({ currentCourses : result });

    return result;
}

export async function getCoursesList() : Promise<Subject[]> {
    const res = await fetch("https://plato.pusan.ac.kr/");
    const coursePage = await res.text();
    
    const parsed = parse(coursePage);
    const courses = Array.from(parsed.querySelectorAll(".course-box"));
    const result : Subject[] = [];
    for (const course of courses) {
        const name = course.querySelector(".course-title h3 *:not(.new, .semester-name)")
        ?.textContent
        .match(/^.+(?=\s\()/)?.[0] ?? course.querySelector(".course-title h3 *:not(.new, .semester-name)")
        ?.textContent ?? "";

        const url = course.querySelector("a")?.getAttribute("href");
        const cid = new URL(url as string).searchParams.get("id");

        result.push({name, url,  id : cid} as Subject);
    }
    chrome.storage.local.set({ currentCourses : result });
    return result;
}

async function getHomeworks(subject : Subject) {
    const parsed = await fetchAndParse(`https://plato.pusan.ac.kr/mod/assign/index.php?id=${subject.id}`);
    if (!parsed) return;
    const hwLinks = Array
                    .from(parsed.querySelectorAll("table a"))
                    .map((e)=>e.getAttribute("href"));

    const result : Schedule[] = [];
    for (const hwLink of hwLinks) {
        if (!hwLink) continue;
        const parsed = await fetchAndParse(hwLink);
        if (!parsed) continue;

        const sch = new Object() as Schedule;
        sch.course = subject;
        sch.type = ScheduleType.HW;
        sch.name = parsed.querySelector(".page-content-container h2")?.textContent ?? "";
        sch.completed = parsed.querySelector(".submissionstatussubmitted") ? true : false;
        sch.id = new URL(hwLink).searchParams.get("id") ?? "";
        sch.url = hwLink;
        sch.orphaned = false;
        sch.due = new Date(
            Array.from(parsed.querySelectorAll(".submissionsummarytable > table tr"))
            .filter((e)=>e.children[0].textContent === "종료 일시")
            .at(0)?.querySelector("td:nth-child(2)")
            ?.textContent ?? 0
        )
        result.push(sch);
    }
    return result;
}

async function getQuizes(subject:Subject) {
    const parsed = await fetchAndParse(`https://plato.pusan.ac.kr/mod/quiz/index.php?id=${subject.id}`);
    if (!parsed) return;
    const hwLinks = Array
                    .from(parsed.querySelectorAll("table a"))
                    .map((e)=> "https://plato.pusan.ac.kr/mod/quiz/" + e.getAttribute("href"));

    const result : Schedule[] = [];
    for (const hwLink of hwLinks) {
        if (!hwLink) continue;
        const parsed = await fetchAndParse(hwLink);
        if (!parsed) continue;

        const sch = new Object() as Schedule;
        sch.course = subject;
        sch.type = ScheduleType.QUIZ;
        sch.name = parsed.querySelector(".page-content-container h2")?.textContent ?? "";
        sch.completed = parsed.querySelector("table.quizattemptsummary td.cell.c3")?.textContent != "";
        sch.id = new URL(hwLink).searchParams.get("id") ?? "";
        sch.url = hwLink;
        sch.orphaned = false;
        sch.due = new Date(
            parsed.querySelector(".quizinfo p:nth-child(2)")
                ?.textContent
                .replace("종료일시 : ", "")
                .trim() ?? 0
            );     
        result.push(sch);
    }
    return result;
}

async function getVids(subject : Subject) {
    const parsed = await fetchAndParse(`https://plato.pusan.ac.kr/mod/vod/index.php?id=${subject.id}`);
    if (!parsed) return;
    const hwLinks = Array
                    .from(parsed.querySelectorAll("table a"))
                    .map((e)=> "https://plato.pusan.ac.kr/mod/vod/" + e.getAttribute("href"));

    const result : Schedule[] = [];
    for (const hwLink of hwLinks) {
        if (!hwLink) continue;
        const parsed = await fetchAndParse(hwLink);
        if (!parsed) continue;
        
        const sch = new Object() as Schedule;
        sch.course = subject;
        sch.type = ScheduleType.VID;
        sch.name = Array.from(
            parsed.querySelectorAll(".page-content-navigation a")
        )?.at(-1)?.textContent ?? "";
        sch.id = new URL(hwLink).searchParams.get("id") ?? "";
        sch.url = hwLink;
        sch.orphaned = false;
        sch.due = new Date(
            Array.from(parsed.querySelectorAll(".vod_info_value"))
                ?.at(1)
                ?.textContent
                ?.replace("출석인정기간: ", "")
                .trim() ?? 0
            );     

        result.push(sch);
    }

    if (result.length === 0) return result;

    const vidParsed = await fetchAndParse(`https://plato.pusan.ac.kr/report/ubcompletion/user_progress_a.php?id=${subject.id}`);
    if (!vidParsed) return [];
    const vidData = Array
        .from(vidParsed.querySelectorAll(".user_progress_table tbody tr"))
        .filter(e => e.children[1] && e.children[1].textContent.trim() !== "") // 2번째 <td> 요소가 비어있지 않은 행만 필터링
        .map(e=> Array.from(e.querySelectorAll("td:not(td[rowspan])")))
        .map(e => e[3] ? e[3].textContent.trim() === "O" : false);

    for (let i = 0; i < result.length; i++) {
        result[i].completed = vidData[i];
    }
    return result;
}

async function getZooms(subject : Subject) {
    const parsed = await fetchAndParse(`https://plato.pusan.ac.kr/mod/zoom/index.php?id=${subject.id}`);
    if (!parsed) return;
    const hwLinks = Array
                    .from(parsed.querySelectorAll("table a"))
                    .map((e)=> "https://plato.pusan.ac.kr/mod/zoom/" + e.getAttribute("href"));

    const result : Schedule[] = [];
    for (const hwLink of hwLinks) {
        if (!hwLink) continue;
        const parsed = await fetchAndParse(hwLink);
        if (!parsed) continue;


        const sch = new Object() as Schedule;
        sch.course = subject;
        sch.type = ScheduleType.ZOOM;
        sch.name = parsed.querySelector(".page-content-container h2")?.textContent ?? "";
        sch.completed = parsed.querySelectorAll(".ubzoom_list table tr").length > 1;
        sch.id = new URL(hwLink).searchParams.get("id") ?? "";
        sch.url = hwLink;
        sch.orphaned = false;
        sch.due = new Date(
            parsed
                .querySelector("#show_schedule tr:nth-child(1) td:nth-child(2)")
                ?.textContent ?? 0
            );     
        result.push(sch);
    }

    return result;
}

async function getPAs(subject : Subject) {
    const parsed = await fetchAndParse(`https://plato.pusan.ac.kr/mod/vpl/index.php?id=${subject.id}`);
    if (!parsed) return;
   
    const assignmentRows = Array.from(parsed.querySelectorAll("table tbody tr"));
    const result : Schedule[] = [];
    for (const row of assignmentRows) {
        const sch = new Object() as Schedule;
        if (row.childElementCount <= 1) continue;
        sch.course = subject;
        sch.type = ScheduleType.PA;
        sch.name = row.children[1].querySelector("a")?.textContent ?? "";
        sch.completed = row.children[4]?.textContent != "제출물이 존재하지 않습니다."
        sch.url = "https://plato.pusan.ac.kr/mod/vpl/" 
            + (row.children[1].querySelector("a")?.getAttribute("href") ?? "");
        sch.id = new URL(sch.url).searchParams?.get("id") ?? "";
        sch.orphaned = false;
        sch.due = new Date(
            row.children[3]?.textContent ?? 0
        )
        result.push(sch);
    }
    return result;

}

export async function updateData() {
    const courses = await getCoursesListTest();

    for (const course of courses) {
        const result = (await Promise.all([
            getHomeworks(course),
            getQuizes(course),
            getVids(course),
            getZooms(course),
            getPAs(course)
        ]))
        .flat()
        .filter((e)=>e!==undefined);
        // const hws = await getHomeworks(course);
        // const quizs = await getQuizes(course);
        // const vids = await getVids(course);
        // const zooms = await getZooms(course);
        // const pas = await getPAs(course);
        // const result = [
        //     ...(hws ?? []), 
        //     ...(quizs ?? []),
        //     ...(vids ?? []),
        //     ...(zooms ?? []),
        //     ...(pas ?? [])
        // ]
        ScheduleStorageManager
            .getInstance()
            .updateSchedulesForCourse(course.id, result);
        console.log(course.name, result);
    }
    return true;
} 