;/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([
        "N/record",
        "N/config",

        "../../modules/pd_blc_constants_module",
        "../services/pd_blc_bank_layout_record_service"
    ],

    (record, config, cts, bank_layout_service) => {

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

            const {
                newRecord,
                type
            } = scriptContext;

            const values = {}

            try {

                if (type === scriptContext.UserEventType.CREATE) converStatementToNetsuite(newRecord, values);

                if (Object.keys(values).length > 0) record.submitFields({
                    id: newRecord.id,
                    type: newRecord.type,
                    values: values
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

        const converStatementToNetsuite = (newRecord, values) => {

            try {

                const fileConverted = newRecord.getValue({
                    fieldId: cts.CUSTOM_RECORD.BANK_LAYOUT_CONVERSION.FIELDS.CONVERTED_FILE
                });

                if (fileConverted) return null;

                const fileIdToConvert = newRecord.getValue({
                    fieldId: cts.CUSTOM_RECORD.BANK_LAYOUT_CONVERSION.FIELDS.BANK_STATEMENT
                });

                if (!fileIdToConvert) return null;

                const convertStatus = Number(newRecord.getValue({
                    fieldId: cts.CUSTOM_RECORD.BANK_LAYOUT_CONVERSION.FIELDS.STATUS
                }));

                if (convertStatus !== cts.CUSTOM_LIST.LAYOUT_CONVERSION_STATUS.VALUES.PENDING) return null;

                const fileData = bank_layout_service.getStatementFileContents(fileIdToConvert);

                const companyConfigData = config.load({
                    type: config.Type.COMPANY_PREFERENCES
                });

                const statementParsedFolderId = companyConfigData.getValue({
                    fieldId: cts.CUSTOM_SCRIPT.USEREVENT.PARAMS.FOLDER_ID
                });

                if(!statementParsedFolderId) throw new Error("Go to Setup > Company > General Preferences > Custom Preferences and enter the folder where you will store the converted files.");

                const convertedFileId = bank_layout_service.convertStatementToNetsuite(fileData.fileContents, statementParsedFolderId, fileData.fileName);

                if (!convertedFileId) throw new Error("An unexpected error occurred while converting the file.");

                values[cts.CUSTOM_RECORD.BANK_LAYOUT_CONVERSION.FIELDS.CONVERTED_FILE] = convertedFileId;
                values[cts.CUSTOM_RECORD.BANK_LAYOUT_CONVERSION.FIELDS.STATUS] = cts.CUSTOM_LIST.LAYOUT_CONVERSION_STATUS.VALUES.PROCESSED;

            } catch (e) {

                log.error({
                    title: "ERROR IN - converStatementToNetsuite",
                    details: {
                        stack: e.stack,
                        message: e.message
                    }
                });

                values[cts.CUSTOM_RECORD.BANK_LAYOUT_CONVERSION.FIELDS.STATUS] = cts.CUSTOM_LIST.LAYOUT_CONVERSION_STATUS.VALUES.ERROR;
                values[cts.CUSTOM_RECORD.BANK_LAYOUT_CONVERSION.FIELDS.ERROR_MESSAGE] = e.message;

            }

        }

        return {afterSubmit}

    });
