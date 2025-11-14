"""
PPT创建智能体
基于LangGraph的ReAct架构,根据用户提供的主题和页面数自动创建PPT
"""

# 加载环境变量
from dotenv import load_dotenv
load_dotenv()


# 定义工具
from tools.ppt_create import create_ppt_from_json
from tools.file_manage import current_time

tools = [create_ppt_from_json, current_time]
tools_by_name = {tool.name: tool for tool in tools}

# 定义大模型
from langchain.chat_models import init_chat_model

model = init_chat_model(
    model="deepseek-chat",
    model_provider="deepseek",
    temperature=0.7,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)

# 绑定工具
model_with_tools = model.bind_tools(tools)


# 定义状态
from langchain.messages import AnyMessage
from typing_extensions import Annotated, TypedDict
import operator


class MessagesState(TypedDict):
    """
    消息状态
    
    属性:
        messages (list[AnyMessage]): 消息列表,使用operator.add追加新消息
        llm_calls (int): LLM调用次数统计
        tools_calls (int): 工具调用次数统计
    """
    messages: Annotated[list[AnyMessage], operator.add]
    llm_calls: int
    tools_calls: int


# 定义节点

# 大模型调用节点
from langchain.messages import SystemMessage


def llm_call(state: dict) -> dict:
    """
    LLM调用节点,决定是否调用工具
    
    参数:
        state (dict): 当前状态,包含messages等信息
    
    返回:
        dict: 更新后的状态,包含新消息和调用次数
    
    异常:
        Exception: LLM调用失败时抛出异常
    """
    messages = state["messages"]
    
    system_prompt = """你是一个专业的PPT制作助手。你的任务是根据用户提供的主题和页面数创建美观、专业的PPT。

工作流程:
1. 理解用户的PPT主题和需求
2. 根据主题和页面数,设计合理的PPT结构
3. 为每一页生成合适的标题和内容
4. 使用create_ppt_from_json工具创建PPT

PPT设计原则:
- 第一页必须是标题页(type: "title"),包含吸引人的主标题和副标题
- 第二页建议是目录页(type: "catalog"),列出主要章节
- 使用章节页(type: "section")来分隔不同的主题部分
- 内容要简洁明了,每页不超过6个要点
- 合理使用不同的页面类型来增加视觉吸引力
- 配色方案可选: "blue_green"(蓝绿)、"modern"(现代)、"elegant"(优雅)

可用的页面类型:
1. title - 标题页
   {"type": "title", "title": "主标题", "subtitle": "副标题", "color_scheme": "blue_green"}

2. catalog - 目录页
   {"type": "catalog", "title": "目录", "items": ["章节1", "章节2", "章节3"], "color_scheme": "blue_green"}

3. section - 章节页
   {"type": "section", "section_number": "01", "section_title": "章节标题", "color_scheme": "blue_green"}

4. content - 内容页
   {"type": "content", "title": "页面标题", "content": ["要点1", "要点2", "要点3"], "color_scheme": "blue_green"}

5. card_grid - 卡片网格页(最多6个卡片)
   {"type": "card_grid", "title": "标题", "cards": [{"title": "卡片1", "content": "内容"}, ...], "color_scheme": "blue_green"}

6. stats - 数据展示页(最多4个数据)
   {"type": "stats", "title": "数据统计", "stats": [{"value": "85%", "label": "完成率"}, ...], "color_scheme": "blue_green"}

7. timeline - 时间线页
   {"type": "timeline", "title": "发展历程", "events": [{"time": "2020", "description": "事件描述"}, ...], "color_scheme": "blue_green"}

8. two_column - 双栏对比页
   {"type": "two_column", "title": "对比", "left_content": ["左侧1"], "right_content": ["右侧1"], "color_scheme": "blue_green"}

9. image_text - 图文混排页
   {"type": "image_text", "title": "标题", "content": ["文字内容"], "image_description": "图片说明", "color_scheme": "blue_green"}

请根据用户需求创建专业、美观的PPT内容,合理搭配不同的页面类型。"""
    
    response = model_with_tools.invoke(
        [SystemMessage(content=system_prompt)] + messages
    )
    
    return {
        "messages": [response],
        "llm_calls": state.get('llm_calls', 0) + 1
    }


