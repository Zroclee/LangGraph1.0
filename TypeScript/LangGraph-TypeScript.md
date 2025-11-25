# 玩转 LangGraph · JavaScript 篇（一）：从 0 到 1 搭建 RAG 智能体

## 前言
AI 的重要性已无需多言——但作为前端开发者，如何在AI浪潮中找到自己的切入点？

线性代数、概率统计、微积分？
机器学习、神经网络、深度学习？
你是否也曾被这些看似高深的概念劝退？被庞杂的知识体系压得望而却步？

别急，也许你不需要从零开始。
我建议有经验的开发者，直接上手 LangGraph，从构建第一个智能体开始，提前感受 AI 开发的乐趣与成就感——
不走“从入门到放弃”的老路，而是走“从实践到掌握”的捷径。

在这里你将获得什么：

- 用 LangGraph 快速编排有状态智能体的能力
- 一个约 100 行的 JavaScript RAG 示例，可在终端交互运行
- 对状态管理、循环与分支、检查点的直觉理解
- 可拓展的工程化建议与下一步路线

## 什么是 LangGraph

来自官方文档：

> LangGraph is a low-level orchestration framework and runtime for building, managing, and deploying long-running, stateful agents.

一句话理解：LangGraph 是用于构建、管理并运行“长时间、有状态”的智能体（Agent）的底层编排框架与运行时。

LangGraph 由 LangChain 团队开发，它采用图结构来构建和管理基于大语言模型的复杂工作流，尤其擅长处理需要有状态、多步骤和循环逻辑的应用。

## LangGraph 的核心思想

理解 LangGraph，可以抓住以下几个关键点：

- 图结构工作流：在 LangGraph 中，应用逻辑被建模成一个有向图，由“节点”和“边”组成。节点代表一个具体的操作步骤，例如调用大语言模型、执行一个工具函数或进行条件判断。边则定义了这些节点之间的连接关系和执行顺序。
- 状态管理：这是 LangGraph 的核心。它会维护一个贯穿整个图的共享数据结构（State）。每个节点都可以读取当前状态，并返回对状态的更新，使信息在多步骤工作流中有效传递与累积。
- 支持循环与分支：LangGraph 原生支持循环和条件分支。工作流可以根据中间结果“绕回去”重新执行某些步骤，或选择不同的执行路径，这对于需要反复试错或决策的场景至关重要。

下面这个表格总结了它的一些核心概念：

| 核心概念     | 说明                                   | 一句话理解               |
| :----------- | :------------------------------------- | :----------------------- |
| 图 (Graph)   | 由节点和边构成的工作流蓝图。           | 应用的设计图纸。         |
| 节点 (Node)  | 图中的一个步骤，如调用 LLM、执行工具。 | 图纸上的具体工作任务。   |
| 边 (Edge)    | 连接节点，定义执行顺序和条件。         | 任务间的箭头与流向指示。 |
| 状态 (State) | 在工作流步骤间共享和传递的上下文信息。 | 任务传递的共享备忘录。   |

## 为什么选择 LangGraph

选择 LangGraph 框架开发智能体，是因为它专门为解决传统智能体开发中的核心痛点而设计，尤其在处理复杂状态和多步骤控制流方面具有独特优势。

### 1. 原生支持“状态管理”：智能体的记忆核心

这是最核心的优势。智能体的“智能”很大程度上体现在它能记住之前的交互和决策。

- 传统挑战：在简单的链式调用中，维护一个不断更新的上下文（如多轮对话历史、中间结果）非常繁琐，需要手动拼接和管理。
- LangGraph 解决方案：内置基于图的状态管理。你可以定义一个共享状态模式，图中的每个节点都能读取并更新这个状态的特定部分。
- 实际价值：智能体自然拥有“记忆”，可持续追踪对话历史、已执行的操作列表、收集到的数据等，为下一步决策提供完整上下文。

### 2. 强大的循环与分支控制：实现“思考-行动”循环

智能体的核心范式是 ReAct（Reason + Act）：思考、调用工具、观察结果、再思考——本质上是一个循环过程。

- 传统挑战：标准的 LangChain 链本质是有向无环图（DAG），难以优雅地处理这种循环逻辑，通常需要笨重的外围代码。
- LangGraph 解决方案：通过条件边（Conditional Edges）原生支持循环。你可以根据一个节点（通常是 LLM）的输出，动态决定下一步是继续执行另一个节点，还是返回到之前的节点。
- 实际价值：轻松构建能够自我反思、纠正错误、持续深入的智能体。例如，如果工具返回的结果不充分，智能体可以重新制定问题再次查询。

### 3. 灵活的编排能力：从简单到极度复杂

LangGraph 是一个“低级别”的编排框架，这赋予了它极大的灵活性。

- 细粒度控制：精确控制工作流中的每一个步骤，定义它们如何交互、如何更新状态，适合构建高定制化的复杂智能体。
- 多智能体协作：可将不同的节点视为拥有不同技能的“专家智能体”（如搜索、写代码、审核），通过图结构串联，实现分工协作。
- 人类介入：轻松在工作流中设置中断点，等待人类审核或提供额外输入后再继续执行。

### 4. 生产级特性：为真实世界而生

