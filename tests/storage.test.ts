import { beforeEach, expect, test, vi } from 'vitest';
import ScheduleStorageManager from '../src/background/scheduleStorageManager';
import { ScheduleType } from '../src/background/updateSchedule';
let saved: Record<string, any>;
const course = { id: '11', name: '테스트', url: 'https://plato.pusan.ac.kr/course/view.php?id=11' };
const old = { id: '21', course, type: ScheduleType.VID, name: '이전 제목', url: 'https://plato.pusan.ac.kr/mod/vod/view.php?id=21', completed: true, attendance: 'late' as const, orphaned: false, due: '2026-10-06T14:59:00.000Z' };
beforeEach(() => {
    saved = { allSchedules: { '11': { '21': { ...old } } } };
    vi.stubGlobal('chrome', { storage: { local: { get: async () => structuredClone(saved), set: async data => Object.assign(saved, structuredClone(data)) } } });
});

test('새 판정과 날짜를 확인하지 못해도 기존 확정값을 보존하고 제목을 갱신한다', async () => {
    const incoming = { ...old, name: '새 제목', completed: null, due: undefined, attendance: undefined };
    await ScheduleStorageManager.getInstance().updateSchedulesForCourse('11', [incoming], { discoveredIds: ['21'], listingComplete: true });
    expect(saved.allSchedules['11']['21']).toEqual({ ...old, name: '새 제목' });
});

test('목록 오류는 기존 값을 바꾸지 않고 정상 빈 목록만 지원 활동을 orphan 처리한다', async () => {
    saved.allSchedules['11']['88'] = { ...old, id: '88', type: ScheduleType.PA };
    await ScheduleStorageManager.getInstance().updateSchedulesForCourse('11', [], { discoveredIds: [], listingComplete: false });
    expect(saved.allSchedules['11']['21'].orphaned).toBe(false);
    await ScheduleStorageManager.getInstance().updateSchedulesForCourse('11', [], { discoveredIds: [], listingComplete: true });
    expect(Object.values(saved.allSchedules['11']).map((s: any) => s.orphaned)).toEqual([true, false]);
});

test('기존 boolean은 유지하고 누락된 완료 값은 확인 불가로 읽는다', async () => {
    delete saved.allSchedules['11']['21'].completed;
    saved.allSchedules['11']['22'] = { ...old, id: '22', completed: false };
    const schedules = await ScheduleStorageManager.getInstance().loadAllSchedules();
    expect([schedules['11']['21'].completed, schedules['11']['22'].completed]).toEqual([null, false]);
});

test('새 영상의 확인 불가와 마감 없음은 null로 저장한다', async () => {
    await ScheduleStorageManager.getInstance().updateSchedulesForCourse('12', [{ ...old, id: '31', completed: null, attendance: undefined, due: null }], { discoveredIds: ['31'], listingComplete: true });
    expect({ completed: saved.allSchedules['12']['31'].completed, due: saved.allSchedules['12']['31'].due }).toEqual({ completed: null, due: null });
});

test('진도율 판정은 저장된 확정 출석보다 우선하지 않고 새 제목은 반영한다', async () => {
    saved.allSchedules['11']['21'] = { ...old, completed: false, attendance: 'absent' };
    await ScheduleStorageManager.getInstance().updateSchedulesForCourse('11', [{ ...old, name: '새 제목', completed: true, attendance: undefined, completionBasis: 'progress' }], { discoveredIds: ['21'], listingComplete: true });
    const updated = saved.allSchedules['11']['21'];
    expect({ name: updated.name, completed: updated.completed, attendance: updated.attendance, basis: updated.completionBasis }).toEqual({ name: '새 제목', completed: false, attendance: 'absent', basis: undefined });
});

test('새 공식 판정은 이전 진도율 표시를 지우고 판정 실패는 진도율 근거도 보존한다', async () => {
    saved.allSchedules['11']['21'] = { ...old, attendance: undefined, completionBasis: 'progress' };
    const listing = { discoveredIds: ['21'], listingComplete: true };
    const incoming = { ...old, completed: null, attendance: undefined };
    await ScheduleStorageManager.getInstance().updateSchedulesForCourse('11', [incoming], listing);
    expect(saved.allSchedules['11']['21'].completionBasis).toBe('progress');
    await ScheduleStorageManager.getInstance().updateSchedulesForCourse('11', [{ ...old, attendance: 'present' }], listing);
    expect({ completed: saved.allSchedules['11']['21'].completed, basis: saved.allSchedules['11']['21'].completionBasis }).toEqual({ completed: true, basis: undefined });
});
