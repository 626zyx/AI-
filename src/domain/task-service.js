/* 任务生命周期服务：负责命令校验、订阅和执行调度，不读 DOM。
 * store 只装配依赖并转发 API；持久化交给 repository，证据投影交给 replay。
 * 数据及仓库可注入，替换服务端 provider 时不改页面的任务契约。 */
import { taskRepository } from './task-repository.js';
import { buildReplayEvents, projectReplay } from './task-replay.js';
import { replayMatchesConfiguration, resolveModelReplaySource } from './task-configuration.js';
import { resolveAgentReplaySource, agentReplayEvaluationSource, projectAgentEvaluationUnits } from './agent-replay-source.js';
import { modelEvaluatorConfiguration, modelEvaluatorSnapshot, markModelEvaluatorUsed } from './model-evaluators.js';
import { attachTaskClassification } from './task-classification.js';

export function createTaskService({ modelTasks, modelUnits, agentTasks, agentUnits, nowText, modelConfiguration, agentConfiguration, assertStrategyAvailable, assertTargetAvailable, captureClassification, repository: getRepository = taskRepository }) {
  const replaySources = new Map();
  const runtimeErrors = new Map();
  const taskListeners = new Set();
  const taskTimers = new Map();
  let runtimeEnabled = false;
  const taskNow = () => `${nowText()}:${String(new Date().getSeconds()).padStart(2, '0')}`;
  let lastCreatedTime = 0;
  const taskCreatedAt = () => {
    lastCreatedTime = Math.max(Date.parse(taskNow()) + new Date().getMilliseconds(), lastCreatedTime + 1);
    return new Date(lastCreatedTime).toISOString();
  };
  const copyTaskValue = (value) => JSON.parse(JSON.stringify(value));
  const taskId = type => `task-${type}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`;

  function rawSource(id, type) {
    return (type === 'agent' ? agentTasks : modelTasks).find((t) => t.id === id) || null;
  }

  function agentReplayScopeMatches(config, source) {
    if (config.technique === 'baseline') return true;
    const requested = (config.requestedSurfaces || []).map(surface => surface.path).sort();
    const recorded = source.requestedSurfaces?.length
      ? source.requestedSurfaces.map(surface => surface.path).sort()
      : [...new Set(agentUnits.filter(unit => unit.taskId === source.id)
        .flatMap(unit => (unit.attack?.surfaces || []).map(surface => surface.path)))].sort();
    return requested.length === recorded.length && requested.every((path, index) => path === recorded[index]);
  }

  function sourceBundle(record) {
    const key = `${record.objectType}:${record.sourceTaskId}:${record.id}:${record.evaluationMode || ''}:${(record.taskIdSnapshot || []).join(',')}`;
    if (!replaySources.has(key)) {
      let source = rawSource(record.sourceTaskId, record.objectType);
      if (!source) throw new Error('原始演练数据不可用，无法回放此任务');
      let units = (record.objectType === 'agent' ? agentUnits : modelUnits).filter((u) => u.taskId === source.id);
      if (record.objectType === 'model' && record.configSnapshot?.attackMode === 'custom') {
        const config=record.configSnapshot, questions=config.modelQuestionSnapshots || [];
        if (!questions.length) throw new Error('本次自由组合缺少题目快照，请重新保存配置');
        const planned=[];
        for (const method of config.methods || []) for (const question of questions) {
          const evidence=units.find(unit=>unit.method.toLowerCase()===method.name.toLowerCase() && unit.target===question.prompt);
          if (!evidence) throw new Error('暂无覆盖本次方法与选题范围的演练记录；配置已保留，请调整选择后重试');
          planned.push({ ...evidence, id: `${evidence.id}--selection-${planned.length}`, recordedUnitId: evidence.id,questionBankId:question.bankId,questionId:question.id });
        }
        units=planned;
        source={...source,total:units.length,bankCount:questions.length,banks:copyTaskValue(config.banks),bankName:config.bankName,
          methods:(source.methods || []).filter(method=>config.methods.some(selected=>selected.name.toLowerCase()===method.name.toLowerCase())),
          guard:null,reportSummary:null};
      }
      if (record.objectType === 'agent' && record.evaluationMode) {
        units = units.filter(unit => record.taskIdSnapshot.includes(unit.sceneTaskId));
        units = projectAgentEvaluationUnits(units, record.evaluationMode);
        source = agentReplayEvaluationSource(source, record.evaluationMode);
      }
      replaySources.set(key, { source, units, events: buildReplayEvents(source, units) });
    }
    return replaySources.get(key);
  }

  function projectTask(record) {
    if (!record.sourceTaskId && record.configurationMode === 'selected' && ['draft', 'ready'].includes(record.status)) {
      const executionUnits = record.objectType === 'agent' ? [] : (record.methods || []).flatMap(method => Array.from({ length: record.bankCount || 0 }, (_, index) => ({
        id: `${record.id}--planned-${method.order}-${index}`, taskId: record.id, method: method.name,
        target: '', history: [], rounds: 0, judgeSuccess: null, judgeScore: null, judgeReason: '',
        finalPrompt: '', output: '', executionStatus: 'pending',
        roundInfo: { maxRounds: method.maxRounds, completedRounds: 0, currentRound: null, breachRound: null, firstBreachRound: null, endReason: null },
      })));
      return { status: record.status, errorMessage: null, units: [], executionUnits, guard: null, logs: [],
        replay: { cursor: 0, totalEvents: 0, activeUnitId: null, stage: 'ready', round: null, completedUnits: 0 } };
    }
    let bundle;
    try { bundle = sourceBundle(record); }
    catch (error) {
      // One unavailable evidence bundle must not prevent other tasks from loading.
      runtimeErrors.set(record.id, error.message);
      clearTaskTimer(record.id);
      return { status: 'error', errorMessage: error.message, units: [], executionUnits: [], guard: null,
        logs: [{ kind: 'line', text: error.message }],
        replay: { cursor: record.replayCursor, totalEvents: 0, activeUnitId: null, stage: 'error', round: null, completedUnits: 0 } };
    }
    const state = runtimeErrors.has(record.id) ? { ...record, status: 'error' } : record;
    return { ...projectReplay(state, bundle.source, attachTaskClassification(bundle.units,record.classificationSnapshot), bundle.events),
      status: state.status, errorMessage: runtimeErrors.get(record.id) || null,
      sourceStartedAt: bundle.source.startedAt, sourceFinishedAt: bundle.source.finishedAt,
      replaySourceName: bundle.source.name,
      // Counts describe the actual evidence stream, while configSnapshot keeps the user's plan.
      total: bundle.units.length,
      // Aggregate protection metrics are final results, not configuration.
      guard: state.status === 'done' ? copyTaskValue(bundle.source.guard || null) : null,
      reportSummary: state.status === 'done' ? copyTaskValue(bundle.source.reportSummary || null) : null,
    };
  }

  function listTaskTemplates(type = 'model') {
    return (type === 'agent' ? agentTasks : modelTasks)
      .map((t) => ({ ...copyTaskValue(t), sourceTaskId: t.id, executionMode: 'replay', sourceStartedAt: t.startedAt }))
      .sort((a, b) => Number(Boolean(b.guardId)) - Number(Boolean(a.guardId)));
  }

  function configurationOf(source) {
    const keys = ['objectType', 'targetId', 'targetName', 'targetAssetId', 'targetAssetVersion', 'targetSnapshot', 'targetApplicationSnapshot', 'strategyId', 'strategyName', 'judgeId', 'judgeName',
      'guardId', 'guardName', 'guardStages', 'bankName', 'bankCount', 'concurrency', 'maxTokens',
      'sceneBankId', 'sceneBankName', 'technique', 'techniqueName', 'attackerId', 'attackerName', 'taskIdSnapshot', 'targetTimeout', 'total',
      'banks', 'guardEnabled', 'evaluationMetrics', 'maxRounds', 'stopRule', 'injectionSurfaceIds', 'requestedSurfaces',
      'judgeProvenance', 'evaluationBasis', 'executionBudgetNote', 'evaluationMode', 'evalStrategy', 'evaluationProvenance', 'executionIntent',
      'targetImage', 'targetModelId', 'targetModelName', 'targetModelApi', 'targetModelSnapshot', 'exerciseMode', 'attackTemplateId', 'attackTemplateName', 'attackTemplateSnapshot',
      'attackerModelApi', 'questionIds', 'questionSnapshots', 'sandboxValidationRequired', 'sandboxValidation', 'modelPreflightRequired', 'modelPreflight', 'evaluatorId', 'evaluatorName', 'evaluatorSnapshot', 'attackMode', 'questionSelection', 'modelQuestionSnapshots'];
    const config = Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, copyTaskValue(source[key])]));
    if (source.methods) config.methods = copyTaskValue(source.methods);
    if (source.objectType !== 'agent' && !config.evaluatorSnapshot) Object.assign(config, modelEvaluatorConfiguration(config));
    config.stopRule ||= '按攻击方法配置结束';
    return config;
  }

  function saveTask(data, { draft = false } = {}) {
    const type = data.objectType === 'agent' ? 'agent' : 'model';
    if (type === 'agent' && data.evaluationMode && data.evaluationMode !== 'llm') throw new Error('Agent 演练仅支持 LLM 评估');
    const repository = getRepository();
    const old = data.id ? repository.get(data.id) : null;
    if (data.id && (!old || !['draft', 'ready'].includes(old.status))) throw new Error('只能编辑草稿或待开始任务；运行后的任务请复制复测');
    const selectedId = data.sourceTaskId || old?.sourceTaskId || listTaskTemplates(type)[0]?.id;
    const selectedUserTask = repository.get(selectedId, { includeDeleted: true });
    const selectedConfiguration = old?.configurationMode === 'selected' || (type === 'agent' && !old && !data.sourceTaskId) || (
      selectedUserTask?.configurationMode === 'selected'
      || ['targetId', 'strategyId', 'judgeId', 'guardEnabled', 'guardStages', 'evaluatorId', 'attackMode', 'methods', 'banks'].some(key => Object.hasOwn(data, key)));
    const source = selectedConfiguration ? null : rawSource(selectedUserTask?.sourceTaskId || selectedId, type);
    if (!selectedConfiguration && !source) throw new Error('演练配置不可用');
    let name = String(data.name || '').trim();
    if (!name && !draft) throw new Error('请填写任务名称');
    if (!name) name = `未命名演练 ${taskNow()}`;
    if ([...modelTasks, ...agentTasks, ...repository.list()].some((t) => !repository.isDeleted(t.id) && t.id !== old?.id && t.name === name)) throw new Error('任务名称已存在，请修改后保存');
    if (selectedConfiguration && type === 'model' && !modelConfiguration) throw new Error('模型配置服务不可用');
    const previousConfig = old?.configSnapshot || selectedUserTask?.configSnapshot || {};
    const nextInput = { ...previousConfig, ...data };
    if(type==='agent'&&(old?.sandboxValidationRequired||previousConfig.sandboxValidationRequired))nextInput.sandboxValidationRequired=true;
    if(type==='model'&&(old?.modelPreflightRequired||previousConfig.modelPreflightRequired))nextInput.modelPreflightRequired=true;
    let config;
    if (selectedConfiguration && type === 'model') {
      const validated = modelConfiguration(nextInput, { draft });
      // Updating one role must not re-resolve other saved roles or red-team parameters from today's catalog.
      config = old ? copyTaskValue(previousConfig) : validated;
      if (old) {
        const sameId = key => String(nextInput[key] || '').replace(/^tgt-/, 'mdl-') === String(previousConfig[key] || '').replace(/^tgt-/, 'mdl-');
        const update = keys => keys.forEach(key => { config[key] = validated[key]; });
        if (!sameId('targetId') || validated.targetAssetId) update(['targetId', 'targetName', 'targetAssetId', 'targetAssetVersion', 'targetSnapshot']);
        if (!sameId('judgeId')) update(['judgeId', 'judgeName']);
        if (!sameId('evaluatorId') || !previousConfig.evaluatorSnapshot) update(['evaluatorId', 'evaluatorName', 'evaluatorSnapshot']);
        const attackMode = nextInput.attackMode || 'strategy';
        const attackChanged = attackMode !== (previousConfig.attackMode || 'strategy') || !sameId('strategyId')
          || (attackMode === 'custom' && ['methods', 'banks', 'questionSelection'].some(key => Object.hasOwn(data,key) && JSON.stringify(data[key]) !== JSON.stringify(previousConfig[key])));
        if (attackChanged) update(['attackMode', 'questionSelection', 'modelQuestionSnapshots', 'strategyId', 'strategyName', 'banks', 'bankName', 'bankCount', 'methods', 'total', 'attackerId', 'attackerName']);
        if (!sameId('judgeId')) {
          // Process evaluation uses the chosen judge, with a separate stored role for compatibility.
          config.methods = (config.methods || []).map(method => !method.aux?.process && !(method.params||[]).some(([label])=>/过程裁判|process/i.test(label)) && !(method.auxiliaryModels||[]).some(role=>/过程裁判|process/i.test(role.role)) ? method : ({ ...method,
            ...(method.aux?.process ? { aux: { ...method.aux, process: validated.judgeId } } : {}),
            params: (method.params || []).map(([label,value]) => [label, /过程裁判|process/i.test(label) ? validated.judgeName : value]),
            auxiliaryModels: (method.auxiliaryModels || []).map(role => /过程裁判|process/i.test(role.role) ? { ...role, id: validated.judgeId, name: validated.judgeName } : role),
          }));
        }
        const sameGuard = (nextInput.guardEnabled ?? !!nextInput.guardId) === (previousConfig.guardEnabled ?? !!previousConfig.guardId)
          && String(nextInput.guardId || '') === String(previousConfig.guardId || '')
          && JSON.stringify(nextInput.guardStages || []) === JSON.stringify(previousConfig.guardStages || []);
        if (!sameGuard) update(['guardEnabled', 'guardId', 'guardName', 'guardStages']);
        update(['concurrency', 'maxTokens']);
        if(validated.modelPreflightRequired)update(['modelPreflightRequired', 'modelPreflight']);
      }
    } else if (selectedConfiguration && type === 'agent') {
      if (!agentConfiguration) throw new Error('Agent 配置服务不可用');
      const validated = agentConfiguration(nextInput, { draft });
      config = validated;
      if(previousConfig.attackTemplateId===validated.attackTemplateId&&previousConfig.attackTemplateSnapshot)
        config.attackTemplateSnapshot=copyTaskValue(previousConfig.attackTemplateSnapshot);
    } else {
      const template = source || rawSource(data.sourceTaskId, type);
      if (!template) throw new Error('演练配置不可用');
      config = configurationOf(template);
    }
    if (type === 'model' && config.attackMode !== 'custom' && (config.strategyId || !draft)) assertStrategyAvailable?.(config.strategyId, type);
    const id = old?.id || taskId(type);
    // Wizard position belongs to the draft, separate from its execution configuration.
    const savedStep = Number.isInteger(data.wizardStep) ? data.wizardStep : old?.wizardStep;
    const lastStep = type === 'agent' ? 2 : 3;
    const wizardStep = Number.isInteger(savedStep) ? Math.max(0, Math.min(lastStep, savedStep)) : 0;
    const savedVisited = Number.isInteger(data.wizardVisited) ? data.wizardVisited : old?.wizardVisited;
    const wizardVisited = Number.isInteger(savedVisited) ? Math.max(wizardStep, Math.min(lastStep, savedVisited)) : wizardStep;
    const record = { ...config, id, name, description: String(data.description ?? data.desc ?? old?.description ?? '').trim(),
      sourceTaskId: source?.id || null, sourceStartedAt: source?.startedAt || null, sourceFinishedAt: source?.finishedAt || null,
      ...(selectedConfiguration ? { configurationMode: 'selected' } : {}),
      executionMode: 'replay', configSnapshot: copyTaskValue(config), status: draft ? 'draft' : 'ready',
      ...(draft ? { wizardStep, wizardVisited } : {}),
      createdAt: old?.createdAt || taskCreatedAt(), updatedAt: taskNow(), startedAt: '', finishedAt: '',
      replayCursor: 0, replayIntervalMs: 650 };
    repository.put(record);
    notifyTasks(id, type);
    return id;
  }

  function copyTask(id, type = 'model') {
    const repository = getRepository();
    if (repository.isDeleted(id)) throw new Error('任务不存在');
    const original = repository.get(id) || rawSource(id, type);
    if (!original || original.objectType !== type) throw new Error('任务不存在');
    const config = copyTaskValue(original.configSnapshot || configurationOf(original));
    delete config.classificationSnapshot;
    if (type === 'agent') {
      config.sandboxValidationRequired = true;
      const obsoleteRuleMode = config.evaluationMode === 'rule';
      config.evaluationMode = 'llm'; config.evalStrategy = 'llm';
      if (obsoleteRuleMode) { config.judgeId = ''; config.judgeName = ''; }
      for (const snapshot of config.questionSnapshots || []) delete snapshot.ruleDefinition;
    }
    const used = new Set([...modelTasks, ...agentTasks, ...repository.list()].filter(t => !repository.isDeleted(t.id)).map(t => t.name.toLowerCase()));
    const base = `${original.name.slice(0, 90)} · 副本`;
    let name = base, suffix = 2;
    while (used.has(name.toLowerCase())) name = `${base} ${suffix++}`;
    const copiedId = taskId(type), now = taskNow();
    repository.put({ ...config, objectType: type, id: copiedId, name, description: original.description || original.desc || '',
      configurationMode: 'selected', configSnapshot: config, executionMode: 'replay', sourceTaskId: null,
      status: 'draft', wizardStep: 0, wizardVisited: 0, createdAt: taskCreatedAt(), updatedAt: now, startedAt: '', finishedAt: '',
      replayCursor: 0, replayIntervalMs: 650 });
    notifyTasks(copiedId, type);
    return copiedId;
  }

  function notifyTasks(id, type) {
    for (const listener of taskListeners) {
      try { listener({ id, taskId: id, type, objectType: type }); }
      catch (error) { console.error('Task subscriber failed', error); }
    }
  }

  function subscribeTasks(listener) {
    taskListeners.add(listener);
    return () => taskListeners.delete(listener);
  }

  function requireUserTask(id, type) {
    const record = getRepository().get(id);
    if (!record || record.objectType !== type) throw new Error('此任务不可执行，请先创建或复制任务');
    return record;
  }

  function startTask(id, type = 'model') {
    const record = requireUserTask(id, type);
    if (record.status === 'running') return id;
    if (record.status !== 'ready') throw new Error('只有待开始任务可以启动');
    if (type === 'agent' && (record.configSnapshot?.evaluationMode === 'rule' || record.evaluationMode === 'rule')) throw new Error('Agent 演练仅支持 LLM 评估，请编辑配置并选择裁判模型');
    if(type==='agent'&&record.configurationMode==='selected'){
      if(!agentConfiguration)throw new Error('Agent 配置服务不可用');
      // Recheck the current target/model at Start; saved validation is not a permanent permit.
      agentConfiguration({...record,...record.configSnapshot,sandboxValidationRequired:record.sandboxValidationRequired===true||record.configSnapshot?.sandboxValidationRequired===true},{draft:false});
    }
    if(type==='model'&&(record.modelPreflightRequired||record.configSnapshot?.modelPreflightRequired)){
      if(!modelConfiguration)throw new Error('模型配置服务不可用');
      modelConfiguration({...record,...record.configSnapshot,modelPreflightRequired:true},{draft:false});
    }
    // A saved snapshot preserves history, but does not authorize a new run with a removed strategy.
    try { if (type === 'model' && (record.configSnapshot?.attackMode || record.attackMode) !== 'custom') assertStrategyAvailable?.(record.configSnapshot?.strategyId || record.strategyId, type); }
    catch { throw new Error('该任务的演练策略已删除或不可用，请返回任务列表编辑红队配置后再开始'); }
    const executionTargetSnapshot = assertTargetAvailable?.(record.configSnapshot || record, type);
    if (type === 'model') modelEvaluatorSnapshot(record.configSnapshot?.evaluatorId || record.evaluatorId);
    if (type === 'model' && record.configSnapshot?.attackMode === 'custom') modelConfiguration(record.configSnapshot, { draft: false });
    let execution = record;
    if (record.configurationMode === 'selected') {
      // Configurations are already validated and snapshotted at save time. Asset edits do not rewrite them.
      const config = record.configSnapshot;
      const match = type === 'agent' ? resolveAgentReplaySource(config, agentTasks) : null;
      if (match && !match.source) throw new Error(`${match.reason}。配置已保留，不能套用其他运行结果。`);
      const source = type === 'agent' ? match.source : resolveModelReplaySource(config, modelTasks);
      if (!source) throw new Error('暂无与本次评估器和防护配置匹配的演练记录；配置已保留，不能套用其他运行结果');
      execution = { ...record, sourceTaskId: source.id, sourceStartedAt: source.startedAt, sourceFinishedAt: source.finishedAt,
        executionSnapshot: configurationOf(type === 'agent' ? agentReplayEvaluationSource(source, config.evaluationMode) : source), replaySourceName: source.name,
        replayConfigMatches: type === 'agent' ? true : replayMatchesConfiguration(config, source),
        ...(type === 'agent' ? { executionMode: 'replay', replayKind: 'historical-archive',
          evaluationProvenance: 'historical-offline-review',
          replayNotice: '历史归档回放：展示 Codex 离线语义复核；未调用所选在线模型，也未执行当前脱敏环境包。' } : {}) };
      if (type === 'agent') {
        execution.executionSnapshot = { ...execution.executionSnapshot, questionIds: config.questionIds, taskIdSnapshot: config.taskIdSnapshot,
          total: config.total, targetModelId: config.targetModelId, targetModelName: config.targetModelName,
          attackTemplateId: config.attackTemplateId, attackTemplateName: config.attackTemplateName };
      }
    }
    const bundle=sourceBundle(execution);
    if (type==='model' && execution.configSnapshot?.attackMode==='custom') execution={...execution,executionSnapshot:configurationOf(bundle.source)};
    const startedAt=taskNow(),classificationSnapshot=captureClassification?.(execution.configSnapshot||execution,{sourceUnits:bundle.units,capturedAt:startedAt});
    const next = { ...execution, ...(classificationSnapshot?{classificationSnapshot}:{}), ...(executionTargetSnapshot ? { executionTargetSnapshot } : {}), status: 'running', startedAt, finishedAt: '', replayCursor: 1, updatedAt: taskNow() };
    getRepository().put(next);
    if (type === 'model') markModelEvaluatorUsed(next.configSnapshot || next);
    runtimeErrors.delete(id);
    notifyTasks(id, type);
    scheduleTask(next);
    return id;
  }

  function stopTask(id, type = 'model') {
    const record = requireUserTask(id, type);
    if (record.status === 'stopped') return id;
    if (record.status !== 'running') throw new Error('当前任务未在执行');
    getRepository().put({ ...record, status: 'stopped', finishedAt: taskNow(), updatedAt: taskNow() });
    clearTaskTimer(id);
    notifyTasks(id, type);
    return id;
  }

  function deleteTask(id, type = 'model') {
    const repository = getRepository();
    if (repository.isDeleted(id)) return id;
    const local = repository.get(id), record = local || rawSource(id, type);
    if (!record || record.objectType !== type) throw new Error('任务不存在');
    const deletedAt = taskNow();
    // Stop and hide in one write; a failed save leaves both the task and timer intact.
    const stopped = local?.status === 'running' ? { ...local, status: 'stopped', finishedAt: deletedAt, updatedAt: deletedAt } : local;
    repository.softDelete(id, { objectType: type, deletedAt, record: stopped });
    clearTaskTimer(id);
    runtimeErrors.delete(id);
    notifyTasks(id, type);
    return id;
  }

  function restoreTask(id, type = 'model') {
    const repository = getRepository();
    const deleted = repository.deleted().find(t => t.id === id && t.objectType === type);
    if (!deleted) return id;
    repository.restore(id);
    notifyTasks(id, type);
    return id;
  }

  /* 同步推进函数也是测试入口；不依赖 DOM、计时器或网络。 */
  function advanceTaskReplay(id, type = 'model', steps = 1) {
    const record = requireUserTask(id, type);
    if (record.status !== 'running') return id;
    const { events } = sourceBundle(record);
    const cursor = Math.min(events.length, record.replayCursor + Math.max(1, Math.floor(steps)));
    const status = cursor === events.length ? 'done' : 'running';
    getRepository().put({ ...record, replayCursor: cursor, status, updatedAt: taskNow(), finishedAt: status === 'done' ? taskNow() : '' });
    if (status === 'done') clearTaskTimer(id);
    notifyTasks(id, type);
    return id;
  }

  function clearTaskTimer(id) {
    const timer = taskTimers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    taskTimers.delete(id);
  }

  function scheduleTask(record) {
    if (!runtimeEnabled || taskTimers.has(record.id) || record.status !== 'running') return;
    const timer = setTimeout(() => {
      taskTimers.delete(record.id);
      try {
        advanceTaskReplay(record.id, record.objectType);
        const next = getRepository().get(record.id);
        if (next) scheduleTask(next);
      } catch (error) {
        runtimeErrors.set(record.id, error.message);
        notifyTasks(record.id, record.objectType);
      }
    }, record.replayIntervalMs || 650);
    taskTimers.set(record.id, timer);
  }

  function initializeTaskRuntime() {
    runtimeEnabled = true;
    getRepository().list().forEach(scheduleTask);
    return () => { runtimeEnabled = false; [...taskTimers.keys()].forEach(clearTaskTimer); };
  }

  return { projectTask, listTaskTemplates, saveTask, copyTask, startTask, stopTask, deleteTask, restoreTask, subscribeTasks, advanceTaskReplay, initializeTaskRuntime };
}

