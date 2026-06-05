/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/url','N/search'], (url, search) => {
  // AJUSTE para o caminho real no seu File Cabinet (case-sensitive)
  const CLIENT_MODULE_PATH = '../pd_prd_client/pd-prd-purchase-requisition-deletion.client';
  
  // (opcional) IDs do Suitelet resolvidos no próprio UE
  const SL_SCRIPT_ID = 'customscript_pd_prd_purc_req_deletion_st';
  const SL_DEPLOY_ID = 'customdeploy_pd_prd_purc_req_deletion_st';

  function isFullyOrdered(rec) {
    try {
      const t = rec.getText({ fieldId: 'status' });
      if (t && /fully\s*ordered/i.test(t)) return true;
    } catch (_) {}
    try {
      if (!rec.id) return false;
      const data = search.lookupFields({ type: 'purchaserequisition', id: rec.id, columns: ['status'] });
      const txt = (data.status && data.status[0] && data.status[0].text) || '';
      return /fully\s*ordered/i.test(txt);
    } catch (_) {}
    return false;
  }

  function beforeLoad(ctx) {
    if (ctx.type !== ctx.UserEventType.VIEW) return;
    if (isFullyOrdered(ctx.newRecord)) return;
  
    const form = ctx.form;
    const rec  = ctx.newRecord;
  
    // 🔴 pegue o valor aqui...
    const soId = rec.getValue({ fieldId: 'custbody_pd_so_sales_order' });
    if (!soId) return; // botão só aparece se houver SO vinculada
  
    form.clientScriptModulePath = CLIENT_MODULE_PATH;
  
    const slUrl = url.resolveScript({
      scriptId: SL_SCRIPT_ID,
      deploymentId: SL_DEPLOY_ID,
      returnExternalUrl: false
    });
  
    // ✅ ...e passe para o client
    form.addButton({
      id: 'custpage_prd_btn_delete_pr',
      label: 'Delete Requisition',
      functionName: `deletePR('${slUrl}', '${rec.id}', '${soId}')`
    });
  }
  
  return { beforeLoad };
});
