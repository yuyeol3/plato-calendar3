// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ScheduleType } from '../src/background/updateSchedule';

let saved: Record<string, any>;
let reply: any;
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-01T12:00:00+09:00'));
    vi.resetModules();
    document.body.innerHTML = '<div class="dashboard-container"></div>';
    localStorage.clear();
    localStorage.setItem('plato-calendar3-lastUpdate', new Date().toISOString());
    const course = { id: '11', name: '검증 강좌', url: 'https://plato.pusan.ac.kr/course/view.php?id=11' };
    const base = { course, type: ScheduleType.VID, name: '영상', url: 'https://plato.pusan.ac.kr/mod/vod/view.php?id=21', orphaned: false, due: new Date().toISOString() };
    saved = { allSchedules: { '11': {
        '21': { ...base, id: '21', completed: null },
        '22': { ...base, id: '22', completed: false },
        '23': { ...base, id: '23', completed: true, attendance: 'late' },
        '24': { ...base, id: '24', completed: null, due: null },
    } }, currentCourses: [course] };
    reply = { result: true, errors: [], warnings: [] };
    vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn(async ({ action }) => {
        if (action === 'loadSchedules') return { result: structuredClone(saved.allSchedules) };
        if (action === 'loadCurCourses') return { result: saved.currentCourses };
        if (reply instanceof Error) throw reply;
        return reply;
    }) } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

test('잘못된 갱신 시간은 자동 갱신하고 실패 시 마지막 성공 시간을 보존한다', async () => {
    const { CheckScheduleUpdateTiming, updateSchedules } = await import('../src/content_scripts/utils');
    localStorage.setItem('plato-calendar3-lastUpdate', 'invalid');
    expect(CheckScheduleUpdateTiming()).toBe(true);
    localStorage.setItem('plato-calendar3-lastUpdate', '2026-01-01T00:00:00.000Z');
    reply = { result: false, errors: ['로그인 필요'], warnings: [] };
    expect(await updateSchedules()).toEqual(reply);
    expect(localStorage.getItem('plato-calendar3-lastUpdate')).toBe('2026-01-01T00:00:00.000Z');
});

test('마감 없는 일정은 배치하지 않고 기존 월별 캐시로 다른 월도 조회한다', async () => {
    const Manager = (await import('../src/content_scripts/CalendarStorageManager')).default;
    const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1, 2);
    saved.allSchedules['11']['25'] = { ...saved.allSchedules['11']['22'], id: '25', due: nextMonth.toISOString() };
    expect((await Manager.getInstance().get(nextMonth.toDateString())).map(s => s.id)).toEqual(['25']);
});

test('새 홈에 한 번 삽입하고 확인 불가와 지각을 표시하며 미완료 개수에서 제외한다', async () => {
    await import('../src/content_scripts/content');
    await vi.waitFor(() => expect(document.querySelectorAll('#plato-calendar')).toHaveLength(1));
    await vi.waitFor(() => expect(document.querySelector('.info-div .completion-unknown')?.textContent).toBe('⚠️'));
    expect(document.querySelector('.info-div .mini-schedule.unknown')?.textContent).not.toContain('완료 여부 확인 불가');
    expect(document.querySelector('.info-div .completion-unknown')?.getAttribute('aria-label')).toBe('완료 여부 확인 불가');
    expect(document.querySelector('.hover-div .completion-unknown')?.textContent).toBe('완료 여부 확인 불가');
    expect(document.querySelector('.unresolved-schedules:not(:empty)')?.textContent).toBe('1');
    const cell = document.querySelector('.mini-schedule.unknown')!.closest('td')!;
    cell.click();
    await vi.waitFor(() => expect(document.querySelector('#modal .attendance-late')?.textContent).toBe('지각'));
    expect(document.querySelector('#modal .completion-unknown')?.textContent).toBe('완료 여부 확인 불가');
    vi.resetModules();
    await import('../src/content_scripts/content');
    expect(document.querySelectorAll('#plato-calendar')).toHaveLength(1);
});

test('갱신 요청이 예외를 던져도 버튼을 복구하고 오류를 표시한다', async () => {
    saved.allSchedules = {};
    await import('../src/content_scripts/content');
    await vi.waitFor(() => expect(document.querySelector('#update-btn')).not.toBe(null));
    reply = new Error('연결 실패');
    const button = document.querySelector('#update-btn') as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    expect(document.querySelector('#update-status')?.textContent).toContain('연결 실패');
});

test('갱신 시간이 없으면 자동 갱신하고 경고만 있는 성공은 시간을 기록한다', async () => {
    const { CheckScheduleUpdateTiming, updateSchedules } = await import('../src/content_scripts/utils');
    localStorage.removeItem('plato-calendar3-lastUpdate');
    expect(CheckScheduleUpdateTiming()).toBe(true);
    reply = { result: true, errors: [], warnings: ['완료 여부 확인 불가'] };
    expect(await updateSchedules()).toEqual(reply);
    expect(CheckScheduleUpdateTiming()).toBe(false);
});

test('월 이동 후에도 중복 셀 없이 날짜와 일정이 표시되고 수동 갱신 결과를 알린다', async () => {
    await import('../src/content_scripts/content');
    await vi.waitFor(() => expect(document.querySelector('.mini-schedule.unknown')).not.toBe(null));
    const initialLabel = document.querySelector('#month-label')!.textContent;
    (document.querySelector('#next-btn') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('#month-label')!.textContent).not.toBe(initialLabel));
    (document.querySelector('#prev-btn') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('.mini-schedule.unknown')).not.toBe(null));
    expect(document.querySelectorAll('.date-label')).toHaveLength(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate());
    reply = { result: false, errors: ['일부 과제 요청 실패'], warnings: ['완료 여부 확인 불가'] };
    const button = document.querySelector('#update-btn') as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => expect(document.querySelector('#update-status')?.textContent).toContain('일부 과제 요청 실패'));
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    expect(document.querySelector('.mini-schedule.unknown')).not.toBe(null);
});

