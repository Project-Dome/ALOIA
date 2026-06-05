/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/search','N/record','N/log'], function (search, record, log) {

  const STATUS_PENDING_ORDER = 'Pending Order'; // ajuste ao rótulo exato na sua conta

  function afterSubmit(context) {
    try {
      const evt = context.type;
      if (evt !== context.UserEventType.CREATE &&
          evt !== context.UserEventType.EDIT &&
          evt !== context.UserEventType.DELETE) return;

      log.debug('PO UE Recount', `Evento: ${evt}; PO: ${(context.newRecord || context.oldRecord || {}).id || '-'}`);

      const eligible = getEligibleBuyerIds();              // Set<string>
      if (eligible.size === 0) return;

      const pendingByBuyer = computePendingCountsByBuyer(); // Map<string, number>

      let changed = 0, total = 0;
      eligible.forEach(function (empId) {
        total++;
        const desired = pendingByBuyer.get(empId) || 0;
        const current = getCurrentCounter(empId);
        if (current !== desired) {
          record.submitFields({
            type: record.Type.EMPLOYEE,
            id: empId,
            values: { custentity_pd_pow_prs_assigned_today: desired },
            options: { enableSourcing: false, ignoreMandatoryFields: true }
          });
          changed++;
          log.debug('Counter updated', { employeeId: empId, from: current, to: desired });
        }
      });

      log.audit('PO UE Recount done', `Atualizados: ${changed} / ${total}`);

    } catch (e) {
      log.error('afterSubmit error', e);
    }
  }

  function getEligibleBuyerIds() {
    const ids = new Set();
    const s = search.create({
      type: search.Type.EMPLOYEE,
      filters: [
        ['custentity_pd_pow_buyer','is','T'],
        'AND',['custentity_pd_pow_aae_onleave','is','F'],
        'AND',['isinactive','is','F']
      ],
      columns: ['internalid']
    });
    s.run().each(r => (ids.add(String(r.getValue('internalid'))), true));
    return ids;
  }

  function computePendingCountsByBuyer() {
    const map = new Map();
    const s = search.create({
      type: 'purchaserequisition',
      filters: [
        ['mainline','is','T'],
        'AND',['type','anyof','PurchReq'],
        'AND',['custbody_aae_buyer','noneof','@NONE@']
      ],
      columns: [
        search.createColumn({ name: 'custbody_aae_buyer', summary: 'GROUP' }),
        search.createColumn({
          name: 'formulanumeric',
          summary: 'SUM',
          formula: "CASE WHEN {status} = '" + STATUS_PENDING_ORDER.replace(/'/g, "''") + "' THEN 1 ELSE 0 END"
        })
      ]
    });
    s.run().each(function (r) {
      const buyerId = r.getValue({ name: 'custbody_aae_buyer', summary: 'GROUP' });
      const qty = parseInt(r.getValue({ name: 'formulanumeric', summary: 'SUM' }), 10) || 0;
      if (buyerId) map.set(String(buyerId), qty);
      return true;
    });
    return map;
  }

  function getCurrentCounter(employeeId) {
    const lookup = search.lookupFields({
      type: search.Type.EMPLOYEE,
      id: employeeId,
      columns: ['custentity_pd_pow_prs_assigned_today']
    });
    const raw = lookup && lookup.custentity_pd_pow_prs_assigned_today;
    const val = Array.isArray(raw) ? raw[0] : raw;
    return parseInt(val, 10) || 0;
  }

  return { afterSubmit };
});
