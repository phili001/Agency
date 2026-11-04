/**
 * Doble en memoria del cliente de Supabase para las pruebas de `node --test`.
 *
 * Implementa solo lo que usa el código de `src/lib/crm` y `src/lib/agenda`:
 * select/insert/update/upsert/delete con filtros eq, neq, in, is, ilike, gte,
 * lt, lte, gt, `or` sencillo, order, range, limit, single/maybeSingle y count.
 * Las restricciones únicas se declaran por tabla para simular el error 23505.
 * No comprueba RLS: el servicio usa service_role, así que el aislamiento entre
 * empresas tiene que venir de los filtros del propio código, que es justo lo
 * que prueban los tests de aislamiento.
 */

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;
type Result = {
  count?: number | null;
  data: unknown;
  error: { code?: string; message: string } | null;
};

export type FakeTables = Record<string, Row[]>;
export type UniqueKeys = Record<string, Array<(row: Row) => string>>;

let idCounter = 0;

export function fakeId(prefix = "id") {
  idCounter += 1;
  return `${prefix}-${idCounter.toString().padStart(6, "0")}`;
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function compare(a: unknown, b: unknown) {
  if (a === b) {
    return 0;
  }
  // Como Postgres con timestamptz: "…00Z" y "…00.000Z" son el mismo instante.
  if (typeof a === "string" && typeof b === "string" && ISO_INSTANT.test(a) && ISO_INSTANT.test(b)) {
    return Math.sign(new Date(a).getTime() - new Date(b).getTime());
  }
  if (a === null || a === undefined) {
    return 1;
  }
  if (b === null || b === undefined) {
    return -1;
  }
  return String(a) < String(b) ? -1 : 1;
}

function likeToRegExp(pattern: string) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function parseOr(expression: string): Filter {
  const parts = expression.split(",").map((part) => {
    const [column, operator, ...rest] = part.split(".");
    const value = rest.join(".");

    if (operator === "eq") {
      return (row: Row) => String(row[column]) === value;
    }
    if (operator === "is" && value === "null") {
      return (row: Row) => row[column] === null || row[column] === undefined;
    }
    if (operator === "ilike") {
      const regExp = likeToRegExp(value);
      return (row: Row) => typeof row[column] === "string" && regExp.test(row[column] as string);
    }
    throw new Error(`fake-supabase: operador or no soportado: ${part}`);
  });

  return (row) => parts.some((test) => test(row));
}

class FakeQuery implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orders: Array<{ ascending: boolean; column: string }> = [];
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private limitCount: number | null = null;
  private mode: "delete" | "insert" | "select" | "update" | "upsert" = "select";
  private payload: Row[] = [];
  private patch: Row = {};
  private returning = false;
  private wantCount = false;
  private headOnly = false;
  private singleMode: "maybe" | "single" | null = null;
  private upsertConflict: string[] = [];
  private readonly db: FakeSupabase;
  private readonly table: string;

  constructor(db: FakeSupabase, table: string) {
    this.db = db;
    this.table = table;
  }

  select(columns = "*", options?: { count?: string; head?: boolean }) {
    // Las columnas no se recortan: el doble devuelve la fila entera.
    void columns;
    if (this.mode === "select") {
      this.wantCount = Boolean(options?.count);
      this.headOnly = Boolean(options?.head);
    } else {
      this.returning = true;
    }
    return this;
  }

  insert(rows: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  upsert(rows: Row | Row[], options?: { onConflict?: string }) {
    this.mode = "upsert";
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.upsertConflict = (options?.onConflict ?? "id").split(",").map((item) => item.trim());
    return this;
  }

  update(patch: Row) {
    this.mode = "update";
    this.patch = patch;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    const path = column.split(/->>?/);
    this.filters.push((row) => {
      let current: unknown = row;
      for (const key of path) {
        current = current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined;
      }
      return current === value;
    });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  is(column: string, value: null | boolean) {
    this.filters.push((row) =>
      value === null ? row[column] === null || row[column] === undefined : row[column] === value,
    );
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    if (operator !== "is" || value !== null) {
      throw new Error(`fake-supabase: not(${operator}) no soportado`);
    }
    this.filters.push((row) => row[column] !== null && row[column] !== undefined);
    return this;
  }

  ilike(column: string, pattern: string) {
    const regExp = likeToRegExp(pattern);
    this.filters.push((row) => typeof row[column] === "string" && regExp.test(row[column] as string));
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push((row) => compare(row[column], value) >= 0);
    return this;
  }

  gt(column: string, value: unknown) {
    this.filters.push((row) => compare(row[column], value) > 0);
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push((row) => compare(row[column], value) <= 0);
    return this;
  }

  lt(column: string, value: unknown) {
    this.filters.push((row) => compare(row[column], value) < 0);
    return this;
  }

  or(expression: string) {
    this.filters.push(parseOr(expression));
    return this;
  }

  contains(column: string, values: unknown[]) {
    this.filters.push((row) => Array.isArray(row[column]) && values.every((v) => (row[column] as unknown[]).includes(v)));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ ascending: options?.ascending !== false, column });
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected);
  }

  private matches(row: Row) {
    return this.filters.every((test) => test(row));
  }

  private finish(rows: Row[], count?: number): Result {
    this.db.log.push({ filters: this.filters.length, mode: this.mode, table: this.table });

    if (this.singleMode) {
      if (rows.length === 0) {
        return this.singleMode === "single"
          ? { data: null, error: { code: "PGRST116", message: "No rows" } }
          : { data: null, error: null };
      }
      if (rows.length > 1) {
        return { data: null, error: { code: "PGRST116", message: "Multiple rows" } };
      }
      return { data: { ...rows[0] }, error: null };
    }

    if (this.headOnly) {
      return { count: count ?? rows.length, data: null, error: null };
    }

    return {
      count: this.wantCount ? (count ?? rows.length) : null,
      data: rows.map((row) => ({ ...row })),
      error: null,
    };
  }

  private execute(): Result {
    const tableRows = this.db.table(this.table);

    if (this.mode === "insert" || this.mode === "upsert") {
      const inserted: Row[] = [];

      for (const input of this.payload) {
        const row: Row = { ...this.db.defaults(this.table), ...input };

        if (this.mode === "upsert") {
          const existing = tableRows.find((candidate) =>
            this.upsertConflict.every((column) => candidate[column] === row[column]),
          );
          if (existing) {
            Object.assign(existing, input);
            inserted.push(existing);
            continue;
          }
        }

        const conflict = this.db.violatesUnique(this.table, row);
        if (conflict) {
          return { data: null, error: { code: "23505", message: `duplicate key (${conflict})` } };
        }
        tableRows.push(row);
        inserted.push(row);
      }

      return this.returning || this.singleMode ? this.finish(inserted) : { data: null, error: null };
    }

    const matched = tableRows.filter((row) => this.matches(row));

    if (this.mode === "update") {
      for (const row of matched) {
        const next = { ...row, ...this.patch };
        const conflict = this.db.violatesUnique(this.table, next, row);
        if (conflict) {
          return { data: null, error: { code: "23505", message: `duplicate key (${conflict})` } };
        }
      }
      for (const row of matched) {
        Object.assign(row, this.patch);
      }
      return this.returning || this.singleMode ? this.finish(matched) : { data: null, error: null };
    }

    if (this.mode === "delete") {
      this.db.tables[this.table] = tableRows.filter((row) => !matched.includes(row));
      this.db.cascade(this.table, matched);
      return this.returning || this.singleMode ? this.finish(matched) : { data: null, error: null };
    }

    let rows = [...matched];
    for (const { ascending, column } of [...this.orders].reverse()) {
      rows.sort((a, b) => (ascending ? compare(a[column], b[column]) : compare(b[column], a[column])));
    }
    const total = rows.length;
    if (this.rangeFrom !== null && this.rangeTo !== null) {
      rows = rows.slice(this.rangeFrom, this.rangeTo + 1);
    }
    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }
    return this.finish(rows, total);
  }
}

