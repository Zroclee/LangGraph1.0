/**
 * 创建一个可以应对客户投诉的智能体
 *
 * 实现步骤
 * 读取并解析内容：提取客户和投诉内容
 * 意图分类：使用 LLM 对紧急程度和主题进行分类，然后路由到相应的操作
 * 文档搜索：查询知识库以获取相关信息
 * 缺陷跟踪：在跟踪系统中创建或更新问题
 * 草拟回复：生成合适的回复
 * 人工审核：升级至人工审核员进行审批或处理。
 * 发送回复：发送电子邮件回复
 */

/**
 * 意图识别节点
 * 回复生成节点
 * 客户历史查询
 * 文档检索
 * 申请人工干预节点
 */

/**
 * 设计状态
 * 1. 用户信息
 * 2. 投诉内容
 * 3. 意图识别类型
 * 4. 意图识别级别
 * 5. 检索结果
 * 6. 回复生成结果
 */

import * as z from "zod";

// 投诉类型定义 - 基于业务类别和原因类别
const ComplaintTypeSchema = z
	.enum([
		"CARD_BUSINESS", // 银行卡业务
		"LOAN_BUSINESS", // 贷款业务
		"PAYMENT_SETTLEMENT", // 支付结算
		"FINANCIAL_MANAGEMENT", // 理财业务
		"SERVICE_ATTITUDE", // 服务态度
		"SERVICE_QUALITY", // 服务质量
		"MARKETING_SALES", // 营销销售
		"FEE_PRICING", // 收费定价
		"POLICY_PROCESS", // 制度流程
		"INFORMATION_DISCLOSURE", // 信息披露
		"OTHER", // 其他
	])
	.meta({
		title: "投诉类型",
		description: `
		  	CARD_BUSINESS: '涉及借记卡、信用卡的申请、使用、额度、挂失等业务问题，包括但不限于卡片管理、交易争议、年费争议等',
			LOAN_BUSINESS: '涉及个人贷款、企业贷款的申请、审批、发放、还款、展期、催收等业务环节的问题',
			PAYMENT_SETTLEMENT: '涉及转账汇款、票据业务、跨境支付、第三方支付等支付结算服务的问题',
			FINANCIAL_MANAGEMENT: '涉及银行理财产品、基金、保险等财富管理业务的销售、运作、赎回等问题',
			SERVICE_ATTITUDE: '涉及员工服务态度、沟通方式、礼貌用语等服务质量问题',
			SERVICE_QUALITY: '涉及业务办理效率、系统稳定性、网点环境、设备运行等服务质量问题',
			MARKETING_SALES: '涉及误导销售、不当营销、私自开通业务、未充分告知风险等销售行为问题',
			FEE_PRICING: '涉及收费标准不透明、乱收费、费用争议、利率争议等定价收费问题',
			POLICY_PROCESS: '涉及银行内部管理制度、业务规则、操作流程等制度性问题',
			INFORMATION_DISCLOSURE: '涉及产品信息、风险提示、合同条款等披露不充分、不准确的问题',
			OTHER: '未包含在上述类别中的其他投诉类型'
	`,
	});
// 投诉级别定义 - 基于影响范围和紧急程度
export const ComplaintLevelSchema = z
	.enum([
		"EMERGENCY", // 紧急级别
		"HIGH", // 高级别
		"MEDIUM", // 中级别
		"LOW", // 低级别
	])
	.meta({
		title: "投诉级别",
		description: `
		  	EMERGENCY: '涉及重大资金损失、群体性事件、系统性风险、媒体曝光等可能引发重大声誉风险或监管关注的紧急事件，需2小时内响应并启动应急预案',
			HIGH: '涉及较大金额损失、可能升级为诉讼或监管投诉、影响重要客户关系等较严重事件，需24小时内响应并优先处理',
			MEDIUM: '涉及一般性服务问题、流程优化建议、小额费用争议等中等影响事件，需3个工作日内响应并标准处理',
			LOW: '涉及简单咨询、轻微服务瑕疵等低影响事件，可按照常规流程在5个工作日内处理'
	`,
	});

// 投诉信息
const ComplaintInfoSchema = z.object({
	title: z.string(),
	description: z.string(),
});

// 用户信息
const CustomerInfoSchema = z.object({
	name: z.string(),
	contact: z.string(),
	branch: z.string(),
	manager: z.string(),
});

type TypeComplaintInfo = z.infer<typeof ComplaintInfoSchema>;
type TypeCustomerInfo = z.infer<typeof CustomerInfoSchema>;

const ComplaintAgentState = z.object({
	complaint_info: ComplaintInfoSchema,
	customer_info: CustomerInfoSchema,
	intent_type: ComplaintTypeSchema,
	intent_level: ComplaintLevelSchema,
	retrieval_result: z.string(),
	reply_result: z.string(),
});

type TypeComplaintAgentState = z.infer<typeof ComplaintAgentState>;

// 定义大模型
import { ChatDeepSeek } from "@langchain/deepseek";
const model = new ChatDeepSeek({
	model: "deepseek-chat",
	temperature: 0.8,
});

// 结构化输出
const IntentOutPutSchema = z.object({
	type: ComplaintTypeSchema,
	level: ComplaintLevelSchema,
});

const structured_model = model.withStructuredOutput(IntentOutPutSchema, {
	name: "intent",
});

