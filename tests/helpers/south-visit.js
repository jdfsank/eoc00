import {advanceYear,advanceToNextWindow} from '../../src/simulation.js';
import {localAt30,lock,submit} from './local-crisis.js';
export function southVisitDates({teaching=true,aid=false}={}){
 const before=localAt30({teaching,aid}),locked=structuredClone(before);lock(locked,'protagonist','D5','mutual_aid');
 const pending=structuredClone(locked);submit(pending);const y31=structuredClone(pending);advanceYear(y31);
 const y40=structuredClone(y31);advanceToNextWindow(y40);return {before,locked,pending,y31,y40};
}
export function collisionEvent(id){return {id,year:39,cellId:'B4',actionId:'training',kind:'event',title:'OTHER FUTURE',text:'DO NOT EXPOSE',parentId:null,sourceActionId:null,probability:1,status:'pending'};}
