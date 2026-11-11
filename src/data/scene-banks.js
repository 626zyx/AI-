/* 场景题库：按 domain 分组的 OpenART 任务包。
 * 一个 domain 一套题库，与 openart_mid_by_domain 的 14 个 zip 一一对应。
 *
 * total / labelCoverage / items 由 _tools/extract_scenebank.py 从
 * all_tasks_index.jsonl 与各题的 analysis_labels.json 生成。
 * 这里先只放题库骨架（名称、编码、来源），items 为空数组。 */

const ORIGIN = 'dongdongunique/openart-planner-tasks · mid · b4089b2';
const TAXONOMY = 'openart-mid-risk-taxonomy-v1';

const DOMAINS = [
  ['01', 'general_operations', '通用运营与办公协作', 509],
  ['02', 'security_governance', '安全与治理', 83],
  ['03', 'marketing_media', '营销与媒体', 76],
  ['04', 'software_data', '软件与数据', 57],
  ['05', 'finance_insurance', '金融与保险', 49],
  ['06', 'customer_community', '客户服务与社区运营', 47],
  ['07', 'education_research', '教育与研究', 46],
  ['08', 'legal_compliance', '法律与合规', 36],
  ['09', 'procurement_facilities', '采购、供应链与设施运营', 34],
  ['10', 'hr_recruiting', '人力与招聘', 33],
  ['11', 'healthcare_clinical', '医疗与临床', 27],
  ['12', 'public_government', '公共与政务', 21],
  ['13', 'personal_household', '个人与家庭事务', 18],
  ['14', 'nonprofit_volunteer', '非营利与志愿服务', 10],
];

export const sceneBanks = DOMAINS.map(([no, code, name, total]) => ({
  id: `sbank-${no}-${code.replace(/_/g, '-')}`,
  no,
  code,
  name,
  source: 'system',
  origin: ORIGIN,
  taxonomyVersion: TAXONOMY,
  /* total 来自打包时的题数，items 落地后应与之一致 */
  total,
  /* 各风险标签覆盖多少条题。ASR 分母的唯一来源 */
  labelCoverage: {},
  items: [],
  createdAt: null,
}));
