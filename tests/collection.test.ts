import { readFileSync } from 'node:fs';
import { beforeEach, expect, test, vi } from 'vitest';
import { getCoursesList, updateData, ScheduleType } from '../src/background/updateSchedule';

export const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');

let saved: Record<string, any>;
beforeEach(() => {
    saved = { allSchedules: {}, currentCourses: [] };
    vi.stubGlobal('chrome', { storage: { local: {
        get: vi.fn(async () => structuredClone(saved)),
        set: vi.fn(async (data) => Object.assign(saved, structuredClone(data))),
    } } });
});

test('상세 요청 실패와 VPL 수집 보류는 기존 일정을 사라진 것으로 만들지 않는다', async () => {
    const old = { id: '21', type: ScheduleType.HW, name: '기존 과제', completed: false, orphaned: false,
        url: 'https://plato.pusan.ac.kr/mod/assign/view.php?id=21', due: '2026-10-11T14:59:00.000Z', course: { id: '11', name: '테스트 강좌', url: 'https://plato.pusan.ac.kr/course/view.php?id=11' } };
    saved.allSchedules = { '11': { '21': old, '88': { ...old, id: '88', type: ScheduleType.PA } } };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (url.endsWith('/')) return new Response(fixture('home'));
        if (url.includes('/activities.php')) return new Response(fixture('activities'));
        return new Response('', { status: 404 });
    }));
    const result = await updateData();
    expect({ success: result.result, orphaned: Object.values(saved.allSchedules['11']).map((s: any) => s.orphaned) }).toEqual({ success: false, orphaned: [false, false] });
});

test.each(['현재 강좌가 있음', '현재 강좌가 없음'])('홈에서 빠진 강좌는 저장 상태를 보존하고 요청하지 않는다: %s', async state => {
    const old = { id: '31', type: ScheduleType.VID, name: '지난 강좌 영상', completed: true, attendance: 'late', orphaned: false,
        url: 'https://plato.pusan.ac.kr/mod/vod/view.php?id=31', due: '2026-10-06T14:59:00.000Z', course: { id: '12', name: '지난 강좌', url: 'https://plato.pusan.ac.kr/course/view.php?id=12' } };
    saved.allSchedules = { '12': { '31': old } };
    const home = state === '현재 강좌가 있음' ? fixture('home') : '<div class="dashboard-container"><div class="ongoing-courses"></div></div>';
    const request = vi.fn(async (url: string) => new Response(url.endsWith('/') ? home : url.includes('activities') ? fixture('activities') : fixture('assign')));
    vi.stubGlobal('fetch', request);
    const result = await updateData();
    expect(result.result).toBe(true);
    expect(saved.allSchedules['12']['31']).toEqual(old);
    expect(request.mock.calls.some(([url]) => url.includes('id=12') || url.includes('id=31'))).toBe(false);
});

test('새 홈의 진행 중인 강좌만 수집하고 상대 주소와 중복을 처리한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(fixture('home'))));
    const courses = await getCoursesList();
    expect(courses).toEqual([{ id: '11', name: '테스트 강좌 (001)', url: 'https://plato.pusan.ac.kr/course/view.php?id=11' }]);
});

test('활동 모아보기의 과제를 새 상세 필드로 수집해 저장한다', async () => {
    const pages: Record<string, string> = {
        'https://plato.pusan.ac.kr/': fixture('home'),
        'https://plato.pusan.ac.kr/local/ubion/course/activities.php?id=11': fixture('activities'),
        'https://plato.pusan.ac.kr/mod/assign/view.php?id=21': fixture('assign'),
    };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(pages[url] ?? '', { status: pages[url] ? 200 : 404 })));
    const result = await updateData();
    expect({ result: result.result, schedule: saved.allSchedules['11']['21'] }).toEqual({
        result: true,
        schedule: { id: '21', type: ScheduleType.HW, name: '테스트 과제', completed: true, orphaned: false,
            course: { id: '11', name: '테스트 강좌 (001)', url: 'https://plato.pusan.ac.kr/course/view.php?id=11' },
            url: 'https://plato.pusan.ac.kr/mod/assign/view.php?id=21', due: '2026-10-11T14:59:00.000Z' },
    });
});

test.each([
    new Response('<form id="form-login-sso"></form>'),
    new Response('', { status: 404 }),
    new Response('<main id="region-main">오류</main>'),
])('로그인 만료와 홈 요청 오류는 기존 강좌 목록과 일정을 보존한다', async response => {
    saved.currentCourses = [{ id: 'old', name: '기존', url: 'https://plato.pusan.ac.kr/course/view.php?id=old' }];
    const before = structuredClone(saved);
    vi.stubGlobal('fetch', vi.fn(async () => response.clone()));
    const result = await updateData();
    expect({ data: saved, success: result.result, errors: result.errors.length }).toEqual({ data: before, success: false, errors: 1 });
});

test('로그인 주소로 리다이렉트된 응답도 실패로 처리한다', async () => {
    const response = new Response(fixture('home'));
    Object.defineProperty(response, 'url', { value: 'https://plato.pusan.ac.kr/login/index.php' });
    vi.stubGlobal('fetch', vi.fn(async () => response));
    expect((await updateData()).errors).toEqual(['PLATO 로그인이 필요합니다.']);
});

test('알 수 없는 활동 목록 구조를 정상 빈 목록으로 처리하지 않는다', async () => {
    saved.allSchedules = { '11': { '21': { id: '21', type: ScheduleType.HW, completed: false, orphaned: false, due: null } } };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('/') ? fixture('home') : '<main id="region-main">권한 없음</main>')));
    const result = await updateData();
    expect({ success: result.result, orphaned: saved.allSchedules['11']['21'].orphaned }).toEqual({ success: false, orphaned: false });
});

