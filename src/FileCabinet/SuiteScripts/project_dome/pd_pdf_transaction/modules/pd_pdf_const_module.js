/**
 * @NApiVersion 2.1
 */
define([],
    
    () => {

        return {
            CUSTOM_FIELDS: {
                TRANSACTIONS: {
                    BODY_FIELDS: {
                        INVOICE_PDF: "custbody_pd_pdf_invoice_pdf_dc"
                    }
                }
            },
            CUSTOM_SCRIPT: {
                SUITELET: {
                    PRINT_INVOICE: {
                        ID: "customscript_pd_pdf_print_invoice_sl",
                        DEPLOY: "customdeploy_pd_pdf_print_invoice_sl"
                    },
                    PRINT_PACK_LIST: {
                        ID: "customscript_pd_pdf_print_pack_list_sl",
                        DEPLOY: "customdeploy_pd_pdf_print_pack_list_sl"
                    }
                }
            }
        }

    });
