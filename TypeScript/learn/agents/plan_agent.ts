/**
 * 规划智能体
 * plan_agent.ts是一个使用LangGraph来实现计划智能体
 * 这个智能体工作流存在三个节点：
 * 1. 协调器节点 - 根据问题生成规划
 * 2. 工作节点 - 循环解决计划列表
 * 3. 评价器节点 - 评估工作完成情况
 *
 * 示例：制定一个适合初学者的健身计划，包括运动项目、频率和饮食建议
 */

import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { ChatDeepSeek } from "@langchain/deepseek";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

/**
 * 计划步骤结构化模型
 */
const TaskStepSchema = z.object({
	task_id: z
		.string()
		.describe("任务唯一标识符, 格式要求：task_{index}, 示例：task_0"),
	task_name: z.string().describe("执行任务名称"),
	desc: z.string().describe("具体可执行的任务描述"),
	result: z.string().optional().describe("任务执行结果"),
});

/**
 * 计划输出结构化模型
 */
const PlanModelSchema = z.object({
	user_goal: z.string().describe("原始用户目标描述"),
	tasks: z.array(TaskStepSchema).describe("有序计划任务列表"),
});

type TaskStep = z.infer<typeof TaskStepSchema>;
type PlanModel = z.infer<typeof PlanModelSchema>;

/**
 * 计划状态接口
 * @property {string} user_content - 用户输入内容
 * @property {TaskStep[]} tasks - 有序计划任务列表
 * @property {number} current_step - 当前执行到的任务索引
 * @property {TaskStep | null} current_task - 当前执行的任务
 * @property {string[]} completed_tasks - 已完成的任务结果列表
 * @property {string} final_res - 最终评估结果
 */
const PlanStateAnnotation = Annotation.Root({
	user_content: Annotation<string>({
		reducer: (x, y) => y ?? x,
		default: () => "",
	}),
	tasks: Annotation<TaskStep[]>({
		reducer: (x, y) => y ?? x,
		default: () => [],
	}),
	current_step: Annotation<number>({
		reducer: (x, y) => y ?? x,
		default: () => 0,
	}),
	current_task: Annotation<TaskStep | null>({
		reducer: (x, y) => y ?? x,
		default: () => null,
	}),
	completed_tasks: Annotation<string[]>({
		reducer: (x, y) => x.concat(y),
		default: () => [],
	}),
	final_res: Annotation<string>({
		reducer: (x, y) => y ?? x,
		default: () => "",
	}),
});

type PlanState = typeof PlanStateAnnotation.State;

/**
 * 计划智能体类
 * 实现了基于LangGraph的三节点计划执行系统
 */
export class PlanAgent {
	private ds_worker_llm: ChatDeepSeek;
	private ds_plan_llm: ChatDeepSeek;
	private ds_llm: ChatDeepSeek;
	private qwen_llm: ChatOpenAI;
	private graph: any;

	/**
	 * 构造函数
	 * 初始化所需的LLM实例和构建工作流图
	 */
	constructor() {
		this.ds_worker_llm = this._get_ds_llm();
		this.ds_plan_llm = this._get_ds_llm();
		this.ds_llm = this._get_ds_llm();
		this.qwen_llm = this._get_qwen_llm();
		this.graph = this._build_graph();
	}

	/**
	 * 执行智能体
	 * @param {string} content - 用户输入内容
	 * @returns {Promise<PlanState>} 执行结果状态
	 */
	async invoke(content: string): Promise<PlanState> {
		const res = await this.graph.invoke({
			user_content: content,
		});
		return res;
	}

