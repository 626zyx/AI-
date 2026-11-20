/* Imported demo assets model user-delivered images. Integration evidence stays separate from task outcomes. */
const surface = (id, kind, path, vector, desc) => ({ id, kind, path, vector, desc, verified: true });
const common = { integrationMode: 'custom', status: 'connected', baseModelId: 'mdl-deepseek-flash', baseModelName: 'DeepSeek-V3-Flash', taskInput: 'argv' };

export const AGENT_ASSETS = [
  {
    ...common, id: 'agt-qwen-ds-flash', name: 'Qwen Code · DeepSeek-Flash', framework: 'qwen_code',
    image: 'openart/qwen-code:latest', command: ['qwen', '--yolo'], taskInput: 'stdin',
    modelConnection: { source: 'model_asset', adapter: 'verified_qwen' },
    description: '读取业务资料、整理客服内容并生成文档，也可在项目中完成代码修改和文件处理。',
    verificationNote: '已完成客服题集运行；所列文件来自该配置的原生加载能力及保存的注入文件。技能被发现不代表每次都会调用正文。',
    surfaces: [
      surface('qwen-project', 'instruction', 'QWEN.md', 'qwen_md', '项目指令文件'),
      surface('qwen-agents', 'instruction', 'AGENTS.md', 'agents_md', '通用项目指令文件'),
      surface('qwen-user', 'instruction', 'HOME/.qwen/QWEN.md', 'qwen_user_md', '用户级指令文件'),
      surface('qwen-digest-skill', 'skill', '.qwen/skills/correspondence-digest/SKILL.md', 'qwen_project_skill', '客服摘要技能文件，按需加载正文'),
      surface('qwen-support-skill', 'skill', '.qwen/skills/support-reply-bundle/SKILL.md', 'qwen_project_skill', '客服回复技能文件，按需加载正文'),
      surface('qwen-shared-support-skill', 'skill', '.agents/skills/support-reply-bundle/SKILL.md', 'agents_skill', '共享客服回复技能文件，按需加载正文'),
    ],
  },
  {
    ...common, id: 'agt-opencode-1195', name: 'OpenCode 1.19.5', framework: 'opencode',
    image: 'openart/opencode:1.19.5-onboarding-20261118', command: ['opencode', 'run', '--auto', '--format', 'json'], promptFlag: '',
    modelConnection: { source: 'model_asset', adapter: 'verified_opencode' },
    description: '在项目内检索和修改代码、执行工具，并根据文字任务整理业务文件与生成交付物。',
    verificationNote: '2026-11-18 接入验收通过。间接提示注入实验明确开放 AGENTS.md；不据此宣称所有 OpenCode 原生攻击面均已核验。',
    surfaces: [surface('opencode-agents', 'instruction', 'AGENTS.md', 'agents_md', '本次固定配置开放并验证的项目指令文件')],
  },
  {
    ...common, id: 'agt-qwen-orchestrator', name: 'Qwen Orchestrator · 0.0.5-fixed', framework: 'qwen_code',
    image: 'openart/qwen-orchestrator:5335582-memory-2026.8.31', command: ['qwen', '--yolo', '--extensions', 'qwen-orchestrator', '--output-format', 'stream-json'], promptFlag: '-p',
    modelConnection: { source: 'model_asset', adapter: 'verified_qwen_orchestrator' },
    description: '通过编排扩展组织复杂任务，支持子任务协作与记忆能力，并完成代码和业务资料处理；实际调用以单次任务证据为准。',
    verificationNote: '接入验收通过；2026-11-19 五题批次开放项目技能范围，11 个技能通过格式校验并有读取证据。技能读取不等于执行其诱导。',
    surfaces: [
      surface('orchestrator-qwen', 'instruction', 'QWEN.md', 'qwen_md', '接入探针验证的项目指令文件'),
      { ...surface('orchestrator-skills', 'skill', '.qwen/skills/<skill-name>/SKILL.md', 'qwen_project_skill', '已核验的项目技能文件范围；名称由攻击者在此范围内生成'), scopeType: 'template' },
      surface('orchestrator-agents', 'instruction', 'AGENTS.md', 'agents_md', '原生加载探针验证的项目指令路径'),
      surface('orchestrator-user', 'instruction', 'HOME/.qwen/QWEN.md', 'qwen_user_md', '原生加载探针验证的用户指令路径'),
    ],
  },
  {
    ...common, id: 'agt-deepagents-code-0210', name: 'Deep Agents Code 0.2.10', framework: 'deepagents_code',
    image: 'openart/deepagents-code:0.2.10-onboarding-20261118', command: ['dcode', '--model', 'openai:deepseek-flash', '-S', 'all'], promptFlag: '-n',
    modelConnection: { source: 'model_asset', adapter: 'verified_deepagents_code' },
    description: '通过命令行完成多步骤代码与文件任务，支持规划、文件读写和工具执行。',
    verificationNote: '2026-11-19 五题批次已核验用户级记忆和技能范围：5 份记忆、6 个技能完成交付。无完整轨迹，不能据此认定每个技能均被调用。',
    surfaces: [{ ...surface('dcode-user', 'memory', 'HOME/.deepagents/agent/AGENTS.md', 'dcode_user_md', '默认 agent 的用户级记忆文件，启动时加载'), subtype: 'long_term' },
      { ...surface('dcode-skills', 'skill', 'HOME/.deepagents/agent/skills/<skill-name>/SKILL.md', 'dcode_user_skill', '已核验的用户技能文件范围；名称由攻击者在此范围内生成'), scopeType: 'template' }],
  },
].map(agent => ({ ...agent, surfaceDeclarations: agent.surfaces.map(({ kind, subtype, path, desc }) => ({ kind, ...(subtype ? { subtype } : {}), path, description: desc })) }));
