/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([
        "N/record",

        "../modules/pd_frf_search_module"
    ],

    (record, searchModule) => {

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

            try {

                let {
                    newRecord,
                    type
                } = scriptContext;

                if (type === scriptContext.UserEventType.DELETE) return null;

                newRecord = record.load({
                    type: newRecord.type,
                    id: newRecord.id
                });

                fillItemReceiptFields(newRecord);

                newRecord.save({
                    ignoreMandatoryFields: true
                });

            } catch (e) {
                log.error({
                    title: "ERROR IN - afterSubmit",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
            }

        }

        const fillItemReceiptFields = (newRecord) => {

            try {

                const inboundShipment = newRecord.getValue({
                    fieldId: "inboundshipment"
                });

                if(!inboundShipment) return null;

                const inboundShipmentData = searchModule.getInboundShipmentData(inboundShipment);

                const lineCount = newRecord.getLineCount({
                    sublistId: "item"
                });

                for (let index = 0; index < lineCount; index++) {

                    let thisItem = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        line: index
                    });

                    let thisQuantity = newRecord.getSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        line: index
                    });

                    let dateOfManufacture = inboundShipmentData.lines
                        .filter(function(line) { return line.item === thisItem && line.quantity === thisQuantity; })
                        .map(function(line) { return line.dateOfManufacture; })[0];

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

            } catch (e) {

                log.error({
                    title: "ERROR IN - fillItemReceiptFields",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });

            }

        }

        return {afterSubmit}

    });
