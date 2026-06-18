/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([
        "N/query",
        "N/record",
        "N/ui/serverWidget",

        "../../modules/pd_frf_search_module"
    ],

    (query, record, serverWidget, searchModule) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {

            try {

                const {
                    newRecord,
                    type,
                    form
                } = scriptContext;

                if (type === scriptContext.UserEventType.EDIT) createFields(newRecord, form);

            } catch (e) {
                log.error({
                    title: "ERROR IN - beforeLoad",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
            }

        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

            try {

                const {
                    newRecord,
                    type
                } = scriptContext;

                if (type === scriptContext.UserEventType.EDIT) fillFields(newRecord);

            } catch (e) {
                log.error({
                    title: "ERROR IN - beforeSubmit",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
            }

        }

        const createFields = (newRecord, form) => {

            form.addField({
                id: "custpage_wr",
                type: serverWidget.FieldType.TEXT,
                label: "WR#"
            });

            const sublist = form.getSublist({id: "receiveitems"});

            const lineField = sublist.addField({
                id: "custpage_date_of_manufacture",
                type: serverWidget.FieldType.DATE,
                label: "Date of Manufacture"
            });

            lineField.updateDisplayType({displayType: serverWidget.FieldDisplayType.ENTRY});


        }

        const fillFields = (newRecord) => {

            const inboundShipment = newRecord.getValue({fieldId: "inboundshipmentnumber"});
            const inboundShipmentId = searchModule.getInboundShipmentId(inboundShipment);

            const linesArr = [];

            const lineCount = newRecord.getLineCount({sublistId: "receiveitems"});

            for (let index = 0; index < lineCount; index++) {

                let item = newRecord.getSublistValue({
                    sublistId: "receiveitems",
                    fieldId: "item",
                    line: index
                });

                let po = newRecord.getSublistValue({
                    sublistId: "receiveitems",
                    fieldId: "purchaseorder",
                    line: index
                });

                let quantity = newRecord.getSublistValue({
                    sublistId: "receiveitems",
                    fieldId: "quantity",
                    line: index
                });

                let dateOfManufacture = newRecord.getSublistValue({
                    sublistId: "receiveitems",
                    fieldId: "custpage_date_of_manufacture",
                    line: index
                });

                linesArr.push({
                    item,
                    po,
                    quantity,
                    dateOfManufacture
                });

            }

            const inboundShipmentRecord = record.load({
                type: record.Type.INBOUND_SHIPMENT,
                id: inboundShipmentId,
                isDynamic: true
            });

            const thisWrCode = newRecord.getValue({
                fieldId: "custpage_wr"
            });

            inboundShipmentRecord.setValue({
                fieldId: "custrecord_wr_2",
                value: thisWrCode
            });

            const lineCountInbound = inboundShipmentRecord.getLineCount({sublistId: "items"});

            for (let index = 0; index < lineCountInbound; index++) {

                inboundShipmentRecord.selectLine({
                    sublistId: "items",
                    line: index
                });

                let thisItem = inboundShipmentRecord.getCurrentSublistValue({
                    sublistId: "items",
                    fieldId: "itemid"
                });

                let thisPo = inboundShipmentRecord.getCurrentSublistValue({
                    sublistId: "items",
                    fieldId: "purchaseorder"
                });

                let thisQuantity = inboundShipmentRecord.getCurrentSublistValue({
                    sublistId: "items",
                    fieldId: "quantityexpectedorig"
                });

                let dateOfManufacture = linesArr
                    .filter(function (line) {
                        return line.item === thisItem && line.quantity === thisQuantity && line.po === thisPo;
                    })
                    .map(function (line) {
                        return line.dateOfManufacture;
                    })[0];

                if (dateOfManufacture) {

                    inboundShipmentRecord.setCurrentSublistValue({
                        sublistId: "items",
                        fieldId: "custrecord_pd_date_manufacturer",
                        value: new Date(dateOfManufacture)
                    });

                    inboundShipmentRecord.commitLine({
                        sublistId: "items"
                    });

                }

            }

            inboundShipmentRecord.save({ignoreMandatoryFields: true});

        }

        return {beforeLoad, beforeSubmit}

    });
