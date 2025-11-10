# 定义工具
from tools.baidu_search import BaiduSearchTool
from tools.file_manage import current_time
tools = [BaiduSearchTool(), current_time]
tools_by_name = {tool.name: tool for tool in tools}
# print(tools_by_name)

# 定义大模型
from langchain.chat_models import init_chat_model
model = init_chat_model(
    model="deepseek-chat",
    model_provider="deepseek",
    temperature=0.7,
    max_tokens=None,
    timeout=None,
    # base_url="https://api.deepseek.com",
    max_retries=2,
)

# 绑定工具
model_with_tools = model.bind_tools(tools)


# 定义状态
from langchain.messages import AnyMessage
from typing_extensions import Annotated, TypedDict
import operator

# 在 LangGraph 中，状态会在整个智能体的执行期间持续存在。
# 使用 operator.add 声明的 Annotated 类型能确保新消息被追加到现有列表中，而不是将其替换。
class MessagesState(TypedDict):
    """消息状态"""
    messages: Annotated[list[AnyMessage], operator.add]
    llm_calls: int
    tools_calls: int


# 定义节点

# 大模型调用节点
from langchain.messages import SystemMessage


def llm_call(state: dict):
    """LLM decides whether to call a tool or not"""
    messages = state["messages"]
    response = model_with_tools.invoke(
        [
            SystemMessage(
                content="You are a helpful assistant tasked with performing arithmetic on a set of inputs."
            )
        ]
        + messages
    )
    return {
        "messages": [response],
        "llm_calls": state.get('llm_calls', 0) + 1
    }
# 工具调用节点
from langchain.messages import ToolMessage

def tool_node(state: dict):
    """Performs the tool call"""
    result = []
    for tool_call in state["messages"][-1].tool_calls:
        tool = tools_by_name[tool_call["name"]]
        observation = tool.invoke(tool_call["args"])
        result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
    return {"messages": result}


# 定义条件边
from typing import Literal
from langgraph.graph import StateGraph, START, END


def should_continue(state: MessagesState) -> Literal["tool_node", END]:
    """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""
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
agent = graph.compile()



# 调用工作流
from langchain.messages import HumanMessage
messages = [HumanMessage(content="今天深圳天气怎么样？出行如何穿搭？")]
messages = agent.invoke({"messages": messages})
for m in messages["messages"]:
    m.pretty_print()