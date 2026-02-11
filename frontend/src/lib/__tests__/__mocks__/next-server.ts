/**
 * Mock for next/server used in middleware tests under jsdom.
 * Provides NextRequest and NextResponse with enough fidelity
 * for the middleware to run in a test environment.
 */

export class NextURL {
  private _url: URL;
  
  constructor(input: string, base?: string) {
    this._url = new URL(input, base || 'http://localhost:3000');
  }

  get href() { return this._url.href; }
  set href(v: string) { this._url.href = v; }
  get pathname() { return this._url.pathname; }
  set pathname(v: string) { this._url.pathname = v; }
  get search() { return this._url.search; }
  set search(v: string) { this._url.search = v; }
  get searchParams() { return this._url.searchParams; }
  get host() { return this._url.host; }
  set host(v: string) { this._url.host = v; }
  get protocol() { return this._url.protocol; }
  get origin() { return this._url.origin; }

  clone() {
    return new NextURL(this._url.href);
  }

  toString() {
    return this._url.href;
  }
}

export class NextRequest {
  url: string;
  method: string;
  nextUrl: NextURL;
  headers: Map<string, string>;
  cookies: {
    get: (name: string) => { name: string; value: string } | undefined;
    getAll: () => { name: string; value: string }[];
    set: (name: string, value: string) => void;
    delete: (name: string) => void;
    has: (name: string) => boolean;
  };
  private _cookies: Map<string, string>;

  constructor(input: string | URL, init?: any) {
    const urlStr = typeof input === 'string' ? input : input.toString();
    this.url = urlStr;
    this.method = init?.method || 'GET';
    this.nextUrl = new NextURL(urlStr);
    this.headers = new Map();
    this._cookies = new Map();

    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v: string, k: string) => this.headers.set(k.toLowerCase(), v));
      } else if (init.headers instanceof Map) {
        init.headers.forEach((v: string, k: string) => this.headers.set(k.toLowerCase(), v));
      } else if (typeof init.headers === 'object') {
        Object.entries(init.headers).forEach(([k, v]) => this.headers.set(k.toLowerCase(), String(v)));
      }
    }

    // Parse cookies from cookie header
    const cookieHeader = this.headers.get('cookie') || '';
    if (cookieHeader) {
      cookieHeader.split(';').forEach(pair => {
        const [name, ...rest] = pair.trim().split('=');
        if (name) {
          this._cookies.set(name.trim(), rest.join('=').trim());
        }
      });
    }

    const self = this;
    this.cookies = {
      get: (name: string) => {
        const value = self._cookies.get(name);
        return value !== undefined ? { name, value } : undefined;
      },
      getAll: () => Array.from(self._cookies.entries()).map(([name, value]) => ({ name, value })),
      set: (name: string, value: string) => { self._cookies.set(name, value); },
      delete: (name: string) => { self._cookies.delete(name); },
      has: (name: string) => self._cookies.has(name),
    };
  }

  clone() {
    const headers: Record<string, string> = {};
    this.headers.forEach((v, k) => { headers[k] = v; });
    return new NextRequest(this.url, { method: this.method, headers });
  }
}

export class NextResponse {
  status: number;
  headers: Map<string, string>;
  url: string;
  private _body: any;

  constructor(body?: any, init?: any) {
    this._body = body;
    this.status = init?.status || 200;
    this.headers = new Map();
    this.url = init?.url || '';
    if (init?.headers) {
      if (init.headers instanceof Map) {
        init.headers.forEach((v: string, k: string) => this.headers.set(k.toLowerCase(), v));
      } else if (init.headers instanceof Headers) {
        init.headers.forEach((v: string, k: string) => this.headers.set(k.toLowerCase(), v));
      } else if (typeof init.headers === 'object') {
        Object.entries(init.headers).forEach(([k, v]) => this.headers.set(k.toLowerCase(), String(v)));
      }
    }
  }

  get ok() { return this.status >= 200 && this.status < 300; }
  
  async json() {
    if (typeof this._body === 'string') return JSON.parse(this._body);
    return this._body;
  }

  async text() {
    if (typeof this._body === 'string') return this._body;
    return JSON.stringify(this._body);
  }

  static next(init?: any) {
    const response = new NextResponse(null, { status: 200, ...init });
    if (init?.headers) {
      if (typeof init.headers === 'object' && !(init.headers instanceof Map)) {
        Object.entries(init.headers).forEach(([k, v]) => response.headers.set(k.toLowerCase(), String(v)));
      }
    }
    return response;
  }

  static redirect(url: string | URL, init?: number | { status?: number }) {
    const urlStr = typeof url === 'string' ? url : url.toString();
    const statusCode = typeof init === 'number' ? init : (init?.status || 307);
    const response = new NextResponse(null, { status: statusCode });
    response.headers.set('location', urlStr);
    response.url = urlStr;
    return response;
  }

  static rewrite(url: string | URL, init?: any) {
    const urlStr = typeof url === 'string' ? url : url.toString();
    const response = new NextResponse(null, { status: 200, ...init });
    response.headers.set('x-middleware-rewrite', urlStr);
    response.url = urlStr;
    return response;
  }

  static json(data: any, init?: any) {
    return new NextResponse(JSON.stringify(data), {
      status: init?.status || 200,
      headers: { 'content-type': 'application/json', ...(init?.headers || {}) }
    });
  }
}
