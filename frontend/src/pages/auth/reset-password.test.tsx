import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '@/App';
import {
  PASSWORD_MIN_LENGTH,
  RESET_CONSUMED_STORAGE_KEY,
  classifyResetToken,
  consumeResetToken,
  parseResetToken,
  validateNewPassword,
} from '@/lib/password-reset';
import { mockRepository } from '@/lib/mock-repository';

const HOUR = 60 * 60;
const nowSeconds = () => Math.floor(Date.now() / 1000);

function validToken(nonce = 'noncevalue') {
  return `officer.${nowSeconds() + HOUR}.${nonce}`;
}
function expiredToken(nonce = 'noncevalue') {
  return `officer.${nowSeconds() - HOUR}.${nonce}`;
}

function visit(path: string) {
  window.history.pushState({}, '', path);
}

describe('recovery token classification', () => {
  beforeEach(() => window.localStorage.clear());

  it('reports a missing token when the page is opened without one', () => {
    expect(classifyResetToken(null)).toBe('missing');
    expect(classifyResetToken('')).toBe('missing');
  });

  it('reports a malformed token for anything that is not the expected shape', () => {
    expect(classifyResetToken('broken')).toBe('malformed');
    expect(classifyResetToken('officer.notanumber.nonce')).toBe('malformed');
    expect(classifyResetToken('officer.1700000000')).toBe('malformed');
  });

  it('reports an expired token once the expiry has passed', () => {
    expect(classifyResetToken(expiredToken())).toBe('expired');
  });

  it('reports a used token after the link has completed a reset', () => {
    const token = validToken('usedonce');
    expect(classifyResetToken(token)).toBe('valid');

    consumeResetToken('usedonce');
    expect(classifyResetToken(token)).toBe('used');
  });

  it('prefers "used" over "expired" so the message names the real cause', () => {
    consumeResetToken('bothnonce');
    expect(classifyResetToken(expiredToken('bothnonce'))).toBe('used');
  });

  it('parses the id, expiry, and nonce out of a well-formed token', () => {
    expect(parseResetToken('officer.1700000000.abcdef')).toEqual({
      id: 'officer',
      expiresAt: 1700000000,
      nonce: 'abcdef',
    });
  });
});

describe('new-password rules', () => {
  it('requires the minimum length', () => {
    expect(validateNewPassword('Ab1', 'Ab1')).toMatch(
      new RegExp(`at least ${PASSWORD_MIN_LENGTH} characters`),
    );
  });

  it('requires mixed case and a number', () => {
    expect(validateNewPassword('alllowercase1', 'alllowercase1')).toMatch(/uppercase/i);
    expect(validateNewPassword('NoNumbersHere', 'NoNumbersHere')).toMatch(/number/i);
  });

  it('requires the confirmation to match', () => {
    expect(validateNewPassword('ValidPass123', 'ValidPass124')).toMatch(/must match/i);
  });

  it('accepts a compliant password', () => {
    expect(validateNewPassword('ValidPass123', 'ValidPass123')).toBeNull();
  });
});

describe('reset-password screen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRepository.reset();
  });

  it('is reachable without a session instead of bouncing to login', async () => {
    visit(`/reset-password?token=${validToken()}`);
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Set a new password', level: 1 }),
    ).toBeInTheDocument();
  });

  it('explains a missing token and offers a new link', async () => {
    visit('/reset-password');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'No recovery link' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Request a new link/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('explains a malformed token', async () => {
    visit('/reset-password?token=broken');
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'This link is not readable' }),
    ).toBeInTheDocument();
  });

  it('explains an expired token', async () => {
    visit(`/reset-password?token=${expiredToken()}`);
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'This link has expired' }),
    ).toBeInTheDocument();
  });

  it('explains a reused token', async () => {
    consumeResetToken('spentnonce');
    visit(`/reset-password?token=${validToken('spentnonce')}`);
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'This link has already been used' }),
    ).toBeInTheDocument();
  });

  it('rejects a weak password inline without consuming the link', async () => {
    visit(`/reset-password?token=${validToken('keepme')}`);
    render(<App />);

    await screen.findByRole('heading', { name: 'Set a new password', level: 1 });
    await userEvent.type(screen.getByLabelText('New password'), 'short1A');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'short1A');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 10 characters/);
    expect(window.localStorage.getItem(RESET_CONSUMED_STORAGE_KEY)).toBeNull();
  });

  it('rejects a mismatched confirmation', async () => {
    visit(`/reset-password?token=${validToken()}`);
    render(<App />);

    await screen.findByRole('heading', { name: 'Set a new password', level: 1 });
    await userEvent.type(screen.getByLabelText('New password'), 'ValidPass123');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'ValidPass999');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/must match/i);
  });

  it('completes the reset and burns the link so it cannot be replayed', async () => {
    const token = validToken('burnme');
    visit(`/reset-password?token=${token}`);
    render(<App />);

    await screen.findByRole('heading', { name: 'Set a new password', level: 1 });
    await userEvent.type(screen.getByLabelText('New password'), 'ValidPass123');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'ValidPass123');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(
      await screen.findByRole('heading', { name: 'Password updated' }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(classifyResetToken(token)).toBe('used');
  });

  it('toggles password visibility with an accessible control', async () => {
    visit(`/reset-password?token=${validToken()}`);
    render(<App />);

    await screen.findByRole('heading', { name: 'Set a new password', level: 1 });
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'text');
  });
});
