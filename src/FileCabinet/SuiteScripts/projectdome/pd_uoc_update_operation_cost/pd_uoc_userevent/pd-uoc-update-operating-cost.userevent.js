/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/ui/serverWidget','N/log'], (serverWidget, log) => {
  const BEFORELOAD_EVENTS = ['view','edit','create','copy'];

  function beforeLoad(ctx) {
    try {
      const { form, newRecord, type } = ctx;
      if (!BEFORELOAD_EVENTS.includes(type)) return;

      const recType = newRecord.type; // 'salesorder' ou 'invoice'
      if (recType !== 'salesorder' && recType !== 'invoice') return;

      // aponto para o client
      form.clientScriptModulePath = '../pd_uoc_client/pd-uoc-update-operating-cost.client.js';

      form.addButton({
        id: 'custpage_pd_update_operating_cost',
        label: 'Update Operating Cost',
        // chamamos a função com o tipo da transação
        functionName: `pdUpdateOperatingCost("${recType}")`
      });
    } catch (e) {
      log.error('beforeLoad error', e);
    }
  }

  return { beforeLoad };
});
