/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define([
        "N/render",
        "N/record",

        "../../layout/pd_pdf_packing_list_layout_module",
        "../../modules/pd_pdf_utils_module"
    ],
    
    (render, record, packingListLayout, utilsMd) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {

            try {

                const {
                    response,
                    request
                } = scriptContext;

                const invoiceRecord = record.load({
                    type: record.Type.INVOICE,
                    id: request.parameters.invoiceid
                });

                const params = utilsMd.manipulateInvoicePdf(invoiceRecord);

                const html = packingListLayout.getXml(params);

                const renderer = render.create();
                renderer.templateContent = html;

                const pdfFile = renderer.renderAsPdf();

                pdfFile.name = `PACK_LIST_${params.invoiceNumber}.pdf`;

                scriptContext.response.writeFile({
                    file: pdfFile,
                    isInline: true
                });


            } catch (e) {
                log.error({
                    title: "ERROR IN - onRequest",
                    details: {
                        stack: e.stack,
                        message: e.message,
                    }
                });
            }

        }

        return {onRequest}

    });
