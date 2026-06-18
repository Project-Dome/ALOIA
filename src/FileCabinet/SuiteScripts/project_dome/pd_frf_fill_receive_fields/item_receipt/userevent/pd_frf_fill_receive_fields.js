/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([
        "N/https"
    ],

    ( https) => {

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

                if (type !== scriptContext.UserEventType.CREATE) return null;

                updateItemReceipt(newRecord);

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

        const updateItemReceipt = (newRecord) => {

            const requestRestlet = https.requestRestlet({
                method: https.Method.GET,
                headers: {
                    "Content-Type": "application/json"
                },
                urlParams: {
                    "itemReceiptId": newRecord.id
                },
                scriptId: "customscript_pd_frf_rec_ind_ship_rl",
                deploymentId: "customdeploy_pd_frf_rec_ind_ship_rl"
            });

        }

        return {afterSubmit}

    });