test('공통 보고서는 강좌당 한 번 읽고 영상 출석을 ID로 연결한다', async () => {
    const list = `<main id="region-main"><table class="table-activities"><tr><td><a href="/mod/vod/view.php?id=21">동명 영상</a><a href="/mod/vod/view.php?id=22">동명 영상</a><a href="/mod/vod/view.php?id=23">동명 영상</a></td></tr></table></main><nav><a href="/local/ubsmartbook/index.php?id=11">출석부</a><a href="/local/ubsmartbook/index.php?id=11">중복</a><a href="/report/ublogs/completion.php?id=11">활동 이수</a></nav>`;
    const attendance = `<main id="region-main"><table><thead><tr><th>활동명</th><th>출결 상태</th></tr></thead><tbody>${[['21','출석'], ['22','결석'], ['23','지각 인정']].map(([id, state]) => `<tr><td><a href="/mod/vod/view.php?id=${id}">동명 영상</a></td><td>${state}</td></tr>`).join('')}</tbody></table></main>`;
    const completion = '<main id="region-main"><table class="table-learning-student-activity"><tr><td><a href="/mod/vod/view.php?id=22">영상</a></td><td class="td-status">완료</td></tr></table></main>';
    const request = vi.fn(async (url: string) => new Response(url.endsWith('/') ? fixture('home') : url.includes('activities.php') ? list : url.includes('ubsmartbook') ? attendance : url.includes('ublogs') ? completion : fixture('vod')));
    vi.stubGlobal('fetch', request);
    expect((await updateData()).result).toBe(true);
    expect(Object.values(saved.allSchedules['11']).map((s: any) => [s.id, s.completed, s.attendance])).toEqual([['21', true, 'present'], ['22', false, 'absent'], ['23', true, 'late']]);
    expect(request.mock.calls.filter(([url]) => url.includes('ubsmartbook') || url.includes('ublogs')).length).toBe(2);
});

test('여러 홈 탭에서 동시에 갱신해도 수집과 저장을 한 번만 수행한다', async () => {
    const request = vi.fn(async (url: string) => new Response(url.endsWith('/') ? fixture('home') : url.includes('activities') ? fixture('activities') : fixture('assign')));
    vi.stubGlobal('fetch', request);
    const results = await Promise.all([updateData(), updateData()]);
    expect(results.map(r => r.result)).toEqual([true, true]);
    expect(request.mock.calls.filter(([url]) => url.endsWith('/'))).toHaveLength(1);
});

test('출석 보고서 오류에도 제목과 마감은 갱신하고 기존 확정 출석을 보존한다', async () => {
    const old = { id: '21', type: ScheduleType.VID, name: '이전 영상', completed: true, attendance: 'late', orphaned: false, due: '2026-01-01T00:00:00.000Z' };
    saved.allSchedules = { '11': { '21': old } };
    const list = '<main id="region-main"><table class="table-activities"><tr><td><a href="/mod/vod/view.php?id=21">영상</a></td></tr></table></main><a href="/local/ubsmartbook/index.php?id=11">출석부</a>';
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('/') ? fixture('home') : url.includes('activities') ? list : url.includes('ubsmartbook') ? '<div data-rel="fatalerror"><div class="errorbox">오류</div></div>' : fixture('vod'))));
    const result = await updateData();
    expect({ completed: saved.allSchedules['11']['21'].completed, attendance: saved.allSchedules['11']['21'].attendance, due: saved.allSchedules['11']['21'].due, result: result.result }).toEqual({ completed: true, attendance: 'late', due: '2026-10-06T14:59:00.000Z', result: false });
    expect(result.errors[0]).toContain('출석 보고서');
    expect(result.warnings[0]).toContain('시청 기준 100%');
});

test('정상 빈 목록은 지원 활동만 orphan 처리하고 VPL 완료 상태는 보존한다', async () => {
    saved.allSchedules = { '11': { '21': { id: '21', type: ScheduleType.HW, completed: true, orphaned: false, due: null }, '88': { id: '88', type: ScheduleType.PA, completed: false, orphaned: false, due: null } } };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('/') ? fixture('home') : '<main id="region-main"><table class="table-activities"><tbody><tr class="csms-table-no-data"><td>등록된 학습활동이 없습니다.</td></tr></tbody></table></main>')));
    const result = await updateData();
    expect(result.result).toBe(true);
    expect([saved.allSchedules['11']['21'].orphaned, saved.allSchedules['11']['88'].orphaned, saved.allSchedules['11']['88'].completed]).toEqual([true, false, false]);
    expect(result.warnings.join(' ')).toContain('VPL');
});

test('일부 상세 페이지 실패에도 정상 과제는 저장하고 실패한 과제의 기존 값은 보존한다', async () => {
    saved.allSchedules = { '11': { '22': { id: '22', type: ScheduleType.HW, completed: true, name: '이전 과제', orphaned: true, due: '2026-10-04T14:59:00.000Z' } } };
    const list = fixture('activities').replace('</table>', '<tr><td><a href="/mod/assign/view.php?id=22">과제2</a></td></tr></table>');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.endsWith('/') ? fixture('home') : url.includes('activities') ? list : url.endsWith('id=21') ? fixture('assign') : '<form id="form-login-sso"></form>')));
    const result = await updateData();
    expect(result.result).toBe(false);
    expect([saved.allSchedules['11']['21'].completed, saved.allSchedules['11']['22'].completed, saved.allSchedules['11']['22'].orphaned, saved.allSchedules['11']['22'].name]).toEqual([true, true, false, '이전 과제']);
});
