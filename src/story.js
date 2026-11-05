import { getWarningCoverage, usesLegacyCrisisRules } from './simulation.js';

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

function riverportScene(state, base, chapter, actorId) {
  const station = state.institutions.find(i => i.kind === 'station' && i.cellId === 'D4');
  const training = state.institutions.some(i => i.kind === 'training');
  const archive = state.institutions.some(i => i.kind === 'archive' && i.cellId === 'D4');
  const failedBuild = state.events.some(e => e.actionId?.startsWith('build_') && e.status === 'failed');
  if (chapter === 0) return base;
  if (chapter === 10) return {
    ...base,
    title: !station ? '没有建成的十年，也要有人接住' : base.title,
    body: [
      training
        ? '第一批学徒已经会独自读水尺。林澈翻着东岸送回的练习记录，问下一轮该由谁带教。'
        : station
          ? '重建的测站已经开始工作，但最初的学徒培训链没有随之补回。新的维护小组仍要面对接班的问题。'
        : failedBuild
          ? '建站协议没能兑现，小型档案站保住了零散的记录。没有最初的测站，也没有随它出发的学徒。林澈把未完成的名单放回桌上。'
          : '过去十年，没有河港测站投入运转，也没有从这里出发的培训链。林澈仍在整理旧水尺和地方记录。',
      '“我愿意去看看你说的那些年代。”她停顿了一下，“但如果我的离开，只是把没有做完的工作留给下一个人，这不叫自由。”',
      station?.active
        ? '续约会占用你的十年名额。去东岸资助学校，也许能培养更多维护者；请她入局，则必须面对原岗位的空缺。'
        : '现在可以重建地方测站，或另行资助东岸的夜校。重建不会补回错过的培训链；请林澈入局，也不能代替当地建设。',
    ],
  };
  if (chapter === 20) {
    const current = !station
      ? archive
        ? '今天，苏岚把小型档案站里的散页重新编号。建站未成留下的记录还在，河港却没有正在运转的水文站。'
        : '今天，苏岚以居民的身份来到河港。这里没有建成水文站，也没有属于她的测站管理岗位。'
      : !station.active
        ? '今天，河港测站的门关着。苏岚站在停运告示旁，问那些已经留下的记录要由谁保管。'
        : station.open
          ? '今天，河港的水位记录仍向居民开放。苏岚把一张刚抄好的记录放在桌上。'
          : '今天，河港测站仍在运转，收费牌也还挂着。苏岚把一枚磨损的铜币放回孩子掌心。';
    return {
      ...base,
      speaker: station?.active && state.flags.successor ? '苏岚 · 河港的维护者' : base.speaker,
      body: [
        (actorId === 'protagonist'
          ? '旧现实的档案里，苏岚是免费学校的教师。你记得她讲课时总开着窗。'
          : '你读到主角保存的旧现实档案：苏岚曾是免费学校的教师。那间开着窗的教室来自主角的见证，不是你的亲历记忆。') + current,
        actorId === 'protagonist'
          ? '“那是你记得的我。”她看着那页不属于自己记忆的履历，“它没有写下我今天愿意承担什么。你要先问我。”'
          : '“那是档案里的我。”她看着那页不属于自己记忆的履历，“你认识的是现在的我。这张纸没有写下我今天愿意承担什么，你要先问我。”',
        '远方的水位报告出现共同偏差。是否曾建成河港测站，不会替所有地方消除风险。现在仍能独立复核或争取地方停闸权，但你的介入名额有限。',
      ],
    };
  }
  const teaching = state.institutions.some(i => ['training', 'school'].includes(i.kind) && i.active);
  return {
    ...base,
    body: [
      station?.active
        ? '四十年的报告还剩最后一册。河港测站仍在运转，下一次维护不会因为你写完报告就自动发生。'
        : station
          ? '四十年的报告还剩最后一册。河港曾有一座测站，如今已经停运。移交文件里，不能把关着的门写成仍在提供的服务。'
          : '四十年的报告还剩最后一册。河港测站一直没有建成。空白也是这段历史的一部分，不能在最后一页补写成成功。',
      teaching
        ? '当地仍有人教授读尺与记录。知识已有承接者，但能否独立纠错，还要看现存网络与居民的信任。'
        : '没有现存的培训点或学校替你承接教学。新的制度可以写下责任，却不能凭空创造已经受训的人手。',
      '监察顾问把印章推到你面前：“集中维护需要持续承担责任。共享纠错权，需要当地真正拥有纠错的能力。退出也不是把钥匙丢在桌上。”',
    ],
  };
}

export function sceneFor(state, cell, actorId = 'protagonist') {
  const chapter = Math.min(30, Math.floor(state.year / 10) * 10);
  const base = riverportScene(state, chapters[chapter], chapter, actorId);
  if (cell === 'D4') return base;
  if (cell === 'E4') {
    const teaching = state.institutions.some(i => i.cellId === cell && ['training', 'school'].includes(i.kind) && i.active);
    return { ...base, title: '不是一座站，是一群会读水的人', speaker: '东岸 · 居民代表', body: [
      teaching ? '教室没有墙。学员坐在河堤上，拿着不同年代的水尺互相核对。' : '河堤上还没有持续运作的课堂。居民带来旧水尺，希望有人把读尺和记录的方法教给更多人。',
      '“我们可以记住标准，也可以学会什么时候不相信它。”更多培训会增加独立判断的能力，也会消耗当地有限的经费。',
    ], question: '给学校一次机会，也意味着本窗口把有限的名额留在这里。' };
  }
  if (cell === 'F6') {
    const branch = state.institutions.some(i => i.kind === 'branch' && i.cellId === cell && i.active);
    return { ...base, title: '远方的水声', speaker: branch ? '远港 · 分站值班人' : '远港 · 船工代表', body: [
      branch ? '柜子里保存着河港协议的抄本。它经过东岸的课堂，又被带到了这座远方港口。' : '河港的培训链没有在这里建成分站。船工仍用自己的记录辨认支流水位，也收到了一份来自外地的统一标准。',
      '“他们说，照着上游的标准做就不会错。”对方指向两条并不吻合的曲线，“可我们的支流，从来不在那份表里。”',
    ], question: '真正可靠的网络，必须允许一个节点说：这里不一样。' };
  }
  return { ...base, title: cell === 'D5' ? '把第一声钟传到岸边' : '不应消失的底稿', speaker: cell === 'D5' ? '南岸 · 居民代表' : '北岸 · 档案保管员', body: cell === 'D5' ? ['南岸没有高大的观测塔，只有一口大家轮流敲的钟。', '居民愿意组成互助队，却不愿再被要求承担无穷的免费劳动。培训和经费必须与责任一起到来。'] : ['有些纸页没有被抄进正式报告。它们不是正确答案，却记录着一种不同的判断。', '保存旧档不能让过去重新生效，但可以在所有人相信同一个数字时，提醒他们再看一眼。'], question: '这个地方的能力也会进入每一年的历史。' };
}
