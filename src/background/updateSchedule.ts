import { parse, HTMLElement } from 'node-html-parser';
import ScheduleStorageManager from './scheduleStorageManager';
import { findDates, getLaterDate } from './utils';

export enum ScheduleType { HW, VID, ZOOM, QUIZ, PA }
export type Attendance = 'present' | 'late' | 'absent';
export interface Schedule {
    type: ScheduleType;
    id: string;
    name: string;
    url: string;
    course: Subject;
    completed: boolean | null;
    attendance?: Attendance;
    completionBasis?: 'progress';
    orphaned: boolean;
    due: Date | string | null;
}
export interface Subject { name: string; url: string; id: string }
export type CollectedSchedule = Omit<Schedule, 'due'> & { due?: Schedule['due'] };
export interface CourseCollection {
    schedules: CollectedSchedule[];
    discoveredIds: string[];
    listingComplete: boolean;
    errors: string[];
    warnings: string[];
}
export interface UpdateResult { result: boolean; errors: string[]; warnings: string[] }
const ORIGIN = 'https://plato.pusan.ac.kr';
const MODULE_TYPES: Record<string, ScheduleType> = {
    assign: ScheduleType.HW, vod: ScheduleType.VID, quiz: ScheduleType.QUIZ, zoom: ScheduleType.ZOOM,
};
const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '알 수 없는 오류';

