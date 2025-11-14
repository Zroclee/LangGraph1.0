import { createAgent } from "langchain";
import { ChatDeepSeek } from "@langchain/deepseek";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { BaiduSearchTool } from "../tools/baiduSearchTool";
import { getCurrentTimeTool } from "../tools/common";
import { read_file, write_file } from "../tools/fileManage";
import { getAmapMcpTools } from "../MCP/AMap";
const baiduTool = new BaiduSearchTool();

const systemPrompt = `
# 角色
你是一个专业的RAG（检索增强生成）智能助手，具备强大的信息检索和生成能力。

# 核心要求
1. **信息检索**：使用搜索baidu_search工具获取最新、权威的客观信息和知识
2. **信息时效性**：请时刻使用get_current_time工具获取当前时间，确保信息时效性
3. **信息准确性**：生成内容请以搜索结果为准，避免臆测和幻觉，确保信息准确性
4. **文件操作**：使用read_file和write_file工具进行文件读写操作
5. **地图信息**：使用maps_**工具获取地图、导航、POI搜索、交通、城市天气等信息
`;
const model = new ChatDeepSeek({
	model: "deepseek-chat",
	temperature: 0.8,
});

const checkpointer = new MemorySaver();

const config = {
	configurable: { thread_id: "1" },
	context: { user_id: "1" },
};

// const messages = [new HumanMessage("今天深圳天气怎么样？出行如何穿搭？")];
const messages = [
	new HumanMessage(
		"我在深圳龙华一区，本周六日要去大梅沙玩两天，使用高德地图MCP服务，帮我查询交通和天气，并给出出行游玩建议？"
	),
];
// messages = [HumanMessage(content="珠穆朗玛峰的高度是多少米？转换成英尺是多少？")]
// const messages = [
// 	new HumanMessage("帮我看下本地文件files/test.txt的内容,并进行总结"),
// ];
// const messages = [
// 	new HumanMessage(
// 		"帮我查询大模型思考框架ReAct的详细内容，进行总结并保存在react.txt"
// 	),
// ];
const invoke = async () => {
	const amapTools = await getAmapMcpTools();
	const agent = createAgent({
		model: model,
		tools: [baiduTool, getCurrentTimeTool, read_file, write_file, ...amapTools],
		systemPrompt: systemPrompt,
		checkpointer,
	});

	const result = await agent.invoke(
		{
			messages: messages,
		},
		config
	);

	console.log(result);

	if (result && result.messages && result.messages.length > 0) {
		console.log(result.messages[result.messages.length - 1].content);
	}
};
invoke();
