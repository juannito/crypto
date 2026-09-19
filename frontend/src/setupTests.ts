// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom (Jest 27) no expone TextEncoder/TextDecoder, que usan react-router y el cifrado
import { TextDecoder, TextEncoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });
