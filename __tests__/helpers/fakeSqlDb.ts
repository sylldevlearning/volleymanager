// A minimal in-memory SQL engine for integration-style service tests.
//
// expo-sqlite's native module cannot run under Jest (no device/emulator —
// `NativeDatabase is not a constructor` when required directly). Rather than
// stub out every individual service call with hand-picked return values
// (which can't catch a test that "plays a real sequence of actions" through
// several services and then reads it all back), this interprets the actual
// parameterized SQL strings the services send — INSERT / UPDATE / DELETE /
// SELECT with simple `col = ?` (or literal) WHERE clauses, ORDER BY, LIMIT —
// against plain in-memory tables. It intentionally throws on any statement
// shape it doesn't recognize, so an unsupported query fails loudly instead of
// silently returning nothing.

export type Row = Record<string, unknown>;

function resolveToken(token: string, params: unknown[], paramIndex: { i: number }): unknown {
  const t = token.trim();
  if (t === '?') return params[paramIndex.i++];
  const quoted = t.match(/^'(.*)'$/);
  if (quoted) return quoted[1];
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/^NULL$/i.test(t)) return null;
  throw new Error(`fakeSqlDb: unsupported literal token "${t}"`);
}

function evalWhere(row: Row, whereClause: string | null, whereParams: unknown[]): boolean {
  if (!whereClause) return true;
  const conds = whereClause.split(/\s+AND\s+/i);
  const paramIndex = { i: 0 };
  return conds.every((cond) => {
    const trimmed = cond.trim();

    const notInMatch = trimmed.match(/^(\w+)\s+NOT IN\s*\(([^)]*)\)$/i);
    if (notInMatch) {
      const [, col, listRaw] = notInMatch;
      const values = listRaw.split(',').map((v) => resolveToken(v, whereParams, paramIndex));
      return !values.includes(row[col]);
    }
    const inMatch = trimmed.match(/^(\w+)\s+IN\s*\(([^)]*)\)$/i);
    if (inMatch) {
      const [, col, listRaw] = inMatch;
      const values = listRaw.split(',').map((v) => resolveToken(v, whereParams, paramIndex));
      return values.includes(row[col]);
    }

    const m = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (!m) throw new Error(`fakeSqlDb: unsupported WHERE condition "${cond}"`);
    const [, col, rhsToken] = m;
    const rhs = resolveToken(rhsToken, whereParams, paramIndex);
    return row[col] === rhs;
  });
}

export class FakeSqlDb {
  tables = new Map<string, Row[]>();
  /** Insertion order, keyed off-object so it never leaks into a row's own fields. */
  private insertSeq = new WeakMap<Row, number>();
  private nextSeq = 0;

  private table(name: string): Row[] {
    if (!this.tables.has(name)) this.tables.set(name, []);
    return this.tables.get(name)!;
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    const s = sql.trim();

    const insertMatch = s.match(/^INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/is);
    if (insertMatch) {
      const [, table, colsRaw, valsRaw] = insertMatch;
      const cols = colsRaw.split(',').map((c) => c.trim());
      const valTokens = valsRaw.split(',');
      const paramIndex = { i: 0 };
      const row: Row = {};
      cols.forEach((c, i) => { row[c] = resolveToken(valTokens[i], params, paramIndex); });
      this.insertSeq.set(row, this.nextSeq++);
      this.table(table).push(row);
      return;
    }

    const updateMatch = s.match(/^UPDATE\s+(\w+)\s+SET\s+([\s\S]+?)\s+WHERE\s+([\s\S]+)$/i);
    if (updateMatch) {
      const [, table, setClause, whereClause] = updateMatch;
      const setPairs = setClause.split(',').map((p) => {
        const [col, valToken] = p.split('=');
        return { col: col.trim(), valToken: valToken.trim() };
      });
      const paramIndex = { i: 0 };
      const resolvedSets = setPairs.map(({ col, valToken }) => ({ col, value: resolveToken(valToken, params, paramIndex) }));
      const whereParams = params.slice(paramIndex.i);
      for (const row of this.table(table)) {
        if (evalWhere(row, whereClause, whereParams)) {
          for (const { col, value } of resolvedSets) row[col] = value;
        }
      }
      return;
    }

    const deleteMatch = s.match(/^DELETE FROM\s+(\w+)(?:\s+WHERE\s+([\s\S]+))?$/i);
    if (deleteMatch) {
      const [, table, whereClause] = deleteMatch;
      if (!whereClause) { this.tables.set(table, []); return; }
      const kept = this.table(table).filter((row) => !evalWhere(row, whereClause, params));
      this.tables.set(table, kept);
      return;
    }

    throw new Error(`fakeSqlDb.runAsync: unsupported statement "${s}"`);
  }

  private selectRows(sql: string, params: unknown[]): Row[] {
    let working = sql.trim();

    let limit: number | null = null;
    const limitMatch = working.match(/\bLIMIT\s+(\d+)\s*$/i);
    if (limitMatch) { limit = Number(limitMatch[1]); working = working.slice(0, limitMatch.index).trim(); }

    let orderCol: string | null = null;
    let orderDir: 'ASC' | 'DESC' = 'ASC';
    const orderMatch = working.match(/\bORDER BY\s+([\w.]+)\s+(ASC|DESC)\s*$/i);
    if (orderMatch) {
      orderCol = orderMatch[1];
      orderDir = orderMatch[2].toUpperCase() as 'ASC' | 'DESC';
      working = working.slice(0, orderMatch.index).trim();
    }

    let whereClause: string | null = null;
    const whereMatch = working.match(/\bWHERE\s+([\s\S]+)$/i);
    if (whereMatch) {
      whereClause = whereMatch[1].trim();
      working = working.slice(0, whereMatch.index).trim();
    }

    const fromMatch = working.match(/\bFROM\s+(\w+)/i);
    if (!fromMatch) throw new Error(`fakeSqlDb: unsupported SELECT (no FROM) "${sql}"`);
    const table = fromMatch[1];

    let rows = this.table(table).filter((row) => evalWhere(row, whereClause, params));

    if (orderCol) {
      const col = orderCol;
      rows = [...rows].sort((a, b) => {
        const av = a[col] as string | number;
        const bv = b[col] as string | number;
        if (av < bv) return orderDir === 'ASC' ? -1 : 1;
        if (av > bv) return orderDir === 'ASC' ? 1 : -1;
        // Tie (e.g. two events sharing the same millisecond timestamp under
        // fake timers) — break by insertion order, in the same direction as
        // the primary sort, so "ORDER BY timestamp DESC LIMIT 1" reliably
        // means "the most recently inserted row", not an arbitrary one.
        const aSeq = this.insertSeq.get(a) ?? 0;
        const bSeq = this.insertSeq.get(b) ?? 0;
        return orderDir === 'ASC' ? aSeq - bSeq : bSeq - aSeq;
      });
    }

    if (limit !== null) rows = rows.slice(0, limit);
    return rows.map((r) => ({ ...r }));
  }

  async getAllAsync<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.selectRows(sql, params) as unknown as T[];
  }

  async getFirstAsync<T = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = this.selectRows(sql, params);
    return (rows[0] as unknown as T) ?? null;
  }

  async withExclusiveTransactionAsync(cb: () => Promise<void>): Promise<void> {
    await cb();
  }
}
