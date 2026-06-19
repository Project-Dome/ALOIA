/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define([
        "N/render",
        "N/record",
        "../../modules/pd_lgl_utils_module",
        "../../layout/pd_lgl_log_label_layout"
    ],

    (render, record, utilsMd, logLabelLayout) => {
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
                
                const {
                    parameters
                } = request;

                log.debug({
                    title: "PARAMETERS",
                    details: parameters
                })

                const pdfParameters = utilsMd.getXmlParameters(parameters.invoiceid);

                const html = logLabelLayout.getXml(pdfParameters);

                const renderer = render.create();
                renderer.templateContent = html;

                const pdfFile = renderer.renderAsPdf();

                pdfFile.name = `SHIPPING_LABEL_${formatDate(new Date())}.pdf`;

                response.writeFile({
                    file: pdfFile,
                    isInline: true
                });

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

        function formatDate(date) {
            date = date || new Date();
            const pad = (n) => String(n).padStart(2, '0');

            const MM = pad(date.getMonth() + 1);
            const DD = pad(date.getDate());
            const YYYY = date.getFullYear();
            const HH = pad(date.getHours());
            const MIN = pad(date.getMinutes());

            return `${MM}_${DD}_${YYYY}_${HH}_${MIN}`;
        }

        return {onRequest}

    });
