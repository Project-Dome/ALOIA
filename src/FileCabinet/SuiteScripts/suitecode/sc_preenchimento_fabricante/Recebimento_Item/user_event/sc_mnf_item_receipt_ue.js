/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([],

    () => {

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

                if(scriptContext.type === scriptContext.UserEventType.DELETE) return true;

                const newRecord = scriptContext.newRecord;

                fillManufacturer(newRecord);

            } catch (e) {
                log.debug({
                    title: "ERROR IN - afterSubmit",
                    details: e
                });
            }
        }

        const fillManufacturer = (newRecord) => {

            const lineCount = newRecord.getLineCount({
                sublistId: "item"
            });

            for (let index = 0; index < lineCount; index++) {

                let sublistSubrecord = newRecord.getSublistSubrecord({
                    sublistId: "item",
                    fieldId: "inventorydetail",
                    line: index
                });

                const subrecordLineCount = sublistSubrecord.getLineCount({
                    sublistId: "inventoryassignment"
                });


                for (let jindex = 0; jindex < subrecordLineCount; jindex++) {
                    
                    log.debug({
                        title: "sublistSubrecord",
                        details: sublistSubrecord.getSublistValue({
                            sublistId: "inventoryassignment",
                            fieldId: "receiptinventorynumber",
                            line: jindex
                        })
                    });

                }

            }

        }

        return {afterSubmit}

    });
