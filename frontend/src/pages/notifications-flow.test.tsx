import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import { DEPARTMENT_STORAGE_KEY } from '@/lib/department-scope';
import {
  NOTIFICATION_READ_STORAGE_KEY,
  readSeenIds,
  writeSeenIds,
} from '@/lib/notification-storage';
import { mockRepository } from '@/lib/mock-repository';
import { mockUsers } from '@/lib/mock-data';
import type { Role } from '@/lib/types';

function signInAs(role: Role, departmentId = 'd3') {
  const user = Object.values(mockUsers).find((candidate) => candidate.role === role);
  if (!user) throw new Error(`No ${role} fixture`);
  window.localStorage.setItem('sail_auth', JSON.stringify(user));
  window.localStorage.setItem(DEPARTMENT_STORAGE_KEY, departmentId);
}

function visit(path: string) {
  window.history.pushState({}, '', path);
}

describe('notification read state', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRepository.reset();
  });

  it('renders a dedicated notifications page that the sidebar reaches', async () => {
    signInAs('supervisor', 'd3');
    visit('/notifications');
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Notifications', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/page not found/i)).not.toBeInTheDocument();
  });

  it('starts every derived notification unread and counts them', async () => {
    signInAs('supervisor', 'd3');
    visit('/notifications');
    render(<App />);

    await screen.findByRole('heading', { name: 'Notifications', level: 1 });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/^\d+ unread of \d+ notification/);
    // Every item is new, so unread must equal the total.
    const [, unread, total] = status.textContent!.match(/(\d+) unread of (\d+)/)!;
    expect(unread).toBe(total);
  });

  it('marks a single notification read when it is opened, and persists that', async () => {
    signInAs('supervisor', 'd3');
    visit('/notifications');
    render(<App />);

    await screen.findByRole('heading', { name: 'Notifications', level: 1 });
    // Scoped to the notification list: the sidebar nav also renders list items.
    const list = screen.getByRole('list', { name: 'Notifications' });
    const items = within(list).getAllByRole('listitem');
    if (items.length === 0) throw new Error('Fixture produced no notifications to read');

    const firstLink = within(items[0]).getByRole('link');
    await userEvent.click(firstLink);

    expect(readSeenIds('d3')).toHaveLength(1);
  });

  it('marks everything read at once and drops the unread count to zero', async () => {
    signInAs('supervisor', 'd3');
    visit('/notifications');
    render(<App />);

    await screen.findByRole('heading', { name: 'Notifications', level: 1 });
    await userEvent.click(screen.getByRole('button', { name: /Mark all read/ }));

    expect(screen.getByRole('status')).toHaveTextContent(/^0 unread of/);
    expect(screen.queryByRole('button', { name: /Mark all read/ })).not.toBeInTheDocument();
  });

  it('restores read state across a reload', async () => {
    signInAs('supervisor', 'd3');
    visit('/notifications');
    const first = render(<App />);

    await screen.findByRole('heading', { name: 'Notifications', level: 1 });
    await userEvent.click(screen.getByRole('button', { name: /Mark all read/ }));
    first.unmount();

    render(<App />);
    await screen.findByRole('heading', { name: 'Notifications', level: 1 });
    expect(screen.getByRole('status')).toHaveTextContent(/^0 unread of/);
  });

  it('scopes notifications to the selected department', async () => {
    signInAs('officer', 'd1');
    visit('/notifications');
    const first = render(<App />);
    await screen.findByRole('heading', { name: 'Notifications', level: 1 });
    const d1Count = screen.getByRole('status').textContent;
    first.unmount();

    window.localStorage.setItem(DEPARTMENT_STORAGE_KEY, 'd5');
    render(<App />);
    await screen.findByRole('heading', { name: 'Notifications', level: 1 });

    // Different departments hold different records, so the summaries must differ or the
    // scoping is not being applied.
    expect(screen.getByRole('status').textContent).not.toBe(d1Count);
  });
});

describe('notification read-state storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('prunes ids that no longer correspond to a live notification', () => {
    const kept = writeSeenIds('d3', ['a', 'stale'], ['a', 'b']);

    expect(kept).toEqual(['a']);
    expect(readSeenIds('d3')).toEqual(['a']);
  });

  it('de-duplicates repeated ids', () => {
    expect(writeSeenIds('d3', ['a', 'a', 'b'], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('keeps each department independent, so pruning one cannot wipe another', () => {
    // Regression: read state was a flat list pruned against only the selected
    // department's live ids, so marking anything read in one department discarded
    // every other department's read state.
    writeSeenIds('d1', ['d1-item'], ['d1-item']);
    writeSeenIds('d5', ['d5-item'], ['d5-item']);

    expect(readSeenIds('d1')).toEqual(['d1-item']);
    expect(readSeenIds('d5')).toEqual(['d5-item']);
  });

  it('survives corrupted storage without throwing', () => {
    window.localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, '{not json');
    expect(readSeenIds('d3')).toEqual([]);
  });

  it('ignores a legacy flat array left by the previous format', () => {
    window.localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(['old', 'ids']));
    expect(readSeenIds('d3')).toEqual([]);
  });
});
