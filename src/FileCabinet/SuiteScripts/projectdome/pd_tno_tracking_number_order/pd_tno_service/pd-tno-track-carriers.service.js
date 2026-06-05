/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */

define(
    [
        'N/record'
    ],
    function (
        record
    ) {

        function getCarrierCode(idCarrier) {

            const carrierRec = record.load({
                type: 'customrecord_pd_17track_carriers',
                id: idCarrier,
                isDynamic: false
            });

            return carrierRec.getValue({fieldId: 'custrecord_pd_17track_carrier_code' });

        }

        return {
            getCarrierCode: getCarrierCode
        }
    })