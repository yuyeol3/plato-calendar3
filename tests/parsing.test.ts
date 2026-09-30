import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';
import { expect, test } from 'vitest';
import { parseSchedule, ScheduleType } from '../src/background/updateSchedule';
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
const course = { id: '11', name: '테스트 강좌', url: 'https://plato.pusan.ac.kr/course/view.php?id=11' };
const activity = (type: ScheduleType, id = '21') => ({ type, id, url: `https://plato.pusan.ac.kr/mod/quiz/view.php?id=${id}` });

test('네트워크보안의 실제 진도율 100% 영상은 출석 판정이 없으면 시청 기준으로 완료한다', () => {
    const { schedule } = parseSchedule(parse(fixture('live-security-vod')), activity(ScheduleType.VID), course);
    expect({ completed: schedule.completed, basis: schedule.completionBasis, attendance: schedule.attendance }).toEqual({ completed: true, basis: 'progress', attendance: undefined });
});

test.each([
    ['0%', false], ['90%', false], ['99.99%', false], ['100 %', true],
    ['101%', null], ['-1%', null], ['', null], ['확인 중', null],
])('출석 판정이 없는 영상의 진도율 %s는 100%% 기준으로 처리한다', (progress, completed) => {
    const html = fixture('live-security-vod').replace('100%', progress);
    const schedule = parseSchedule(parse(html), activity(ScheduleType.VID), course).schedule;
    expect({ completed: schedule.completed, basis: schedule.completionBasis }).toEqual({ completed, basis: completed === null ? undefined : 'progress' });
});

test('새 시험의 종료된 응시는 성적이 없어도 완료이고 종료 기간을 마감으로 사용한다', () => {
    const { schedule } = parseSchedule(parse(fixture('quiz')), activity(ScheduleType.QUIZ), course);
    expect({ completed: schedule.completed, due: schedule.due }).toEqual({ completed: true, due: '2026-10-06T14:59:00.000Z' });
});

test.each(['진행 중', '기한 초과', '포기'])('시험 상태 %s는 성적이 있어도 완료로 처리하지 않는다', state => {
    const html = fixture('quiz').replace('>종료<', `>${state}<`).replace('class="user-info-value"></span>', 'class="user-info-value">10점</span>');
    expect(parseSchedule(parse(html), activity(ScheduleType.QUIZ), course).schedule.completed).toBe(false);
});

test('최초 시험 응시 버튼이 있으면 미응시로 처리한다', () => {
    const html = fixture('quiz').replace(/<div class="csms-box-list-of-attempts">[\s\S]*?<\/main>/, '<form action="/mod/quiz/startattempt.php"><button>시험 응시</button></form></main>');
    expect(parseSchedule(parse(html), activity(ScheduleType.QUIZ), course).schedule.completed).toBe(false);
});

test('과제 미제출과 마감 없음은 명시적인 미완료와 null 날짜로 수집한다', () => {
    const html = fixture('assign').replace('제출 완료', '미제출').replace('2026-10-11 23:59:00', '없음');
    const { schedule } = parseSchedule(parse(html), activity(ScheduleType.HW), course);
    expect({ completed: schedule.completed, due: schedule.due }).toEqual({ completed: false, due: null });
});

test('해석할 수 없는 마감은 저장 병합에서 기존 값을 보존할 수 있게 생략한다', () => {
    const html = fixture('assign').replace('2026-10-11 23:59:00', '2026-02-30 12:00:00');
    const { schedule, warnings } = parseSchedule(parse(html), activity(ScheduleType.HW), course);
    expect({ due: schedule.due, warning: warnings[0] }).toEqual({ due: undefined, warning: expect.stringContaining('마감일') });
});

test('기간의 종료 날짜가 잘못되면 시작 날짜를 마감으로 대신 저장하지 않는다', () => {
    const html = '<header id="page-mod-header"><h2 class="mod-info-title">검증 시험</h2></header><main id="region-main"><div class="cml-item"><span class="cml-label">시험 기간</span><span class="cml-text">2026-02-01 00:00:00 ~ 2026-02-30 23:59:00</span></div></main>';
    const { schedule, warnings } = parseSchedule(parse(html), activity(ScheduleType.QUIZ), course);
    expect(schedule.due).toBe(undefined);
    expect(warnings.join(' ')).toContain('마감일');
});

test('동명 영상은 제목과 진도율 대신 ID별 서버 출석 결과를 사용한다', () => {
    const attendance = new Map([['21', 'present' as const], ['22', 'absent' as const], ['23', 'late' as const]]);
    const results = ['21', '22', '23'].map(id => {
        const html = id === '21' ? fixture('vod').replace('100%', '60%') : fixture('vod');
        const { schedule } = parseSchedule(parse(html), activity(ScheduleType.VID, id), course, attendance);
        return { id, completed: schedule.completed, attendance: schedule.attendance };
    });
    expect(results).toEqual([{ id: '21', completed: true, attendance: 'present' }, { id: '22', completed: false, attendance: 'absent' }, { id: '23', completed: true, attendance: 'late' }]);
});

test('학습 시간 준수를 명시한 완료 결과만 영상 판정에 사용한다', () => {
    const html = fixture('vod').replace('<span id="csms-mod-progress">100%</span>', '').replace('<main id="region-main">', '<main id="region-main"><div class="cml-item"><span class="cml-label">활동 완료 조건</span><span class="cml-text">학습 시간 준수</span></div>');
    expect(parseSchedule(parse(html), activity(ScheduleType.VID), course).schedule.completed).toBe(true);
    expect(parseSchedule(parse(html.replace('학습 시간 준수', '활동 열람')), activity(ScheduleType.VID), course).schedule.completed).toBe(null);
    expect(parseSchedule(parse(html.replace('학습 시간 준수', '열람만으로 완료')), activity(ScheduleType.VID), course).schedule.completed).toBe(null);
});

test.each([['이수 완료', true], ['미이수', false], ['성적 10점', null]])('Zoom은 명시적인 이수 결과 %s만 사용한다', (status, completed) => {
    const html = `<header id="page-mod-header"><h2 class="mod-info-title">Zoom 검증</h2></header><main id="region-main"><div class="cml-item"><span class="cml-label">예정 종료 시각</span><span class="cml-text">2026-10-01 12:30:00</span></div><div class="cml-item"><span class="cml-label">이수 결과</span><span class="cml-text">${status}</span></div><table><tr><td>참여 기록</td></tr></table></main>`;
    const schedule = parseSchedule(parse(html), activity(ScheduleType.ZOOM), course).schedule;
    expect({ completed: schedule.completed, due: schedule.due }).toEqual({ completed, due: '2026-10-01T03:30:00.000Z' });
});

test.each([
    ['live-assign', ScheduleType.HW, false, '2026-10-11T14:59:00.000Z'],
    ['live-quiz', ScheduleType.QUIZ, true, '2026-10-06T14:59:00.000Z'],
    ['live-vod', ScheduleType.VID, false, '2026-10-06T14:59:00.000Z'],
])('실제 학생 화면에서 인증·개인정보를 제거한 %s 자료를 수집한다', (name, type, completed, due) => {
    const schedule = parseSchedule(parse(fixture(name)), activity(type), course).schedule;
    expect({ completed: schedule.completed, due: schedule.due }).toEqual({ completed, due });
});
