import { getWarningCoverage, usesLegacyCrisisRules, usesHandoffRules, handoffSummary, getActorRefusals, getRecruitmentRoles, usesRecruitmentRules, fulfilledEvent, RECRUITMENT_ACTIONS, recruitmentRolesAtDeparture } from './simulation.js';

export const chapters = {
  0: {
    title: '谁拥有洪水预警？', subtitle: '第一卷 · 河港的水位线', speaker: '林澈 · 河港测量员',
    body: ['雨停了，旧档案室仍有一股潮湿的纸味。林澈把两本账册并排放下：一份记着商船的损失，另一份只有死者的姓名。', '“你们的报告说，修一座站就能救很多人。”她按住被水泡皱的页角，“可河水不会先问，谁付过钱。”', '这次介入会留下一套制度。先决定相信哪些证据，再决定把预警交给谁。'],
    question: '资金、指令与共同维护，没有一种选择不留下债务。',
  },
  10: {
    title: '留下来的人，离开的人', subtitle: '第二卷 · 继任者的姓名', speaker: '林澈 · 河港测量员',
    question: '这一回，你要带走一个人，还是让一套规则不再依赖一个人？',
  },
  20: {
    title: '她不是档案里的那个人', subtitle: '第三卷 · 未曾生活的另一生', speaker: '苏岚 · 河港居民',
    question: '旧现实能证明一段人生曾经存在，不能替现在的人同意。',
  },
  30: {
    title: '谁签署下一版历史？', subtitle: '第四卷 · 把钥匙交给谁', speaker: '续史局 · 最后一份阶段委托',
    question: '把成功写成你的功劳很容易。让下一代不需要你，困难得多。',
  },
};

export const evidenceText={
 evacuation_routes:{title:'逐户核实撤离路线',text:'居民把夜间无法通行的渡口、需要搀扶的邻居和备用高地标在同一张图上。这不能校正水位标准，却能让停闸后真正有人及时撤离。新规则下花2轮确认，把停闸损失基数从0.30降至0.20。'},
 independent_flood_records:{title:'比对修会的旧洪水记录',text:'修会保存的河岸刻线比官署记录早了四十年。它们提示：上游暴雨与河港最高水位并不同步。公开副本可以让不同的人独立复核。'},
 unfunded_maintenance:{title:'打开商会的经费账簿',text:'建站款足够，十年后的值班薪资却没有着落。商会愿意出钱，但希望优先向缴费港口发出预警。免费不是没有成本。'},
 successor_consent:{title:'商量培训与继任条件',text:'苏岚愿意商量培训与接班，条件是有正式薪资、公开记录和拒绝不安全指令的权利。“我不是她的替身，我要有自己的签名。”'},
 anomaly_records:{title:'交叉核对远港的异常曲线',text:'不同地方的水位报告同时漏掉一条支流。问题不是科学太强，而是它们采用了同一份未经独立复核的标准。地方停闸权与异源测量可以截断共同失效。'},
 old_reality_record:{title:'阅读 R0 的教师履历',text:'R0｜已归档现实：苏岚曾在免费学校任教。这份真实旧档保留了她的生活，却不包含她对今天的意见。出示它可能引发对话，也可能伤害她的信任。'},
 resident_testimony:{title:'听取岸边居民的证词',text:'居民希望第一声钟能传到最远的棚户。他们愿意商量值班与维护，但不接受无限的免费劳动。'}
};

