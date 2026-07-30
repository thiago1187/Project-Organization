import { vi } from "vitest";
import { cookies, headers } from "next/headers";

// Helper reaproveitado pelos testes que exercitam o código real de
// src/servidor/acesso.ts e src/servidor/sessao.ts (nível 1 e 2 do plano de
// testes) — só a fronteira de I/O (`next/headers`) é mockada; a lógica de
// acesso em si roda de verdade. Cada arquivo de teste que usa isto ainda
// precisa da chamada
//   vi.mock("next/headers", () => ({ headers: vi.fn(), cookies: vi.fn() }));
// no próprio arquivo — vi.mock só é hoisted no arquivo onde é escrito, não
// através de um import.

/** Configura `headers()` para devolver os cabeçalhos indicados. */
export function mockHeaders(mapa: Record<string, string> = {}): void {
  vi.mocked(headers).mockResolvedValue(new Headers(mapa) as never);
}

/** Configura `cookies()` para devolver os cookies indicados (nome → valor). */
export function mockCookies(mapa: Record<string, string> = {}): void {
  const store = {
    get: (nome: string) => (nome in mapa ? { name: nome, value: mapa[nome] } : undefined),
  };
  vi.mocked(cookies).mockResolvedValue(store as never);
}
