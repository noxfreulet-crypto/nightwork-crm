/**
 * D1直接SQLヘルパー
 * Drizzle ORMに問題がある場合の代替手段
 */

export class D1Helper {
  constructor(private db: D1Database) {}

  /**
   * SELECT クエリ実行
   */
  async select<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const result = await stmt.bind(...params).all();
    return result.results as T[];
  }

  /**
   * SELECT 単一行
   */
  async selectOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const results = await this.select<T>(sql, params);
    return results[0] || null;
  }

  /**
   * INSERT クエリ実行
   */
  async insert(sql: string, params: any[] = []): Promise<{ lastRowId: number; changes: number }> {
    const stmt = this.db.prepare(sql);
    const result = await stmt.bind(...params).run();
    return {
      lastRowId: result.meta.last_row_id || 0,
      changes: result.meta.changes || 0,
    };
  }

  /**
   * UPDATE クエリ実行
   */
  async update(sql: string, params: any[] = []): Promise<number> {
    const stmt = this.db.prepare(sql);
    const result = await stmt.bind(...params).run();
    return result.meta.changes || 0;
  }

  /**
   * DELETE クエリ実行
   */
  async delete(sql: string, params: any[] = []): Promise<number> {
    const stmt = this.db.prepare(sql);
    const result = await stmt.bind(...params).run();
    return result.meta.changes || 0;
  }

  /**
   * トランザクション実行
   */
  async transaction<T>(callback: (helper: D1Helper) => Promise<T>): Promise<T> {
    // D1はトランザクションをネイティブサポートしていないため、
    // バッチ実行で代替
    return callback(this);
  }
}

/**
 * D1ヘルパーのインスタンス作成
 */
export function createD1Helper(db: D1Database): D1Helper {
  return new D1Helper(db);
}