export function evidenceFor(state, id, cellId = 'D4', actorId = 'protagonist') {
  const base = evidenceText[id];
  if (!base) return { title: id, text: '一份有关当地制度的材料。' };
  if (id === 'old_reality_record' && actorId !== 'protagonist') {
    return { ...base, text: base.text + '这份材料由主角从亲历的旧现实中保存；对你而言，它是可查阅的他人见证，不是入局锚定后凭空获得的记忆。' };
  }
  if (id === 'resident_testimony') {
    if (usesLegacyCrisisRules(state) && state.flags.freeWarning) return { ...base, text: '这份旧版历史已经兑现了免费预警协议，居民仍要求明确的值班与长期经费。协议的整体减损承诺继续生效，但旧记录没有提供逐地覆盖明细。' };
    const service = getWarningCoverage(state)[cellId];
    const opening = !service?.coverage ? '这里还没有持续运转的预警载体。居民讨论的是下一次险情该由谁传话，远处的家庭又该怎样听见。'
      : service.providers.some(i => ['station', 'branch'].includes(i.kind) && !i.open) ? '部分家庭能够收到预警，但收费门槛与维护缺口仍把其他人留在外面。'
      : service.coverage < 1 ? '居民已经能从当地的读尺或传讯人员那里获得消息，但覆盖仍有限，不能把有一口钟当成每个人都能及时听见。'
      : '居民能够使用现有的公开预警。他们愿意讨论怎样让值班与维护持续下去，而不是让服务永远依赖一个人。';
    return { ...base, text: opening + '“只要第一声钟能响到这里，之后我们愿意一起修。”当地合作并不等于无限负担。' };
  }
  if (id === 'successor_consent') {
    if (!getRecruitmentRoles(state).length) return { ...base, title: '确认是否有岗位需要交接', text: '河港没有正在运转的测站或档案岗位。苏岚没有因此被指定接班，林澈的同行意愿与当地未来的建设是两件事。若要另行建设或培训，需要另外作出安排。' };
    const trained = state.institutions.some(i => i.kind === 'training');
    return { ...base, title: trained ? '与学徒商量继任' : '与苏岚商量培训与接班',
      text: (trained ? '苏岚带着已经完成的读尺记录来商量接班。' : '这里没有原培训链培养的接班人。苏岚愿意先接受培训，再承担明确的工作。') + '她要求正式薪资、公开记录和拒绝不安全指令的权利。“我不是她的替身，我要有自己的签名。”' };
  }
  if (id === 'unfunded_maintenance') {
    const station = state.institutions.find(i => i.kind === 'station' && i.cellId === 'D4');
    return { ...base, text: !station ? '账簿列着建站计划与运输报价，却没有一座已经运转的河港测站可供续约。若要开始服务，建设和长期人手都要有经费。商会愿意讨论资助条件，但没有承诺无限维护。'
      : state.flags.renewed ? '公开章程已有长期维护基金。眼前不是一笔凭空出现的欠薪，而是如何继续履行已经承诺的值班与公开记录。'
      : '河港曾建起测站，长期维护经费却未落实。现有经费、值班人手与服务门槛需要一起谈，免费不是没有成本。' };
  }
  return base;
}

export function crisisRecollection(state) {
  if (state.year < 23) return null;
  const crisis = state.flags.crisis;
  if (crisis?.status === 'averted' && crisis.damage === 0) return '第23年的共同失效被拦在错误指令发出之前。那份及时改写的水位报告仍留在桌上。避免了这次记录中的损失，不等于洪水不再上涨，也不等于下一次总会有人替地方纠错。';
  if (crisis?.status === 'contained') return `第23年的清点册还没有收起。${state.flags.veto ? '停闸与地方保护' : '地方保护'}减轻了冲击，但剩余损失已经发生。今天恢复的产出，不能把那一页改写成从未付出代价。`;
  if (crisis?.status === 'disaster') return '第23年的共同标准失效留下了不可逆的地方损失。报告里那一页没有被撕掉；即使后来新办学校、恢复产出或签署交班方案，也不能把已经发生的伤害抹去。';
  return '这份档案没有完整记录第23年的结算结果。你不能用今天的机构与产出，替过去补写一场没有证据的胜利或灾难。';
}
function currentConsent(state) {
  if (state.flags.trust === false) return state.flags.forced
    ? '苏岚从东岸寄来的信没有替迁任补上同意：“岗位可以写进命令，我的签名不能。谈下一次交班之前，先承认上一次是谁替我作了决定。”'
    : '河港仍明确拒绝当前安排。现有机构可以列出人手，却不能替居民在交班协议上签名。';
  if (state.flags.respected) return '当年那份旧现实履历旁，留着苏岚自己写下的选择。她愿意继续核对证据，但要求你记住：合作来自现在的同意，不来自她在另一段人生里的职位。';
  if (state.flags.freeWarning) return '居民传讯与值班协议还在执行。苏岚愿意讨论下一次交班：“把维护责任和拒绝错误指令的权利，一起写在我们能看见的地方。”';
  if (state.flags.renewed) return '公开章程仍是苏岚愿意继续商量的根据。她指着当年写下的继任条款：“不是只有你留下来才有人会做；但你也不能把我们的名字当成现成的签字。”';
  return '苏岚还没有承诺替你接过全部责任。听过报告不等于同意交班，现存的人手也不能替尚未作出的合作决定签名。';
}

