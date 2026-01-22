import { NextResponse } from "next/server";
import { canMarkTaskDone } from "@/lib/roles";
import { getSession } from "@/lib/session";

export async function POST(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  if (!canMarkTaskDone(session.role)) {
    return NextResponse.json(
      { error: "You do not have permission to mark tasks as done." },
      { status: 403 }
    );
  }

  const body = await request.json();

  return NextResponse.json({
    ok: true,
    task: body?.task ?? null,
  });
}
