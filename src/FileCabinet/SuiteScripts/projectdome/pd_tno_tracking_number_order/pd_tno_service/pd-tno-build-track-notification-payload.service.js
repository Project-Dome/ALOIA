/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @author Rogério Gonçalves Rodrigues
 */

define([], function () {

    function formatDateToMDYYYY(dateObj) {
        if (!dateObj || Object.prototype.toString.call(dateObj) !== '[object Date]') {
            return null;
        }

        var mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        var dd = String(dateObj.getDate()).padStart(2, '0');
        var yyyy = dateObj.getFullYear();

        return mm + '/' + dd + '/' + yyyy;
    }

    function buildPayload(params) {

        var status = params && params.status ? params.status : '';
        var deliveryTo = params && params.deliveryTo ? params.deliveryTo : null;

        // STATUS DATE (data da atualização)

        var statusDate = new Date();

        // ESTIMATED DELIVERY DATE
        // (independente do campo name)
        var estimatedDateObj = null;
        var estimatedDateText = null;

        if (deliveryTo) {
            // deliveryTo esperado: YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
            var dateOnly = String(deliveryTo).split('T')[0];
            var parts = dateOnly.split('-');

            if (parts.length === 3) {
                estimatedDateObj = new Date(
                    parseInt(parts[0], 10),
                    parseInt(parts[1], 10) - 1,
                    parseInt(parts[2], 10)
                );
                estimatedDateText = formatDateToMDYYYY(estimatedDateObj);
            }
        }

        // Fallback: se API não retornar estimated, usa a data da atualização




        // HISTORICAL (texto puro)
        var historicalText = '';

        if (params && params.historicalData) {
            if (typeof params.historicalData === 'string') {
                historicalText = params.historicalData;
            } else if (Array.isArray(params.historicalData)) {
                historicalText = params.historicalData.join('\n\n');
            }
        }

        var payload = {
            custrecord_pd_tno_status: status,
            custrecord_pd_tno_status_date: statusDate,
            custrecord_pd_tno_historical: historicalText
        };

        if (estimatedDateObj) {
            payload.custrecord_pd_tno_estimated_delivery_dat = estimatedDateObj;
        }

        return payload;
    }

    return {
        buildPayload: buildPayload
    };
});