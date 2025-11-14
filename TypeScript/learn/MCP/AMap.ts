import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const client = new MultiServerMCPClient({
	amap_mcp_server: {
		transport: "http",
		url: "https://mcp.amap.com/mcp?key=" + process.env.AMAP_API_KEY,
	},
});

// const test = async () => {
// 	const tools = await client.getTools();
// 	tools.forEach(async (e) => {
// 		console.log(e);
// 		if (e.name === "maps_weather") {
// 			const result = await e.invoke({ city: "深圳" });
// 			console.log(result);
// 		}
// 	});
// };
// test();

export const getAmapMcpTools = async () => {
	return await client.getTools();
};
