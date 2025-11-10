import { MultiServerMCPClient } from "@langchain/mcp-adapters";
const api_key = process.env.DASHSCOPE_API_KEY;

const client = new MultiServerMCPClient({
	amap_maps: {
		transport: "sse",
		url: "https://dashscope.aliyuncs.com/api/v1/mcps/amap-maps/sse",
		headers: {
			Authorization: `Bearer ${api_key}`,
		},
	},
});

client.getTools().then((tools) => {
	console.log(tools);
});
