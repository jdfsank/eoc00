import { getBuildingContract } from './building-contract.js';

// Present the available public contract, including its legacy-rule wording.
// Reading neither predicts an outcome nor changes the action or saved world.
export function getBuildingCardTradeoff(state, actionId, options) {
  const contract = getBuildingContract(state, actionId, options);
  if (!contract) return null;
  return [
    { field: 'reward', label: '若合同兑现', text: contract.displayReward, known: true },
    { field: 'risk', label: '仍需承担', text: contract.displayRisk, known: true },
  ];
}
