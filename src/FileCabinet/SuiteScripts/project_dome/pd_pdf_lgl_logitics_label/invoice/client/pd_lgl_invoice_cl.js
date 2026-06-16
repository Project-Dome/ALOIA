/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define([
        "N/url",

        "../../modules/pd_lgl_contants_module"
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

        function printShippingLabel(parameters) {

            try {

                const suiteletUrl = url.resolveScript({
                    scriptId: cts.CUSTOM_SCRIPT.SUITELET.PRINT_LOG_LABEL.ID,
                    deploymentId:  cts.CUSTOM_SCRIPT.SUITELET.PRINT_LOG_LABEL.DEPLOY,
                    params: {
                        salesorderid: parameters
                    }
                });

                window.open(suiteletUrl, "_blank");

            } catch (e) {
                console.error({
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
            printShippingLabel: printShippingLabel
        };

    });
