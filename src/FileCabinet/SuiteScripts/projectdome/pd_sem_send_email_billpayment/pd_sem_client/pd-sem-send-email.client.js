/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/url', 'N/ui/dialog'], function (currentRecord, url, dialog) {

  // Entry point obrigatório
  function pageInit() {}

  // Overlay simples de processamento
  function showProcessingOverlay(message = 'Sending email...') {
    const existing = document.getElementById('pd-sem-processing-overlay');
    if (existing) return;

    const overlay = document.createElement('div');
    overlay.id = 'pd-sem-processing-overlay';
    overlay.setAttribute('style', [
      'position: fixed',
      'inset: 0',
      'background: rgba(0,0,0,0.35)',
      'z-index: 2147483647',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'font-family: Arial, Helvetica, sans-serif'
    ].join(';'));

    const panel = document.createElement('div');
    panel.setAttribute('style', [
      'background: #fff',
      'padding: 20px 24px',
      'border-radius: 10px',
      'box-shadow: 0 8px 24px rgba(0,0,0,.2)',
      'min-width: 280px',
      'display: flex',
      'gap: 12px',
      'align-items: center',
      'justify-content: center'
    ].join(';'));

    const spinner = document.createElement('div');
    spinner.setAttribute('style', [
      'width: 22px',
      'height: 22px',
      'border: 3px solid #e5e7eb',
      'border-top-color: #3b82f6',
      'border-radius: 50%',
      'animation: pd-sem-spin 0.9s linear infinite'
    ].join(';'));

    const style = document.createElement('style');
    style.innerHTML = '@keyframes pd-sem-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);

    const text = document.createElement('div');
    text.textContent = message;
    text.setAttribute('style', 'font-size:14px;color:#111;');

    panel.appendChild(spinner);
    panel.appendChild(text);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  function hideProcessingOverlay() {
    const overlay = document.getElementById('pd-sem-processing-overlay');
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  async function onSendPaymentEmailClick() {
    const rec = currentRecord.get();
    const recordType = rec.type;     // 'customerpayment' | 'vendorpayment'
    const recordId = rec.id;

    try {
      if (!recordId) {
        await dialog.alert({ title: 'Send email', message: 'Please save the record before sending the email.' });
        return;
      }

      const confirmed = await dialog.confirm({
        title: 'Send payment confirmation',
        message: `Do you want to send the payment confirmation for this ${recordType === 'customerpayment' ? 'Customer Payment' : 'Vendor Payment'}?`
      });
      if (!confirmed) return;

      // Mostra overlay e dispara chamada assíncrona via fetch
      showProcessingOverlay('Sending email...');

      const slUrl = url.resolveScript({
        scriptId: 'customscript_pd_sem_send_email_sl',
        deploymentId: 'customdeploy_pd_sem_send_email_sl',
        returnExternalUrl: false // mesma origem -> cookies de sessão OK
      });

      // Timeout de segurança (abort em ~120s)
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);

      let bodyJson;
      try {
        const resp = await fetch(slUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordType, recordId: String(recordId) }),
          credentials: 'same-origin',
          signal: controller.signal
        });

        clearTimeout(timer);

        // Tenta parsear JSON de retorno
        bodyJson = await resp.json().catch(() => ({}));

        // Tira overlay ANTES de abrir o dialog (evita "tela travada" por sobreposição)
        hideProcessingOverlay();

        if (resp.ok && bodyJson?.ok) {
          await dialog.alert({
            title: 'Success',
            message: bodyJson.message || 'Email sent.'
          });
        } else {
          await dialog.alert({
            title: 'Could not send',
            message: (bodyJson && bodyJson.message)
              ? bodyJson.message
              : `Status: ${resp.status}\n${await resp.text().catch(() => 'No further details.')}`
          });
        }
      } catch (fetchErr) {
        clearTimeout(timer);
        // Garante remoção do overlay mesmo com erro/timeout
        hideProcessingOverlay();

        const msg = fetchErr?.name === 'AbortError'
          ? 'Timeout sending the email (took more than 120 seconds).'
          : (fetchErr?.message || String(fetchErr));

        await dialog.alert({ title: 'Unexpected error', message: msg });
      }

    } catch (e) {
      hideProcessingOverlay();
      await dialog.alert({ title: 'Unexpected error', message: e?.message || String(e) });
    }
  }

  return { pageInit, onSendPaymentEmailClick };
});
