/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */
define(
    [
        'N/log',
        '../pd_iss_service/pd-iss-inbound-shipment.service'
    ],
    function (
        log,
        inbound_shipment_service
    ) {

        function afterSubmit(context) {
            try {

                const _type = context.type;
                const _newRecord = context.newRecord;

                if (!inbound_shipment_service.isValidAction(_type)) return;

                inbound_shipment_service.syncLinesFromPurchaseOrder(_newRecord);

            } catch (_error) {

                log.error({
                    title: 'afterSubmit - error',
                    details: _error
                });
            }
        }

        return {
            afterSubmit: afterSubmit
        };
    }
);
