import '@testing-library/jest-dom';

// Mock scrollIntoView which is not implemented in jsdom
// eslint-disable-next-line @typescript-eslint/no-empty-function
Element.prototype.scrollIntoView = function () {};

// Polyfill Web APIs not available in jsdom
if (typeof globalThis.Request === 'undefined') {
  class RequestPolyfill {
    private _url: string;
    private _method: string;
    private _headers: Map<string, string>;
    private _body: any;

    constructor(input: string | RequestPolyfill, init?: any) {
      this._url = typeof input === 'string' ? input : input._url || String(input);
      this._method = init?.method || 'GET';
      this._headers = new Map();
      this._body = init?.body || null;
      if (init?.headers) {
        if (init.headers instanceof Map) {
          init.headers.forEach((v: string, k: string) => this._headers.set(k, v));
        } else if (typeof init.headers === 'object') {
          Object.entries(init.headers).forEach(([k, v]) => this._headers.set(k, String(v)));
        }
      }
    }

    get url() { return this._url; }
    get method() { return this._method; }
    get headers() { return this._headers; }
    get body() { return this._body; }
    clone() { return new RequestPolyfill(this._url, { method: this._method, headers: Object.fromEntries(this._headers) }); }
  }
  globalThis.Request = RequestPolyfill as any;
}

if (typeof globalThis.Response === 'undefined') {
  class ResponsePolyfill {
    private _status: number;
    private _headers: Map<string, string>;
    private _body: any;

    constructor(body?: any, init?: any) {
      this._body = body;
      this._status = init?.status || 200;
      this._headers = new Map();
      if (init?.headers) {
        if (typeof init.headers === 'object' && !(init.headers instanceof Map)) {
          Object.entries(init.headers).forEach(([k, v]) => this._headers.set(k, String(v)));
        }
      }
    }

    get status() { return this._status; }
    get headers() { return this._headers; }
    get body() { return this._body; }
    get ok() { return this._status >= 200 && this._status < 300; }
    json() { return Promise.resolve(typeof this._body === 'string' ? JSON.parse(this._body) : this._body); }
    text() { return Promise.resolve(typeof this._body === 'string' ? this._body : JSON.stringify(this._body)); }

    static redirect(url: string, status?: number) {
      return new ResponsePolyfill(null, { status: status || 302, headers: { Location: url } });
    }
    static json(data: any, init?: any) {
      return new ResponsePolyfill(JSON.stringify(data), { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
    }
  }
  globalThis.Response = ResponsePolyfill as any;
}
