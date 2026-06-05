/**
 * @NApiVersion 2.1
 */
define([],

    () => {

        return {
            CUSTOM_RECORD: {
                BANK_LAYOUT_CONVERSION: {
                    ID: "customrecord_pd_blc_bank_lay_convert",
                    FIELDS: {
                        BANK_STATEMENT: "custrecord_blc_bank_file_dc",
                        CONVERTED_FILE: "custrecord_blc_converted_file_dc",
                        STATUS: "custrecord_blc_status_ls",
                        ERROR_MESSAGE: "custrecord_blc_error_message_ds"
                    }
                }
            },
            CUSTOM_LIST: {
                LAYOUT_CONVERSION_STATUS: {
                    ID: "customlist_pd_blc_convert_status",
                    VALUES: {
                        PENDING: 1,
                        PROCESSED: 2,
                        ERROR: 3
                    }
                }
            },
            CUSTOM_SCRIPT: {
                USEREVENT: {
                    ID: "customscript_pd_blc_convt_bank_layout_ue",
                    DEPLOY: "customdeploy_pd_blc_convt_bank_layout_ue",
                    PARAMS: {
                        FOLDER_ID: "custscript_pd_blc_convet_files_folder_nu"
                    }
                }
            }
        }

    });