- 持久化与检查点：LangGraph 可以自动将工作流的状态持久化到数据库或文件中。长时间运行的任务可被中断，并从断点精确恢复。
- “时间旅行”调试：得益于状态持久化，开发者可以回放智能体的整个执行过程，查看每一步的状态变化，极大简化复杂智能体的调试。
- 可观测性：清晰监控工作流的执行路径和每个节点的输入/输出。

## 快速开始

选定一个对话模型 + 一个搜索/检索工具 → 定义状态 → 用 `createAgent` 串联 → 在终端交互跑通。

### 准备工作

- 一个对话模型的 API Key（如 DeepSeek 等）
- 一个搜索或检索服务的 API Key（如百度千帆 AI 搜索）
- 本地安装 Node.js ≥ 20

### 项目初始化

```shell
pnpm init
pnpm install ts-node typescript dotenv --save-dev
pnpm install @langchain/core @langchain/langgraph @langchain/openai @langchain/deepseek --save
```

### 配置环境变量

在环境变量中添加对应 API Key。示例中使用 DeepSeek 和百度 AI 搜索；`DASHSCOPE_API_KEY` 为可选项（本文未直接使用）。

```
touch .env

# Deepseek API key
DEEPSEEK_API_KEY=

# 百度 AI 搜索相关配置
BAIDU_API_KEY=

# 阿里百炼（可选）
DASHSCOPE_API_KEY=

```

### 创建文件与运行入口

```shell
mkdir learn
touch learn/index.ts
cd learn
mkdir code
touch code/rag-agent.ts
```

添加运行指令：

```json
{
  "scripts": {
    "learn": "node -r ts-node/register/transpile-only learn/index.ts"
  }
}
```

将 `rag-agent.ts` 文件引入 `learn/index.ts` 文件：

```typescript
import "./code/rag-agent";
```

至此准备工作完成。

### 100 行代码实现 RAG 智能体

RAG（Retrieval Augmented Generation，检索增强生成）：先检索相关信息，再生成答案，以降低幻觉风险。

```ts
// 添加环境变量
// 添加环境变量
import * as dotenv from "dotenv";
dotenv.config();

// 百度AI搜索工具
import { Tool } from "@langchain/core/tools";
class BaiduSearchTool extends Tool {
	name = "baidu_search";
	description =
		"使用百度AI搜索获取网络信息，适用于获取最新新闻、事实性信息、当前事件等。输入应为搜索关键词。";
	async _call(searchQuery: string) {
		const apiKey = process.env.BAIDU_API_KEY;
		if (!apiKey) {
			return "BAIDU_API_KEY 未配置";
		}
		console.log(`调用百度AI搜索：${searchQuery}`);
		const url = `https://qianfan.baidubce.com/v2/ai_search/chat/completions`;
		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: [
					{
						role: "user",
						content: searchQuery,
					},
				],
				search_source: "baidu_search_v2",
				resource_type_filter: [
					{ type: "web", top_k: 5 },
					{ type: "video", top_k: 5 },
				],
			}),
		});
		// references
		if (!response.ok) {
			return "未搜索到结果";
		}
		const data = await response.json();
		const contents = data.references.map((ref: any) => ref.content);
		console.log(`搜索到 ${contents.length} 条结果`);
		return JSON.stringify({
			source: "baidu_ai_search",
			query: searchQuery,
			contents,
		});
	}
}

// 智能体搭建
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";

class RagAgent {
	agent: any;
	constructor() {
		const baiduTool = new BaiduSearchTool();
		const model = new ChatOpenAI({
			model: "deepseek-chat",
			apiKey: process.env.DEEPSEEK_API_KEY,
			configuration: {
				baseURL: "https://api.deepseek.com",
			},
		});
		const tools = [baiduTool];
		const checkpointer = new MemorySaver();
		this.agent = createReactAgent({
			llm: model,
			tools,
			checkpointer,
		});
	}
	async invoke(content: string) {
		console.log(`调用智能体：${content}`);
		const result = await this.agent.invoke(
			{
				messages: [
					new SystemMessage(
						"你是严谨的智能助手。遇到事实性或时间相关问题必须调用工具检索；不得主观臆断，需在回答中引用来源或说明依据。"
					),
					new HumanMessage(content),
				],
			},
			{
				configurable: {
					thread_id: "default_id",
				},
			}
		);
		console.log(
			`智能体回复：${result.messages[result.messages.length - 1].content}`
		);
		return result.messages[result.messages.length - 1].content;
	}
}
```

### 终端交互功能实现

```ts
// 交互式CLI：模仿 Python while True 输入循环
import * as readLine from "node:readline";
async function startCli(): Promise<void> {
	const agent = new RagAgent();
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
			const result = await agent.invoke(userInput);
			console.log(result);
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
```

### 测试

终端运行：

```shell
npm run learn
User: 你好
```

常见问题与排查：

- 搜索工具提示 `BAIDU_API_KEY 未配置`：在 `.env` 填写正确的 Key 并重试。
- 对话模型鉴权失败：检查 `DEEPSEEK_API_KEY` 是否有效，以及 `baseURL` 是否正确。
- 返回结构变化：百度接口返回结构可能调整，已做基础容错；如长期失败，建议查看最新接口文档并适配。

## 总结

现在你就拥有了一个基于 LangGraph 的 RAG 智能体，它可以在终端与用户交互、搜索网络信息并回答问题。你可以根据需要修改智能体的行为，例如添加更多的工具、调整模型参数等。

下一篇预告：状态、工作流、检查点，带你了解LangGraph基础概念。