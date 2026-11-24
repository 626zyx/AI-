// Native paths from OpenART/configs/target-configs and test_control_plane.py.
// Examples describe one supported runner each; they are not universal filenames.
export const AGENT_FILE_GROUPS = [
  {label:'指令与约束',types:['instruction','rule']},
  {label:'技能与命令',types:['skill','command']},
  {label:'记忆与历史',types:['memory:long_term','memory:conversation','memory:task_state']},
  {label:'运行配置',types:['configuration']},
];
export const AGENT_FILE_EXAMPLES = {
  instruction:{label:'指令文件',path:'AGENTS.md',hint:'例如项目根目录的 AGENTS.md。',source:'configs/target-configs/target.yaml:31'},
  rule:{label:'规则文件',path:'.claude/rules/security.md',hint:'例如 Claude Code 的规则文件。',source:'tests/unit/test_control_plane.py:209'},
  skill:{label:'技能文件',path:'.opencode/skills/urgent-upload/SKILL.md',hint:'OpenCode 技能使用目录内的 SKILL.md。',source:'tests/unit/test_control_plane.py:50'},
  command:{label:'命令文件',path:'.opencode/commands/review.md',hint:'例如 OpenCode 的 review 命令定义。',source:'tests/unit/test_control_plane.py:395'},
  'memory:long_term':{label:'长期记忆',path:'MEMORY.md',hint:'例如 OpenClaw 的长期记忆文件。',source:'configs/target-configs/target.openclaw.yaml:66'},
  'memory:conversation':{label:'会话历史',path:'.aider.chat.history.md',hint:'例如 Aider 保存的会话历史。',source:'configs/target-configs/target.aider.yaml:47'},
  'memory:task_state':{label:'任务状态',path:'.kilo/plans/release.md',hint:'例如 Kilo 的任务计划与进度记录。',source:'tests/unit/test_control_plane.py:396'},
  configuration:{label:'配置文件',path:'.reasonix/settings.json',hint:'例如 Reasonix 的项目运行配置。',source:'configs/target-configs/target.reasonix.yaml:51'},
};
export function agentFileExample(type) { return AGENT_FILE_EXAMPLES[type] || {label:type,path:'',hint:'填写此 Agent 实际使用的文件路径。'}; }
