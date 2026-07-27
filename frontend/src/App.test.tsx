import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';

describe('application routes', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, '', '/login');
  });

  it('renders the registered login route', async () => {
    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Sign in to your account' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
