// 百度AI搜索工具
import { Tool } from "@langchain/core/tools";
export class BaiduSearchTool extends Tool {
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
