// Preserve startup bytes. All writes require the caller's coordinated commit.
export function createStartupSaveGuard(storage,key,restore,commit){
 let raw=null,blocked=false,kind=null,loaded=null,needsInitialSave=true;
 try{raw=storage.getItem(key);}catch{blocked=true;kind='unreadable';}
 if(!blocked&&raw!==null){try{const parsed=JSON.parse(raw);const originalState=JSON.stringify(parsed?.state);loaded=restore(parsed);needsInitialSave=originalState!==JSON.stringify(loaded?.state);}catch{blocked=true;kind='invalid';}}
 async function write(value){
  if(typeof commit!=='function')throw Error('缺少安全保存协调器，未写入存档。');
  await commit(JSON.stringify(value));return true;
 }
 return {
  get needsInitialSave(){return !blocked&&needsInitialSave;},get loaded(){return loaded;},get blocked(){return blocked;},get kind(){return kind;},get raw(){return raw;},
  async save(value){if(blocked)return false;return write(value);},
  async replace(value){
   if(!blocked)throw Error('恢复请求已结束。');
   if(kind==='unreadable')throw Error('仍无法确认原始数据，请恢复浏览器存储权限后刷新重试。');
   restore(value);await write(value);
   blocked=false;kind=null;loaded=value;return true;
  }
 };
}