function riverportScene(state, base, chapter, actorId) {
  const station = state.institutions.find(i => i.kind === 'station' && i.cellId === 'D4');
  const operatingStation = station?.active && station.maintenance > 0;
  const training = state.institutions.some(i => i.kind === 'training');
  const archive = state.institutions.some(i => i.kind === 'archive' && i.cellId === 'D4');
  const failedBuild = state.events.some(e => e.actionId?.startsWith('build_') && e.status === 'failed');
  if (chapter === 0) return base;
  if (chapter === 10) return {
    ...base,
    title: !station ? '没有建成的十年，也要有人接住' : base.title,
    question: usesRecruitmentRules(state) && !getRecruitmentRoles(state).length ? '邀请她同行，或把这一次介入留给地方建设？没有岗位，不等于没有机会成本。' : base.question,
    body: [
      training
        ? '第一批学徒已经会独自读水尺。林澈翻着东岸送回的练习记录，问下一轮该由谁带教。'
        : station
          ? '重建的测站已经开始工作，但最初的学徒培训链没有随之补回。新的维护小组仍要面对接班的问题。'
        : failedBuild
          ? '建站协议没能兑现，小型档案站保住了零散的记录。没有最初的测站，也没有随它出发的学徒。林澈把未完成的名单放回桌上。'
          : '过去十年，没有河港测站投入运转，也没有从这里出发的培训链。林澈仍在整理旧水尺和地方记录。',
      !getRecruitmentRoles(state).length ? '“我愿意去看看你说的那些年代。”林澈把入局条件读完，“这里没有一个现成岗位需要我交给苏岚。请把邀请我同行，和替地方建起什么，分别写清楚。”' : '“我愿意去看看你说的那些年代。”她停顿了一下，“但如果我的离开，只是把没有做完的工作留给下一个人，这不叫自由。”',
      operatingStation
        ? '续约会占用你的十年名额。去东岸资助学校，也许能培养更多维护者；请她入局，则必须面对原岗位的空缺。'
        : getRecruitmentRoles(state).length ? '小型档案站也是一份正在进行的工作。招募林澈仍要决定谁来接班；重建测站或资助夜校，则占用另一项本轮选择。' : '现在可以邀请林澈自愿同行，或把本轮名额用于重建测站、地方保档与东岸夜校。同行不会补出机构，也没有虚构的岗位需要减产停运。',
    ],
  };
  if (chapter === 20) {
    const current = !station
      ? archive
        ? '今天，苏岚把小型档案站里的散页重新编号。建站未成留下的记录还在，河港却没有正在运转的水文站。'
        : '今天，苏岚以居民的身份来到河港。这里没有建成水文站，也没有属于她的测站管理岗位。'
      : !operatingStation
        ? '今天，河港测站的门关着。苏岚站在停运告示旁，问那些已经留下的记录要由谁保管。'
        : station.open
          ? '今天，河港的水位记录仍向居民开放。苏岚把一张刚抄好的记录放在桌上。'
          : '今天，河港测站仍在运转，收费牌也还挂着。苏岚把一枚磨损的铜币放回孩子掌心。';
    const upkeep = operatingStation && station.maintenance < 1 ? ' 维护经费不足，值班与修缮都有缺口；它仍在运转，不能把失修写成从未建成。' : '';
    return {
      ...base,
      speaker: operatingStation && state.flags.successor ? '苏岚 · 河港的维护者' : base.speaker,
      body: [
        (actorId === 'protagonist'
          ? '旧现实的档案里，苏岚是免费学校的教师。你记得她讲课时总开着窗。'
          : '你读到主角保存的旧现实档案：苏岚曾是免费学校的教师。那间开着窗的教室来自主角的见证，不是你的亲历记忆。') + current + upkeep,
        actorId === 'protagonist'
          ? '“那是你记得的我。”她看着那页不属于自己记忆的履历，“它没有写下我今天愿意承担什么。你要先问我。”'
          : '“那是档案里的我。”她看着那页不属于自己记忆的履历，“你认识的是现在的我。这张纸没有写下我今天愿意承担什么，你要先问我。”',
        ...getActorRefusals(state, actorId, 'D4').map(r => r.reason),
        '远方的水位报告出现共同偏差。是否曾建成河港测站，不会替所有地方消除风险。现在仍能独立复核或争取地方停闸权，但你的介入名额有限。',
      ],
    };
  }
  const teaching = state.institutions.some(i => ['training', 'school'].includes(i.kind) && i.active && i.maintenance > 0);
  return {
    ...base,
    body: [
      operatingStation
        ? '四十年的报告还剩最后一册。河港测站仍在运转，下一次维护不会因为你写完报告就自动发生。' + (station.maintenance < 1 ? ' 站内仍有维护缺口，继续亮灯不等于已经修复。' : '')
        : station
          ? '四十年的报告还剩最后一册。河港曾有一座测站，如今已经停运。移交文件里，不能把关着的门写成仍在提供的服务。'
          : '四十年的报告还剩最后一册。河港测站一直没有建成。空白也是这段历史的一部分，不能在最后一页补写成成功。',
      crisisRecollection(state),
      teaching
        ? '沿岸仍有人教授读尺与记录。知识已有承接者，但能否独立纠错，还要看现存网络与居民的信任。'
        : '没有现存的培训点或学校替你承接教学。新的制度可以写下责任，却不能凭空创造已经受训的人手。',
      currentConsent(state),
      ...(usesHandoffRules(state) ? ['交班清单分开列着人手、校验与授权。' + handoffSummary(state, 'share_power')] : []),
      '监察顾问把印章推到你面前：“集中维护需要持续承担责任。共享纠错权，需要当地真正拥有纠错的能力。退出也不是把钥匙丢在桌上。”',
    ].filter(Boolean),
  };
}

