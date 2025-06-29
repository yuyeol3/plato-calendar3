import { parse } from 'node-html-parser';

enum ScheduleType { ASS, VID, ZOOM, QUIZ, PA };

interface schedule {
    type : ScheduleType;
    name : string;
    url : string;  
};

export interface subject {
    name : string;
    url : string;
}

export async function getCoursesList() : Promise<subject[]> {
    const res = await fetch("https://plato.pusan.ac.kr/");
    const coursePage = await res.text();
    
    const parsed = parse(coursePage);
    const courses = Array.from(parsed.querySelectorAll(".course-box"));
    const result : subject[] = [];
    for (const course of courses) {
        const name = course.querySelector(".course-title h3 *:not(.new)")?.textContent.split(' ')[0];
        const url = course.querySelector("a")?.getAttribute("href");

        result.push({name, url} as subject);
    }

    return result;
}