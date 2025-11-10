from langchain.tools import tool
from datetime import datetime, timezone
from pathlib import Path
import os

@tool('current_time', description='获取最新的、当前的、现在的年月日、时分秒')
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

# 文件根目录（限制在 learn 目录）
# 将根目录提升到 learn，便于读取 files/、images/ 等同级资源目录
BASE_DIR = Path(__file__).resolve().parent.parent

def _resolve_safe_path(filename: str) -> Path:
    """在 BASE_DIR 下解析安全路径，防止路径越权。"""
    p = (BASE_DIR / filename).resolve()
    # 确保解析后的路径仍在 BASE_DIR 中
    if os.path.commonpath([str(BASE_DIR), str(p)]) != str(BASE_DIR):
        raise ValueError("非法路径，必须在当前目录内")
    return p

@tool('read_file', description='读取 learn 目录下的文件内容')
def read_file(filename: str, encoding: str = "utf-8") -> str:
    """读取 BASE_DIR 下的文件内容。
    参数：
    - filename: 文件名或相对路径（相对于 BASE_DIR，即 learn 目录）
    - encoding: 文本编码，默认 utf-8
    返回：文件内容或错误信息。
    """
    try:
        p = _resolve_safe_path(filename)
        if not p.exists() or not p.is_file():
            return f"文件不存在: {p.name}"
        return p.read_text(encoding=encoding)
    except Exception as e:
        return f"读取失败: {e}"

@tool('write_file', description='将内容写入当前目录文件（覆盖或追加）')
def write_file(filename: str, content: str, mode: str = "overwrite", encoding: str = "utf-8") -> str:
    """写入 BASE_DIR 下的文件内容。
    参数：
    - filename: 文件名或相对路径（相对于当前脚本目录）
    - content: 要写入的文本内容
    - mode: 写入模式，"overwrite" 覆盖 或 "append" 追加，默认覆盖
    - encoding: 文本编码，默认 utf-8
    返回：写入结果说明。
    """
    try:
        p = _resolve_safe_path(filename)
        p.parent.mkdir(parents=True, exist_ok=True)
        write_mode = 'a' if str(mode).lower() == 'append' else 'w'
        with open(p, write_mode, encoding=encoding) as f:
            f.write(content)
        return f"写入成功: {p.name}（模式: {write_mode}）"
    except Exception as e:
        return f"写入失败: {e}"