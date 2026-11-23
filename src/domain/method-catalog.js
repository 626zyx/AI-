/* Read-only platform method definitions. User resources are question banks, never methods. */
import { methodCatalog as originalMethods } from "../data/catalog.js";

const definitions = [
  [
    "AutoDAN",
    "优化与搜索",
    "通过群体选择与变异探索有效提示词",
    "autodan_attack",
    ["攻击生成模型", "裁判模型"],
  ],
  [
    "Genetic",
    "优化与搜索",
    "组合选择、变异与判定步骤进行遗传搜索",
    "genetic_attack",
    ["攻击生成模型", "裁判模型"],
  ],
  [
    "SeqAR",
    "优化与搜索",
    "按序列反馈逐步优化攻击表达",
    "seqar_attack",
    ["攻击生成模型", "裁判模型"],
  ],
  [
    "Adaptive Attack",
    "优化与搜索",
    "使用前缀填充、迁移或概率反馈搜索",
    "adaptive_attack",
    ["裁判模型"],
  ],
  [
    "AutoDAN-Turbo-R",
    "反馈改写",
    "结合推理与策略检索迭代改写",
    "autodan_turbo_r",
    ["攻击生成模型", "裁判模型", "文本嵌入模型"],
  ],
  [
    "AIR",
    "反馈改写",
    "将指令拆分并重新组织为上下文",
    "air_attack",
    ["攻击生成模型", "裁判模型"],
  ],
  [
    "Past Tense",
    "表达与编码",
    "通过时态变换检查指令理解边界",
    "past_tense",
    ["攻击生成模型", "裁判模型"],
  ],
  [
    "ArtPrompt",
    "表达与编码",
    "使用字符画表达检查内容理解",
    "artprompt",
    ["裁判模型"],
  ],
  ["JAM", "表达与编码", "组合编码与格式变换检查内容边界", "jam", ["裁判模型"]],
  [
    "Response Attack",
    "情境与对话",
    "构造对话上下文检查任务边界",
    "response_attack",
    ["攻击生成模型", "裁判模型"],
  ],
  [
    "Query-Relevant",
    "多模态",
    "组合任务相关图片与文本进行演练",
    "query_relevant_attack",
    ["攻击生成模型", "图像生成模型", "裁判模型"],
  ],
  [
    "IDEATOR",
    "多模态",
    "依据视觉反馈迭代图片和提示词",
    "ideator_attack",
    ["攻击生成模型", "图像生成模型", "裁判模型"],
  ],
  ["MML", "多模态", "将文字内容转换为图文组合", "mml_attack", ["裁判模型"]],
  [
    "HADES",
    "多模态",
    "通过图文组合与辅助反馈检查边界",
    "hades_attack",
    ["攻击生成模型", "图像生成模型", "裁判模型"],
  ],
  [
    "HIMRD",
    "多模态",
    "结合图片理解和图文诱导进行迭代",
    "himrd_attack",
    ["攻击生成模型", "图像生成模型", "裁判模型"],
  ],
  [
    "JOOD",
    "多模态",
    "通过文字图像混合与图像变换演练",
    "jood_attack",
    ["攻击生成模型", "图像生成模型", "裁判模型"],
  ],
  ["SI", "多模态", "重排文本和图片片段并迭代验证", "si_attack", ["裁判模型"]],
  [
    "CS-DJ",
    "多模态",
    "结合问题分解、图片检索和图文组合",
    "csdj_attack",
    ["攻击生成模型", "图文嵌入模型", "裁判模型"],
  ],
  [
    "ActorAttack",
    "协同规划",
    "从关联主题逐步构造多轮对话",
    "actor_attack",
    ["攻击生成模型", "裁判模型"],
  ],
  [
    "Rainbow Teaming",
    "协同规划",
    "组合业务类别与表达风格探索覆盖",
    "rainbow_teaming",
    ["攻击生成模型", "裁判模型"],
  ],
  [
    "X-Teaming",
    "协同规划",
    "协同规划与优化多轮演练",
    "xteaming_attack",
    ["攻击生成模型", "裁判模型"],
  ],
  [
    "EvoSynth",
    "协同规划",
    "通过多个协作角色生成和优化演练",
    "evosynth",
    ["攻击生成模型", "裁判模型"],
  ],
  [
    "NanoGCG",
    "白盒优化",
    "基于模型梯度优化提示词后缀",
    "nanogcg_attack",
    ["裁判模型"],
  ],
  [
    "Visual Jailbreak",
    "白盒优化",
    "基于视觉模型梯度优化图像输入",
    "visual_jailbreak_attack",
    ["裁判模型"],
  ],
  [
    "ASA",
    "白盒优化",
    "通过内部激活干预探索模型表现",
    "activation_steering_attack",
    ["裁判模型"],
  ],
  [
    "Imperceptible Jailbreak",
    "白盒优化",
    "利用本地 token 概率优化隐蔽文本变换",
    "imperceptible_jailbreak",
    ["裁判模型"],
  ],
];
const families = {
  基线测试: ["Direct"],
  优化与搜索: [
    "GPTFuzzer",
    "TreeAttack",
    "RACE",
    "AutoDAN",
    "Genetic",
    "SeqAR",
    "Adaptive Attack",
  ],
  反馈改写: [
    "PAIR",
    "ReNeLLM",
    "DrAttack",
    "AutoDAN-Turbo",
    "AutoDAN-Turbo-R",
    "AIR",
  ],
  表达与编码: [
    "CipherChat",
    "CodeAttack",
    "Multilingual",
    "Jailbroken",
    "ICA",
    "FlipAttack",
    "Mousetrap",
    "Prefill",
    "Past Tense",
    "ArtPrompt",
    "JAM",
  ],
  情境与对话: [
    "DeepInception",
    "Crescendo",
    "RedQueen",
    "CoA",
    "Response Attack",
  ],
  多模态: [
    "FigStep",
    "Query-Relevant",
    "IDEATOR",
    "MML",
    "HADES",
    "HIMRD",
    "JOOD",
    "SI",
    "CS-DJ",
  ],
  协同规划: ["ActorAttack", "Rainbow Teaming", "X-Teaming", "EvoSynth"],
  白盒优化: ["NanoGCG", "Visual Jailbreak", "ASA", "Imperceptible Jailbreak"],
};
const p = (key, label, value) => ({ key, label, value });
const params = {
  AutoDAN: [
    p("max_iterations", "最大优化次数", 5),
    p("population_size", "候选数量", 8),
  ],
  Genetic: [p("max_iterations", "最大优化次数", 5)],
  SeqAR: [p("max_iterations", "最大优化次数", 10)],
  "Adaptive Attack": [
    p("attack_mode", "搜索方式", "transfer"),
    p("max_retries", "最大重试次数", 3),
  ],
  "AutoDAN-Turbo-R": [
    p("max_iterations", "最大优化次数", 10),
    p("warm_up_iterations", "预热次数", 1),
  ],
  AIR: [
    p("reformulate_method", "重组方式", "k4"),
    p("max_restarts", "最大重启次数", 10),
  ],
  "Past Tense": [p("tense", "时态", "past")],
  ArtPrompt: [p("font", "字符画字体", "standard")],
  JAM: [p("iter_toxic", "格式优化次数", 20)],
  "Response Attack": [
    p("attack_type", "对话方式", "type1"),
    p("max_retries", "最大重试次数", 3),
  ],
  IDEATOR: [p("max_iterations", "最大优化次数", 5)],
  SI: [p("max_iterations", "最大优化次数", 10)],
  ActorAttack: [
    p("max_turns", "最大对话轮次", 6),
    p("max_clues", "线索数量", 6),
  ],
  "Rainbow Teaming": [p("max_iterations", "最大优化次数", 8)],
  "X-Teaming": [
    p("max_turns", "最大对话轮次", 5),
    p("max_iterations_per_turn", "每轮优化次数", 3),
  ],
  EvoSynth: [p("max_iterations", "协同优化次数", 5)],
};
const extras = definitions.map(
  ([name, family, desc, registry, dependencies]) => ({
    id: name,
    name,
    family,
    desc,
    registry,
    dependencies,
    source: "OpenRT",
    generator: dependencies.includes("攻击生成模型"),
    process: dependencies.includes("裁判模型"),
    turns: ["情境与对话", "协同规划"].includes(family) ? "多轮" : "单轮",
    params: params[name] || [],
  }),
);
export const methodDependencies = (method) => [
  ...new Set(
    method.dependencies ||
      [
        method.generator ? "攻击生成模型" : "",
        method.process ? "裁判模型" : "",
      ].filter(Boolean),
  ),
];
export const modelMethodCatalog = [...originalMethods, ...extras]
  .map((method) => {
    const family =
      Object.entries(families).find(([, names]) =>
        names.includes(method.name),
      )?.[0] || method.family;
    const dependencies = methodDependencies(method);
    if (method.name === "DrAttack") dependencies.push("文本嵌入模型");
    const requires =
      family === "白盒优化"
        ? ["local-model"]
        : family === "多模态"
          ? ["image-input"]
          : ["text-input"];
    return {
      ...method,
      family,
      source: "OpenRT",
      sourcePath: method.source?.startsWith("OpenRT/")
        ? method.source
        : undefined,
      dependencies: [...new Set(dependencies)],
      requires,
      requirements:
        family === "白盒优化"
          ? "需要本地模型与内部访问能力"
          : family === "多模态"
            ? "靶标需支持图像输入"
            : "靶标需支持文本输入",
      runtime:
        method.name === "CS-DJ"
          ? "图文嵌入与图片库"
          : method.name === "JAM"
            ? "文本分类辅助模型"
            : method.name === "EvoSynth"
              ? "多角色协作运行环境"
              : method.name === "Adaptive Attack"
                ? "随机搜索模式需靶标支持 token 概率"
                : "",
    };
  })
  .sort(
    (a, b) =>
      Object.keys(families).indexOf(a.family) -
      Object.keys(families).indexOf(b.family),
  );
