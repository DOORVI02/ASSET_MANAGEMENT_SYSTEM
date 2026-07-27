import { describe, expect, it } from 'vitest';
import {
  clampPageSize,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  toRange,
  withTieBreaker,
} from './pagination';

describe('clampPageSize', () => {
  it('falls back to the default when nothing is requested', () => {
    expect(clampPageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  it('falls back to the default for zero, negative, or non-finite input', () => {
    expect(clampPageSize(0)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(-5)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(Number.POSITIVE_INFINITY)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(Number.NaN)).toBe(DEFAULT_PAGE_SIZE);
  });

  it('truncates a fractional request down to a whole page size', () => {
    expect(clampPageSize(25.9)).toBe(25);
  });

  it('passes through an in-range whole request unchanged', () => {
    expect(clampPageSize(40)).toBe(40);
  });

  it('caps a request above the maximum at the maximum', () => {
    expect(clampPageSize(500)).toBe(MAX_PAGE_SIZE);
  });
});

describe('toRange', () => {
  it('returns a zero-based range for the first page', () => {
    expect(toRange(1, 10)).toEqual({ from: 0, to: 9 });
  });

  it('offsets by page size for later pages', () => {
    expect(toRange(3, 10)).toEqual({ from: 20, to: 29 });
  });

  it('treats page 0, negative, or fractional pages as page 1', () => {
    expect(toRange(0, 10)).toEqual({ from: 0, to: 9 });
    expect(toRange(-4, 10)).toEqual({ from: 0, to: 9 });
    expect(toRange(1.9, 10)).toEqual({ from: 0, to: 9 });
  });
});

describe('withTieBreaker', () => {
  it('appends an ascending id tie-breaker to a non-id sort', () => {
    expect(withTieBreaker({ column: 'code', ascending: true })).toEqual([
      { column: 'code', ascending: true },
      { column: 'id', ascending: true },
    ]);
  });

  it('does not duplicate the tie-breaker when already sorting by id', () => {
    expect(withTieBreaker({ column: 'id', ascending: false })).toEqual([
      { column: 'id', ascending: false },
    ]);
  });
});
