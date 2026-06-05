/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/currentRecord','N/url','N/https','N/ui/dialog'], 
(currentRecord, url, https, dialog) => {

  function pageInit(_) {}

  function showLoadingOverlay(text) {
    const overlay = document.createElement('div');
    overlay.id = 'pd-prd-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.35)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '99999';

    const box = document.createElement('div');
    box.style.minWidth = '340px';
    box.style.maxWidth = '90vw';
    box.style.background = '#fff';
    box.style.borderRadius = '12px';
    box.style.padding = '24px 28px';
    box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.alignItems = 'center';
    box.style.gap = '14px';

    const spinner = document.createElement('div');
    spinner.style.width = '44px';
    spinner.style.height = '44px';
    spinner.style.border = '5px solid #e0e0e0';
    spinner.style.borderTop = '5px solid #3b82f6';
    spinner.style.borderRadius = '50%';
    spinner.style.animation = 'pdSpin 0.9s linear infinite';

    const msg = document.createElement('div');
    msg.textContent = text || 'Processing…';
    msg.style.fontFamily = 'Inter,system-ui,Segoe UI,Roboto,Arial';
    msg.style.fontSize = '14px';
    msg.style.color = '#111827';
    msg.style.textAlign = 'center';

    const style = document.createElement('style');
    style.textContent = `
      @keyframes pdSpin { 
        0% { transform: rotate(0deg);} 
        100% { transform: rotate(360deg);} 
      }
    `;

    box.appendChild(spinner);
    box.appendChild(msg);
    overlay.appendChild(style);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  function hideLoadingOverlay() {
    const el = document.getElementById('pd-prd-overlay');
    if (el) el.remove();
  }

  // principal: chamada pelo botão
  function deletePR(slBaseUrl, prId, soIdFromUE) {
    // 🔧 use o ID que veio do UE; se não vier, tente ler do form como fallback
    var soId = soIdFromUE;
    if (!soId) {
      try {
        const rec = currentRecord.get();
        soId = rec.getValue({ fieldId: 'custbody_pd_so_sales_order' });
      } catch(_) {}
    }
  
    if (!soId) {
      dialog.alert({
        title: 'Missing Sales Order',
        message: 'This requisition has no linked Sales Order.'
      });
      return;
    }
  
    dialog.confirm({
      title: 'Delete Requisition',
      message: 'Are you sure you want to DELETE this Purchase Requisition? This cannot be undone.'
    }).then((ok) => {
      if (!ok) return;
  
      showLoadingOverlay('Deleting requisition… Please wait…');
  
      setTimeout(() => {
        try {
          const slUrl = url.resolveScript({
            scriptId: 'customscript_pd_prd_purc_req_deletion_st',
            deploymentId: 'customdeploy_pd_prd_purc_req_deletion_st',
            params: { id: prId }
          });
  
          const resp = https.get({ url: slUrl });
          let body = {};
          try { body = JSON.parse(resp.body || '{}'); } catch(_) {}
  
          hideLoadingOverlay();
  
          if (resp.code === 200 && body && body.success) {
            // redireciona para a SO já com o alerta
            const soUrl = url.resolveRecord({
              recordType: 'salesorder',
              recordId: soId,
              isEditMode: false
            });
            window.location.href = soUrl + (soUrl.indexOf('?') >= 0 ? '&' : '?') + 'custparam_prd_deleted_pr=1';
          } else {
            dialog.alert({
              title: 'Deletion failed',
              message: (body && body.error) ? body.error : `HTTP ${resp.code}: ${resp.body || 'Unknown error.'}`
            });
          }
        } catch (e) {
          hideLoadingOverlay();
          dialog.alert({ title: 'Error', message: `${e.name}: ${e.message}` });
        }
      }, 50);
    });
  }  

  return { pageInit, deletePR };
});
