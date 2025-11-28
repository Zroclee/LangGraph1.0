# eg: 制定一个适合初学者的健身计划，包括运动项目、频率和饮食建议
# 急需智能体自动询问用户目标和需求。需要人工干预

# 节点"b"和"c"在同一个超级步骤中并发执行。我们设置defer=True节点d，使其在所有待处理任务完成后才会执行。
# 在本例中，这意味着"d"等待执行，直到整个"b"分支完成。

import os
import json
import asyncio
from typing import Annotated, List, Literal, Optional, AsyncGenerator
from typing_extensions import TypedDict
from langgraph.graph import START, StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_deepseek import ChatDeepSeek
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
import operator


# 结构化输出模型
class TaskStep(BaseModel):
    """计划步骤输出结构化模型"""
    task_id: str = Field(description="任务唯一标识符, 格式要求：task_{index}, 示例：task_0")
    task_name: str = Field(description="执行任务名称")
    desc: str = Field(description="具体可执行的任务描述")
    result: str = Field(description="任务执行结果")
    # status: Literal['pending', 'executing', 'completed', 'failed'] = Field("pending")

class PlanModel(BaseModel):
    """计划输出结构化模型"""
    user_goal: str = Field(description="原始用户目标描述")
    tasks: List[TaskStep] = Field(description="有序计划任务列表")

class PlanState(TypedDict):
    user_content: str = Field(description="用户输入内容")
    tasks: List[TaskStep] = Field(description="有序计划任务列表")
    current_step: int = Field(default=0, description="当前执行到的任务索引")
    current_task: Optional[TaskStep] = Field(description="当前执行的任务")
    completed_tasks: Annotated[
        list, operator.add
    ]
    final_res: str

    
