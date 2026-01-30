import asyncpg
import json
import os
from typing import Optional

_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    """Get or create the global async connection pool"""
    global _pool
    if _pool is None:
        DATABASE_URL = os.getenv('DATABASE_URL')
        if not DATABASE_URL:
            raise Exception("DATABASE_URL environment variable not set")
        
        async def init_connection(conn):
            """Initialize connection with JSONB type codec"""
            await conn.set_type_codec(
                'jsonb',
                encoder=json.dumps,
                decoder=json.loads,
                schema='pg_catalog'
            )
        
        _pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=5,        # Minimum connections always open
            max_size=20,       # Maximum connections in pool
            max_queries=50000, # Max queries per connection before recycling
            max_inactive_connection_lifetime=300,  # Close idle connections after 5min
            command_timeout=60,  # Query timeout in seconds
            init=init_connection,  # Set JSONB codec on each connection
            server_settings={
                'application_name': 'intrinsic_api'
            }
        )
    return _pool

async def close_pool():
    """Close the pool (call on FastAPI shutdown)"""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None

async def execute_query(query: str, *args):
    """Execute a query and return all results"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(query, *args)

async def execute_query_one(query: str, *args):
    """Execute a query and return single row"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchrow(query, *args)

async def execute_command(query: str, *args):
    """Execute a command (INSERT/UPDATE/DELETE) and return status"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)