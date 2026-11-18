// Preserve unreadable startup bytes until an explicit, validated replacement.
export function createStartupSaveGuard(storage,key,restore){
 let raw=null,blocked=false,kind=null,loaded=null;
 try{raw=storage.getItem(key);}catch{blocked=true;kind='unreadable';}
 if(!blocked&&raw!==null){try{loaded=restore(JSON.parse(raw));}catch{blocked=true;kind='invalid';}}
 return {
  get loaded(){return loaded;},get blocked(){return blocked;},get kind(){return kind;},get raw(){return raw;},
  save(value){if(blocked)return false;storage.setItem(key,JSON.stringify(value));return true;},
  replace(value){
   if(!blocked)throw Error('恢复请求已结束。');
   if(kind==='unreadable')throw Error('仍无法确认原始数据，请恢复浏览器存储权限后刷新重试。');
   restore(value);const text=JSON.stringify(value);
   if(storage.getItem(key)!==raw)throw Error('浏览器存档已被其他页面更改；未覆盖，请刷新后重新核对。');
   storage.setItem(key,text);
   if(storage.getItem(key)!==text)throw Error('无法确认新存档已保存；请保留原始下载并刷新核对。');
   blocked=false;kind=null;loaded=value;return true;
  }
 };
}