# 工具调用节点
from langchain.messages import ToolMessage


def tool_node(state: dict) -> dict:
    """
    工具调用节点,执行工具调用
    
    参数:
        state (dict): 当前状态,包含待执行的工具调用
    
    返回:
        dict: 包含工具执行结果的消息
    
    异常:
        KeyError: 工具不存在时抛出异常
        Exception: 工具执行失败时抛出异常
    """
    result = []
    for tool_call in state["messages"][-1].tool_calls:
        tool = tools_by_name[tool_call["name"]]
        observation = tool.invoke(tool_call["args"])
        result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
    
    return {
        "messages": result,
        "tools_calls": state.get('tools_calls', 0) + 1
    }


# 定义条件边
from typing import Literal
from langgraph.graph import StateGraph, START, END


def should_continue(state: MessagesState) -> Literal["tool_node", END]:
    """
    判断是否继续执行工作流
    
    参数:
        state (MessagesState): 当前消息状态
    
    返回:
        Literal["tool_node", END]: 如果需要调用工具返回"tool_node",否则返回END
    """
    messages = state["messages"]
    last_message = messages[-1]

    if last_message.tool_calls:
        return "tool_node"

    return END


# 定义工作流
graph = StateGraph(MessagesState)
graph.add_node(llm_call)
graph.add_node(tool_node)
graph.add_edge(START, "llm_call")
graph.add_conditional_edges("llm_call", should_continue, ["tool_node", END])
graph.add_edge("tool_node", "llm_call")

# 编译工作流
ppt_agent = graph.compile()


def create_ppt(topic: str, num_slides: int = 5, output_path: str = "output.pptx") -> dict:
    """
    创建PPT的便捷函数
    
    参数:
        topic (str): PPT主题
        num_slides (int): PPT页面数,默认5页
        output_path (str): 输出文件路径,默认为"output.pptx"
    
    返回:
        dict: 包含执行结果的消息字典
    
    异常:
        Exception: PPT创建过程中的异常
    """
    from langchain.messages import HumanMessage
    
    user_message = f"请帮我创建一个关于'{topic}'的PPT,共{num_slides}页,保存为'{output_path}'"
    messages = [HumanMessage(content=user_message)]
    
    result = ppt_agent.invoke({
        "messages": messages,
        "llm_calls": 0,
        "tools_calls": 0
    })
    
    return result


# 主程序入口
if __name__ == "__main__":
    print("=" * 60)
    print("PPT智能体启动")
    print("=" * 60)
    
    # 示例1: 创建关于人工智能的PPT
    print("\n示例1: 创建人工智能主题PPT")
    result = create_ppt(
        topic="人工智能的发展与应用",
        num_slides=6,
        output_path="AI_presentation.pptx"
    )
    
    print(f"\n执行统计:")
    print(f"- LLM调用次数: {result.get('llm_calls', 0)}")
    print(f"- 工具调用次数: {result.get('tools_calls', 0)}")
    print(f"- 总消息数: {len(result['messages'])}")
    
    print("\n" + "=" * 60)
    print("消息历史:")
    print("=" * 60)
    for i, m in enumerate(result["messages"], 1):
        print(f"\n[消息 {i}]")
        m.pretty_print()
    
    # 示例2: 交互式创建PPT
    print("\n" + "=" * 60)
    print("交互式PPT创建")
    print("=" * 60)
    
    try:
        topic = input("\n请输入PPT主题: ").strip()
        num_slides = input("请输入页面数 (默认5): ").strip()
        num_slides = int(num_slides) if num_slides else 5
        output_path = input("请输入输出文件名 (默认output.pptx): ").strip()
        output_path = output_path if output_path else "output.pptx"
        
        if not output_path.endswith('.pptx'):
            output_path += '.pptx'
        
        print(f"\n开始创建PPT...")
        result = create_ppt(topic, num_slides, output_path)
        
        print(f"\n✓ PPT创建完成!")
        print(f"- 文件路径: files/{output_path}")
        print(f"- LLM调用: {result.get('llm_calls', 0)}次")
        print(f"- 工具调用: {result.get('tools_calls', 0)}次")
        
    except KeyboardInterrupt:
        print("\n\n程序已退出")
    except Exception as e:
        print(f"\n✗ 创建失败: {str(e)}")
