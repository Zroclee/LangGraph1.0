import { tool } from "@langchain/core/tools";
import * as z from "zod";

export const getCurrentTimeTool = tool(
	() => {
		console.log("获取当前时间");
		const now = new Date();
		return now.toLocaleString("zh-CN");
	},
	{
		name: "get_current_time",
		description: "获取当前时间",
		schema: z.string(),
	}
);
