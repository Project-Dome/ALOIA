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
    overlay.id = 'pd-uoc-overlay';
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
    const el = document.getElementById('pd-uoc-overlay');
    if (el) el.remove();
  }

  // recType: "salesorder" | "invoice"
  function pdUpdateOperatingCost(recType) {
    const rec = currentRecord.get();
    const transId = rec.id;

    if (!transId) {
      dialog.alert({ title: 'Record', message: 'Please save the record before running the update.' });
      return;
    }

    // English popup with animation
    showLoadingOverlay('Updating operating costs from linked Purchase Order(s). Please wait…');

    // Let the browser paint the overlay before the blocking GET
    setTimeout(() => {
      try {
        const slUrl = url.resolveScript({
          scriptId: 'customscript_pd_uoc_update_op_cost_sl',
          deploymentId: 'customdeploy_pd_uoc_update_op_cost_sl',
          params: { recId: transId, recType }
        });

        const resp = https.get({ url: slUrl });

        let body = {};
        try { body = JSON.parse(resp.body || '{}'); } catch(_) {}

        hideLoadingOverlay();

        if (resp.code === 200 && body.success) {
          if (body.alreadyUpToDate) {
            dialog.alert({
              title: 'No Changes',
              message: 'No changes: this transaction was already up to date.'
            });
          } else if (body.matchedLines === 0) {
            dialog.alert({
              title: 'Nothing to Update',
              message: 'No linked Purchase Order lines were found to update.'
            });
          } else {
            dialog.alert({
              title: 'Operating Cost',
              message: `Updated successfully. Lines updated: ${body.updatedLines || 0}.`
            }).then(() => window.location.reload());
          }
        } else {
          dialog.alert({
            title: 'Update Failed',
            message: (body && body.message) ? body.message : `HTTP ${resp.code}: ${resp.body}`
          });
        }
      } catch (e) {
        hideLoadingOverlay();
        dialog.alert({ title: 'Error', message: `${e.name}: ${e.message}` });
      }
    }, 50);
  }

  return { pageInit, pdUpdateOperatingCost };
});
