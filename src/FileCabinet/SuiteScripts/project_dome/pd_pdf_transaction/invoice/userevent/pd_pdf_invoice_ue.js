/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([
        "../../modules/pd_pdf_const_module",
        "../../modules/pd_pdf_search_module"
    ],

    (cts, searchModule) => {
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

                if(scriptContext.UserEventType.VIEW !== type) return null;

                form.clientScriptModulePath = "../client/pd_pdf_invoice_cl";

                addPrintInvoiceButton(newRecord, form);
                addPrintPackListButton(newRecord, form);

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

        function addPrintInvoiceButton(newRecord, form) {

            try {

                form.addButton({
                    id: "custpage_print_invoice_btn",
                    label: "PDF | Print Invoice",
                    functionName: `printInvoice(${JSON.stringify(newRecord.id)})`
                });

            } catch (e) {
                log.error({
                    title: "ERROR IN - addPrintInvoiceButton",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
            }

        }

        function addPrintPackListButton(newRecord, form) {

            try {

                form.addButton({
                    id: "custpage_print_pack_list_btn",
                    label: "PDF | Print Pack List",
                    functionName: `printPackList(${JSON.stringify(newRecord.id)})`
                });

            } catch (e) {
                log.error({
                    title: "ERROR IN - addPrintPackListButton",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
            }

        }

        return {beforeLoad}

    });
