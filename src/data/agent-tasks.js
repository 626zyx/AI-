/* 自动生成：_tools/extract_agent.py，勿手改 */
import { fiveTaskTasks } from './five-task-batch.js';
export const agentTasks = [
 ...fiveTaskTasks,
 {
  "id": "task-agt-cs5-baseline",
  "name": "Qwen Code 客服前 5 题 · 基础安全演练",
  "objectType": "agent",
  "targetId": "agt-qwen-ds-flash",
  "targetName": "Qwen Code · DeepSeek-Flash",
  "status": "done",
  "sceneBankId": "sbank-06-customer-community",
  "sceneBankName": "客户服务与社区运营",
  "strategyId": "agstg-cs-baseline",
  "strategyName": "客服 · 基础安全演练",
  "technique": "baseline",
  "techniqueName": "基础安全演练",
  "attackerId": null,
  "attackerName": null,
  "judgeId": "mdl-deepseek-v4-pro",
  "judgeName": "DeepSeek-V4-Pro",
  "taskIdSnapshot": [
   "openart-mid-000003",
   "openart-mid-000038",
   "openart-mid-000040",
   "openart-mid-000047",
   "openart-mid-000052"
  ],
  "concurrency": 4,
  "targetTimeout": 900,
  "total": 5,
  "startedAt": "2026-11-12 21:10",
  "finishedAt": "2026-11-12 22:32"
 },
 {
  "id": "task-agt-cs5-universal",
  "name": "Qwen Code 客服前 5 题 · 间接提示注入",
  "objectType": "agent",
  "targetId": "agt-qwen-ds-flash",
  "targetName": "Qwen Code · DeepSeek-Flash",
  "status": "done",
  "sceneBankId": "sbank-06-customer-community",
  "sceneBankName": "客户服务与社区运营",
  "strategyId": "agstg-cs-universal",
  "strategyName": "客服 · 间接提示注入",
  "technique": "universal",
  "techniqueName": "间接提示注入",
  "attackerId": "mdl-deepseek-v4-pro",
  "attackerName": "DeepSeek-V4-Pro",
  "judgeId": "mdl-deepseek-v4-pro",
  "judgeName": "DeepSeek-V4-Pro",
  "taskIdSnapshot": [
   "openart-mid-000003",
   "openart-mid-000038",
   "openart-mid-000040",
   "openart-mid-000047",
   "openart-mid-000052"
  ],
  "concurrency": 4,
  "targetTimeout": 900,
  "total": 5,
  "startedAt": "2026-11-13 13:32",
  "finishedAt": "2026-11-13 14:16"
 }
];
