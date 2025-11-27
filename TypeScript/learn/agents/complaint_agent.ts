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
import fs from "fs";
import path from "path";

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
const customer_info_node = () => {
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

import {
	business_tool,
	service_tool,
	process_tool,
	security_tool,
	other_tool,
} from "../tools/complaintTool";

/**
 * 业务节点 - 处理业务类投诉(银行卡、贷款、支付结算、理财)
 * @param {TypeComplaintAgentState} state - 投诉智能体状态
 * @returns {Object} 业务系统处理结果
 */
const business_node = async (state: TypeComplaintAgentState) => {
	const { intent_type, intent_level, customer_info } = state;
	const res = await business_tool(intent_type, intent_level, customer_info);
	return { retrieval_result: JSON.stringify(res.processing_result.data) };
};

/**
 * 服务节点 - 处理服务类投诉(服务态度、服务质量、营销销售、收费定价)
 * @param {TypeComplaintAgentState} state - 投诉智能体状态
 * @returns {Object} 服务系统处理结果
 */
const service_node = async (state: TypeComplaintAgentState) => {
	const { intent_type, intent_level, complaint_info, customer_info } = state;
	const res = await service_tool(intent_type, intent_level, customer_info);
	return { retrieval_result: JSON.stringify(res.processing_result.data) };
};

/**
 * 流程节点 - 处理制度流程类投诉
 * @param {TypeComplaintAgentState} state - 投诉智能体状态
 * @returns {Object} 流程系统处理结果
 */
const process_node = async (state: TypeComplaintAgentState) => {
	const { intent_type, intent_level, complaint_info, customer_info } = state;
	const res = await process_tool(intent_type, intent_level, customer_info);
	return { retrieval_result: JSON.stringify(res.processing_result.data) };
};
/**
 * 安全节点 - 处理信息披露类投诉
 * @param {TypeComplaintAgentState} state - 投诉智能体状态
 * @returns {Object} 安全合规系统处理结果
 */
const security_node = async (state: TypeComplaintAgentState) => {
	const { intent_type, intent_level, complaint_info, customer_info } = state;
	const res = await security_tool(intent_type, intent_level, customer_info);
	return { retrieval_result: JSON.stringify(res.processing_result.data) };
};
/**
 * 其他节点 - 处理其他类型投诉
 * @param {TypeComplaintAgentState} state - 投诉智能体状态
 * @returns {Object} 综合处理系统结果
 */
const other_node = async (state: TypeComplaintAgentState) => {
	const { intent_type, intent_level, complaint_info, customer_info } = state;
	const res = await other_tool(intent_type, intent_level, customer_info);
	return { retrieval_result: JSON.stringify(res.processing_result.data) };
};

// 读取客服服务提示词
const customer_service_md = fs.readFileSync(
	path.join(__dirname, "../prompts/customer_service.md"),
	"utf-8"
);

/**
 * 回复生成节点 - 根据投诉内容和处理结果生成客服回复
 * @param {TypeComplaintAgentState} state - 投诉智能体状态
 * @returns {Object} 包含生成的回复结果
 */
const reply_node = async (state: TypeComplaintAgentState) => {
	const result = await model.invoke([
		new SystemMessage(customer_service_md),
		new HumanMessage(`
			投诉标题：${state.complaint_info.title}
			投诉内容：${state.complaint_info.description}
			处理结果：${state.retrieval_result}
			`),
	]);
	return { reply_result: result.content };
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
	.addNode("customer", customer_info_node)
	.addNode("business", business_node)
	.addNode("service", service_node)
	.addNode("process", process_node)
	.addNode("security", security_node)
	.addNode("other", other_node)
	.addNode("reply", reply_node)
	.addEdge(START, "intent")
	.addEdge("intent", "customer")
	.addConditionalEdges("customer", shouldContinue, {
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
	.addEdge("reply", END);

const graph = workflow.compile();

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

const invoke = async () => {
	let index = 2;
	let complaint_info: TypeComplaintInfo;
	if (index == 1) {
		// 示例 1: 银行卡业务 - 高级别投诉
		complaint_info = {
			title: "信用卡被盗刷5万元未能及时止损",
			description:
				"我的信用卡在2024年11月25日凌晨3点在境外被盗刷了5万元，当时我人在深圳并持有卡片。我立即拨打客服电话申请冻结，但客服系统繁忙无人接听，导致又被盗刷2笔共计2万元。直到早上7点才联系上客服冻结卡片，此时已造成7万元损失。我认为银行风控系统存在严重问题，且客服响应不及时，要求银行承担全部损失并赔偿。",
		};
	} else if (index == 2) {
		// 示例 2: 服务态度 - 中级别投诉
		complaint_info = {
			title: "柜台工作人员服务态度恶劣",
			description:
				"今天上午10点我在深圳分行营业部办理业务时，3号柜台的工作人员态度非常差。我询问理财产品相关问题时，她不耐烦地说'不懂就别买，浪费时间'，并且在我填写单据时多次催促，让我感到非常不舒服。作为老客户，我对这种服务态度非常失望，希望银行能够重视员工培训，提升服务质量。",
		};
	} else if (index == 3) {
		// 示例 3: 误导销售 - 高级别投诉
		complaint_info = {
			title: "理财经理误导销售高风险理财产品",
			description:
				"上个月理财经理向我推荐了一款理财产品，声称是保本保息、随时可赎回，年化收益6%。我投入了50万元。但现在产品亏损了8万元,我要求赎回时被告知有3个月封闭期。查看合同才发现这是一款R4风险等级的非保本浮动收益产品。理财经理在销售时完全没有告知风险，涉嫌误导销售，我要求银行退还本金并赔偿损失。",
		};
	} else if (index == 4) {
		// 示例 4: 贷款业务 - 紧急级别投诉
		complaint_info = {
			title: "房贷利率违规上浮威胁断贷",
			description:
				"我2020年办理的首套房贷款，合同约定LPR+0.5%。但从今年开始,银行擅自将利率调整为LPR+1.2%，每月多还款2000多元。我多次与银行沟通要求恢复原利率，但客户经理态度强硬，称这是总行统一调整。如果不接受就要求提前还款，否则影响征信。这严重侵害了我的合法权益，我已准备向银保监会投诉并寻求法律途径解决。",
		};
	} else if (index == 5) {
		// 示例 5: 收费定价 - 中级别投诉
		complaint_info = {
			title: "账户管理费和短信费乱扣费",
			description:
				"我在你行开立的储蓄账户，最近3个月每月都被扣除10元账户管理费和3元短信服务费。但我从未申请过短信服务，账户管理费的收取标准也不清楚。我查询时柜台人员说是系统自动扣除，让我自己去营业厅办理取消。我认为这种不经客户同意就扣费的行为不合理，要求退还已扣费用并说明收费依据。",
		};
	} else if (index == 6) {
		// 示例 6: 系统问题 - 中级别投诉
		complaint_info = {
			title: "网银转账系统故障导致重复扣款",
			description:
				"11月23日下午我通过网银向供应商转账10万元货款，提交后显示'系统繁忙，请稍后重试'。我又操作了2次都是同样提示。但今天查询发现账户被扣款了3次共30万元，导致我其他款项无法支付，影响了业务运营。我已联系客服，但处理效率很慢，至今还有20万元未退回。要求尽快退款并给予合理补偿。",
		};
	} else {
		// 示例 7: 制度流程 - 低级别投诉
		complaint_info = {
			title: "开通网银业务流程过于繁琐",
			description:
				"我昨天去营业网点开通企业网银，需要填写5份表格，提供各种证明材料，还要法人到场签字。整个流程耗时2个多小时，中间还要在不同窗口排队等候。相比其他银行，你行的开户流程过于复杂和低效。建议优化业务流程，简化材料要求，提高办事效率，改善客户体验。",
		};
	}

	const result = await graph.invoke({
		complaint_info: complaint_info,
	});
	console.log(result.reply_result);
};
invoke();
