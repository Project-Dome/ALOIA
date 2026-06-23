/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([],

    () => {
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

                if (type !== scriptContext.UserEventType.VIEW) return null;

                form.clientScriptModulePath = "../client/pd_lgl_invoice_cl";

                addPrintShippingLabelButton(newRecord, form);

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

        const addPrintShippingLabelButton = (newRecord, form) => {

            try {

                const createdFrom = newRecord.getValue({fieldId: "createdfrom"});

                form.addButton({
                    id: "custpage_print_shipping_label_btn",
                    label: "PDF | Print Shipping Label",
                    functionName: `printShippingLabel(${JSON.stringify(newRecord.id)})`
                });

            } catch (e) {
                log.error({
                    title: "ERROR IN - addPrintShippingLabelButton",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
            }

        }


        return {beforeLoad}

    });