// 定义节点
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// 查询客户信息节点
const customer_info_node = async (state: TypeComplaintAgentState) => {
	return {
		customer_info: {
			name: "李照鹏",
			contact: "130****4050",
			branch: "深圳分行",
			manager: "张三",
		},
	};
};
// 意图识别节点
const intent_node = async (state: TypeComplaintAgentState) => {
	const result = await structured_model.invoke([
		new SystemMessage(
			`
			你是一个投诉识别智能助手，你需要识别投诉内容，并给出投诉类型和投诉紧急程度。
			投诉类型有以下几种：
			CARD_BUSINESS: '涉及借记卡、信用卡的申请、使用、额度、挂失等业务问题，包括但不限于卡片管理、交易争议、年费争议等',
			LOAN_BUSINESS: '涉及个人贷款、企业贷款的申请、审批、发放、还款、展期、催收等业务环节的问题',
			PAYMENT_SETTLEMENT: '涉及转账汇款、票据业务、跨境支付、第三方支付等支付结算服务的问题',
			FINANCIAL_MANAGEMENT: '涉及银行理财产品、基金、保险等财富管理业务的销售、运作、赎回等问题',
			SERVICE_ATTITUDE: '涉及员工服务态度、沟通方式、礼貌用语等服务质量问题',
			SERVICE_QUALITY: '涉及业务办理效率、系统稳定性、网点环境、设备运行等服务质量问题',
			MARKETING_SALES: '涉及误导销售、不当营销、私自开通业务、未充分告知风险等销售行为问题',
			FEE_PRICING: '涉及收费标准不透明、乱收费、费用争议、利率争议等定价收费问题',
			POLICY_PROCESS: '涉及银行内部管理制度、业务规则、操作流程等制度性问题',
			INFORMATION_DISCLOSURE: '涉及产品信息、风险提示、合同条款等披露不充分、不准确的问题',
			OTHER: '未包含在上述类别中的其他投诉类型'
			投诉紧急程度有以下几种：
			EMERGENCY: '涉及重大资金损失、群体性事件、系统性风险、媒体曝光等可能引发重大声誉风险或监管关注的紧急事件，需2小时内响应并启动应急预案',
			HIGH: '涉及较大金额损失、可能升级为诉讼或监管投诉、影响重要客户关系等较严重事件，需24小时内响应并优先处理',
			MEDIUM: '涉及一般性服务问题、流程优化建议、小额费用争议等中等影响事件，需3个工作日内响应并标准处理',
			LOW: '涉及简单咨询、轻微服务瑕疵等低影响事件，可按照常规流程在5个工作日内处理'
			请根据投诉内容，给出投诉类型和投诉紧急程度。
			`
		),
		new HumanMessage(
			`
			投诉标题：${state.complaint_info.title}
			投诉内容：${state.complaint_info.description}
			`
		),
	]);
	return { intent_type: result.type, intent_level: result.level };
};

const business_node = async (state: TypeComplaintAgentState) => {
	// 通知业务系统
	return "投诉处理完成";
};

const service_node = async (state: TypeComplaintAgentState) => {
	// 获取服务结果
	return "投诉处理完成";
};

const process_node = async (state: TypeComplaintAgentState) => {
	return "投诉处理完成";
};
const security_node = async (state: TypeComplaintAgentState) => {
	// 获取安全结果
	return "投诉处理完成";
};
const other_node = async (state: TypeComplaintAgentState) => {
	// 获取安全结果
	return "投诉处理完成";
};

// 回复生成节点
const reply_node = async (state: TypeComplaintAgentState) => {
	const result = await model.invoke([
		new SystemMessage(""),
		new HumanMessage(""),
	]);
	return result;
};

// 通知人工节点
const notify_node = async (state: TypeComplaintAgentState) => {
	// 通知人工处理
	return "投诉处理完成";
};

// 定义工具调用条件边
const shouldContinue = async (state: TypeComplaintAgentState) => {
	const type = state.intent_type;
	const map = {
		CARD_BUSINESS: "business", // 银行卡业务
		LOAN_BUSINESS: "business", // 贷款业务
		PAYMENT_SETTLEMENT: "business", // 支付结算
		FINANCIAL_MANAGEMENT: "business", // 理财业务
		SERVICE_ATTITUDE: "service", // 服务态度
		SERVICE_QUALITY: "service", // 服务质量
		MARKETING_SALES: "service", // 营销销售
		FEE_PRICING: "service", // 收费定价
		POLICY_PROCESS: "process", // 制度流程
		INFORMATION_DISCLOSURE: "security", // 信息披露
		OTHER: "other", // 其他
	};
	return map[type];
};

import { StateGraph, START, END } from "@langchain/langgraph";

const workflow = new StateGraph(ComplaintAgentState)
	.addNode("intent", intent_node)
	.addNode("business", business_node)
	.addNode("service", service_node)
	.addNode("process", process_node)
	.addNode("security", security_node)
	.addNode("other", other_node)
	.addNode("reply", reply_node)
	.addNode("notify", notify_node)
	.addEdge(START, "intent")
	.addConditionalEdges("intent", shouldContinue, {
		business: "business",
		service: "service",
		process: "process",
		security: "security",
		other: "other",
	})
	.addEdge("business", "reply")
	.addEdge("service", "reply")
	.addEdge("process", "reply")
	.addEdge("security", "reply")
	.addEdge("other", "reply")
	.addEdge("reply", "notify")
	.addEdge("notify", END);

const graph = workflow.compile();

import fs from "fs";
import path from "path";
const saveGraphImage = async () => {
	try {
		const graphObj = await graph.getGraphAsync();
		const png_data = await graphObj.drawMermaidPng();
		// 定义保存路径
		const saveDir = path.join(__dirname, "../files");
		const savePath = path.join(saveDir, "graph_visualization.png");

		// 如果目录不存在，则创建
		if (!fs.existsSync(saveDir)) {
			fs.mkdirSync(saveDir, { recursive: true });
		}

		// 保存文件
		const arrayBuffer = await png_data.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		fs.writeFileSync(savePath, buffer);
	} catch (error) {
		console.error("保存文件时出错：", error);
	}
};
saveGraphImage();
