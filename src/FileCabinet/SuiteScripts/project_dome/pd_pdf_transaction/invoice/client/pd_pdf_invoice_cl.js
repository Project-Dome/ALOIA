/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define([
        "N/url",

        "../../modules/pd_pdf_const_module"
    ],

    function (url, cts) {

        /**
         * Function to be executed after page is initialized.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.currentRecord - Current form record
         * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
         *
         * @since 2015.2
         */
        function pageInit(scriptContext) {

        }

        function printInvoice(parameters) {

            try {

                const suiteletUrl = url.resolveScript({
                    scriptId: cts.CUSTOM_SCRIPT.SUITELET.PRINT_INVOICE.ID,
                    deploymentId: cts.CUSTOM_SCRIPT.SUITELET.PRINT_INVOICE.DEPLOY,
                    params: {
                        invoiceid: parameters
                    }
                });

                window.open(suiteletUrl, "_blank");

            } catch (e) {
                log.error({
                    title: "ERROR IN - onRequest",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
            }

        }

        function printPackList(parameters) {

            try {

                const suiteletUrl = url.resolveScript({
                    scriptId: cts.CUSTOM_SCRIPT.SUITELET.PRINT_PACK_LIST.ID,
                    deploymentId: cts.CUSTOM_SCRIPT.SUITELET.PRINT_PACK_LIST.DEPLOY,
                    params: {
                        invoiceid: parameters
                    }
                });

                window.open(suiteletUrl, "_blank");

            } catch (e) {
                log.error({
                    title: "ERROR IN - onRequest",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });
            }

        }

        return {
            pageInit: pageInit,
            printInvoice: printInvoice,
            printPackList: printPackList
        };

    });
