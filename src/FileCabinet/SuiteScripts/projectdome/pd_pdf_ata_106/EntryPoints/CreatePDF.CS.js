/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * Author: Lucas Monaco (+ segmentação)
 */
define(['N/url','N/currentRecord','N/https'], function (url, currentRecord, https) {

    function pageInit() {}

    function triggerDownload(downloadUrl) {
        window.open(downloadUrl, '_blank');
    }

    function dispatchGroups(invoiceId, scriptId, deploymentId) {
        var planUrl = url.resolveScript({
            scriptId:     scriptId,
            deploymentId: deploymentId,
            returnExternalUrl: false,
            params: { action: 'planGroups', invoiceId: invoiceId }
        });

        var resp   = https.get({ url: planUrl });
        var groups = [];
        try { groups = JSON.parse(resp.body || '{}').groups || []; } catch(e) {}

        if (!groups.length) {
            triggerDownload(buildUrl(invoiceId, '', 'new', scriptId, deploymentId));
            return;
        }

        var delay = 250;
        groups.forEach(function(g, idx) {
            setTimeout(function() {
                triggerDownload(buildUrl(invoiceId, g.vendorId || '', g.group, scriptId, deploymentId));
            }, idx * delay);
        });
    }

    function buildUrl(invoiceId, vendorId, group, scriptId, deploymentId) {
        var params = { invoiceId: invoiceId, group: group };
        if (vendorId) params.vendorId = vendorId;
        return url.resolveScript({
            scriptId:     scriptId,
            deploymentId: deploymentId,
            returnExternalUrl: false,
            params: params
        });
    }

    function printPDF() {
        dispatchGroups(
            currentRecord.get().id,
            'customscript_pd_aae_structurepdfsl',
            'customdeploy_pd_aae_structurepdfsl'
        );
    }

    function printPDFCOFC() {
        dispatchGroups(
            currentRecord.get().id,
            'customscript_pd_aae_cofc_pdf_sl',
            'customdeploy_pd_aae_cofc_pdf_sl'
        );
    }

    return { pageInit: pageInit, printPDF: printPDF, printPDFCOFC: printPDFCOFC };
});