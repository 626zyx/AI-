/* Initial-state view model. It intentionally has no task or asset-history input.
 * Catalog resources are real; connecting a backend only changes the catalog provider. */
export const INITIAL_METRICS = [
  { label: '演练任务', description: '已完成的演练任务数' },
  { label: '攻击单元', description: '已执行的测试单元数' },
  { label: '攻破 / 泄漏', description: '被判定为攻破的单元数' },
  { label: '整体 ASR', description: '攻破数 ÷ 有效判定数' },
  { label: '覆盖靶标', description: '已完成演练的不同靶标数' },
  { label: '风险事件', description: '满足风险规则的任务数' },
];

export function initialResources({ banks = [], sceneBanks = [] } = {}) {
  return [
    ...banks.filter(bank => bank.source === 'system').map(bank => ({ name: bank.name, kind: '模型攻击题库', page: 'strategy', sub: 'banks' })),
    ...sceneBanks.filter(bank => bank.source === 'system' && bank.items?.length).map(bank => ({ name: bank.name, kind: `Agent 场景题库 · ${bank.items.length} 题`, page: 'strategy', sub: 'scenebanks' })),
  ];
}

export { exerciseDemoSequences as welcomeSequences } from './exercise-demo.js';