	/**
	 * 流式执行智能体
	 * @param {string} content - 用户输入内容
	 * @returns {AsyncGenerator<string>} 流式输出的事件数据
	 */
	async *stream(content: string): AsyncGenerator<string> {
		for await (const event of await this.graph.stream({
			user_content: content,
		})) {
			// 处理每个节点的输出
			for (const [nodeName, nodeOutput] of Object.entries(event)) {
				if (nodeName === "plan_llm_call") {
					// 规划节点输出
					const output = nodeOutput as Partial<PlanState>;
					if (output.tasks && output.tasks.length > 0) {
						const tasksInfo = {
							node: "plan_llm_call",
							status: "completed",
							data: {
								tasks_count: output.tasks.length,
								tasks: output.tasks.map((task) => ({
									task_id: task.task_id,
									task_name: task.task_name,
									desc: task.desc,
								})),
							},
						};
						yield `data: ${JSON.stringify(tasksInfo)}\n\n`;
					}
				} else if (nodeName === "worker_llm_call") {
					// 工作节点输出
					const output = nodeOutput as Partial<PlanState>;
					if (output.completed_tasks && output.completed_tasks.length > 0) {
						const currentStep = (output.current_step ?? 1) - 1;
						const workerInfo = {
							node: "worker_llm_call",
							status: "completed",
							data: {
								step: currentStep,
								result:
									output.completed_tasks[output.completed_tasks.length - 1] ||
									"",
							},
						};
						yield `data: ${JSON.stringify(workerInfo)}\n\n`;
					}
				} else if (nodeName === "final_llm_call") {
					// 最终总结节点输出
					const output = nodeOutput as Partial<PlanState>;
					if (output.final_res) {
						const finalInfo = {
							node: "final_llm_call",
							status: "completed",
							data: {
								final_result: output.final_res,
							},
						};
						yield `data: ${JSON.stringify(finalInfo)}\n\n`;
					}
				}
			}
		}

		// 发送结束信号
		yield `data: ${JSON.stringify({ status: "finished" })}\n\n`;
	}

	/**
	 * 协调器节点 - 规划大模型节点
	 * 根据用户输入生成计划
	 * @param {PlanState} state - 当前状态
	 * @returns {Promise<Partial<PlanState>>} 更新的状态
	 */
	private async _plan_llm_call(state: PlanState): Promise<Partial<PlanState>> {
		const planPrompt = `
            # 角色
            你是世界级规划专家，及其擅长将复杂的任务目标转化成可执行计划。

            # 任务拆分原则
            1. 原子性：每个任务必须是不可再分的最小执行单元
            2. 覆盖率：所有任务组合必须能100%达成原始目标

            # 返回数据示例
            {
            "user_goal": "原始用户目标描述",
            "tasks": [
                {
                "task_id": "任务唯一标识符, 格式要求：task_{index}",
                "task_name": "执行任务名称",
                "desc": "具体可执行的任务描述"
                }
            ]
            }
        `;

		console.log(`plan_llm_call: ${state.user_content}`);

		const structuredLLM = this.ds_plan_llm.withStructuredOutput(
			PlanModelSchema,
			{
				name: "plan_llm_call",
			}
		);
		const plan = await structuredLLM.invoke([
			new SystemMessage(planPrompt),
			new HumanMessage(`请根据用户输入${state.user_content}，进行任务规划。`),
		]);

		return {
			tasks: (plan as PlanModel).tasks,
			current_step: 0,
		};
	}

	/**
	 * 工作节点 - 执行当前任务
	 * 根据当前任务执行计划，调用大模型执行任务
	 * @param {PlanState} state - 当前状态
	 * @returns {Promise<Partial<PlanState>>} 更新的状态
	 */
	private async _worker_llm_call(
		state: PlanState
	): Promise<Partial<PlanState>> {
		const currentStep = state.current_step;
		const currentTask = state.tasks[currentStep];
		const nextStep = currentStep + 1;

		const workerPrompt = `
            # 角色
            你是专注精准执行的AI助手，严格按指令完成当前任务

            # 全局目标上下文
            总体目标： ${state.user_content}
            当前任务ID: ${currentTask.task_id}

            # 当前任务信息
            当前任务名称： ${currentTask.task_name}
            当前任务描述： ${currentTask.desc}

            # 要求
            1. 严格按照当前任务描述执行当前任务，不能偏离任务目标，也不得执行其他步骤任务。
    `;

		console.log("current_step: ", currentStep);
		console.log(`worker_llm_call: ${currentTask.task_name}`);

		const taskRes = await this.ds_worker_llm.invoke([
			new HumanMessage(workerPrompt),
		]);

		return {
			completed_tasks: [taskRes.content as string],
			current_step: nextStep,
		};
	}