async function fetchAndParse(url: string): Promise<HTMLElement> {
    const res = await fetch(url, { credentials: 'include', signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`페이지 요청 실패 (${res.status})`);
    const page = parse(await res.text());
    if (res.url.includes('/login/') || page.querySelector('#page-login-index, #form-login-sso, form#login')) {
        throw new Error('PLATO 로그인이 필요합니다.');
    }
    if (page.querySelector('[data-rel="fatalerror"], .errorbox')) throw new Error('PLATO가 오류 화면을 반환했습니다.');
    return page;
}

export async function getCoursesList(): Promise<Subject[]> {
    const page = await fetchAndParse(`${ORIGIN}/`);
    const section = page.querySelector('.dashboard-container .ongoing-courses');
    if (!section) throw new Error('진행 중인 강좌 목록을 확인할 수 없습니다.');
    const courses = new Map<string, Subject>();
    for (const card of section.querySelectorAll('.course-card')) {
        const href = card.getAttribute('href') ?? card.querySelector('a[href*="/course/view.php"]')?.getAttribute('href');
        if (!href) throw new Error('강좌 링크를 확인할 수 없습니다.');
        const url = new URL(href, ORIGIN);
        const id = url.searchParams.get('id');
        if (url.origin !== ORIGIN || url.pathname !== '/course/view.php' || !id || !/^\d+$/.test(id)) throw new Error('강좌 ID를 확인할 수 없습니다.');
        const name = clean(card.querySelector('.course-info-header h5')?.textContent ?? '');
        if (!name) throw new Error('강좌명을 확인할 수 없습니다.');
        courses.set(id, { id, name, url: url.href });
    }
    const result = [...courses.values()];
    await chrome.storage.local.set({ currentCourses: result });
    return result;
}

export function getActivityLinks(page: HTMLElement, pageUrl: string) {
    const table = page.querySelector('#region-main .table-activities');
    if (!table) throw new Error('학습활동 목록 화면을 확인할 수 없습니다.');
    const activities = new Map<string, { id: string; url: string; type: ScheduleType }>();
    for (const link of table.querySelectorAll('a[href]')) {
        const url = new URL(link.getAttribute('href')!, pageUrl);
        const module = url.pathname.match(/^\/mod\/(assign|quiz|vod|zoom)\/view\.php$/)?.[1];
        if (url.origin !== ORIGIN || !module) continue;
        const id = url.searchParams.get('id');
        if (!id || !/^\d+$/.test(id)) throw new Error('학습활동 ID를 확인할 수 없습니다.');
        activities.set(id, { id, url: url.href, type: MODULE_TYPES[module] });
    }
    return [...activities.values()];
}

function getFields(page: HTMLElement): Map<string, string> {
    const fields = new Map<string, string>();
    for (const item of page.querySelectorAll('.cml-item')) {
        const label = clean(item.querySelector('.cml-label')?.textContent ?? '').replace(/\s|:|：/g, '').toLowerCase();
        const value = clean(item.querySelector('.cml-text')?.textContent ?? '');
        if (label) fields.set(label, value);
    }
    return fields;
}

function getField(fields: Map<string, string>, labels: string[]): string | undefined {
    for (const label of labels) {
        const value = fields.get(label.replace(/\s|:|：/g, '').toLowerCase());
        if (value !== undefined) return value;
    }
}

function completionState(text: string): boolean | null {
    if (/^(완료|이수 완료|이수|참여 완료|참여|Completed)$/i.test(clean(text))) return true;
    if (/^(미완료|미이수|미참여|미충족|Incomplete|Not completed)$/i.test(clean(text))) return false;
    return null;
}

function requiresLearningTime(page: HTMLElement): boolean {
    const condition = getField(getFields(page), ['활동 완료 조건', '학습 완료 조건']) ?? '';
    return /학습\s*시간\s*준수/.test(condition) && !/미사용|안\s*함|열람만|비활성|사용\s*안/.test(condition);
}

function videoId(row: HTMLElement, pageUrl: string): string | undefined {
    for (const link of row.querySelectorAll('a[href]')) {
        const url = new URL(link.getAttribute('href')!, pageUrl);
        if (url.origin === ORIGIN && url.pathname === '/mod/vod/view.php') {
            const id = url.searchParams.get('id');
            if (id && /^\d+$/.test(id)) return id;
        }
    }
}

function parseAttendanceReport(page: HTMLElement, pageUrl: string): Map<string, Attendance> {
    const result = new Map<string, Attendance>();
    let recognized = false;
    for (const table of page.querySelectorAll('#region-main table')) {
        const headers = table.querySelectorAll('thead th').map(node => clean(node.textContent).replace(/\s/g, ''));
        const statusIndex = headers.findIndex(text => /^(출결상태|출석상태|출석결과|Attendancestatus)$/i.test(text));
        if (statusIndex < 0) continue;
        recognized = true;
        for (const row of table.querySelectorAll('tbody tr')) {
            const id = videoId(row, pageUrl);
            if (!id) continue; // 날짜별 대면 수업 출결을 영상 출결로 해석하지 않는다.
            const cells = row.querySelectorAll('td');
            const cell = statusIndex === headers.length - 1 ? cells[cells.length - 1] : cells.length === headers.length ? cells[statusIndex] : undefined;
            const status = clean(cell?.textContent ?? '');
            if (/^(출석|정상 출석|출석 인정|Present)$/i.test(status)) result.set(id, 'present');
            else if (/^(지각|지각 인정|Late)$/i.test(status)) result.set(id, 'late');
            else if (/^(결석|미충족|출석 미인정|Absent)$/i.test(status)) result.set(id, 'absent');
        }
    }
    if (!recognized) throw new Error('영상 출석 보고서 구조를 확인할 수 없습니다.');
    return result;
}

function parseCompletionReport(page: HTMLElement, pageUrl: string) {
    const table = page.querySelector('#region-main .table-learning-student-activity');
    if (!table) throw new Error('활동 완료 보고서 구조를 확인할 수 없습니다.');
    const result = new Map<string, { completed: boolean | null; learningTimeRequired: boolean }>();
    for (const row of table.querySelectorAll('tr')) {
        const id = videoId(row, pageUrl);
        if (id) result.set(id, { completed: completionState(row.querySelector('.td-status')?.textContent ?? ''), learningTimeRequired: requiresLearningTime(row) });
    }
    return result;
}

export function parseSchedule(page: HTMLElement, activity: { id: string; url: string; type: ScheduleType }, course: Subject, attendance = new Map<string, Attendance>(), completion = new Map<string, { completed: boolean | null; learningTimeRequired: boolean }>()) {
    const name = clean(page.querySelector('#page-mod-header .mod-info-title')?.textContent ?? '');
    if (!name || !page.querySelector('#region-main')) throw new Error('활동 상세 화면을 확인할 수 없습니다.');
    const schedule: CollectedSchedule = { ...activity, name, course, completed: null, orphaned: false, due: null };
    const warnings: string[] = [];
    const fields = getFields(page);
    const dueText = page.querySelector('#page-mod-header .timeclose')?.textContent.trim()
        ?? getField(fields, ['예정 종료 시각', '예정 종료 일시', '종료 일시', '종료일시', '마감일', '시험 기간', '출석 인정 기간', 'Due date', 'End time']);
    const endText = dueText?.split('~').pop()?.trim();
    if (endText && !/^(없음|미설정|제한 없음|No due date|Not set|-)$/i.test(endText)) {
        const due = getLaterDate(findDates(endText));
        if (due) schedule.due = due.toISOString();
        else { delete schedule.due; warnings.push(`${name}: 마감일을 해석할 수 없어 기존 값을 유지합니다.`); }
    }
    if (activity.type === ScheduleType.HW) {
        const status = getField(fields, ['제출 상태', 'Submission status']);
        if (/^(제출 완료|Submitted for grading|Submitted)$/i.test(status ?? '')) schedule.completed = true;
        else if (/^(미제출|제출 전|초안.*|No submission|Draft.*)$/i.test(status ?? '')) schedule.completed = false;
    }
    if (activity.type === ScheduleType.QUIZ) {
        const states = page.querySelectorAll('.list-of-attempts .user-info-item-state .user-info-value').map(node => clean(node.textContent));
        if (states.some(state => /^(종료|종료됨|Finished|Completed)$/i.test(state))) schedule.completed = true;
        else if (states.length && states.every(state => /^(진행 중|진행중|미완료|기한 초과|포기|In progress|Overdue|Abandoned)$/i.test(state))) schedule.completed = false;
        else if (page.querySelector('#region-main form[action*="/mod/quiz/startattempt.php"]')) schedule.completed = false;
    }
    if (activity.type === ScheduleType.VID) {
        if (attendance.has(activity.id)) {
            schedule.attendance = attendance.get(activity.id)!;
            schedule.completed = schedule.attendance !== 'absent';
        } else {
            const reported = completion.get(activity.id);
            if (requiresLearningTime(page)) {
                schedule.completed = completionState(page.querySelector('#csms-mod-completion')?.textContent ?? '');
                if (schedule.completed === null) schedule.completed = reported?.completed ?? null;
            } else if (reported?.learningTimeRequired) schedule.completed = reported.completed;
        }
        if (schedule.completed === null) {
            const text = clean(page.querySelector('#page-mod-header #csms-mod-progress')?.textContent ?? '');
            const match = text.match(/^(\d+(?:\.\d+)?)\s*%$/);
            const progress = match ? Number(match[1]) : NaN;
            if (progress >= 0 && progress <= 100) {
                schedule.completed = progress === 100;
                schedule.completionBasis = 'progress';
                warnings.push(`${name}: 출석 판정 없음: 시청 기준 100% 사용 (기존 확정 출석이 있으면 우선).`);
            }
        }
    }
    if (activity.type === ScheduleType.ZOOM) {
        const status = getField(fields, ['이수 결과', '참여 결과', '이수 상태', '참여 상태', 'Participation status']);
        schedule.completed = completionState(status ?? '');
    }
    if (schedule.completed === null) warnings.push(`${name}: 완료 여부 확인 불가 (기존 확정값이 있으면 유지).`);
    return { schedule, warnings };
}

export async function collectCourse(course: Subject): Promise<CourseCollection> {
    const result: CourseCollection = { schedules: [], discoveredIds: [], listingComplete: false, errors: [], warnings: [] };
    const listUrl = `${ORIGIN}/local/ubion/course/activities.php?id=${course.id}`;
    try {
        const listPage = await fetchAndParse(listUrl);
        const activities = getActivityLinks(listPage, listUrl);
        result.discoveredIds = activities.map(activity => activity.id);
        result.listingComplete = true;
        if (listPage.querySelector('a[href*="/mod/vpl/view.php"]')) result.warnings.push(`${course.name}: VPL 자동 수집은 보류하며 기존 데이터를 보존합니다.`);
        let attendance = new Map<string, Attendance>();
        let completion = new Map<string, { completed: boolean | null; learningTimeRequired: boolean }>();
        if (activities.some(activity => activity.type === ScheduleType.VID)) {
            const reports = new Map<string, string>();
            for (const link of listPage.querySelectorAll('a[href]')) {
                const url = new URL(link.getAttribute('href')!, listUrl);
                if (url.origin !== ORIGIN || url.searchParams.get('id') !== course.id) continue;
                if (/^\/local\/ubsmartbook\/(index|my)\.php$/.test(url.pathname)) reports.set('attendance', url.href);
                if (/^\/report\/ublogs\/(completion|student\/activity)\.php$/.test(url.pathname)) reports.set('completion', url.href);
            }
            for (const [kind, url] of reports) {
                try {
                    const page = await fetchAndParse(url);
                    if (kind === 'attendance') attendance = parseAttendanceReport(page, url);
                    else completion = parseCompletionReport(page, url);
                } catch (error) {
                    result.errors.push(`${course.name} / ${kind === 'attendance' ? '출석' : '활동 완료'} 보고서: ${errorMessage(error)}`);
                }
            }
        }
        for (const activity of activities) {
            try {
                const parsed = parseSchedule(await fetchAndParse(activity.url), activity, course, attendance, completion);
                result.schedules.push(parsed.schedule);
                result.warnings.push(...parsed.warnings);
            } catch (error) {
                result.errors.push(`${course.name} / 활동 ${activity.id}: ${errorMessage(error)}`);
            }
        }
    } catch (error) {
        result.errors.push(`${course.name}: ${errorMessage(error)}`);
    }
    return result;
}

let pendingUpdate: Promise<UpdateResult> | undefined;
export function updateData(): Promise<UpdateResult> {
    return pendingUpdate ??= performUpdate().finally(() => { pendingUpdate = undefined; });
}

async function performUpdate(): Promise<UpdateResult> {
    const result: UpdateResult = { result: false, errors: [], warnings: [] };
    try {
        const courses = await getCoursesList();
        const oldSchedules = await ScheduleStorageManager.getInstance().loadAllSchedules();
        if (Object.values(oldSchedules).some(items => Object.values(items).some(item => item.type === ScheduleType.PA))) {
            result.warnings.push('VPL 자동 수집은 보류하며 기존 데이터를 보존합니다.');
        }
        for (const course of courses) {
            const collection = await collectCourse(course);
            result.errors.push(...collection.errors);
            result.warnings.push(...collection.warnings);
            if (collection.listingComplete) {
                try {
                    await ScheduleStorageManager.getInstance().updateSchedulesForCourse(course.id, collection.schedules, collection);
                } catch (error) { result.errors.push(`${course.name} / 저장 실패: ${errorMessage(error)}`); }
            }
        }
        result.result = result.errors.length === 0;
    } catch (error) {
        result.errors.push(errorMessage(error));
    }
    return result;
}
