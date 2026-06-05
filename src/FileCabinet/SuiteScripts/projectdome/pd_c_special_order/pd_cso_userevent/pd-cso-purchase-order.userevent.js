/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([
  'N/record',
  'N/log',

  '../pd_cso_service/pd-cso-purchase-order.service',
  '../pd_cso_service/pd-cso-purchase-requisition.service',
  '../pd_cso_service/pd-cso-sales-order.service',

  '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
], function (
  record,
  log,
  purchase_order_service,
  purchase_requisition_service,
  sales_order_service
) {

  function beforeSubmit(context) {
    try {
      const UserEventType = context.UserEventType;
      if (context.type !== UserEventType.DELETE) return;

      // No delete, use oldRecord
      const oldRec = context.oldRecord;
      if (!oldRec) return;

      const poId = oldRec.id;
      const soId = oldRec.getValue({ fieldId: 'custbody_pd_so_sales_order' });

      if (!soId) {
        log.audit({ title: 'PO DELETE - Sem SO vinculada', details: { poId } });
        return;
      }

      // Limpa na SO tudo que veio deste PO (vínculo e final cost)
      const cleared = sales_order_service.clearPurchaseOrderLinkAndFinalCost({
        purchaseOrderId: poId,
        salesOrderId: soId,
        clearBuyerFromPOLines: true // opcional: limpa buyer da linha se desejar
      });

      log.audit({
        title: 'PO DELETE - Limpeza em SO concluída',
        details: { poId, soId, cleared }
      });

    } catch (e) {
      log.error({ title: 'beforeSubmit(DELETE) - erro ao limpar SO', details: e });
    }
  }

  function afterSubmit(context) {
    try {
      const _cRecord = context.newRecord;
      log.debug({ title: 'afterSubmit - linha 59 - Registro submetido (PO)', details: _cRecord.id });

      // Se quiser limitar só à criação, descomente a linha abaixo
      // if (context.type !== context.UserEventType.CREATE) return;

      // 1) Carrega o PO para ler/editar as linhas
      const poId = _cRecord.id;
      const poRec = record.load({ type: record.Type.PURCHASE_ORDER, id: poId, isDynamic: false });
      log.debug({ title: 'afterSubmit - linha 67 -  PO carregado', details: poId });

      // === [NOVO BLOCO] Preencher campos de LINHA do PO a partir da PR (via linkedorder) ===
      (function reflectBuyerAndSOFromPRToPOLines() {
        log.debug({ title: 'reflectBuyerAndSOFromPRToPOLines - start', details: { poId } });

        const sublistId = 'item';
        const lineCount = poRec.getLineCount({ sublistId }) || 0;
        const prCache = {};
        let touched = 0;

        log.debug({ title: 'reflectBuyerAndSOFromPRToPOLines - lineCount', details: lineCount });

        for (let i = 0; i < lineCount; i++) {
          const prId = poRec.getSublistValue({ sublistId, fieldId: 'linkedorder', line: i });
          log.debug({ title: 'reflectBuyerAndSOFromPRToPOLines - linkedorder', details: { line: i, prId } });

          if (!prId) continue;

          if (!prCache[prId]) {
            const pr = record.load({ type: record.Type.PURCHASE_REQUISITION, id: prId, isDynamic: false });
            prCache[prId] = {
              buyer: pr.getValue({ fieldId: 'custbody_aae_buyer' }) || '',
              salesOrder: pr.getValue({ fieldId: 'custbody_pd_so_sales_order' }) || ''
            };
            log.debug({ title: 'reflectBuyerAndSOFromPRToPOLines - PR cacheada', details: { prId, ...prCache[prId] } });
          }

          const buyerVal = prCache[prId].buyer;
          const soVal = prCache[prId].salesOrder;

          // Valores atuais na linha
          const currBuyer = poRec.getSublistValue({ sublistId, fieldId: 'custcol_aae_buyer_purchase_order', line: i });
          const currSO = poRec.getSublistValue({ sublistId, fieldId: 'custcol_pd_sales_order_linked', line: i });

          // Atualize somente se mudou (evita save desnecessário)
          if (String(currBuyer || '') !== String(buyerVal || '')) {
            poRec.setSublistValue({ sublistId, fieldId: 'custcol_aae_buyer_purchase_order', line: i, value: buyerVal });
            touched++;
            log.debug({ title: 'reflectBuyerAndSOFromPRToPOLines - set buyer', details: { line: i, from: currBuyer, to: buyerVal } });
          }

          if (String(currSO || '') !== String(soVal || '')) {
            poRec.setSublistValue({ sublistId, fieldId: 'custcol_pd_sales_order_linked', line: i, value: soVal });
            touched++;
            log.debug({ title: 'reflectBuyerAndSOFromPRToPOLines - set SO', details: { line: i, from: currSO, to: soVal } });
          }
        }

        if (touched > 0) {
          const saveId = poRec.save({ enableSourcing: true, ignoreMandatoryFields: true });
          log.audit({ title: 'reflectBuyerAndSOFromPRToPOLines - salvo', details: { poId, touched, saveId } });
        } else {
          log.debug({ title: 'reflectBuyerAndSOFromPRToPOLines - nada a salvar', details: { poId } });
        }
      })();
      // === [FIM NOVO BLOCO] ===

      // 2) Coleta PRs distintas a partir das linhas do PO (item.linkedorder)
      const prIds = collectRequisitionsFromPO(poRec);
      log.debug({ title: 'afterSubmit -linha 127 - PRs distintas encontradas no PO', details: JSON.stringify(prIds) });

      // 3) Para cada PR encontrada, executa as três ações na ordem solicitada
      if (prIds.length) {
        prIds.forEach(function (prId) {
          try {
            log.debug({ title: 'afterSubmit - linha 133 - Processando PR', details: prId });

            // PR -> dados
            const prRec = record.load({ type: record.Type.PURCHASE_REQUISITION, id: prId, isDynamic: false });
            const _purchaseRequisitionData = purchase_requisition_service.readData(prRec);
            log.debug({ title: 'afterSubmit - linha 138 - Dados da Requisição', details: JSON.stringify(_purchaseRequisitionData) });

            // SO origem (exposta pelo readData da PR)
            const _idSalesOrder = _purchaseRequisitionData && _purchaseRequisitionData.salesOrder;
            log.debug({ title: 'afterSubmit - linha 142 - ID da Sales Order vinculada', details: _idSalesOrder });

            if (!_idSalesOrder) {
              log.debug({ title: 'afterSubmit - linha 145 - Nenhuma Sales Order vinculada à PR, pulando PR', details: prId });
              return;
            }

            // SO -> dados
            const _salesOrderOptions = sales_order_service.getSalesData(_idSalesOrder);
            log.debug({ title: 'afterSubmit - linha 151 - Opções da Sales Order', details: JSON.stringify(_salesOrderOptions) });

            const _salesOrderData = sales_order_service.readData(_salesOrderOptions);
            log.debug({ title: 'afterSubmit - linha 154 - Dados da Sales Order', details: JSON.stringify(_salesOrderData) });

            // 1) syncLinkedOrders
            const _syncLinkedOrders = sales_order_service.syncLinkedOrders(_purchaseRequisitionData, _salesOrderData);
            log.debug({ title: 'afterSubmit - linha 158 - Resultado do syncLinkedOrders', details: JSON.stringify(_syncLinkedOrders) });

            // 2) updateSalesOrder
            const _updateSalesOrder = sales_order_service.updateSalesOrder(_syncLinkedOrders);
            log.debug({ title: 'afterSubmit - linha 162 - Resultado do updateSalesOrder', details: JSON.stringify(_updateSalesOrder) });

            // 3) updateVendor (somente linhas da PR que apontam para ESTE PO)
            const _prDataOnlyThisPO = {
              id: _purchaseRequisitionData.id,
              itemList: (_purchaseRequisitionData.itemList || []).filter(function (line) {
                return line.linkedOrder && line.linkedOrder[0] == poId;
              })
            };

            let _updateRequistion = null;
            if (_prDataOnlyThisPO.itemList.length) {
              _updateRequistion = purchase_requisition_service.updateVendor(_prDataOnlyThisPO);
              log.debug({ title: 'afterSubmit - linha 175 -  Resultado do updateVendor (somente linhas desta PR->PO)', details: JSON.stringify(_updateRequistion) });
            } else {
              log.debug({ title: 'afterSubmit - linha 177 - PR sem linhas vinculadas ao PO atual para updateVendor (ok)', details: { prId, poId } });
            }

            log.debug({
              title: 'afterSubmit - linha 181 - PR processada com sucesso',
              details: { purchaseOrderId: poId, purchaseRequisitionId: prId, salesOrderId: _idSalesOrder }
            });

          } catch (innerErr) {
            log.error({ title: 'afterSubmit - linha 186 - Erro ao processar PR vinculada ao PO', details: { poId, prId, error: innerErr } });
          }
        });
      } else {
        log.debug({ title: 'afterSubmit - linha 190 -  Nenhuma Requisição vinculada ao PO (ok)', details: null });
      }

      // 4) Ações que dependem dos dados do PO (independente de ter PR)
      const _purchaseOrderData = purchase_order_service.readData(poRec);

      // Atualiza FINAL COST na PR (só se houver PRs)
      if (prIds.length) {
        const _updateFinalCostPR = purchase_requisition_service.updateFinalCost(prIds, _purchaseOrderData);
        log.audit({ title: 'afterSubmit -linha 199 - updateFinalCost (PR)', details: _updateFinalCostPR });
      }

      const _hasIdSalesOrder = !isNullOrEmpty(_purchaseOrderData.salesOrder);
      log.debug({ title: 'afterSubmit -linha 203 - _purchaseOrderData id SO', details: _hasIdSalesOrder });
      // log.debug({ title: 'afterSubmit - _purchaseOrderData dados', details: _purchaseOrderData });

      if (_hasIdSalesOrder) {

        // Atualiza Final Buyer na SO
        const _updateFinalBuyer = sales_order_service.updateFinalBuyer(_purchaseOrderData);
        log.audit({ title: 'Linha 210 - afterSubmit - updateFinalBuyer (SO)', details: _updateFinalBuyer });
      } else {

        log.debug({ title: 'Linha 213 - afterSubmit - _purchaseOrderData dados', details: _purchaseOrderData });
        const _updateSOItems = sales_order_service.updateSOItems(_purchaseOrderData);
        log.debug({ title: 'Linha 215 - afterSubmit - retorno _updateSOItems', details: _updateSOItems });

      }


      // Preenche custcol_aae_final_cost_po NA SALES ORDER com {amount} das linhas do PO
      const _updateFinalCostSO = sales_order_service.updateFinalCostFromPO(_purchaseOrderData);
      log.audit({ title: 'afterSubmit - linha 222 - updateFinalCostFromPO (SO)', details: _updateFinalCostSO });
      
      const _propagateFinalCost = purchase_order_service.propagateFinalCost({poRec} );
      log.audit({ title: 'afterSubmit - linha 235 - _propagateFinalCost (PO)', details: _propagateFinalCost });

      const _updateFinalCostPoUnFromRate = purchase_order_service.updateFinalCostPoUnFromRate(poId);
      log.debug({ title: 'Linha 228 - afterSubmit - retorno _updateFinalCostPoUnFromRate', details: _updateFinalCostPoUnFromRate });
      
      log.debug({ title: 'Linha 230- afterSubmit - fim ', details: '' });

    } catch (error) {
      log.error({ title: 'afterSubmit - Erro de processamento (PO)', details: error });
    }
  }

  // Coleta ids únicos de PR lendo item.linkedorder nas linhas do PO
  function collectRequisitionsFromPO(poRec) {
    const reqSet = new Set();
    const lineCount = poRec.getLineCount({ sublistId: 'item' }) || 0;

    log.debug({ title: 'collectRequisitionsFromPO - lineCount', details: lineCount });

    for (let i = 0; i < lineCount; i++) {
      const prId = poRec.getSublistValue({
        sublistId: 'item',
        fieldId: 'linkedorder',
        line: i
      });

      if (prId) {
        log.debug({ title: 'collectRequisitionsFromPO - Linha com PR encontrada', details: { line: i, prId } });
        reqSet.add(String(prId));
      }
    }
    return Array.from(reqSet);
  }

  return {
    beforeSubmit: beforeSubmit,
    afterSubmit: afterSubmit
  };
});
