/**
 * 声明Markdown文件模块类型
 * 允许TypeScript导入.md文件并将其内容作为字符串处理
 */
declare module "*.md" {
	const content: string;
	export default content;
}