export function sceneFor(state, cell, actorId = 'protagonist') {
  const chapter = Math.min(30, Math.floor(state.year / 10) * 10);
  const base = riverportScene(state, chapters[chapter], chapter, actorId);
  if (cell === 'D4') return base;
  if (cell === 'E4') {
    const hadTeaching = state.institutions.some(i => i.cellId === cell && ['training', 'school'].includes(i.kind));
    const teaching = state.institutions.some(i => i.cellId === cell && ['training', 'school'].includes(i.kind) && i.active && i.maintenance > 0);
    return { ...base, title: '不是一座站，是一群会读水的人', speaker: '东岸 · 居民代表', body: [
      teaching ? '河堤上的学棚向两侧敞开，长凳可以挪到读尺架旁。学员把旧水尺与当天的记录放在一起练习。' : hadTeaching ? '河堤上的旧学棚和读尺架仍在，课已经停下。没有人值班的地方，不能在交班表里写成正在带教。' : '河堤上还没有持续运作的课堂。居民带来旧水尺，希望有人把读尺和记录的方法教给更多人。',
      teaching ? '“会读尺，不等于手里已经有另一套可靠的记录。”带教者指着轮值表。培训可以留下承接人手，谁授权他们接班、由谁提供异源校验，还要分别说清楚。' : '居民把还未排满的轮值表递过来。先让人学会、愿意接手，再谈谁来提供另一套校验记录；一纸移交不会让空位自动坐满。',
      ...(state.year >= 30 ? [crisisRecollection(state)] : []),
    ], question: '给学校一次机会，也意味着本窗口把有限的名额留在这里。' };
  }
  if (cell === 'F6') {
    const hadBranch = state.institutions.some(i => i.kind === 'branch' && i.cellId === cell);
    const branch = state.institutions.some(i => i.kind === 'branch' && i.cellId === cell && i.active && i.maintenance > 0);
    const corrected = state.year >= 23 && state.flags.crisis?.status === 'averted' && state.flags.crisis.damage === 0;
    const incomplete = state.year >= 23 && state.flags.crisis?.status === 'averted' && !Number.isFinite(state.flags.crisis.damage);
    return { ...base, title: '远方的水声', speaker: branch ? '远港 · 分站值班人' : '远港 · 船工代表', body: [
      branch ? '柜子里保存着河港协议的抄本。它经过东岸的课堂，又被带到了这座远方港口。' : hadBranch ? '原来的远港分站已经停运。留下的柜子仍装着旧记录，但门口没有新的值班表。' : '河港的培训链没有在这里建成分站。船工仍用自己的记录辨认支流水位，也收到了一份来自外地的统一标准。',
      corrected ? '对方把改写前后的两条曲线并排留下：“那次复核让支流进入了记录。下一次，也要允许我们指出这里不一样。”' : incomplete ? '两条曲线旁缺了一页结算记录。对方没有把空白填成定论：“先把能够确认的经过留下，再继续核对。”' : '“他们说，照着上游的标准做就不会错。”对方指向两条并不吻合的曲线，“可我们的支流，从来不在那份表里。”',
      ...(state.year >= 30 ? [crisisRecollection(state)] : []),
    ], question: '真正可靠的网络，必须允许一个节点说：这里不一样。' };
  }
  if (cell === 'D5') {
    const teaching = state.institutions.some(i => i.cellId === cell && ['training', 'school'].includes(i.kind) && i.active && i.maintenance > 0);
    const hadTeaching = state.institutions.some(i => i.cellId === cell && ['training', 'school'].includes(i.kind));
    const aidGroups = state.institutions.filter(i => i.cellId === cell && i.kind === 'mutual' && i.active && i.maintenance > 0);
    const aid = aidGroups.length > 0;
    return { ...base, title: '把第一声钟传到岸边', speaker: '南岸 · 居民代表', body: [
      teaching ? '南岸把长凳围在读尺架旁，没有高大的观测塔，也没有封闭校舍。轮值学员在河水边对照当天的刻度。' : hadTeaching ? '南岸的读尺围座还在，带教已经停下。留下长凳和旧水尺，不等于现在仍有人值班。' : '南岸居民正在商量，第一声险情钟报要怎样传到更远的岸边。说好一项计划，还不等于已经有人长期值班。',
      aid ? '互助仓的轮值表列着不按缴费名单分配物资的承诺。居民仍要核对经费、人手和下一次交班。' : '居民愿意商量互助，却不愿被要求承担无穷的免费劳动。培训和经费必须与责任一起到来。',
      ...(state.year >= 30 ? [crisisRecollection(state), aidGroups.some(i => i.startYear > 23) ? '后来的互助轮值正在支持眼前的生计；账册把这些新支出与第23年的损失分开，没有用新增物资改写过去的损失。' : '现在可以增设互助轮值来支持接下来的生计，但第23年的清点册不会重新结算。扩容人手也不是第二层洪水保护。'] : []),
    ], question: '这个地方的能力也会进入每一年的历史。' };
  }
  return { ...base, title: cell === 'D5' ? '把第一声钟传到岸边' : '不应消失的底稿', speaker: cell === 'D5' ? '南岸 · 居民代表' : '北岸 · 档案保管员', body: cell === 'D5' ? ['南岸没有高大的观测塔，只有一口大家轮流敲的钟。', '居民愿意组成互助队，却不愿再被要求承担无穷的免费劳动。培训和经费必须与责任一起到来。'] : ['有些纸页没有被抄进正式报告。它们不是正确答案，却记录着一种不同的判断。', '保存旧档不能让过去重新生效，但可以在所有人相信同一个数字时，提醒他们再看一眼。'], question: '这个地方的能力也会进入每一年的历史。' };
}


