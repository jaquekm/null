/**
 * Cliente Supabase falso, em memória, só com o subconjunto de operações que
 * este projeto usa (`select`/`eq`/`is`/`in`/`contains`/`lt`/`lte`/`gt`/`gte`/
 * `order`/`limit`/`insert`/`update`/`delete`/`maybeSingle`/`single`, mais
 * `count` no `select`).
 * Nasceu pros testes de `features/packs` (5.2: `install.ts`/`uninstall.ts`/
 * `export.ts`) e é reaproveitado por qualquer feature que precise simular
 * várias tabelas encadeadas num teste de unidade — não é um emulador
 * genérico do Postgrest.
 */

type Row = Record<string, unknown>;
type PgError = { code?: string; message: string };
type PgResult = { data: unknown; error: PgError | null; count?: number };

class FakeQuery implements PromiseLike<PgResult> {
  private filters: ((row: Row) => boolean)[] = [];
  private selectCount = false;
  private pendingInsert: Row[] | null = null;
  private pendingUpsert: { rows: Row[]; conflictFields: string[] } | null = null;
  private pendingUpdate: Row | null = null;
  private pendingDelete = false;
  private orderField: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;

  constructor(
    private rows: Row[],
    private replaceRows: (rows: Row[]) => void,
    private generateId: () => string,
    private uniqueFields: string[],
  ) {}

