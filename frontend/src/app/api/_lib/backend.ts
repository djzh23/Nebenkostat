import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:5049";

export async function proxyBackend(request: Request, path: string): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json({ detail: "Nicht angemeldet." }, { status: 401 });
  }

  try {
    const response = await fetch(new URL(path, `${backendUrl.replace(/\/$/, "")}/`), {
      method: request.method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: request.method === "GET" ? undefined : await request.text(),
      cache: "no-store",
    });
    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json(
      { detail: "Das Backend ist nicht erreichbar. Starte den .NET-Server auf Port 5049." },
      { status: 502 },
    );
  }
}