// Read-only personal coda: it never edits ending scores, old contracts or history.
export function characterEpilogue(state) {
  if (state.year < 40 || state.phase !== 'ended') return [];
  const recordId = e => e ? `resolved:${e.id}` : null;
  const recruit = fulfilledEvent(state, RECRUITMENT_ACTIONS);
  const roles = recruitmentRolesAtDeparture(state, recruit);
  const warning = fulfilledEvent(state, 'free_warning');
  const renewal = fulfilledEvent(state, 'renew_charter');
  const respect = fulfilledEvent(state, 'present_archive');
  const forced = fulfilledEvent(state, 'relocate_teacher');
  const linche = [], lincheSources = [];
  if (!recruit) {
    linche.push(renewal ? `第${renewal.resolvedYear}年的章程留下林澈愿意带教的记录，她没有在这份历史中完成入局。留下来的选择，也不等于一份没有期限的劳动承诺。` : '这份档案没有林澈完成入局的记录。最后一册报告没有替她补写一段未曾作出的承诺，也不把未同行当成背弃。');
    if (renewal) lincheSources.push(recordId(renewal));
  } else {
    lincheSources.push(recordId(recruit));
    if (!roles.length) linche.push(`第${recruit.resolvedYear}年，林澈自愿入局；当时没有运转中的河港测站或档案岗位需要交接。同行是真实的选择，却没有一个不存在的空岗可以归咎于她。`);
    if (!roles.length && recruit.actionId === 'recruit_successor') linche.push('旧合同记录了继任安排，但那时没有运转中的岗位。承诺本身仍在，不能据此补写苏岚已经管理了一座测站。');
    if (!roles.length && recruit.actionId === 'recruit_risk') linche.push('旧合同列过减产与停运的风险，却没有对应的在岗载体。没有实际停运记录，就不把空缺算成她造成的损失。');
    if (roles.length && recruit.actionId === 'recruit_successor') linche.push(`第${recruit.resolvedYear}年，林澈在苏岚同意接班后离开。那份签名解决了谁来值班，不是长期经费已经充足的证明。`);
    else if (roles.length) linche.push(`第${recruit.resolvedYear}年，林澈入局时留下了尚未安排继任的${roles.some(i=>i.kind==='station')?'测站':'档案站'}岗位。她带走了自己的选择，也留下了一项没有完成的交接。`);
    const stopped = state.history.filter(h => h.kind === 'maintenance' && /-unattended$/.test(h.id) && h.year >= recruit.resolvedYear && roles.some(i => i.sourceEventId === h.parentId));
    if (stopped.length) {
      linche.push(`第${stopped[0].year}年的停运告示仍在档案里。后来增加的产出或新的合作，没有把那段无人接班的时间删掉。`);
      lincheSources.push(...stopped.map(h=>h.id));
      if (warning) {
        const station = roles.find(i=>i.kind==='station');
        if (station) linche.push(`第${warning.resolvedYear}年，免费预警方案重新补足河港维护与接班安排。${station.active&&station.maintenance>0?'测站现在仍在运转，但恢复不等于从未停过。':'当前测站仍未有效运转，不能把那次修复承诺当作永久有效。'}`);
        else {
          const team = state.institutions.find(i=>i.kind==='warning'&&i.sourceEventId===warning.id);
          linche.push(`第${warning.resolvedYear}年另行建立了居民传讯队，${team?.active&&team.maintenance>0?'如今仍在服务':'当前没有可确认的有效服务'}。它没有重新打开原来的档案站，旧岗位的中断不能被新机构冒名顶替。`);
        }
        lincheSources.push(recordId(warning));
      }
    }
    const lapse = state.history.find(h=>h.id==='charter-lapsed' && roles.some(i=>i.sourceEventId===h.parentId));
    if (lapse) { linche.push(`第${lapse.year}年，维护经费的缺口又变成收费门槛。${warning?'后来的免费预警曾重新处理这项负担，却没有让旧缺口消失。':'接班有人，并不代表当地已经获得公开、长期的支持。'}`); lincheSources.push(lapse.id); if(warning)lincheSources.push(recordId(warning)); }
  }
  const sulan = [], sulanSources = [];
  let title = '末页仍留着她的选择';
  if (forced) {
    title = '调令没有替她签名';
    sulan.push(`第${forced.resolvedYear}年，迁任命令把苏岚带到东岸，反对的证词也被留了下来。学校多了一个岗位，不证明她曾同意，也不能把强制改称为拯救。`);
    if (respect) sulan.push('这份档案也有尊重她选择的记录。两份记录必须同时面对，不能拿一份同意去抹掉另一项强制决定。');
    sulanSources.push(recordId(forced),recordId(respect));
  } else if (respect) {
    title = '她在这一版历史里的签名';
    sulan.push(`第${respect.resolvedYear}年，旧现实履历被放到桌上，苏岚保留了决定今天生活的权利。她的证词成为合作依据，不是一张保证所有问题都已解决的收据。`);
    sulanSources.push(recordId(respect));
  } else if (warning) {
    title = '河岸上的共同安排';
    sulan.push(`第${warning.resolvedYear}年，苏岚与居民参与了免费预警和值班安排。这是当前现实里作出的合作，不是旧现实教师身份替她选好的生活。`);
    sulanSources.push(recordId(warning));
  } else if (recruit?.actionId === 'recruit_successor' && roles.length) {
    sulan.push(`第${recruit.resolvedYear}年，她同意承担接班。档案没有继续记录她对旧现实履历或迁任的决定，末页不会替她签下一个未作出的选择。`);
    sulanSources.push(recordId(recruit));
  } else if (recruit?.actionId === 'recruit_successor') {
    sulan.push(`第${recruit.resolvedYear}年的旧合同记录了苏岚的继任安排，但当时没有运转中的河港岗位可供交接。那份承诺不能被写成已经发生的任职，也没有替她决定此后的生活。`);
    sulanSources.push(recordId(recruit));
  } else sulan.push('档案没有可核实的继任、迁任或个人去向同意。没有选择记录，不等于她已经同意成为任何人的历史样本。');
  return [
    { name:'林澈', title:recruit?'同行之后，仍要面对留下的事':'未曾同行，也不是空白', paragraphs:linche, sources:[...new Set(lincheSources.filter(Boolean))] },
    { name:'苏岚', title, paragraphs:sulan, sources:[...new Set(sulanSources.filter(Boolean))] },
  ];
}
