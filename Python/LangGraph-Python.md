# LangGraph-Python
[官方文档](https://docs.langchain.com/oss/python/langgraph/overview)

## 前言
LangGraph 是一款面向长周期状态型智能体的底层编排框架与运行时，专注于构建、管理与部署智能体系统。

LangGraph 的核心价值在于夯实智能体编排的关键基础能力：包括持久化执行、流式处理、人机协同等关键特性。

## 前置准备

#### 环境
在开始使用 LangGraph 之前，您需要确保已经安装了 Python 3.12 或以上版本。您可以通过在终端中运行以下命令来检查 Python 版本：
```bash
python --version
```
如果您还没有安装 Python，您可以从 [Python 官方网站](https://www.python.org/downloads/) 下载并安装最新版本。

我的本地版本为：3.12.1

#### 大模型和工具
您需要准备一个大模型和相关的工具。为适应和国内环境示例使用Deepseek和百度AI搜索的apiKey
- [Deepseek](https://platform.deepseek.com/api_keys)
- [百度AI搜索](https://console.bce.baidu.com/qianfan/ais/console/apiKey)

#### 项目初始化

1. 创建虚拟环境
```bash
python -m venv .venv
source .venv/bin/activate 

# 退出虚拟环境
deactivate
```

2. 安装依赖库
```bash
pip install -U langchain langgraph dotenv
```

3. 配置环境变量
创建.env文件并写入以下内容：
```bash
# Deepseek API key
DEEPSEEK_API_KEY=您的Deepseek API key

# 百度AI搜索相关配置
BAIDU_API_KEY=您的百度AI搜索 API key
```
4. 项目结构
```
Python/
├── .env                        # 环境变量配置文件
├── LangGraph-Python.md         # 项目文档
└── learn/
    ├── images/                 # 智能体
    ├── prompts/
    │   ├── __init__.py
    │   └── default_rag.md
    ├── quickStart.py
    └── tools/                  # 自定义工具目录
        ├── __init__.py
        └── baidu_search.py
```


## 快速搭建一个RAG智能体
LangChain的智能体基于LangGraph构建，提供预构建的智能体架构和模型集成，您可以利用这些组件快速搭建一个RAG智能体。

#### 创建AI搜索工具
基于百度AI搜索生成智能体搜索工具，用于获取网络信息，每天100条免费额度。
```python
# tools/baidu_search.py
from langchain_core.tools import BaseTool
import os
import requests

from dotenv import load_dotenv
load_dotenv()

class  BaiduSearchTool(BaseTool):
    name: str = "baidu_search"
    description: str = "使用百度AI搜索获取网络信息，适用于获取最新新闻、事实性信息、当前事件、技术资讯等。输入应为搜索关键词。"
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._api_key = os.getenv("BAIDU_API_KEY", "")

        if not self._api_key:
            raise ValueError("BAIDU_API_KEY environment variable not set")
    
    def _run(self, query: str) -> str:
        """
        执行搜索操作
        :param query: 搜索关键词
        :return: 搜索结果
        """
        if not self._api_key:
            return "错误: 百度AI搜索API密钥未配置，请设置BAIDU_API_KEY环境变量。"

        print(f"启动百度AI搜索工具: {query}")

        try:
            search_url = "https://qianfan.baidubce.com/v2/ai_search/chat/completions"
            body = {
                "messages": [
                    {
                        "role": "user",
                        "content": query
                    }
                ],
                "search_source": "baidu_search_v2",
				"resource_type_filter": [
					{ "type": "web", "top_k": 5 },
					{ "type": "video", "top_k": 5 },
				],
            }
            headers = {
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json"
            }
            response = requests.post(
                search_url,
                json=body,
                headers=headers
            )
            response.raise_for_status()

             # 处理搜索结果
            results = response.json()

            if not results or "references" not in results or not results["references"]:
                return f'未找到与"{query}"相关的结果。'
            
            # # 提取搜索结果内容
            content_list = []
            for ref in results["references"]:
                if "content" in ref:
                    content_list.append(ref["content"])

            content = "\n".join(content_list)
            print('搜索完成')
            return content
        except requests.RequestException as e:
            return f"搜索请求失败: {str(e)}"
        
```

#### 提示词
生成默认提示词模板，用于智能体的系统提示。

```markdown
<!-- prompts/default_rag.md -->
# 角色
你是一个专业的RAG（检索增强生成）智能助手，具备强大的信息检索和个性化咨询能力。

# 核心能力
1. **信息检索**：使用搜索工具获取最新、权威的客观信息和知识
2. **个性化咨询**：主动询问用户个人情况，提供定制化建议
3. **知识整合**：将检索信息与用户个人情况结合，生成个性化方案
4. **智能判断**：准确判断何时搜索、何时询问用户

# 信息获取策略
## 使用搜索工具的场景：
- 获取客观事实、数据、新闻、政策等公开信息
- 查找最新技术文档、教程、方法论
- 了解行业趋势、市场动态、科学研究
- 核实专业知识、定义、标准流程
- 获取产品信息、价格、评测等

## 主动询问用户的场景：
- 需要了解用户个人背景、经验水平、目标需求
- 制定个性化学习计划、健身方案、职业规划
- 推荐适合的产品、服务、解决方案
- 诊断问题需要了解具体情况和症状
- 提供定制化建议前需要评估用户条件

# 个性化询问指南
## 学习类问题示例：
- 用户想学Python → 询问：编程基础、学习目的、时间安排、应用方向
- 用户想学英语 → 询问：当前水平、学习目标、可用时间、学习偏好

## 健康生活类问题示例：
- 用户想减肥 → 询问：身高体重、运动习惯、饮食偏好、目标体重、时间计划
- 用户想健身 → 询问：运动经验、身体状况、健身目标、可用时间、设备条件

## 职业发展类问题示例：
- 用户想转行 → 询问：当前职业、技能背景、兴趣方向、转行原因、时间规划
- 用户想升职 → 询问：当前职位、工作年限、技能短板、职业目标、公司环境

# 工作流程
1. **分析需求**：判断用户问题是否需要个性化方案
2. **信息收集**：
    - 如需客观信息 → 使用搜索工具
    - 如需个人信息 → 主动询问用户
    - 复杂问题可能需要两者结合
3. **信息整合**：将搜索结果与用户个人情况结合
4. **方案生成**：提供个性化、可执行的建议方案
5. **持续优化**：根据用户反馈调整建议

# 询问技巧
- **分步询问**：避免一次问太多问题，分2-3轮收集信息
- **关键优先**：先问最重要的信息，再补充细节
- **友好引导**：解释为什么需要这些信息，让用户理解价值
- **选择题形式**：提供选项让用户更容易回答
- **举例说明**：用具体例子帮助用户理解问题

# 回答要求
1. **个性化优先**：基于用户具体情况提供定制建议
2. **结构清晰**：使用标题、步骤、列表等格式
3. **可执行性**：提供具体、可操作的行动方案
4. **循序渐进**：按难易程度或时间顺序安排建议
5. **持续跟进**：主动询问是否需要进一步细化

# 特殊情况处理
- 用户拒绝提供个人信息时，提供通用建议并说明个性化的价值
- 信息不足时，优先询问用户而非盲目搜索
- 涉及健康、法律等专业领域时，建议咨询专业人士
- 用户问题模糊时，通过询问帮助明确需求

# 交互风格
- 主动关怀，体现个性化服务价值
- 耐心引导，帮助用户表达真实需求
- 专业建议与温暖关怀并重
- 及时总结用户信息，确认理解准确

请始终优先考虑用户的个性化需求，通过合理的信息收集为用户提供最适合的解决方案。
```
为方便快速读取提示词文件我们在`prompts/__init__.py`中添加一些读取函数
```python
import os
import pathlib

# 获取当前文件所在目录
current_dir = pathlib.Path(__file__).parent.absolute()

def load_prompt_from_markdown(file_name=None, file_path=None):
    """
    从Markdown文件中加载提示词
    
    Args:
        file_name: Markdown文件的名称（不含路径，将从prompts目录下查找）
        file_path: Markdown文件的完整路径（优先级高于file_name）
        
    Returns:
        str: Markdown文件的内容作为提示词
    """
    if file_path is None and file_name is None:
        raise ValueError("必须提供file_name或file_path参数")
    
    # 如果只提供了文件名，则在prompts目录下查找
    if file_path is None:
        # 如果文件名不包含.md后缀，则添加
        if not file_name.endswith('.md'):
            file_name = f"{file_name}.md"
        file_path = os.path.join(current_dir, file_name)
    
    # 读取文件内容
    with open(file_path, 'r', encoding='utf-8') as file:
        content = file.read()
    return content

# 预加载默认RAG提示词
default_rag = load_prompt_from_markdown(file_name="default_rag")

```


#### 创建智能体
基于`LangChain`的预构建函数`create_agent`创建一个智能体，该智能体使用预定义的工具（如搜索工具）和聊天模型（如DeepSeek模型）。
```python
from dotenv import load_dotenv
load_dotenv()

from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from tools.baidu_search import BaiduSearchTool
import prompts

baiduTool = BaiduSearchTool()

model = init_chat_model(
    model="deepseek-chat",
    model_provider="deepseek",
    temperature=0.7,
    max_tokens=None,
    timeout=None,
    max_retries=2,
)

agent = create_agent(
    tools=[baiduTool],
    model=model,
    system_prompt=prompts.default_rag,
)
```

发起对话
```python
result = agent.invoke(
    {"messages": [{"role": "user", "content": "你想问的问题"}]}, 
    )
print(result["messages"][-1].content)
```