# 监控智能体    
class PlanAgent:
    def __init__(self):
        self.ds_worker_llm = self._get_ds_llm()
        self.ds_plan_llm = self._get_ds_llm().with_structured_output(PlanModel)
        self.ds_llm = self._get_ds_llm()
        self.qwen_llm = self._get_qwen_llm()
        self.graph = self._build_graph()
    
    # 执行
    async def ainvoke(self, content: str):
        res = await self.graph.ainvoke({
            'user_content': content,
        })
        return res
    
    # 流式执行
    async def astream(self, content: str) -> AsyncGenerator[str, None]:
        """
        流式执行智能体，每个节点的输出都会实时返回
        """
        async for event in self.graph.astream({
            'user_content': content,
        }):
            # 处理每个节点的输出
            for node_name, node_output in event.items():
                if node_name == 'plan_llm_call':
                    # 规划节点输出
                    if 'tasks' in node_output:
                        tasks_info = {
                            "node": "plan_llm_call",
                            "status": "completed",
                            "data": {
                                "tasks_count": len(node_output['tasks']),
                                "tasks": [{"task_id": task.task_id, "task_name": task.task_name, "desc": task.desc} for task in node_output['tasks']]
                            }
                        }
                        yield f"data: {json.dumps(tasks_info, ensure_ascii=False)}\n\n"
                
                elif node_name == 'worker_llm_call':
                    # 工作节点输出
                    if 'completed_tasks' in node_output and node_output['completed_tasks']:
                        current_step = node_output.get('current_step', 1) - 1
                        worker_info = {
                            "node": "worker_llm_call",
                            "status": "completed",
                            "data": {
                                "step": current_step,
                                "result": node_output['completed_tasks'][-1] if node_output['completed_tasks'] else ""
                            }
                        }
                        yield f"data: {json.dumps(worker_info, ensure_ascii=False)}\n\n"
                
                elif node_name == 'final_llm_cll':
                    # 最终总结节点输出
                    if 'final_res' in node_output:
                        final_info = {
                            "node": "final_llm_cll",
                            "status": "completed",
                            "data": {
                                "final_result": node_output['final_res']
                            }
                        }
                        yield f"data: {json.dumps(final_info, ensure_ascii=False)}\n\n"
        
        # 发送结束信号
        yield f"data: {json.dumps({'status': 'finished'}, ensure_ascii=False)}\n\n"


    # 协调器节点
    def _plan_llm_call(self, state: PlanState) -> PlanState:
        """
        规划大模型节点，根据用户输入生成计划
        """
        plan_prompt = f"""
            # 角色
            你是世界级规划专家，及其擅长将复杂的任务目标转化成可执行计划。
            # 任务拆分原则
            1. 原子性：每个任务必须是不可再分的最小执行单元
            2. 覆盖率：所有任务组合必须能100%达成原始目标
            # 返回数据示例
            {{
                "user_goal": "原始用户目标描述",
                "tasks": [
                    {{
                        "task_id": "任务唯一标识符, 格式要求：task_{{index}}",
                        "task_name": "执行任务名称",
                        "desc": "具体可执行的任务描述"
                    }}
                ]
            }}
        """
        print(f"plan_llm_call: {state['user_content']}")
        plan = self.ds_plan_llm.invoke([
            SystemMessage(content=plan_prompt),
            HumanMessage(content=f"请根据用户输入{state['user_content']}，进行任务规划。")
            ])
        return {'tasks': plan.tasks, "current_step": 0}

    # 工作节点
    def _worker_llm_call(self, state: PlanState) -> PlanState:
        """
        工作节点，根据当前任务执行计划，调用大模型执行任务
        """
        currentStep = state['current_step']
        currentTask = state['tasks'][currentStep]
        next_step = currentStep + 1
        worker_promt = f"""
            # 角色
            你是专注精准执行的AI助手，严格按指令完成当前任务
            # 全局目标上下文
            总体目标： {state['user_content']}
            当前任务ID: {currentTask.task_id}
            # 当前任务信息
            当前任务名称： {currentTask.task_name}
            当前任务描述： {currentTask.desc}
            # 要求
            1. 严格按照当前任务描述执行当前任务，不能偏离任务目标，也不得执行其他步骤任务。
        """
        print('current_step: ', currentStep)
        print(f"worker_llm_call: {currentTask.task_name}")
        task_res = self.ds_worker_llm.invoke([
            HumanMessage(content=worker_promt)
            ])
        return {'completed_tasks': [task_res.content], 'current_step': next_step}

    # 总结
    def _final_llm_cll(self, state: PlanState) -> PlanState:
        final_prompt = f"""
            # 角色
            你是一个计划完成评估器，对已完成的任务列表进行总结。
            # 示例输入
            {{
                "completed_tasks": [
                    {{
                        "task_id": "task_1",
                        "task_name": "任务1",
                        "result": "任务1执行结果",
                    }},
                    {{
                        "task_id": "task_2",
                        "task_name": "任务2",
                        "result": "任务2执行结果",
                    }}
                ]
            }}
        """
        print(f"final_llm_cll: 对已完成任务进行评估，已完成任务数：{len(state['completed_tasks'])}")
        final_res = self.ds_llm.invoke([
            SystemMessage(content=final_prompt),
            HumanMessage(content=f"请根据已完成的任务列表，进行总结。已完成的任务列表：{state['completed_tasks']}")
        ])
        return {'final_res': final_res.content}

    # 条件边
    def _should_call(self, state: PlanState) -> str:
        """
        按步骤执行计划，根据当前任务索引判断是否继续执行下一个任务
        """
        tasks_len = len(state["tasks"])
        current_step = state['current_step']
        print(f"current_step: {current_step}")
        print(f"tasks_len: {tasks_len}")
        if tasks_len > 0 and current_step < tasks_len:
            return 'worker_llm_call'
        return 'final_llm_cll'

    # 组装
    def _build_graph(self):
        workflow = StateGraph(PlanState)
        # 添加节点
        workflow.add_node('plan_llm_call', self._plan_llm_call)
        workflow.add_node('worker_llm_call', self._worker_llm_call)
        workflow.add_node('final_llm_cll', self._final_llm_cll)
        # 添加条件边
        workflow.add_edge(START, "plan_llm_call")
        workflow.add_edge("plan_llm_call", "worker_llm_call")

        workflow.add_conditional_edges('worker_llm_call', self._should_call, {
            "worker_llm_call": "worker_llm_call",
            'final_llm_cll': 'final_llm_cll'
        })
        workflow.add_edge("final_llm_cll", END)
        return workflow.compile()

    # 获取deepseek大模型
    def _get_ds_llm(self):
        return ChatDeepSeek(
            model="deepseek-chat",
            api_key=os.environ["DEEPSEEK_API_KEY"],
            base_url="https://api.deepseek.com",
        )
    # 多模态大模型
    def _get_qwen_llm(self):
        return ChatOpenAI(
            model="qwen-plus",
            api_key=os.getenv("DASHSCOPE_API_KEY"),
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )