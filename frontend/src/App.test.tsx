import React from 'react';
import { render, screen } from '@testing-library/react';
import './i18n';
import App from './App';

jest.mock('lottie-react', () => () => null);

test('muestra las cinco secciones', () => {
  render(<App />);
  for (const name of [/share/i, /encrypt/i, /decrypt/i, /request/i, /help/i]) {
    expect(screen.getByRole('link', { name })).toBeInTheDocument();
  }
});
