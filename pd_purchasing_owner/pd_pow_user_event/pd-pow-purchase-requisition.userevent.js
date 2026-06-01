/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([
  'N/record',
  'N/search',
  'N/log',
  '../pd_pow_service/pd-pow-purchase-requisition.service'
], function (record, search, log, purchase_requisition_service) {

  // Ajuste o rótulo exatamente como aparece na sua conta (se sua UI estiver em PT-BR)
  const STATUS_PENDING_ORDER = 'Pending Order';

  function beforeSubmit(context) {
    try {
      const UE = context.UserEventType;
      const type = context.type;

      // DELETE: decrementar antes do registro sumir (fallback rápido)
      if (type === UE.DELETE) {
        const oldRec = context.oldRecord;
        const oldBuyer = oldRec && oldRec.getValue({ fieldId: 'custbody_aae_buyer' });
        if (oldBuyer) {
          // _decrementCounterSafe(oldBuyer);
          log.audit('Contador atualizado (DELETE)', `Buyer ${oldBuyer} - PR ${oldRec.id}`);
        }
        return;
      }

      // CREATE/EDIT: tratar mudança de buyer (incrementa/decrementa)
      if (type === UE.CREATE || type === UE.EDIT) {
        const newRec = context.newRecord;
        const oldRec = context.oldRecord;

        const newBuyer = newRec.getValue({ fieldId: 'custbody_aae_buyer' });
        const oldBuyer = oldRec ? oldRec.getValue({ fieldId: 'custbody_aae_buyer' }) : null;

        // buyer removido
        if (oldBuyer && !newBuyer) {
          // _decrementCounterSafe(oldBuyer);
          log.audit('Contador atualizado (buyer removido)', `Buyer ${oldBuyer} - PR ${newRec.id}`);
        }

        // buyer trocado
        if (oldBuyer && newBuyer && String(oldBuyer) !== String(newBuyer)) {
          // _decrementCounterSafe(oldBuyer);
          // _incrementCounterSafe(newBuyer);
          log.audit('Contador atualizado (buyer trocado)', `De ${oldBuyer} para ${newBuyer} - PR ${newRec.id}`);
        }

        // buyer definido na criação manual
        if (!oldBuyer && newBuyer && type === UE.CREATE) {
          // _incrementCounterSafe(newBuyer);
          log.audit('Contador atualizado (buyer definido na criação)', `Buyer ${newBuyer} - PR ${newRec.id}`);
        }
      }
    } catch (e) {
      log.error('beforeSubmit - erro', e);
    }
  }

  function afterSubmit(context) {
    try {
      const UE = context.UserEventType;
      const type = context.type;
      if (type !== UE.CREATE && type !== UE.EDIT) return;

      const rec = context.newRecord;
      const prId = rec.id;

      // 1) Distribuição automática (APENAS se não tem buyer ainda)
      try {
        const buyerId = rec.getValue({ fieldId: 'custbody_aae_buyer' });

        if (!buyerId) {
          // ⛔️ NOVO: só distribui se a PR estiver aprovada (approvalstatus = '2')
          const approval = rec.getValue({ fieldId: 'approvalstatus' }); // 1=Pending, 2=Approved, 3=Rejected
          if (approval === '1' || approval === '3') {
            log.debug(
              'Distribuição bloqueada por approvalstatus',
              `PR ${prId} sem buyer e não aprovada (approvalstatus=${approval}).`
            );
            // não faz return do afterSubmit — só pula a distribuição
          } else {
            log.debug('Distribuição automática', `Disparando redistribuição da PR ${prId}`);
            purchase_requisition_service.assignBuyerToPR(prId);
          }
        } else {
          log.debug('Distribuição automática', `PR ${prId} já tem comprador (${buyerId}), nenhuma ação necessária.`);
        }
      } catch (distErr) {
        log.error('Erro durante distribuição automática', distErr);
      }

      // 2) RECONTAGEM SEMPRE dos compradores impactados (mantido como estava)
      // try {
      //   const newBuyer = rec.getValue({ fieldId: 'custbody_aae_buyer' });
      //   const oldBuyer = context.oldRecord ? context.oldRecord.getValue({ fieldId: 'custbody_aae_buyer' }) : null;

      //   const impacted = {};
      //   if (newBuyer) impacted[String(newBuyer)] = true;
      //   if (oldBuyer && String(oldBuyer) !== String(newBuyer)) impacted[String(oldBuyer)] = true;

      //   for (var empId in impacted) {
      //     const newCount = _recountEmployeePendingOnly(empId);
      //     if (newCount != null) {
      //       const curr = _getCurrentCounter(empId);
      //       if (curr !== newCount) {
      //         record.submitFields({
      //           type: record.Type.EMPLOYEE,
      //           id: empId,
      //           values: { custentity_pd_pow_prs_assigned_today: newCount },
      //           options: { enableSourcing: false, ignoreMandatoryFields: true }
      //         });
      //         log.audit('Recontagem aplicada',
      //           `Employee ${empId} -> contador ${curr} → ${newCount} (PR ${prId})`);
      //       } else {
      //         log.debug('Recontagem sem alteração', { employeeId: empId, count: newCount, prId });
      //       }
      //     }
      //   }
      // } catch (e) {
      //   log.error('Erro na recontagem', e);
      // }

    } catch (e) {
      log.error('Erro no afterSubmit - PR', e);
    }
  }

  // ===== Helpers =====

  function _getCurrentCounter(employeeId) {
    try {
      const lookup = search.lookupFields({
        type: search.Type.EMPLOYEE,
        id: employeeId,
        columns: ['custentity_pd_pow_prs_assigned_today']
      });
      const raw = Array.isArray(lookup.custentity_pd_pow_prs_assigned_today)
        ? lookup.custentity_pd_pow_prs_assigned_today[0]
        : lookup.custentity_pd_pow_prs_assigned_today;
      return parseInt(raw, 10) || 0;
    } catch (e) {
      log.error('_getCurrentCounter error', e);
      return 0;
    }
  }

  /**
   * Conta PRs do employee SOMENTE com status "Pending Order".
   * Lê o TEXTO do status em cada resultado (independe do ID interno).
   */
  function _recountEmployeePendingOnly(employeeId) {
    try {
      const s = search.create({
        type: 'purchaserequisition',
        filters: [
          ['custbody_aae_buyer', 'anyof', employeeId],
          'AND', ['mainline', 'is', 'T'],
          'AND', ['type', 'anyof', 'PurchReq']
        ],
        columns: ['internalid', 'status']
      });

      let count = 0;
      s.run().each(function (r) {
        const statusText = r.getText('status') || '';
        if (statusText === STATUS_PENDING_ORDER) count++;
        return true;
      });

      log.debug('_recountEmployeePendingOnly', { employeeId, count });
      return count;
    } catch (e) {
      log.error('_recountEmployeePendingOnly error', e);
      return null;
    }
  }

  function _incrementCounterSafe(employeeId) {
    try {
      const curr = _getCurrentCounter(employeeId);
      record.submitFields({
        type: record.Type.EMPLOYEE,
        id: employeeId,
        values: { custentity_pd_pow_prs_assigned_today: curr + 1 },
        options: { enableSourcing: false, ignoreMandatoryFields: true }
      });
    } catch (e) { log.error('_incrementCounterSafe', e); }
  }

  function _decrementCounterSafe(employeeId) {
    try {
      const curr = _getCurrentCounter(employeeId);
      if (curr > 0) {
        record.submitFields({
          type: record.Type.EMPLOYEE,
          id: employeeId,
          values: { custentity_pd_pow_prs_assigned_today: curr - 1 },
          options: { enableSourcing: false, ignoreMandatoryFields: true }
        });
      } else {
        log.debug('_decrementCounterSafe', `Contador já está em zero para employee ${employeeId}`);
      }
    } catch (e) { log.error('_decrementCounterSafe', e); }
  }

  return {
    beforeSubmit: beforeSubmit,
    afterSubmit: afterSubmit
  };
});
