import { expect, test } from 'vitest';
import { findDates, getLaterDate } from '../src/background/utils';

test('PLATO 날짜의 초와 한국 시간대를 보존한다', () => {
    expect(findDates('종료 일시: 2026-10-11 23:59:30')[0].toISOString()).toBe('2026-10-11T14:59:30.000Z');
});

test('날짜가 없거나 유효하지 않으면 1970년 마감으로 만들지 않는다', () => {
    expect(['마감 없음', '2026-02-30 12:00', '2026-10-01 25:00'].map(value => getLaterDate(findDates(value)))).toEqual([null, null, null]);
});
