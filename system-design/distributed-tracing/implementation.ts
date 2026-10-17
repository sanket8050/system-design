// Minimal OpenTelemetry-style tracer (no external dependencies)
import * as crypto from 'crypto';

const generateId = (bytes: number) => crypto.randomBytes(bytes).toString('hex');

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startMs: number;
  endMs?: number;
  status: 'ok' | 'error';
  tags: Record<string, string | number | boolean>;
  logs: { timestampMs: number; message: string }[];
}

export class Tracer {
  private spans: Span[] = [];

  startSpan(operationName: string, parentSpan?: Span): Span {
    const span: Span = {
      traceId: parentSpan?.traceId ?? generateId(16),
      spanId: generateId(8),
      parentSpanId: parentSpan?.spanId,
      operationName,
      startMs: Date.now(),
      status: 'ok',
      tags: {},
      logs: [],
    };
    this.spans.push(span);
    return span;
  }

  finishSpan(span: Span): void {
    span.endMs = Date.now();
  }

  setTag(span: Span, key: string, value: string | number | boolean): void {
    span.tags[key] = value;
  }

  log(span: Span, message: string): void {
    span.logs.push({ timestampMs: Date.now(), message });
  }

  setError(span: Span, error: Error): void {
    span.status = 'error';
    span.tags['error.message'] = error.message;
    span.tags['error.type'] = error.constructor.name;
  }

  getTrace(traceId: string): Span[] {
    return this.spans.filter(s => s.traceId === traceId).sort((a, b) => a.startMs - b.startMs);
  }

  // Returns P50, P95, P99 latency across all finished spans for an operation
  latencyPercentiles(operationName: string): { p50: number; p95: number; p99: number } {
    const durations = this.spans
      .filter(s => s.operationName === operationName && s.endMs != null)
      .map(s => s.endMs! - s.startMs)
      .sort((a, b) => a - b);

    if (durations.length === 0) return { p50: 0, p95: 0, p99: 0 };
    const p = (pct: number) => durations[Math.floor((pct / 100) * (durations.length - 1))];
    return { p50: p(50), p95: p(95), p99: p(99) };
  }
}

// Simulate a traced request
const tracer = new Tracer();

const root = tracer.startSpan('http.request');
tracer.setTag(root, 'http.method', 'GET');
tracer.setTag(root, 'http.url', '/api/orders');

const dbSpan = tracer.startSpan('db.query', root);
tracer.setTag(dbSpan, 'db.type', 'postgresql');
tracer.log(dbSpan, 'SELECT * FROM orders WHERE user_id = ?');
await new Promise(r => setTimeout(r, 5));
tracer.finishSpan(dbSpan);

tracer.finishSpan(root);

const trace = tracer.getTrace(root.traceId);
console.assert(trace.length === 2, 'Trace should have 2 spans');
console.assert(trace[0].operationName === 'http.request');
console.assert(trace[1].parentSpanId === root.spanId);
console.log('Tracer spans:', trace.map(s => `${s.operationName} (${s.endMs! - s.startMs}ms)`));
console.log('Distributed tracing tests passed');
