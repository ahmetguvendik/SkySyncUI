/**
 * OpenTelemetry frontend tracing.
 * Tarayıcıdan başlayan istekler traceparent/tracestate header'ları ile backend'e gider;
 * backend aynı trace'e devam eder. Hepsi Jaeger'da tek zincir olarak görünür.
 *
 * OTLP: Tarayıcı HTTP kullandığı için http://localhost:4318 (gRPC 4317 değil).
 * - Proxy varsa (vite.config server.proxy /otel): /otel/v1/traces kullanılır, CORS yok.
 * - Proxy yoksa: VITE_OTEL_TRACE_URL=http://localhost:4318/v1/traces (Collector'da CORS gerekir).
 * Backend: Access-Control-Expose-Headers ile traceparent ve tracestate açık olmalı.
 */

import { context, propagation, trace } from '@opentelemetry/api'
import {
  BatchSpanProcessor,
  WebTracerProvider,
} from '@opentelemetry/sdk-trace-web'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch'
import { resourceFromAttributes } from '@opentelemetry/resources'

// Dev'de proxy kullan (CORS yok); prod'da env veya doğrudan URL
const OTEL_TRACE_URL =
  import.meta.env.VITE_OTEL_TRACE_URL ??
  (import.meta.env.DEV ? '/otel/v1/traces' : 'http://localhost:4318/v1/traces')
const SERVICE_NAME = import.meta.env.VITE_OTEL_SERVICE_NAME ?? 'skysync-ui'

const resource = resourceFromAttributes({
  'service.name': SERVICE_NAME,
})

const exporter = new OTLPTraceExporter({
  url: OTEL_TRACE_URL,
})

const provider = new WebTracerProvider({
  resource,
  spanProcessors: [
    new BatchSpanProcessor(exporter, {
      maxQueueSize: 100,
      maxExportBatchSize: 10,
      scheduledDelayMillis: 500,
      exportTimeoutMillis: 30000,
    }),
  ],
})

provider.register()

/**
 * Mevcut aktif span'den W3C traceparent üretir.
 * Rezervasyon cevabında traceparent header'ı yoksa (backend expose etmiyorsa),
 * ödeme isteğinde aynı trace'e bağlanmak için kullanılır.
 */
export function getCurrentTraceparent(): string | null {
  const span = trace.getActiveSpan()
  if (!span) return null
  const ctx = span.spanContext()
  if (!ctx.traceId || !ctx.spanId) return null
  const flags = (ctx.traceFlags ?? 1).toString(16).padStart(2, '0')
  return `00-${ctx.traceId}-${ctx.spanId}-${flags}`
}

/**
 * traceparent (ve isteğe bağlı tracestate) ile verilen trace context'inde fn çalıştırır.
 * Böylece ödeme fetch'i aynı trace'e bağlanır (tek trace'te görünür).
 */
export function runWithTraceContext<T>(
  traceparent: string,
  tracestate: string | undefined,
  fn: () => T
): T {
  const carrier: Record<string, string> = { traceparent }
  if (tracestate) carrier.tracestate = tracestate
  const ctx = propagation.extract(context.active(), carrier)
  return context.with(ctx, fn)
}

function getStoredUser(): { id: string; email: string; firstName?: string; lastName?: string; role: string } | null {
  try {
    const raw = localStorage.getItem('skysync_user')
    if (!raw) return null
    return JSON.parse(raw) as { id: string; email: string; firstName?: string; lastName?: string; role: string }
  } catch {
    return null
  }
}

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      propagateTraceHeaderCorsUrls: [
        /^http:\/\/localhost(:\d+)?/,
        // /^https?:\/\/your-api\.com/,
      ],
      // Jaeger'da hangi kullanıcının istek attığını görmek için span'e user bilgisi ekle
      requestHook: (span, _request) => {
        const user = getStoredUser()
        if (!user) return
        span.setAttribute('enduser.id', user.id)
        span.setAttribute('user.email', user.email)
        span.setAttribute('user.role', user.role)
        if (user.firstName != null || user.lastName != null) {
          span.setAttribute('user.name', [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email)
        }
      },
    }),
  ],
})