test('갱신 오류와 경고는 달력 아래의 기본으로 접힌 안내에 표시한다', async () => {
    await import('../src/content_scripts/content');
    await vi.waitFor(() => expect(document.querySelector('#update-btn')).not.toBe(null));
    reply = { result: false, errors: ['보고서 요청 실패'], warnings: ['완료 여부 확인 불가'] };
    const button = document.querySelector('#update-btn') as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => expect(document.querySelector('#update-status')?.textContent).toContain('보고서 요청 실패'));
    const status = document.querySelector('#update-status')!;
    const details = status.closest('details');
    const table = document.querySelector('#plato-calendar table')!;
    expect({ id: details?.id, open: details?.open, afterCalendar: Boolean(table.compareDocumentPosition(details!) & Node.DOCUMENT_POSITION_FOLLOWING) }).toEqual({ id: 'update-details', open: false, afterCalendar: true });
    expect(details?.querySelector('summary')?.textContent).toBe('갱신 안내');
});

test('일정 상세에 새 PLATO의 과제·영상·퀴즈·Zoom 이미지 아이콘을 표시한다', async () => {
    const base = saved.allSchedules['11']['22'];
    saved.allSchedules['11'] = Object.fromEntries([ScheduleType.HW, ScheduleType.VID, ScheduleType.QUIZ, ScheduleType.ZOOM].map((type, index) => [String(index), { ...base, id: String(index), type }]));
    await import('../src/content_scripts/content');
    await vi.waitFor(() => expect(document.querySelector('.mini-schedule')).not.toBe(null));
    (document.querySelector('.mini-schedule')!.closest('td')!).click();
    await vi.waitFor(() => expect(document.querySelectorAll('#modal .schedule')).toHaveLength(4));
    expect([...document.querySelectorAll('#modal .schedule img')].map(img => (img as HTMLImageElement).src)).toEqual(['assign', 'vod', 'quiz', 'zoom'].map(module => `https://plato.pusan.ac.kr/theme/image.php/coursemos/${module}/1790758578/monologo`));
});

test('시청 기준 100%는 달력칸과 호버에서 생략하고 일정 상세에만 표시한다', async () => {
    saved.allSchedules['11'] = { '21': { ...saved.allSchedules['11']['21'], completed: true, completionBasis: 'progress' } };
    saved.allSchedules['11']['22'] = { ...saved.allSchedules['11']['21'], id: '22', completed: null, completionBasis: undefined };
    await import('../src/content_scripts/content');
    await vi.waitFor(() => expect(document.querySelector('.mini-schedule.completed')).not.toBe(null));
    expect(document.querySelector('.info-div .completion-progress')).toBe(null);
    expect(document.querySelector('.info-div .mini-schedule.completed')?.textContent).toBe('영상');
    expect(document.querySelector('.hover-div .mini-schedule.completed')?.textContent).toBe('영상');
    expect(document.querySelector('.hover-div .completion-progress')).toBe(null);
    expect(document.querySelector('.unresolved-schedules:not(:empty)')).toBe(null);
    document.querySelector('.mini-schedule')!.closest('td')!.click();
    await vi.waitFor(() => expect(document.querySelector('#modal .completion-progress')?.textContent).toBe('시청 기준 100%'));
});

test('확인 불가 일정이 하나뿐이어도 호버 창에서 전체 설명을 제공한다', async () => {
    saved.allSchedules['11'] = { '21': saved.allSchedules['11']['21'] };
    await import('../src/content_scripts/content');
    await vi.waitFor(() => expect(document.querySelector('.info-div .mini-schedule.unknown')).not.toBe(null));
    expect(document.querySelector('.hover-div .completion-unknown')?.textContent).toBe('완료 여부 확인 불가');
    expect(document.querySelector('.info-div .mini-schedule.unknown')?.textContent).toBe('⚠️영상');
    expect(document.querySelector('.unresolved-schedules:not(:empty)')).toBe(null);
});

test.each(['현재 강좌가 있음', '현재 강좌가 없음'])('홈에서 빠진 강좌도 갱신 후 일정과 완료 상태를 표시한다: %s', async state => {
    const course = { id: '12', name: '지난 강좌', url: 'https://plato.pusan.ac.kr/course/view.php?id=12' };
    const schedule = { ...saved.allSchedules['11']['22'], id: '31', course, name: '지난 강좌 과제', completed: true };
    saved.currentCourses.push(course);
    saved.allSchedules['12'] = { '31': schedule };
    await import('../src/content_scripts/content');
    await vi.waitFor(() => expect(document.querySelector('.hover-div')?.textContent).toContain('지난 강좌 과제'));

    saved.currentCourses = state === '현재 강좌가 있음' ? saved.currentCourses.filter(item => item.id !== '12') : [];
    const button = document.querySelector('#update-btn') as HTMLButtonElement;
    button.click();
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    expect(document.querySelector('.hover-div')?.textContent).toContain('지난 강좌 과제');
    document.querySelector('.info-div .mini-schedule')!.closest('td')!.click();
    await vi.waitFor(() => expect([...document.querySelectorAll('#modal .schedule.completed h4')].map(el => el.textContent)).toContain('지난 강좌 과제'));
    expect(saved.allSchedules['12']['31']).toEqual(schedule);
});
