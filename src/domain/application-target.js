/* Application metadata identifies a target; only an exact execution resource supplies runtime fields. */
const copy = value => value == null ? null : structuredClone(value);
const clean = value => String(value ?? '').trim();
const encoded = value => encodeURIComponent(value).replaceAll("'", '%27');
const identity = (source, assetId) => `${source ? 'platform:' + encoded(source) : 'manual'}:${encoded(assetId)}`;
let readApplication;

// Registered lazily by the directory to avoid the asset-intake -> store import cycle.
export function registerApplicationTargetDirectory(reader) { readApplication = reader; }

export function applicationTargetSnapshot(application) {
  if (!application) return null;
  const { versions, ...snapshot } = application;
  return copy(snapshot);
}

function runtimeMissing(target) {
  const missing = [];
  if (!clean(target?.image)) missing.push('镜像引用');
  if (!(Array.isArray(target?.command) ? target.command.some(clean) : clean(target?.command))) missing.push('启动命令');
  if (!['stdin', 'argv'].includes(target?.taskInput)) missing.push('任务输入方式');
  return missing;
}

export function resolveApplicationTarget(application, agents = [], currentApplication) {
  const snapshot = applicationTargetSnapshot(application);
  if (!snapshot) return { target: null, executableId: '', applicationSnapshot: null, matched: false, missingFields: [], availability: 'unselected', issues: [] };
  const source = clean(snapshot.platformConnectionId), assetId = clean(snapshot.assetId);
  const version = clean(snapshot.enterpriseVersion), address = clean(snapshot.address);
  const issues = [];
  let availability = 'available';
  if (arguments.length < 3) currentApplication = readApplication?.(snapshot.id);
  if (!snapshot.id || snapshot.id !== identity(source, assetId) || !assetId || !version || !address) {
    availability = 'invalid'; issues.push('所选应用的来源、资产 ID、版本或地址不完整，请重新选择');
  } else if (currentApplication === undefined) {
    availability = 'unverified'; issues.push('尚未读取当前应用目录，请重新选择靶标应用');
  } else if (!currentApplication) {
    availability = 'missing'; issues.push('所选应用已从资产目录删除，请重新选择');
  } else if (['已下架', '已停用'].includes(currentApplication.sourceStatus)) {
    availability = 'disabled'; issues.push(`所选应用${currentApplication.sourceStatus}，不能用于演练`);
  } else if (['id', 'assetId', 'platformConnectionId', 'enterpriseVersion', 'addressType', 'address'].some(key => clean(currentApplication[key]) !== clean(snapshot[key]))) {
    availability = 'changed'; issues.push('所选应用的来源、版本或地址已变更，请重新选择并验证');
  }
  const matches = agents.filter(agent => {
    const runtime = agent.assetSnapshot || agent;
    const runtimeSource = clean(runtime.platformConnectionId || agent.platformConnectionId);
    const runtimeId = source ? clean(runtime.sourceRecordId || agent.sourceRecordId || runtime.id)
      : clean(agent.assetId || runtime.id || agent.id);
    const runtimeVersion = clean(runtime.enterpriseVersion || agent.enterpriseVersion || agent.assetVersion || runtime.version || agent.version);
    const runtimeAddress = clean(runtime.address || agent.address || runtime.runtimeEndpoint || agent.runtimeEndpoint || runtime.image || agent.image);
    return (!runtime.kind || runtime.kind === 'agent') && runtimeSource === source && runtimeId === assetId
      && runtimeVersion === version && runtimeAddress === address;
  });
  const executable = matches.length === 1 ? matches[0] : null;
  if (!executable) issues.push(matches.length > 1 ? '同一应用版本对应多个运行配置，需明确运行配置后再验证' : '所选应用尚未关联相同来源、版本和地址的 Agent 运行配置');
  const target = executable ? copy(executable) : {
    id: snapshot.id, name: snapshot.name || assetId, address, addressType: snapshot.addressType,
    status: 'planned', sourceStatus: snapshot.sourceStatus, image: '', command: [], taskInput: '', promptFlag: '', surfaces: [], surfaceDeclarations: [],
  };
  Object.assign(target, {
    targetApplicationSnapshot: copy(snapshot), applicationAvailability: availability,
    applicationIssues: [...issues], applicationCurrentState: currentApplication ? {
      id: currentApplication.id, assetId: currentApplication.assetId, platformConnectionId: currentApplication.platformConnectionId,
      enterpriseVersion: currentApplication.enterpriseVersion, addressType: currentApplication.addressType,
      address: currentApplication.address, sourceStatus: currentApplication.sourceStatus,
    } : null,
  });
  return { target, executableId: executable?.id || '', applicationSnapshot: snapshot, matched: !!executable,
    missingFields: runtimeMissing(target), availability, issues };
}