export type CascadeRule = { childColumn: string; childTable: string; parentTable: string };

export class FakeSupabase {
  readonly log: Array<{ filters: number; mode: string; table: string }> = [];
  readonly rpcCalls: Array<{ args: Row; name: string }> = [];
  rpcHandler: ((name: string, args: Row) => Result) | null = null;
  readonly tables: FakeTables;
  private readonly uniques: UniqueKeys;
  private readonly cascades: CascadeRule[];

  constructor(tables: FakeTables = {}, uniques: UniqueKeys = {}, cascades: CascadeRule[] = []) {
    this.tables = tables;
    this.uniques = uniques;
    this.cascades = cascades;
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }

  rpc(name: string, args: Row) {
    this.rpcCalls.push({ args, name });
    const result = this.rpcHandler?.(name, args) ?? {
      data: null,
      error: { message: `rpc ${name} sin handler` },
    };
    return Promise.resolve(result);
  }

  table(name: string) {
    this.tables[name] ??= [];
    return this.tables[name];
  }

  defaults(table: string): Row {
    const now = new Date().toISOString();
    const base: Row = { created_at: now };
    if (table !== "crm_contact_tags" && table !== "offered_slots") {
      base.id = fakeId(table);
    }
    return base;
  }

  violatesUnique(table: string, row: Row, ignore?: Row) {
    for (const key of this.uniques[table] ?? []) {
      const value = key(row);
      const clash = this.table(table).some((other) => other !== ignore && other !== row && key(other) === value);
      if (clash) {
        return value;
      }
    }
    return null;
  }

