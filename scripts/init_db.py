import asyncio
import os
import sys

# Ensure src is in the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from medikiosk.adapters.database.engine import get_engine, create_all_tables
from medikiosk.adapters.logging import get_logger

log = get_logger(__name__)

async def main():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        log.error("DATABASE_URL environment variable is required")
        sys.exit(1)
        
    engine = get_engine(database_url)
    log.info("initializing_database_schema")
    await create_all_tables(engine)
    log.info("database_schema_provisioned")
    # Clean up engine
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
