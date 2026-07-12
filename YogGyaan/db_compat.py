import psycopg2
import psycopg2.extras


class PGConnection:
    def __init__(self, dsn):
        self._conn = psycopg2.connect(dsn)
        self._conn.autocommit = True

    def execute(self, sql, params=()):
        pg_sql = sql.replace("?", "%s")
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(pg_sql, params)
        return cur

    def executescript(self, sql_script):
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
