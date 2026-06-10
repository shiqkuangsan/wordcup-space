import { NextResponse } from "next/server";

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function apiError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ ok: false, error: message }, { status });
}