  cascade(parentTable: string, removed: Row[]) {
    for (const rule of this.cascades.filter((item) => item.parentTable === parentTable)) {
      const ids = new Set(removed.map((row) => row.id));
      const children = this.table(rule.childTable).filter((row) => ids.has(row[rule.childColumn]));
      this.tables[rule.childTable] = this.table(rule.childTable).filter((row) => !ids.has(row[rule.childColumn]));
      this.cascade(rule.childTable, children);
    }
  }
}

/** Restricciones únicas y cascadas del esquema del CRM (ver crm_core). */
export function createCrmFake(tables: FakeTables = {}) {
  return new FakeSupabase(
    tables,
    {
      contacts: [(row) => `${row.workspace_id}|${row.phone_e164}`],
      crm_contact_tags: [(row) => `${row.contact_id}|${row.tag_id}`],
      crm_custom_fields: [(row) => `${row.workspace_id}|${row.key}`],
      crm_pipeline_stages: [(row) => `${row.workspace_id}|${String(row.name).toLowerCase()}`],
      crm_tags: [(row) => `${row.workspace_id}|${String(row.name).toLowerCase()}`],
      agendas: [(row) => `${row.workspace_id}|${String(row.name).toLowerCase()}`],
      offered_slots: [(row) => `${row.conversation_id}|${row.agenda_id}|${row.starts_at}`],
    },
    [
      { childColumn: "contact_id", childTable: "crm_contact_tags", parentTable: "contacts" },
      { childColumn: "tag_id", childTable: "crm_contact_tags", parentTable: "crm_tags" },
      { childColumn: "contact_id", childTable: "crm_contact_notes", parentTable: "contacts" },
      { childColumn: "contact_id", childTable: "crm_contact_tasks", parentTable: "contacts" },
      { childColumn: "contact_id", childTable: "crm_contact_activity", parentTable: "contacts" },
      { childColumn: "contact_id", childTable: "appointments", parentTable: "contacts" },
      { childColumn: "agenda_id", childTable: "schedule_blocks", parentTable: "agendas" },
      { childColumn: "conversation_id", childTable: "offered_slots", parentTable: "conversations" },
    ],
  );
}
