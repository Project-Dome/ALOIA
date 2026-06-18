/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */
define([
        "N/scriptTypes/restlet",
        "N/record",

        "../../modules/pd_frf_search_module"
    ],

    (restlet, record, searchModule) => {
        /**
         * Defines the function that is executed when a GET request is sent to a RESTlet.
         * @param {Object} requestParams - Parameters from HTTP request URL; parameters passed as an Object (for all supported
         *     content types)
         * @returns {string | Object} HTTP response body; returns a string when request Content-Type is 'text/plain'; returns an
         *     Object when request Content-Type is 'application/json' or 'application/xml'
         * @since 2015.2
         */
        const get = (requestParams) => {

            try {

                const {
                    itemReceiptId
                } = requestParams;

                if (!itemReceiptId) throw new Error("Item Receipt ID is required");

                fillItemReceiptFields(itemReceiptId);

                return restlet.createResponse({
                    content: JSON.stringify({sucesso: true}),
                    contentType: 'application/json'
                });

            } catch (e) {

                log.error({
                    title: "ERROR IN - get",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });

                return restlet.createResponse({
                    content: JSON.stringify({message: e.message}),
                    contentType: 'application/json'
                });

            }

        }

        const fillItemReceiptFields = (newRecordId) => {

            const newRecord = record.load({
                type: record.Type.ITEM_RECEIPT,
                id: newRecordId
            });

            const inboundShipment = newRecord.getValue({
                fieldId: "inboundshipment"
            });

            if (!inboundShipment) return null;

            const inboundShipmentData = searchModule.getInboundShipmentData(inboundShipment);

            log.debug({
                title: "INBOUND SHIPMENT DATA",
                details: inboundShipmentData
            })

            const lineCount = newRecord.getLineCount({
                sublistId: "item"
            });

            for (let index = 0; index < lineCount; index++) {

                let thisItem = newRecord.getSublistValue({
                    sublistId: "item",
                    fieldId: "item",
                    line: index
                });

                let dateOfManufacture = inboundShipmentData.lines
                    .filter(function (line) {
                        return line.item === thisItem;
                    })
                    .map(function (line) {
                        return line.dateOfManufacture;
                    })[0];

                newRecord.setSublistValue({
                    sublistId: "item",
                    fieldId: "custcol_pd_mir_manu_date_ts",
                    line: index,
                    value: dateOfManufacture
                });

            }

            newRecord.setValue({
                fieldId: "custbody_wr",
                value: inboundShipmentData.wrCode
            });

            newRecord.save({
                ignoreMandatoryFields: true
            });

        }

        return {get}

    });
