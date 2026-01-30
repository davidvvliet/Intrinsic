import os
import time
import psycopg2
from psycopg2.pool import ThreadedConnectionPool, PoolError

_pool = None

def _init_pool() -> None:
    global _pool
    if _pool is not None:
        return
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        host = os.getenv('POSTGRES_HOST', 'localhost')
        port = os.getenv('POSTGRES_PORT', '5432')
        db = os.getenv('POSTGRES_DB', 'postgres')
        user = os.getenv('POSTGRES_USER', 'postgres')
        password = os.getenv('POSTGRES_PASSWORD', 'postgres')
        dsn = f"host={host} port={port} dbname={db} user={user} password={password}"
    # small pool: 1-5 connections is enough for API/search
    # Thread-safe pool for concurrent request handling
    _pool = ThreadedConnectionPool(minconn=1, maxconn=5, dsn=dsn)

def get_conn(timeout_seconds=None, poll_interval_seconds=0.05):
    """Get a pooled connection for read queries.

    If the pool is exhausted, block-wait up to timeout_seconds (default from
    env DB_POOL_ACQUIRE_TIMEOUT_SECONDS=3.0) before raising PoolError.
    """
    if _pool is None:
        _init_pool()
    if timeout_seconds is None:
        try:
            timeout_seconds = float(os.getenv("DB_POOL_ACQUIRE_TIMEOUT_SECONDS", "3.0"))
        except Exception:
            timeout_seconds = 3.0

    deadline = time.time() + timeout_seconds
    last_err = None
    while True:
        try:
            return _pool.getconn()
        except PoolError as e:
            last_err = e
            if time.time() >= deadline:
                raise last_err
            time.sleep(poll_interval_seconds)

def put_conn(conn) -> None:
    if _pool is not None and conn is not None:
        try:
            _pool.putconn(conn)
        except Exception:
            try:
                conn.close()
            except Exception:
                pass

def close_pool():
    """Close all connections in the pool. Called on FastAPI shutdown."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
