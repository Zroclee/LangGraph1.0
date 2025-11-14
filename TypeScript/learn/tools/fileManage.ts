import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// 文件根目录（限制在 learn/files 目录）
const BASE_DIR = path.resolve(__dirname, "..", "files");

/**
 * 在 BASE_DIR 下解析安全路径，防止路径越权
 * @param filename - 文件名或相对路径
 * @returns 解析后的安全路径
 * @throws 如果路径越权则抛出错误
 */
function resolveSafePath(filename: string): string {
	const resolvedPath = path.resolve(BASE_DIR, filename);
	// 确保解析后的路径仍在 BASE_DIR 中
	if (!resolvedPath.startsWith(BASE_DIR)) {
		throw new Error("非法路径，必须在当前目录内");
	}
	return resolvedPath;
}

/**
 * 读取 learn 目录下的文件内容
 * @param filename - 文件名或相对路径（相对于 BASE_DIR，即 learn 目录）
 * @param encoding - 文本编码，默认 utf-8
 * @returns 文件内容或错误信息
 */
export const read_file = tool(
	async ({ filename, encoding = "utf-8" }) => {
		console.log("读取文件", filename);
		try {
			const filePath = resolveSafePath(filename);
			if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
				return `文件不存在: ${path.basename(filePath)}`;
			}
			return fs.readFileSync(filePath, {
				encoding: encoding as BufferEncoding,
			});
		} catch (error) {
			return `读取失败: ${error}`;
		}
	},
	{
		name: "read_file",
		description: "读取 learn 目录下的文件内容",
		schema: z.object({
			filename: z.string().describe("文件名或相对路径（相对于 learn 目录）"),
			encoding: z
				.string()
				.optional()
				.default("utf-8")
				.describe("文本编码，默认 utf-8"),
		}),
	}
);

/**
 * 将内容写入当前目录文件（覆盖或追加）
 * @param filename - 文件名或相对路径（相对于当前脚本目录）
 * @param content - 要写入的文本内容
 * @param mode - 写入模式，"overwrite" 覆盖 或 "append" 追加，默认覆盖
 * @param encoding - 文本编码，默认 utf-8
 * @returns 写入结果说明
 */
export const write_file = tool(
	async ({ filename, content, mode = "overwrite", encoding = "utf-8" }) => {
		console.log("写入文件", filename);
		try {
			const filePath = resolveSafePath(filename);
			const dir = path.dirname(filePath);

			// 确保目录存在
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			const writeMode = mode.toLowerCase() === "append" ? "a" : "w";
			const flag = writeMode === "a" ? "a" : "w";

			fs.writeFileSync(filePath, content, {
				encoding: encoding as BufferEncoding,
				flag,
			});

			return `写入成功: ${path.basename(filePath)}（模式: ${writeMode}）`;
		} catch (error) {
			return `写入失败: ${error}`;
		}
	},
	{
		name: "write_file",
		description: "将内容写入当前目录文件（覆盖或追加）",
		schema: z.object({
			filename: z.string().describe("文件名或相对路径（相对于当前脚本目录）"),
			content: z.string().describe("要写入的文本内容"),
			mode: z
				.string()
				.optional()
				.default("overwrite")
				.describe("写入模式，overwrite 覆盖 或 append 追加"),
			encoding: z
				.string()
				.optional()
				.default("utf-8")
				.describe("文本编码，默认 utf-8"),
		}),
	}
);
