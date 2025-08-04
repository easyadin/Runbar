import { jest } from '@jest/globals';

describe('Foundation Tests', () => {
  it('should have working Jest setup', () => {
    expect(true).toBe(true);
  });

  it('should have working TypeScript', () => {
    const message: string = 'Hello TypeScript';
    expect(message).toBe('Hello TypeScript');
  });

  it('should have working async/await', async () => {
    const result = await Promise.resolve('async result');
    expect(result).toBe('async result');
  });

  it('should have working mocks', () => {
    const mockFn = jest.fn().mockReturnValue('mocked value');
    expect(mockFn()).toBe('mocked value');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
}); 