"""
Thin compatibility layer so the rest of app.py (written against sqlite3's
style - `conn.execute(sql_with_question_marks, params)` returning a cursor
directly) keeps working unchanged against Postgres via psycopg2.

Two things sqlite3 gives us that psycopg2 doesn't, out of the box:
1. `?` placeholders instead of `%s`
2. `conn.execute(...)` as a shortcut for `conn.cursor().execute(...)`,
   returning the cursor so you can chain `.fetchone()` / `.fetchall()`

This wrapper adds both back, plus dict-style rows (so `row["col"]` keeps
working exactly like it did with sqlite3.Row).
"""
import psycopg2
import psycopg2.extras


class PGConnection:
    def __init__(self, dsn):
        self._conn = psycopg2.connect(dsn)
        # Autocommit avoids Postgres's "current transaction is aborted"
        # cascade when a statement in a loop (like the ALTER TABLE ADD
        # COLUMN migrations below) fails and is caught with try/except -
        # each statement commits (or fails) independently.
        self._conn.autocommit = True

    def execute(self, sql, params=()):
        pg_sql = sql.replace("?", "%s")
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(pg_sql, params)
        return cur

    def executescript(self, sql_script):
        # psycopg2 can run multiple ;-separated statements in one execute()
        cur = self._conn.cursor()
        cur.execute(sql_script)
        cur.close()

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()

    def cursor(self):
        return self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def connect(dsn):
    return PGConnection(dsn)
