/**
 * @NApiVersion     2.1
 * @NScriptType     ClientScript
 * @NModuleScope    SameAccount
 * @author          Project Dome - Rogério Gonçalves Rodrigues
 */

define(
    [
        'N/currentRecord',
        'N/url',
        'N/ui/dialog',
        'N/log'
    ],
    function (
        currentRecord,
        url,
        dialog,
        log
    ) {
        function createPurchaseRequisition() {
            try {
                const _currentRecord = currentRecord.get();
                const _idSalesOrder = _currentRecord.id;

                if (!_idSalesOrder) {
                    dialog.alert({
                        title: 'Warning',
                        message: 'Please save the Sales Order before creating the Purchase Requisition.'
                    });
                    return;
                }

                const _purchaseRequisition = _currentRecord.getValue({
                    fieldId: 'custbody_pd_cso_linked_requistion'
                });

                if (_purchaseRequisition) {
                    dialog.alert({
                        title: 'Warning',
                        message: 'A Purchase Requisition is already linked to this Sales Order.'
                    });
                    return;
                }

                dialog.confirm({
                    title: 'Confirmation',
                    message: 'Do you want to create a Purchase Requisition?'
                }).then(function (_confirmed) {
                    if (!_confirmed) return;

                    const _suiteletUrl = url.resolveScript({
                        scriptId: 'customscript_pd_cso_purchase_requ_st',
                        deploymentId: 'customdeploy_pd_cso_purchase_requ_st',
                        params: { salesOrderId: _idSalesOrder }
                    });

                    return fetch(_suiteletUrl, { method: 'GET' })
                        .then(function (_response) {
                            return _response.json();
                        })
                        .then(function (_body) {
                            if (_body.success === true) {
                                return dialog.alert({
                                    title: 'Success',
                                    message: 'Purchase Requisition created successfully.'
                                }).then(function () {
                                    window.location.reload();
                                });
                            }

                            dialog.alert({
                                title: 'Error',
                                message: _body.message || 'Error creating Purchase Requisition.'
                            });
                        });

                }).catch(function (_error) {
                    log.error({ title: 'createPurchaseRequisition - confirm/fetch error', details: JSON.stringify(_error) });
                    dialog.alert({
                        title: 'Error',
                        message: 'An unexpected error occurred.'
                    });
                });

            } catch (_error) {
                log.error({ title: 'createPurchaseRequisition - outer catch', details: JSON.stringify(_error) });
                dialog.alert({
                    title: 'Error',
                    message: 'An error occurred while creating the Purchase Requisition.'
                });
            }
        }

        function pageInit(context) {
            log.audit({ title: 'CS pageInit', details: 'executed' });
        }

        return {
            pageInit: pageInit,
            createPurchaseRequisition: createPurchaseRequisition
        }
    }
);