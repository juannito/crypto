import React from 'react';
import { render, screen, within } from '@testing-library/react';
import './i18n';
import App from './App';

jest.mock('lottie-react', () => () => null);

test('muestra las cinco pestañas y los accesos del header', () => {
  render(<App />);
  const tabs = within(screen.getByRole('navigation'));
  for (const name of [/^share$/i, /^encrypt$/i, /^decrypt$/i, /^request$/i, /^help$/i]) {
    expect(tabs.getByRole('link', { name })).toBeInTheDocument();
  }
  expect(screen.getByRole('link', { name: /my requests/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /receipts/i })).toBeInTheDocument();
});
