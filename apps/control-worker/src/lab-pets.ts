interface LabPetEnvironment {
  LAB_PET_COUNTER: DurableObjectNamespace;
  CONTROL_SITE_ORIGIN?: string;
}

interface VisitorRow extends Record<string, SqlStorageValue> {
  visitor_id: string;
  pet_count: number;
  last_petted_at: number;
}

interface TotalsRow extends Record<string, SqlStorageValue> {
  total_pets: number;
  participant_count: number;
}

interface LabPetSnapshot {
  visitor: {
    label: string;
    count: number;
  };
  totalPets: number;
  participantCount: number;
  leaders: Array<{
    label: string;
    count: number;
  }>;
}

const VISITOR_ID_PATTERN = /^xyg_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function json(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { ...JSON_HEADERS, ...init.headers },
  });
}

function anonymousLabel(visitorId: string): string {
  const schools = ["冰蓝小鱼", "月光小鱼", "云朵小鱼", "星屑小鱼", "铃兰小鱼", "薄荷小鱼"];
  let hash = 2166136261;
  for (const character of visitorId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const school = schools[Math.abs(hash) % schools.length] ?? schools[0];
  return `${school} · ${visitorId.slice(-4).toUpperCase()}`;
}

function readVisitorId(url: URL): string | undefined {
  const visitorId = url.searchParams.get("visitor") ?? undefined;
  return visitorId && VISITOR_ID_PATTERN.test(visitorId) ? visitorId : undefined;
}

export class LabPetCounter {
  private readonly sql: SqlStorage;

  constructor(state: DurableObjectState) {
    this.sql = state.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS lab_pet_visitors (
        visitor_id TEXT PRIMARY KEY,
        pet_count INTEGER NOT NULL DEFAULT 0,
        last_petted_at INTEGER NOT NULL DEFAULT 0
      )
    `);
  }

  private snapshot(visitorId: string): LabPetSnapshot {
    const visitor = this.sql.exec<VisitorRow>(
      "SELECT visitor_id, pet_count, last_petted_at FROM lab_pet_visitors WHERE visitor_id = ? LIMIT 1",
      visitorId,
    ).toArray()[0];
    const totals = this.sql.exec<TotalsRow>(`
      SELECT
        COALESCE(SUM(pet_count), 0) AS total_pets,
        COUNT(*) AS participant_count
      FROM lab_pet_visitors
    `).toArray()[0] ?? { total_pets: 0, participant_count: 0 };
    const leaders = this.sql.exec<VisitorRow>(`
      SELECT visitor_id, pet_count, last_petted_at
      FROM lab_pet_visitors
      ORDER BY pet_count DESC, last_petted_at ASC
      LIMIT 6
    `).toArray();

    return {
      visitor: {
        label: anonymousLabel(visitorId),
        count: Number(visitor?.pet_count ?? 0),
      },
      totalPets: Number(totals.total_pets),
      participantCount: Number(totals.participant_count),
      leaders: leaders.map((row) => ({
        label: anonymousLabel(row.visitor_id),
        count: Number(row.pet_count),
      })),
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const visitorId = readVisitorId(url);
    if (!visitorId) {
      return json({ error: { code: "INVALID_VISITOR", message: "匿名访客标识无效" } }, { status: 400 });
    }

    if (request.method === "POST") {
      const now = Date.now();
      this.sql.exec(`
        INSERT INTO lab_pet_visitors (visitor_id, pet_count, last_petted_at)
        VALUES (?, 1, ?)
        ON CONFLICT(visitor_id) DO UPDATE SET
          pet_count = pet_count + 1,
          last_petted_at = excluded.last_petted_at
      `, visitorId, now);
    } else if (request.method !== "GET") {
      return json({ error: { code: "METHOD_NOT_ALLOWED", message: "请求方式不支持" } }, {
        status: 405,
        headers: { Allow: "GET, POST" },
      });
    }

    return json(this.snapshot(visitorId));
  }
}

export async function handleLabPetRequest(request: Request, env: LabPetEnvironment): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/lab/pets") {
    return json({ error: { code: "NOT_FOUND", message: "实验记录接口不存在" } }, { status: 404 });
  }

  if (request.method === "POST") {
    const expectedOrigin = env.CONTROL_SITE_ORIGIN ?? url.origin;
    if (request.headers.get("Origin") !== expectedOrigin) {
      return json({ error: { code: "FORBIDDEN", message: "请求来源无效" } }, { status: 403 });
    }
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
      return json({ error: { code: "INVALID_CONTENT_TYPE", message: "请求格式无效" } }, { status: 415 });
    }
  }

  let visitorId = readVisitorId(url);
  if (request.method === "POST") {
    try {
      const body = await request.json() as { visitor?: unknown };
      visitorId = typeof body.visitor === "string" && VISITOR_ID_PATTERN.test(body.visitor)
        ? body.visitor
        : undefined;
    } catch {
      visitorId = undefined;
    }
  }

  if (!visitorId) {
    return json({ error: { code: "INVALID_VISITOR", message: "匿名访客标识无效" } }, { status: 400 });
  }

  const id = env.LAB_PET_COUNTER.idFromName("xiaoyugan-global-pet-counter");
  const counter = env.LAB_PET_COUNTER.get(id);
  return counter.fetch(new Request(`https://lab-pet-counter.internal/?visitor=${encodeURIComponent(visitorId)}`, {
    method: request.method,
  }));
}