	/**
	 * 评价器节点 - 最终总结节点
	 * 对已完成的任务列表进行总结和评估
	 * @param {PlanState} state - 当前状态
	 * @returns {Promise<Partial<PlanState>>} 更新的状态
	 */
	private async _final_llm_call(state: PlanState): Promise<Partial<PlanState>> {
		const finalPrompt = `
                # 角色
            你是一个计划完成评估器，对已完成的任务列表进行总结。

            # 示例输入
            {
                "completed_tasks": [
                    {
                        "task_id": "task_1",
                        "task_name": "任务1",
                        "result": "任务1执行结果"
                    },
                    {
                        "task_id": "task_2",
                        "task_name": "任务2",
                        "result": "任务2执行结果"
                    }
                ]   
        }
    `;

		console.log(
			`final_llm_call: 对已完成任务进行评估，已完成任务数：${state.completed_tasks.length}`
		);

		const finalRes = await this.ds_llm.invoke([
			new SystemMessage(finalPrompt),
			new HumanMessage(
				`请根据已完成的任务列表，进行总结。已完成的任务列表：${JSON.stringify(
					state.completed_tasks
				)}`
			),
		]);

		return {
			final_res: finalRes.content as string,
		};
	}

	/**
	 * 条件边判断函数
	 * 按步骤执行计划，根据当前任务索引判断是否继续执行下一个任务
	 * @param {PlanState} state - 当前状态
	 * @returns {string} 下一个要执行的节点名称
	 */
	private _should_call(state: PlanState): string {
		const tasksLen = state.tasks.length;
		const currentStep = state.current_step;

		console.log(`current_step: ${currentStep}`);
		console.log(`tasks_len: ${tasksLen}`);

		if (tasksLen > 0 && currentStep < tasksLen) {
			return "worker_llm_call";
		}
		return "final_llm_call";
	}

	/**
	 * 构建工作流图
	 * 组装所有节点和边，构建完整的计划执行图
	 * @returns {CompiledGraph} 编译后的工作流图
	 */
	private _build_graph() {
		const workflow = new StateGraph(PlanStateAnnotation)
			// 添加节点
			.addNode("plan_llm_call", this._plan_llm_call.bind(this))
			.addNode("worker_llm_call", this._worker_llm_call.bind(this))
			.addNode("final_llm_call", this._final_llm_call.bind(this))
			// 添加边
			.addEdge(START, "plan_llm_call")
			.addEdge("plan_llm_call", "worker_llm_call")
			// 添加条件边
			.addConditionalEdges("worker_llm_call", this._should_call.bind(this), {
				worker_llm_call: "worker_llm_call",
				final_llm_call: "final_llm_call",
			})
			.addEdge("final_llm_call", END);

		return workflow.compile();
	}

	/**
	 * 获取DeepSeek大模型实例
	 * @returns {ChatDeepSeek} DeepSeek LLM实例
	 */
	private _get_ds_llm(): ChatDeepSeek {
		return new ChatDeepSeek({
			model: "deepseek-chat",
			apiKey: process.env.DEEPSEEK_API_KEY,
			temperature: 0.7,
		});
	}

	/**
	 * 获取通义千问大模型实例
	 * @returns {ChatOpenAI} Qwen LLM实例
	 */
	private _get_qwen_llm(): ChatOpenAI {
		return new ChatOpenAI({
			model: "qwen-plus",
			apiKey: process.env.DASHSCOPE_API_KEY,
			configuration: {
				baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
			},
		});
	}
}

const agent = new PlanAgent();

agent
	.invoke("制定一个适合初学者的健身计划，包括运动项目、频率和饮食建议")
	.then((res) => {
		console.log(res);
	});
