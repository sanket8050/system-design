# Distributed Tracing

In a microservices architecture, a single user request may touch 10+ services. Distributed tracing makes this visible.

## Core Concepts

### Trace, Span, Context

- **Trace** – The full journey of a request across all services. Identified by `traceId`.
- **Span** – A single unit of work within a trace (one service call, one DB query). Has `spanId`, `parentSpanId`, timestamps, status, and tags.
- **Context propagation** – The `traceId` and `spanId` are passed in HTTP headers (e.g., `traceparent` per W3C spec).

### W3C Traceparent Header

```
traceparent: 00-<traceId>-<parentSpanId>-<flags>
```

## Three Pillars of Observability

| Pillar | Tool Examples | What It Answers |
|--------|---------------|-----------------|
| **Logs** | ELK Stack, Loki | What happened? |
| **Metrics** | Prometheus, Datadog | How much/how often? |
| **Traces** | Jaeger, Zipkin, OTEL | Where did it go? How long? |

## Sampling Strategies

- **Head-based sampling** – Decide at request entry whether to trace (simple, misses rare errors).
- **Tail-based sampling** – Decide after request completes (can target slow/failed requests). Used by Jaeger.
- **Adaptive sampling** – Varies rate based on traffic volume.

## Golden Signals (Google SRE)

1. **Latency** – How long do requests take? (distinguish slow errors from slow successes)
2. **Traffic** – How many requests per second?
3. **Errors** – What percentage of requests fail?
4. **Saturation** – How "full" is the service? (CPU, memory, queue depth)

## RED Method (for microservices)

- **Rate** – Requests per second
- **Errors** – Failed requests per second  
- **Duration** – Request duration distribution (P50, P95, P99)
