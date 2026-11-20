/* Generic process explanations, never fabricated prompts, outputs or judgments. */
export function exerciseDemoSequences(type) {
  if (type === 'model') return [{
    title: '配置 → 攻防 → 评估', target: '待选择模型', guardStages: ['输入', '输出'],
    events: [
      { role: 'src', label: '01 · 红队生成攻击', text: '按照已发布策略，从题库选取题目，使用配置的攻击方法生成测试输入。', action: 'attack' },
      { role: 'input_guard', label: '02 · 输入侧防护（可选）', text: '启用蓝队后，输入侧审核在内容送达靶标前进行。' },
      { role: 'tgt', label: '03 · 靶标响应', text: '被测模型接收测试输入，返回响应；平台保留对应的攻防记录。', action: 'reply' },
      { role: 'output_guard', label: '04 · 输出侧防护（可选）', text: '如配置输出侧防护，在响应交付前审核内容，并记录防护结果。' },
      { role: 'judge', label: '05 · 裁判评估', text: '裁判依据实际输入与响应判定结果。任务完成后汇总攻击成功率（ASR）并生成报告。' },
    ],
  }];
  return [{
    title: '配置 → 执行 → 评估', target: '待选择智能体', taskLabel: '流程示意',
    scene: { steps: [], injected: ['指令文件'], outputs: ['交付产物'] },
    events: [
      { phase: 'guide', role: 'tgt', label: '准备题目', text: '选择已接入的智能体与场景题库，明确题目目标及交付要求。', content: [{ key: 'goal', label: '题目目标', text: '题目包含业务描述、要求和输入材料，定义需要完成的工作。' }] },
      { phase: 'guide', role: 'src', label: '布置攻击', action: 'inject', text: '基础安全演练直接测试原题；间接提示注入在选定范围布置攻击文件。', content: [{ key: 'injection', label: '注入范围', text: '仅使用资产接入时已核验、且创建任务时选定的注入文件。' }] },
      { phase: 'guide', role: 'tgt', label: '靶标执行', action: 'outputs', text: '智能体处理题目并交付产物。此阶段收集输出，不提前给出评估结论。', content: [{ key: 'output', label: '收集交付', text: '记录最终答复及产物文件，作为后续完成度与抵御情况的判读依据。' }] },
      { phase: 'guide', role: 'judge', label: '裁判评估', text: '执行结束后，再根据实际产物和攻击记录形成判定与演练报告。', content: [{ key: 'evaluation', label: '评估内容', text: '靶标完成度、抵御情况、判定理由与攻击成功率（ASR）。没有实际演练时不生成结果。' }] },
    ],
  }];
}
