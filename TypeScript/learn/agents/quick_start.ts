import { createAgent } from "langchain";
import { ChatDeepSeek } from "@langchain/deepseek";
import { MemorySaver } from "@langchain/langgraph";
import { BaiduSearchTool } from "../tools/baiduSearchTool";
import { getCurrentTimeTool } from "../tools/common";
import { HumanMessage } from "@langchain/core/messages";
const baiduTool = new BaiduSearchTool();

const systemPrompt = `
# 角色
你是一个专业的智能助手，具备强大的信息检索和生成能力。

# 核心要求
1. **信息检索**：使用搜索baidu_search工具获取最新、权威的客观信息和知识
2. **信息时效性**：请时刻使用get_current_time工具获取当前时间，确保信息时效性
3. **信息准确性**：生成内容请以搜索结果为准，避免臆测和幻觉，确保信息准确性
`;
const model = new ChatDeepSeek({
	model: "deepseek-chat",
	temperature: 0.8,
});

const checkpointer = new MemorySaver();

const agent = createAgent({
	model: model,
	tools: [baiduTool, getCurrentTimeTool],
	systemPrompt: systemPrompt,
	checkpointer,
});

const config = {
	configurable: { thread_id: "1" },
	context: { user_id: "1" },
};

// const invoke = async () => {
// 	const result = await agent.invoke(
// 		{
// 			messages: [{ role: "user", content: "请帮我写一个关于机器学习的博客" }],
// 		},
// 		config
// 	);
// 	if (result && result.messages && result.messages.length > 0) {
// 		console.log(result.messages[result.messages.length - 1].content);
// 	}
// };
// invoke();

// 交互式CLI：模仿 Python while True 输入循环
import * as readLine from "node:readline";
async function startCli(): Promise<void> {
	const rl = readLine.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: true,
	});

	console.log("请输入搜索关键词，输入 quit/exit/bye 退出");
	rl.setPrompt("User: ");
	rl.prompt();

	rl.on("line", async (line: string) => {
		const userInput = line.trim();
		if (["quit", "exit", "bye"].includes(userInput.toLowerCase())) {
			console.log("Goodbye!");
			rl.close();
			return;
		}
		try {
			const result = await agent.invoke(
				{
					messages: [new HumanMessage({ content: userInput })],
				},
				config
			);
			// console.log(result);
			if (result && result.messages && result.messages.length > 0) {
				console.log(result.messages[result.messages.length - 1].content);
			}
		} catch (err: any) {
			console.log(`'${userInput}' 调用失败：${err?.message ?? String(err)}`);
		}
		rl.prompt();
	});

	rl.on("close", () => {
		// 与 Python 示例一致，退出时结束进程
		if (typeof process !== "undefined") {
			process.exit(0);
		}
	});
}
startCli();
