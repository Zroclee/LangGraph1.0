from dotenv import load_dotenv
load_dotenv()

from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langgraph.checkpoint.memory import InMemorySaver
from langchain.tools import tool
from tools.baidu_search import BaiduSearchTool
import prompts



baiduTool = BaiduSearchTool()

from datetime import datetime, timezone

@tool("current_time", description="获取当前年月日、时分秒")
def current_time(fmt: str = "%Y-%m-%d %H:%M:%S", tz: str = "local") -> str:
    """获取当前时间。
    可选参数：
    - fmt: 时间格式化字符串，默认 "%Y-%m-%d %H:%M:%S"
    - tz: 时区，"UTC" 或 "local"，默认 "local"
    返回格式化后的当前时间字符串。
    """
    try:
        print("获取当前时间")
        if tz.upper() == "UTC":
            now = datetime.now(timezone.utc)
        else:
            now = datetime.now()
        return now.strftime(fmt)
    except Exception:
        return datetime.now().isoformat()

# temperature：用于控制随机性的模型温度。
# max_tokens：输出令牌的最大数量。
# timeout：等待响应的最长时间（以秒为单位）。
# max_retries：失败请求的最大重试次数。
# base_url：自定义 API 端点 URL。
# rate_limiter：BaseRateLimiter控制请求率的实例。

model = init_chat_model(
    model="deepseek-chat",
    model_provider="deepseek",
    temperature=0.7,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)

agent = create_agent(
    tools=[baiduTool, current_time],
    model=model,
    system_prompt=prompts.default_rag,
    checkpointer=InMemorySaver(),
)

# 保存工作流图表
import os
try:
    # 构建图片保存路径
    file_name = "create_agent.png"
    current_dir = os.path.dirname(os.path.abspath(__file__))
    image_path = os.path.join(current_dir, "images", file_name)
    # 检查文件是否已存在
    if os.path.exists(image_path):
        print(f"图表文件已存在")
    else:
        png_data = agent.get_graph().draw_mermaid_png()
        with open(image_path, "wb") as f:
            f.write(png_data)
        print(f"图表已保存为: {image_path}")
except Exception as e:
    print(f"保存失败: {e}")

# result = agent.invoke({"messages": [{"role": "user", "content": "深圳今天天气怎么样？适合什么穿搭？"}]})
# print(result["messages"][-1].content)
thread_id = 'default_thread_123'
while True:
    try:
        user_input = input("User: ")
        if (user_input.lower() in ['quit', 'exit', 'bye']):
            print("Goodbye!")
            break
        result = agent.invoke(
            {"messages": [{"role": "user", "content": user_input}]}, 
            {"configurable": {"thread_id": thread_id}}
            )
        print(result["messages"][-1].content)
    except :
        break