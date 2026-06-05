/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/record', 'N/runtime', 'N/email', 'N/log', 'N/format'],
function (record, runtime, email, log, nsFormat) {

  function onRequest(context) {
    try {
      if (context.request.method !== 'POST') {
        context.response.write(JSON.stringify({ ok: false, message: 'Use POST method.' }));
        return;
      }

      const body = JSON.parse(context.request.body || '{}');
      const { recordType, recordId } = body;

      if (!recordType || !recordId) {
        context.response.write(JSON.stringify({ ok: false, message: 'Missing parameters: recordType/recordId.' }));
        return;
      }

      const isCustPay = recordType === 'customerpayment';
      const isVendPay = recordType === 'vendorpayment';
      if (!isCustPay && !isVendPay) {
        context.response.write(JSON.stringify({ ok: false, message: 'Unsupported transaction type.' }));
        return;
      }

      // Load transaction
      const rec = record.load({ type: recordType, id: recordId });

      // Basic transaction data (date-only)
      const tranid = rec.getValue({ fieldId: 'tranid' });

      // Prefer getValue (Date) -> format DATE; fallback: sanitize string
      const rawTranDate = rec.getValue({ fieldId: 'trandate' }) || rec.getText({ fieldId: 'trandate' });
      const trandate = toDateOnlyString(rawTranDate);

      const totalAmt = rec.getValue({ fieldId: 'total' }) ?? rec.getValue({ fieldId: 'amount' });

      // Resolve entity (customer/vendor)
      const entityField = isCustPay ? 'customer' : 'entity';
      const entityId = rec.getValue({ fieldId: entityField });
      if (!entityId) {
        context.response.write(JSON.stringify({ ok: false, message: 'Transaction without an entity.' }));
        return;
      }

      const entityType = isCustPay ? record.Type.CUSTOMER : record.Type.VENDOR;
      const entityRec = record.load({ type: entityType, id: entityId });
      const entityName = entityRec.getValue({ fieldId: 'companyname' }) || entityRec.getValue({ fieldId: 'entityid' }) || '';

      // Recipient fields (3 slots)
      const emailFields = [
        'custentity_pd_aae_emailpayment',
        'custentity_pd_aae_emailpayment2',
        'custentity_pd_aae_emailpayment3'
      ];
      const recipients = emailFields
        .map(fid => (entityRec.getValue({ fieldId: fid }) || '').toString().trim())
        .filter(v => !!v);

      if (!recipients.length) {
        context.response.write(JSON.stringify({
          ok: false,
          message: 'No recipients found on the entity (check custentity_pd_aae_emailpayment[2|3]).'
        }));
        return;
      }

      // Author = current user (who clicked the button)
      const authorId = runtime.getCurrentUser().id;

      // Build email content
      const txnData = { tranid, trandate, amount: totalAmt };

      let subject;
      let bodyHtml;

      if (isCustPay) {
        subject = `Payment Confirmation – ${tranid}`;

        // Collect applied invoices (Customer Payment -> sublist "apply"), format dates as day-only
        const appliedInvoices = [];
        const lineCount = rec.getLineCount({ sublistId: 'apply' }) || 0;
        for (let i = 0; i < lineCount; i++) {
          const isApplied = rec.getSublistValue({ sublistId: 'apply', fieldId: 'apply', line: i });
          if (isApplied) {
            const rawApplyDate = rec.getSublistValue({ sublistId: 'apply', fieldId: 'applydate', line: i });
            appliedInvoices.push({
              doc: rec.getSublistValue({ sublistId: 'apply', fieldId: 'refnum', line: i }) || '',
              date: toDateOnlyString(rawApplyDate),
              amountApplied: rec.getSublistValue({ sublistId: 'apply', fieldId: 'amount', line: i }) || 0,
              balanceRemaining: rec.getSublistValue({ sublistId: 'apply', fieldId: 'due', line: i }) || 0
            });
          }
        }

        bodyHtml = buildEmailHtml({
          kind: 'customerpayment',
          entityName,
          txn: txnData,
          appliedInvoices
        });

      } else {
        subject = `Payment Notice – ${tranid}`;

        // Collect applied vendor bills (Vendor Payment -> sublist "apply"), date-only
        const appliedBills = [];
        const lineCount = rec.getLineCount({ sublistId: 'apply' }) || 0;
        for (let i = 0; i < lineCount; i++) {
          const isApplied = rec.getSublistValue({ sublistId: 'apply', fieldId: 'apply', line: i });
          if (isApplied) {
            const rawApplyDate = rec.getSublistValue({ sublistId: 'apply', fieldId: 'applydate', line: i });
            appliedBills.push({
              doc: rec.getSublistValue({ sublistId: 'apply', fieldId: 'refnum', line: i }) || '',
              date: toDateOnlyString(rawApplyDate),
              amountApplied: rec.getSublistValue({ sublistId: 'apply', fieldId: 'amount', line: i }) || 0,
              balanceRemaining: rec.getSublistValue({ sublistId: 'apply', fieldId: 'due', line: i }) || 0
            });
          }
        }

        bodyHtml = buildEmailHtml({
          kind: 'vendorpayment',
          entityName,
          txn: txnData,
          appliedBills
        });
      }

      // Send
      email.send({
        author: Number(authorId),
        recipients,
        subject,
        body: bodyHtml,
        relatedRecords: { transactionId: Number(recordId) }
      });

      context.response.write(JSON.stringify({
        ok: true,
        message: `Email successfully sent to: ${recipients.join(', ')}`
      }));

    } catch (e) {
      log.error('pd-sem-send-email.suitelet', e);
      context.response.write(JSON.stringify({
        ok: false,
        message: e?.message || String(e)
      }));
    }

    // ---- helper: normalize any date-like value to account-formatted DATE only ----
    function toDateOnlyString(val) {
      try {
        if (!val) return '';
        // If val is already a Date, format as DATE (no time)
        if (val instanceof Date) {
          return nsFormat.format({ value: val, type: nsFormat.Type.DATE });
        }
        // Try to construct Date from string/number
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
          return nsFormat.format({ value: d, type: nsFormat.Type.DATE });
        }
        // Fallback: strip time portions from strings like "MM/DD/YYYY HH:MM" or "YYYY-MM-DDTHH:MM"
        const s = String(val);
        // Try to keep only the date part if present
        const m1 = s.match(/\b\d{2}\/\d{2}\/\d{4}\b/);      // e.g., 10/29/2025
        const m2 = s.match(/\b\d{4}-\d{2}-\d{2}\b/);        // e.g., 2025-10-29
        return (m1 && m1[0]) || (m2 && m2[0]) || s;
      } catch {
        return String(val);
      }
    }
  }

  // ---------- Helpers ----------
  function buildEmailHtml(opts) {
    const { kind, entityName, txn } = opts;
    const head =
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#222;">';
    const foot = '</div>';

    if (kind === 'customerpayment') {
      const rows = (opts.appliedInvoices || []).map(inv => `
        <tr>
          <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(inv.doc)}</td>
          <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(inv.date)}</td>
          <td style="padding:6px;border:1px solid #ddd;">${numberToStr(inv.amountApplied)}</td>
          <td style="padding:6px;border:1px solid #ddd;">${numberToStr(inv.balanceRemaining)}</td>
        </tr>`).join('');

      return `${head}
        <p>Dear ${escapeHtml(entityName)},</p>
        <p>We have received a payment with the following details:</p>

        <table style="border-collapse:collapse;font-size:14px;margin:12px 0;">
          <tr>
            <th style="text-align:left;padding:6px;">Payment Number</th>
            <th style="text-align:left;padding:6px;">Payment Date</th>
            <th style="text-align:left;padding:6px;">Total Amount Received</th>
          </tr>
          <tr>
            <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(txn.tranid)}</td>
            <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(txn.trandate)}</td>
            <td style="padding:6px;border:1px solid #ddd;">${numberToStr(txn.amount)}</td>
          </tr>
        </table>

        <p>The following invoices were included in this payment:</p>
        <table style="border-collapse:collapse;font-size:14px;margin:12px 0;width:100%;">
          <tr>
            <th style="text-align:left;padding:6px;">Invoice Number</th>
            <th style="text-align:left;padding:6px;">Invoice Date</th>
            <th style="text-align:left;padding:6px;">Amount Applied</th>
            <th style="text-align:left;padding:6px;">Balance Remaining</th>
          </tr>
          ${rows || '<tr><td colspan="4" style="padding:6px;border:1px solid #ddd;">No applied invoices found.</td></tr>'}
        </table>

        <p>If you have any questions, please let us know.</p>
        ${foot}`;
    }

    // === vendor payment (with applied Vendor Bills table) ===
    const rowsBills = (opts.appliedBills || []).map(b => `
      <tr>
        <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(b.doc)}</td>
        <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(b.date)}</td>
        <td style="padding:6px;border:1px solid #ddd;">${numberToStr(b.amountApplied)}</td>
        <td style="padding:6px;border:1px solid #ddd;">${numberToStr(b.balanceRemaining)}</td>
      </tr>`).join('');

    return `${head}
      <p>Dear ${escapeHtml(entityName)},</p>
      <p>We inform you that a payment has been made with the following details:</p>

      <table style="border-collapse:collapse;font-size:14px;margin:12px 0;">
        <tr>
          <th style="text-align:left;padding:6px;">Payment Number</th>
          <th style="text-align:left;padding:6px;">Payment Date</th>
          <th style="text-align:left;padding:6px;">Total Amount Paid</th>
        </tr>
        <tr>
          <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(txn.tranid)}</td>
          <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(txn.trandate)}</td>
          <td style="padding:6px;border:1px solid #ddd;">${numberToStr(txn.amount)}</td>
        </tr>
      </table>

      <p>The following vendor bills were included in this payment:</p>
      <table style="border-collapse:collapse;font-size:14px;margin:12px 0;width:100%;">
        <tr>
          <th style="text-align:left;padding:6px;">Bill Number</th>
          <th style="text-align:left;padding:6px;">Bill Date</th>
          <th style="text-align:left;padding:6px;">Amount Applied</th>
          <th style="text-align:left;padding:6px;">Balance Remaining</th>
        </tr>
        ${rowsBills || '<tr><td colspan="4" style="padding:6px;border:1px solid #ddd;">No applied vendor bills found.</td></tr>'}
      </table>

      <p>If you find any discrepancies, please contact us.</p>
      ${foot}`;
  }

  function numberToStr(n) {
    const v = (typeof n === 'number') ? n : parseFloat(String(n).replace(',', '.'));
    if (isNaN(v)) return String(n ?? '');
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { onRequest };
});
