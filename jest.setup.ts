import '@testing-library/jest-dom';

if (typeof globalThis.Response === 'undefined') {
  class PolyfillResponse {
    readonly ok: boolean;
    readonly status: number;
    private readonly bodyText: string;

    constructor(body: string, init?: { status?: number }) {
      this.status = init?.status ?? 200;
      this.ok = this.status >= 200 && this.status < 300;
      this.bodyText = body;
    }

    async json(): Promise<unknown> {
      return JSON.parse(this.bodyText);
    }

    async text(): Promise<string> {
      return this.bodyText;
    }
  }

  Object.defineProperty(globalThis, 'Response', {
    value: PolyfillResponse,
    configurable: true,
    writable: true,
  });
}

if (typeof globalThis.fetch === 'undefined') {
  Object.defineProperty(globalThis, 'fetch', {
    value: () => Promise.reject(new Error('Unmocked fetch call in jsdom test')),
    configurable: true,
    writable: true,
  });
}
