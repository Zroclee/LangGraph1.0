// 定义工具
import { BaiduSearchTool } from "../tools/baiduSearchTool";
import { getCurrentTimeTool } from "../tools/common";

// 定义大模型
import { ChatDeepSeek } from "@langchain/deepseek";

const model = new ChatDeepSeek({
	model: "deepseek-chat",
	temperature: 0.8,
});

//
const baiduTool = new BaiduSearchTool();
const toolsByName = {
	[baiduTool.name]: baiduTool,
	[getCurrentTimeTool.name]: getCurrentTimeTool,
};

// 绑定工具
const model_with_tools = model.bindTools([baiduTool, getCurrentTimeTool]);

// 定义状态
import * as z from "zod";
import { BaseMessage } from "@langchain/core/messages";
import { MessagesZodMeta } from "@langchain/langgraph";
import { registry } from "@langchain/langgraph/zod";

const MessagesState = z.object({
	messages: z
		.array(z.custom<BaseMessage>())
		.register(registry, MessagesZodMeta),
	llmCalls: z.number().optional(),
});

import { SystemMessage } from "@langchain/core/messages";

const systemPrompt = `
# 角色
你是一个专业的RAG（检索增强生成）智能助手，具备强大的信息检索和生成能力。

# 核心要求
1. **信息检索**：使用搜索baidu_search工具获取最新、权威的客观信息和知识
2. **信息时效性**：请时刻使用get_current_time工具获取当前时间，确保信息时效性
3. **信息准确性**：生成内容请以搜索结果为准，避免臆测和幻觉，确保信息准确性
`;
// 定义大模型节点
const llm_call_node = async (state: z.infer<typeof MessagesState>) => {
	console.log("llm_call_node");
	const result = await model_with_tools.invoke([
		new SystemMessage(systemPrompt),
		...state.messages,
	]);
	return {
		messages: [...state.messages, result],
		llmCalls: (state.llmCalls || 0) + 1,
	};
};

import { ToolMessage, AIMessage } from "@langchain/core/messages";
// 定义工具节点
const tool_call_node = async (state: z.infer<typeof MessagesState>) => {
	console.log("tool_call_node");
	const lastMessage = state.messages[state.messages.length - 1];
	if (!(lastMessage instanceof AIMessage)) {
		return {
			messages: state.messages,
		};
	}
	const result: ToolMessage[] = [];
	for (const toolCall of lastMessage.tool_calls ?? []) {
		const tool = toolsByName[toolCall.name];
		const observation = await tool.invoke(toolCall);
		result.push(observation);
	}
	return {
		messages: [...result],
	};
};

// 定义工具调用条件边
const shouldContinue = async (state: z.infer<typeof MessagesState>) => {
	const lastMessage = state.messages[state.messages.length - 1];
	if (!(lastMessage instanceof AIMessage)) {
		return "END";
	}
	if (lastMessage.tool_calls?.length) {
		return "toolCall";
	}
	return "END";
};

// 构建工作流
import { StateGraph, START, END } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";

const workflow = new StateGraph(MessagesState)
	.addNode("llmCall", llm_call_node)
	.addNode("toolCall", tool_call_node)
	.addEdge(START, "llmCall")
	.addConditionalEdges("llmCall", shouldContinue, {
		toolCall: "toolCall",
		END: END,
	})
	.addEdge("toolCall", "llmCall");

const checkpointer = new MemorySaver();

const agent = workflow.compile({
	checkpointer,
});

const config = {
	configurable: { thread_id: "1" },
};

import { HumanMessage } from "@langchain/core/messages";
// const invoke = async () => {
// 	const result = await agent.invoke({
// 		messages: [new HumanMessage({ content: "请帮我写一个关于机器学习的博客" })],
// 	});
// 	// console.log(result);
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