  select(_columns?: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.count) this.selectCount = true;
    return this;
  }
  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value);
    return this;
  }
  is(field: string, value: null) {
    this.filters.push((row) => (row[field] ?? null) === value);
    return this;
  }
  in(field: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }
  /** Comparação lexicográfica basta pros usos de hoje — sempre timestamptz ISO 8601 (7.9, jobs de limpeza), nunca número. */
  lt(field: string, value: unknown) {
    this.filters.push((row) => (row[field] as string | number) < (value as string | number));
    return this;
  }
  lte(field: string, value: unknown) {
    this.filters.push((row) => (row[field] as string | number) <= (value as string | number));
    return this;
  }
  gt(field: string, value: unknown) {
    this.filters.push((row) => (row[field] as string | number) > (value as string | number));
    return this;
  }
  gte(field: string, value: unknown) {
    this.filters.push((row) => (row[field] as string | number) >= (value as string | number));
    return this;
  }
  /**
   * Aproximação rasa do `@>` do Postgres — dois casos: coluna `uuid[]`/array
   * (`value` também é array, ex.: `reminders.contact_ids @> ARRAY[id]`,
   * 7.7 LGPD — checa que todo elemento de `value` está no array da linha) e
   * coluna jsonb/objeto (`value` é um Record, ex.: `properties @> { _import_id }`,
   * 7.5 — checa as chaves de `value` contra o objeto da coluna). Suficiente
   * pros usos de hoje, não é um emulador de Postgrest de verdade.
   */
  contains(field: string, value: Record<string, unknown> | unknown[]) {
    this.filters.push((row) => {
      const target = row[field];
      if (Array.isArray(value)) {
        return Array.isArray(target) && value.every((item) => target.includes(item));
      }
      if (!target || typeof target !== "object" || Array.isArray(target)) return false;
      return Object.entries(value).every(([key, val]) => (target as Record<string, unknown>)[key] === val);
    });
    return this;
  }
  order(field: string, opts?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  insert(row: Row | Row[]) {
    this.pendingInsert = Array.isArray(row) ? row : [row];
    return this;
  }
  upsert(row: Row | Row[], opts?: { onConflict?: string }) {
    this.pendingUpsert = {
      rows: Array.isArray(row) ? row : [row],
      conflictFields: opts?.onConflict ? opts.onConflict.split(",").map((f) => f.trim()) : ["id"],
    };
    return this;
  }
  update(patch: Row) {
    this.pendingUpdate = patch;
    return this;
  }
  delete() {
    this.pendingDelete = true;
    return this;
  }

  private matched(): Row[] {
    return this.rows.filter((row) => this.filters.every((filter) => filter(row)));
  }

  private applyOrderLimit(rows: Row[]): Row[] {
    let out = rows;
    if (this.orderField) {
      const field = this.orderField;
      out = [...out].sort((a, b) => {
        const av = Number(a[field] ?? 0);
        const bv = Number(b[field] ?? 0);
        return this.orderAsc ? av - bv : bv - av;
      });
    }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    return out;
  }

  private execute(): PgResult {
    if (this.pendingInsert) {
      const inserted: Row[] = [];
      for (const candidate of this.pendingInsert) {
        for (const field of this.uniqueFields) {
          const value = candidate[field];
          if (value != null && this.rows.some((row) => row[field] === value)) {
            return { data: null, error: { code: "23505", message: `duplicate ${field}` } };
          }
        }
        const row = { id: this.generateId(), ...candidate };
        this.rows.push(row);
        inserted.push(row);
      }
      return { data: inserted.length === 1 ? inserted[0] : inserted, error: null };
    }
    if (this.pendingUpsert) {
      const { rows: candidates, conflictFields } = this.pendingUpsert;
      const result: Row[] = [];
      for (const candidate of candidates) {
        const existing = this.rows.find((row) => conflictFields.every((field) => row[field] === candidate[field]));
        if (existing) {
          Object.assign(existing, candidate);
          result.push(existing);
        } else {
          const row = { id: this.generateId(), ...candidate };
          this.rows.push(row);
          result.push(row);
        }
      }
      return { data: result.length === 1 ? result[0] : result, error: null };
    }
    if (this.pendingUpdate) {
      const matched = this.matched();
      for (const row of matched) Object.assign(row, this.pendingUpdate);
      return { data: matched, error: null };
    }
    if (this.pendingDelete) {
      const matched = this.matched();
      this.replaceRows(this.rows.filter((row) => !matched.includes(row)));
      return { data: matched, error: null };
    }
    const matched = this.applyOrderLimit(this.matched());
    return { data: matched, error: null, count: this.selectCount ? this.matched().length : undefined };
  }

  maybeSingle(): Promise<PgResult> {
    const result = this.execute();
    const arr = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    return Promise.resolve({ ...result, data: arr[0] ?? null });
  }

  single(): Promise<PgResult> {
    const result = this.execute();
    if (result.error) return Promise.resolve(result);
    const arr = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
    if (!arr[0]) return Promise.resolve({ data: null, error: { message: "not found" } });
    return Promise.resolve({ ...result, data: arr[0] });
  }

  then<T1 = PgResult, T2 = never>(
    onfulfilled?: ((value: PgResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export class FakeSupabase {
  private tables = new Map<string, Row[]>();
  private counters = new Map<string, number>();
  private uniqueFields: Record<string, string[]>;
  private idGenerator: (table: string, n: number) => string;

  /**
   * `idGenerator` é opcional — o padrão (`"tabela-N"`) serve pra quase todo
   * teste. Só passe um customizado (ex.: uuid v4-like) quando o código sob
   * teste valida o formato do id de verdade (`z.string().uuid()`, ex.:
   * `rollupRelationTypeId`/`create_item.typeId` de automações) — nesse caso
   * `"tabela-N"` faz a validação falhar mesmo com a lógica correta.
   */
  constructor(uniqueFields: Record<string, string[]> = {}, idGenerator: (table: string, n: number) => string = (table, n) => `${table}-${n}`) {
    this.uniqueFields = uniqueFields;
    this.idGenerator = idGenerator;
  }

  seed(table: string, rows: Row[]) {
    this.tables.set(table, [...rows]);
  }

  rowsOf(table: string): Row[] {
    return this.tables.get(table) ?? [];
  }

  from(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    const rows = this.tables.get(table)!;
    const nextId = () => {
      const n = (this.counters.get(table) ?? 0) + 1;
      this.counters.set(table, n);
      return this.idGenerator(table, n);
    };
    return new FakeQuery(rows, (next) => this.tables.set(table, next), nextId, this.uniqueFields[table] ?? []);
  }
}

/** Uuid v4-like determinístico a partir de um contador — pra `idGenerator` quando o código sob teste exige `.uuid()` de verdade. */
export function fakeUuid(n: number): string {
  const hex = n.toString(16).padStart(8, "0");
  return `${hex}-0000-4000-8000-000000000000`;
}
