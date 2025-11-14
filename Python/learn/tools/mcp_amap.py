import os
from dotenv import load_dotenv
load_dotenv()

from langchain_mcp_adapters.client import MultiServerMCPClient  

key = os.getenv("AMAP_KEY")

client = MultiServerMCPClient(  
    {
        "amap-mcp-server": {
            "transport": "streamable_http",  # HTTP-based remote server
            # Ensure you start your weather server on port 8000
            "url": "https://mcp.amap.com/mcp?key=" + key,
        }
    }
)


async def get_tools():
    print("Getting tools...")
    tools = await client.get_tools()
    print(tools)

if __name__ == "__main__":
    import asyncio
    asyncio.run(get_tools())