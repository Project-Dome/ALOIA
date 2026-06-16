/**
 * @NApiVersion 2.1
 */
define([
        "N/record"
    ],
    
    (record) => {

        const handler = {}

        handler.getInboundShipmentData = (inboundShipmentId) => {

            const inboundShipment = record.load({
                type: record.Type.INBOUND_SHIPMENT,
                id: inboundShipmentId,
            });

            const lines = []

            const lineCount = inboundShipment.getLineCount({
                sublistId: "items"
            });

            for (let index = 0; index < lineCount; index++) {

                let item = inboundShipment.getSublistValue({
                    sublistId: "items",
                    fieldId: "itemid",
                    line: index
                });

                let quantity = inboundShipment.getSublistValue({
                    sublistId: "items",
                    fieldId: "quantityreceived",
                    line: index
                });

                let dateOfManufacture = inboundShipment.getSublistValue({
                    sublistId: "items",
                    fieldId: "custrecord_pd_date_manufacturer",
                    line: index
                });

                lines.push({
                    item,
                    quantity,
                    dateOfManufacture
                });

            }

            return {
                wrCode: inboundShipment.getValue({
                    fieldId: "custrecord_wr_2"
                }),
                lines
            }

        }

        return handler;

    });
